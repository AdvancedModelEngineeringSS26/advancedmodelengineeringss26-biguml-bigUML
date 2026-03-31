/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';
import { TYPES } from '../common/types.js';
import type { ActionDispatcher } from './action-dispatcher.js';
import type { ClientManager } from './client-manager.js';

@injectable()
export class DocumentManager<TDocument extends vscode.CustomDocument = vscode.CustomDocument> {
    protected readonly onDidChangeCustomDocumentEmitter = new vscode.EventEmitter<
        vscode.CustomDocumentEditEvent<TDocument> | vscode.CustomDocumentContentChangeEvent<TDocument>
    >();
    readonly onDidChangeCustomDocument = this.onDidChangeCustomDocumentEmitter.event;

    constructor(
        @inject(TYPES.ClientManager) protected readonly clientManager: ClientManager<TDocument>,
        @inject(TYPES.ActionDispatcher) protected readonly actionDispatcher: ActionDispatcher<TDocument>
    ) {}

    async saveDocument(document: TDocument, _destination?: vscode.Uri): Promise<void> {
        const clientId = this.clientManager.getClientId(document);
        if (!clientId) {
            throw new Error('DocumentManager.saveDocument failed: document is not registered.');
        }

        throw new Error(`DocumentManager.saveDocument is not implemented yet for client: ${clientId}`);
    }

    async revertDocument(document: TDocument, _diagramType: string): Promise<void> {
        const clientId = this.clientManager.getClientId(document);
        if (!clientId) {
            throw new Error('DocumentManager.revertDocument failed: document is not registered.');
        }

        throw new Error(`DocumentManager.revertDocument is not implemented yet for client: ${clientId}`);
    }
}
