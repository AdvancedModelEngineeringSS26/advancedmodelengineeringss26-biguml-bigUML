/*********************************************************************************
 * Copyright (c) 2023 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 *********************************************************************************/
import { TYPES as CONTRIBUTION_TYPES } from '@borkdominik-biguml/big-vscode-contribution';
import type {
    ActionListener as ContributionActionListener,
    ClientManager as ContributionClientManager,
    VscodeConnector as ContributionVscodeConnector
} from '@borkdominik-biguml/big-vscode-contribution/vscode';
import { type Action, ActionMessage, type Args, Disposable, type GlspVscodeClient, type GlspVscodeServer } from '@eclipse-glsp/vscode-integration';
import { inject, injectable } from 'inversify';
import type * as vscode from 'vscode';
import { Messenger } from 'vscode-messenger';
import { VscodeAction } from '../../../common/vscode.action.js';
import { TYPES } from '../../vscode-common.types.js';

@injectable()
export class VscodeHandledActionRegistry {
    protected readonly actionKinds = new Set<string>();

    register(actionKind: string): Disposable {
        this.actionKinds.add(actionKind);
        return Disposable.create(() => {
            this.actionKinds.delete(actionKind);
        });
    }

    has(actionKind: string): boolean {
        return this.actionKinds.has(actionKind);
    }
}

@injectable()
export class BigVscodeMessagePropagationFilter {
    constructor(@inject(VscodeHandledActionRegistry) protected readonly handledActions: VscodeHandledActionRegistry) {}

    filter(message: unknown, origin: 'client' | 'server'): unknown | undefined {
        if (origin !== 'client' || !ActionMessage.is(message)) {
            return message;
        }

        const action = message.action;
        if (VscodeAction.isExtensionOnly(action) || this.handledActions.has(action.kind)) {
            return undefined;
        }

        return message;
    }
}

/**
 * Compatibility facade for the retained `big-vscode` connector surface.
 *
 * Runtime ownership lives in `big-vscode-contribution`. This class only keeps
 * the API that existing packages still resolve through `TYPES.GlspVSCodeConnector`
 * plus a small set of deprecated action-helper members for out-of-scope consumers.
 */
@injectable()
export class BigGlspVSCodeConnector<TDocument extends vscode.CustomDocument = vscode.CustomDocument> implements vscode.Disposable {
    readonly messenger = new Messenger({ ignoreHiddenViews: false });

    constructor(
        @inject(TYPES.GlspServer) protected readonly glspServer: GlspVscodeServer,
        @inject(CONTRIBUTION_TYPES.VscodeConnector)
        protected readonly contributionConnector: ContributionVscodeConnector<TDocument>,
        @inject(CONTRIBUTION_TYPES.ClientManager)
        protected readonly clientManager: ContributionClientManager<TDocument>,
        @inject(CONTRIBUTION_TYPES.ActionListener)
        protected readonly contributionActionListener: ContributionActionListener,
        @inject(VscodeHandledActionRegistry)
        protected readonly handledActions: VscodeHandledActionRegistry
    ) {}

    get documents(): TDocument[] {
        return this.clients.map(client => client.document);
    }

    get clients(): GlspVscodeClient<TDocument>[] {
        return [...this.clientManager.clients];
    }

    get activeClient(): GlspVscodeClient<TDocument> | undefined {
        return this.clientManager.activeClient;
    }

    get onDidRegister(): vscode.Event<GlspVscodeClient<TDocument>> {
        return this.contributionConnector.onDidRegister;
    }

    get onDidDispose(): vscode.Event<GlspVscodeClient<TDocument>> {
        return this.contributionConnector.onDidDispose;
    }

    /**
     * @deprecated Prefer `TYPES.ActionListener` instead.
     */
    get onServerActionMessage(): vscode.Event<any> {
        return this.contributionActionListener.onServerAction;
    }

    /**
     * @deprecated Prefer `TYPES.ActionListener` instead.
     */
    get onClientActionMessage(): vscode.Event<any> {
        return this.contributionActionListener.onClientAction;
    }

    /**
     * @deprecated Prefer `TYPES.ActionListener` instead.
     */
    get onVSCodeActionMessage(): vscode.Event<any> {
        return this.contributionActionListener.onVscodeAction;
    }

    get onDidChangeCustomDocument():
        | vscode.Event<vscode.CustomDocumentEditEvent<TDocument>>
        | vscode.Event<vscode.CustomDocumentContentChangeEvent<TDocument>> {
        return this.contributionConnector.onDidChangeCustomDocument;
    }

    clientIdByDocument(document: TDocument): string | undefined {
        return this.contributionConnector.clientIdByDocument(document);
    }

    async registerClient(client: GlspVscodeClient<TDocument>): Promise<void> {
        await this.contributionConnector.registerClient(client, {
            disposeClientSessionArgs: this.disposeClientSessionArgs(client)
        });
    }

    /**
     * @deprecated Prefer `TYPES.ActionDispatcher` instead.
     */
    sendActionToActiveClient(action: Action): void {
        this.dispatchAction(action);
    }

    /**
     * @deprecated Prefer `TYPES.ActionDispatcher` instead.
     */
    public sendActionToActiveServer(action: Action): void {
        this.clients.forEach(client => {
            if (client.webviewEndpoint.webviewPanel.active) {
                client.webviewEndpoint.sendMessage({
                    clientId: client.clientId,
                    action
                });
            }
        });
    }

    /**
     * @deprecated Prefer `TYPES.ActionDispatcher` instead.
     */
    public sendActionToServer(clientId: string, action: Action): void {
        this.glspServer.onSendToServerEmitter.fire({
            clientId,
            action
        });
    }

    dispatchAction(action: Action, clientId?: string): void {
        const client = clientId ? this.clientManager.getClient(clientId) : this.activeClient;
        if (!client) {
            console.warn('Could not dispatch action: No client found for clientId or no active client found.', action);
            return;
        }

        const dispatched = this.contributionConnector.dispatchAction(action, client.clientId);
        if (!dispatched && this.handledActions.has(action.kind)) {
            this.contributionActionListener.emitVscodeAction({
                clientId: client.clientId,
                action
            });
        } else if (!dispatched) {
            console.warn('Could not dispatch action. No handler found for action kind:', action.kind);
        }
    }

    saveDocument(document: TDocument, destination?: vscode.Uri): Promise<void> {
        return this.contributionConnector.saveDocument(document, destination);
    }

    revertDocument(document: TDocument, diagramType: string): Promise<void> {
        return this.contributionConnector.revertDocument(document, diagramType);
    }

    dispose(): void {
        this.contributionConnector.dispose();
    }

    protected disposeClientSessionArgs(client: GlspVscodeClient<TDocument>): Args | undefined {
        return {
            sourceUri: client.document.uri.path
        };
    }
}
