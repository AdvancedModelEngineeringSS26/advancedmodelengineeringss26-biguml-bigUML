/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { Action, RequestAction, ResponseAction } from '@eclipse-glsp/protocol';
import type { ActionMessage, GlspVscodeServer } from '@eclipse-glsp/vscode-integration';
import { inject, injectable, optional } from 'inversify';
import type * as vscode from 'vscode';
import { TYPES } from '../common/types.js';
import type { ClientManager } from './client-manager.js';

@injectable()
export class ActionDispatcher<TDocument extends vscode.CustomDocument = vscode.CustomDocument> {
    constructor(
        @inject(TYPES.ClientManager) protected readonly clientManager: ClientManager<TDocument>,
        @inject(TYPES.GlspVscodeServer) @optional() protected readonly server?: GlspVscodeServer
    ) {}

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
        _clientId?: string
    ): Promise<ActionMessage<TResponse>> {
        throw new Error(`ActionDispatcher.request is not implemented yet for action kind: ${action.kind}`);
    }
}
