/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { RequestAction, ResponseAction, type Action } from '@eclipse-glsp/protocol';
import { Deferred, DisposableCollection, type ActionMessage, type GlspVscodeServer } from '@eclipse-glsp/vscode-integration';
import { inject, injectable, optional } from 'inversify';
import type * as vscode from 'vscode';
import { TYPES } from '../common/types.js';
import type { ClientManager } from './client-manager.js';
import type { ActionListener } from './action-listener.js';

@injectable()
export class ActionDispatcher<TDocument extends vscode.CustomDocument = vscode.CustomDocument> implements vscode.Disposable {
    protected readonly requests = new Map<string, Deferred<ActionMessage<any>>>();
    protected readonly toDispose = new DisposableCollection();

    constructor(
        @inject(TYPES.ClientManager) protected readonly clientManager: ClientManager<TDocument>,
        @inject(TYPES.ActionListener) protected readonly actionListener: ActionListener,
        @inject(TYPES.GlspVscodeServer) @optional() protected readonly server?: GlspVscodeServer
    ) {
        this.toDispose.push(
            this.actionListener.onClientAction(message => this.onActionMessage(message)),
            this.actionListener.onServerAction(message => this.onActionMessage(message))
        );
    }

    dispatch(actionOrActions: Action | readonly Action[], clientId?: string): boolean {
        if (Array.isArray(actionOrActions)) {
            return actionOrActions.reduce((dispatched, currentAction) => this.dispatch(currentAction, clientId) || dispatched, false);
        }

        const client = clientId ? this.clientManager.getClient(clientId) : this.clientManager.activeClient;
        if (!client) {
            console.warn('ActionDispatcher.dispatch skipped: no active or matching client found.', actionOrActions);
            return false;
        }

        const action = actionOrActions as Action;
        const message = {
            clientId: client.clientId,
            action
        };
        let dispatched = false;

        if (client.webviewEndpoint.clientActions?.includes(action.kind)) {
            client.webviewEndpoint.sendMessage(message as ActionMessage);
            dispatched = true;
        }

        if (client.webviewEndpoint.serverActions?.includes(action.kind)) {
            this.server?.onSendToServerEmitter.fire(message);
            dispatched = true;
        }

        return dispatched;
    }

    async request<TResponse extends ResponseAction>(
        action: RequestAction<TResponse>,
        clientId?: string
    ): Promise<ActionMessage<TResponse>> {
        if (!action.requestId || action.requestId === '') {
            action.requestId = RequestAction.generateRequestId();
        }

        const deferred = new Deferred<ActionMessage<TResponse>>();
        this.requests.set(action.requestId, deferred as unknown as Deferred<ActionMessage<any>>);

        const dispatched = this.dispatch(action, clientId);
        if (!dispatched) {
            this.requests.delete(action.requestId);
            throw new Error(`ActionDispatcher.request failed: could not dispatch request action ${action.kind}.`);
        }

        return deferred.promise;
    }

    dispose(): void {
        this.toDispose.dispose();
        this.requests.clear();
    }

    protected onActionMessage(message: ActionMessage): void {
        if (!ResponseAction.is(message.action)) {
            return;
        }

        const deferred = this.requests.get(message.action.responseId);
        if (deferred) {
            this.requests.delete(message.action.responseId);
            deferred.resolve(message);
        }
    }
}
