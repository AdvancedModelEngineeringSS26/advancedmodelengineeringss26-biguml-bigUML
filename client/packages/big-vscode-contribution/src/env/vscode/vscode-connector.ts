/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { Action } from '@eclipse-glsp/protocol';
import { ActionMessage } from '@eclipse-glsp/vscode-integration';
import type { GlspVscodeClient } from '@eclipse-glsp/vscode-integration';
import { inject, injectable } from 'inversify';
import type * as vscode from 'vscode';
import type { MessageOrigin, MessageProcessingResult } from '../common/message-routing.js';
import { TYPES } from '../common/types.js';
import type { ActionDispatcher } from './action-dispatcher.js';
import type { ActionRouter } from './action-router.js';
import type { ClientManager } from './client-manager.js';
import type { DocumentManager } from './document-manager.js';

@injectable()
export class VscodeConnector<TDocument extends vscode.CustomDocument = vscode.CustomDocument> {
    constructor(
        @inject(TYPES.ClientManager) protected readonly clientManager: ClientManager<TDocument>,
        @inject(TYPES.ActionRouter) protected readonly actionRouter: ActionRouter<TDocument>,
        @inject(TYPES.ActionDispatcher) protected readonly actionDispatcher: ActionDispatcher<TDocument>,
        @inject(TYPES.DocumentManager) protected readonly documentManager: DocumentManager<TDocument>
    ) {}

    get clients(): readonly GlspVscodeClient<TDocument>[] {
        return this.clientManager.clients;
    }

    get activeClient(): GlspVscodeClient<TDocument> | undefined {
        return this.clientManager.activeClient;
    }

    async registerClient(client: GlspVscodeClient<TDocument>): Promise<void> {
        this.clientManager.register(client);
    }

    dispatchAction(action: Action, clientId?: string): void {
        this.actionDispatcher.dispatch(action, clientId);
    }

    processMessage(message: unknown, origin: MessageOrigin): MessageProcessingResult {
        const client = ActionMessage.is(message) ? this.clientManager.getClient(message.clientId) : undefined;
        return this.actionRouter.processMessage(message, client, origin);
    }

    saveDocument(document: TDocument, destination?: vscode.Uri): Promise<void> {
        return this.documentManager.saveDocument(document, destination);
    }

    revertDocument(document: TDocument, diagramType: string): Promise<void> {
        return this.documentManager.revertDocument(document, diagramType);
    }
}
