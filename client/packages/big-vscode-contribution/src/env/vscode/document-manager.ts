/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { RequestModelAction, SaveModelAction } from '@eclipse-glsp/protocol';
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
    protected readonly onDidDocumentSavedEmitter = new vscode.EventEmitter<TDocument>();
    readonly onDidChangeCustomDocument = this.onDidChangeCustomDocumentEmitter.event;

    constructor(
        @inject(TYPES.ClientManager) protected readonly clientManager: ClientManager<TDocument>,
        @inject(TYPES.ActionDispatcher) protected readonly actionDispatcher: ActionDispatcher<TDocument>
    ) {}

    notifyDocumentSaved(document: TDocument): void {
        this.onDidDocumentSavedEmitter.fire(document);
    }

    notifyDocumentEdit(event: vscode.CustomDocumentEditEvent<TDocument>): void {
        this.onDidChangeCustomDocumentEmitter.fire(event);
    }

    notifyDocumentChange(document: TDocument): void {
        this.onDidChangeCustomDocumentEmitter.fire({ document });
    }

    async saveDocument(document: TDocument, destination?: vscode.Uri): Promise<void> {
        const clientId = this.clientManager.getClientId(document);
        if (!clientId) {
            throw new Error('DocumentManager.saveDocument failed: document is not registered.');
        }

        return new Promise<void>((resolve, reject) => {
            const listener = this.onDidDocumentSavedEmitter.event(savedDocument => {
                if (savedDocument === document) {
                    listener.dispose();
                    resolve();
                }
            });

            const dispatched = this.actionDispatcher.dispatch(SaveModelAction.create({ fileUri: destination?.path }), clientId);
            if (!dispatched) {
                listener.dispose();
                reject(new Error(`DocumentManager.saveDocument failed: could not dispatch save for client ${clientId}.`));
            }
        });
    }

    async revertDocument(document: TDocument, diagramType: string): Promise<void> {
        const clientId = this.clientManager.getClientId(document);
        if (!clientId) {
            throw new Error('DocumentManager.revertDocument failed: document is not registered.');
        }

        const client = this.clientManager.getClient(clientId);
        if (!client) {
            throw new Error(`DocumentManager.revertDocument failed: client ${clientId} is not registered.`);
        }

        if (!client.webviewEndpoint.webviewPanel.active) {
            return;
        }

        const dispatched = this.actionDispatcher.dispatch(
            RequestModelAction.create({
                options: {
                    sourceUri: document.uri.toString(),
                    diagramType
                }
            }),
            clientId
        );

        if (!dispatched) {
            throw new Error(`DocumentManager.revertDocument failed: could not dispatch revert for client ${clientId}.`);
        }
    }
}
