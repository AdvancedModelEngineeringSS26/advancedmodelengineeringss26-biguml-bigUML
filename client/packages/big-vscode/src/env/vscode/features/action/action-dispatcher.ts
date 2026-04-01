/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { TYPES as CONTRIBUTION_TYPES } from '@borkdominik-biguml/big-vscode-contribution';
import type { ActionDispatcher as ContributionActionDispatcher } from '@borkdominik-biguml/big-vscode-contribution/vscode';
import { type Action, type ActionMessage, type Disposable, RequestAction, type ResponseAction } from '@eclipse-glsp/vscode-integration';
import { inject, injectable } from 'inversify';
import { VscodeAction } from '../../../common/vscode.action.js';
import { TYPES } from '../../vscode-common.types.js';
import type { BigGlspVSCodeConnector } from '../connector/glsp-vscode-connector.js';

/**
 * Dispatches actions to the GLSP client/server and handles responses.
 * It is a wrapper around the GLSP connector to simplify the action dispatching process.
 */
@injectable()
export class ActionDispatcher implements Disposable {
    @inject(TYPES.GlspVSCodeConnector)
    protected readonly connector: BigGlspVSCodeConnector;
    @inject(CONTRIBUTION_TYPES.ActionDispatcher)
    protected readonly contributionActionDispatcher: ContributionActionDispatcher;

    /**
     * Dispatches a request action to the GLSP client (server) and returns a promise that resolves with the response action.
     */
    request<Res extends ResponseAction>(action: RequestAction<Res>): Promise<ActionMessage<Res>> {
        if (!action.requestId || action.requestId === '') {
            action.requestId = RequestAction.generateRequestId();
        }
        action.requestId = VscodeAction.prefixRequestId(action.requestId);
        return this.contributionActionDispatcher.request(action);
    }

    /**
     * Dispatches an action to the GLSP client (server).
     * This method will not wait for a response.
     */
    dispatch(action: Action | Action[]): void {
        this.dispatchToClient(undefined, action);
    }

    /**
     * Dispatches an action to a specific GLSP client (server).
     * This method will not wait for a response.
     */
    dispatchToClient(clientId: string | undefined, action: Action | Action[]): void {
        this.contributionActionDispatcher.dispatch(action, clientId);
    }

    /**
     * Broadcasts an action to all GLSP clients (server).
     * This method will not wait for a response.
     */
    broadcast(action: Action): void {
        this.connector.clients.forEach(client => {
            client.webviewEndpoint.sendMessage({
                clientId: client.clientId,
                action: action
            });
        });
    }

    dispose(): void {
        // Delegated state is owned by the contribution action dispatcher.
    }
}
