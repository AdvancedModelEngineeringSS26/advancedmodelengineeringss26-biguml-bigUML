/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { RequestModelAction, SaveModelAction } from '@eclipse-glsp/protocol';
import { Deferred } from '@eclipse-glsp/vscode-integration';
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';
import { TYPES } from '../common/types.js';
import type { ActionDispatcher } from './action-dispatcher.js';
import type { ClientManager } from './client-manager.js';

@injectable()
export class DocumentManager<TDocument extends vscode.CustomDocument = vscode.CustomDocument> {
    protected static readonly SAVE_TIMEOUT_MS = 10_000;

    protected readonly onDidChangeCustomDocumentEmitter = new vscode.EventEmitter<
        vscode.CustomDocumentEditEvent<TDocument> | vscode.CustomDocumentContentChangeEvent<TDocument>
    >();
    protected readonly pendingSaves = new Map<string, Deferred<void>>();
    readonly onDidChangeCustomDocument = this.onDidChangeCustomDocumentEmitter.event;

    /**
     * Contribution-native owner of custom document lifecycle coordination. This
     * replaces save/revert orchestration that previously lived on the connector.
     */

    constructor(
        @inject(TYPES.ClientManager) protected readonly clientManager: ClientManager<TDocument>,
        @inject(TYPES.ActionDispatcher) protected readonly actionDispatcher: ActionDispatcher<TDocument>
    ) {}

    notifyDocumentSaved(clientId: string, _document: TDocument): void {
        const pendingSave = this.pendingSaves.get(clientId);
        if (!pendingSave) {
            return;
        }

        this.pendingSaves.delete(clientId);
        pendingSave.resolve();
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

        if (this.pendingSaves.has(clientId)) {
            throw new Error(`DocumentManager.saveDocument failed: save already pending for client ${clientId}.`);
        }

        const deferred = new Deferred<void>();
        this.pendingSaves.set(clientId, deferred);

        const dispatched = this.actionDispatcher.dispatch(SaveModelAction.create({ fileUri: destination?.path }), clientId);
        if (!dispatched) {
            this.pendingSaves.delete(clientId);
            throw new Error(`DocumentManager.saveDocument failed: could not dispatch save for client ${clientId}.`);
        }

        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        try {
            await new Promise<void>((resolve, reject) => {
                timeoutHandle = setTimeout(() => {
                    this.pendingSaves.delete(clientId);
                    reject(new Error(`DocumentManager.saveDocument failed: timed out waiting for save completion for client ${clientId}.`));
                }, DocumentManager.SAVE_TIMEOUT_MS);

                deferred.promise.then(resolve, reject);
            });
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
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
