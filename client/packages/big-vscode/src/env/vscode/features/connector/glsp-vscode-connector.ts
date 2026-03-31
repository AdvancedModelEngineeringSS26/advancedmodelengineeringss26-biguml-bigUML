/*********************************************************************************
 * Copyright (c) 2023 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 *********************************************************************************/
import { TYPES as CONTRIBUTION_TYPES, type MessageOrigin as ContributionMessageOrigin } from '@borkdominik-biguml/big-vscode-contribution';
import type {
    ActionDispatcher as ContributionActionDispatcher,
    ActionListener as ContributionActionListener,
    ActionRouter as ContributionActionRouter,
    ClientManager as ContributionClientManager,
    DocumentManager as ContributionDocumentManager
} from '@borkdominik-biguml/big-vscode-contribution/vscode';
import {
    type Action,
    ActionMessage,
    type Args,
    Disposable,
    type GlspVscodeClient,
    GlspVscodeConnector,
    type GlspVscodeServer,
    MessageOrigin,
    type MessageProcessingResult
} from '@eclipse-glsp/vscode-integration';
import { inject, injectable } from 'inversify';
import type * as vscode from 'vscode';
import { VscodeAction } from '../../../common/vscode.action.js';
import { TYPES } from '../../vscode-common.types.js';

/**
 * The `Connector` acts as the bridge between GLSP-Clients and the GLSP-Server
 * and is at the core of the Glsp-VSCode integration.
 *
 * It works by being providing a server that implements the `GlspVscodeServer`
 * interface and registering clients using the `GlspVscodeConnector.registerClient`
 * function. Messages sent between the clients and the server are then intercepted
 * by the connector to provide functionality based on the content of the messages.
 *
 * Messages can be intercepted using the interceptor properties in the options
 * argument.
 *
 * Please use the respective wrappers instead of using this class directly.
 */
@injectable()
export class BigGlspVSCodeConnector<
    TDocument extends vscode.CustomDocument = vscode.CustomDocument
> extends GlspVscodeConnector<TDocument> {
    protected readonly vscodeHandledActions = new Set<string>();

    constructor(
        @inject(TYPES.GlspServer) glspServer: GlspVscodeServer,
        @inject(CONTRIBUTION_TYPES.ClientManager)
        protected readonly clientManager: ContributionClientManager<TDocument>,
        @inject(CONTRIBUTION_TYPES.ActionListener)
        protected readonly contributionActionListener: ContributionActionListener,
        @inject(CONTRIBUTION_TYPES.ActionRouter)
        protected readonly contributionActionRouter: ContributionActionRouter<TDocument>,
        @inject(CONTRIBUTION_TYPES.ActionDispatcher)
        protected readonly contributionActionDispatcher: ContributionActionDispatcher<TDocument>,
        @inject(CONTRIBUTION_TYPES.DocumentManager)
        protected readonly contributionDocumentManager: ContributionDocumentManager<TDocument>
    ) {
        super({
            server: glspServer,
            logging: false,
            onBeforeReceiveMessageFromServer: (message, callback) => {
                callback(message);
            },
            onBeforeReceiveMessageFromClient: (message, callback) => {
                callback(message);
            },
            onBeforePropagateMessageToClient: (_originalMessage, processedMessage, _messageChanged) => {
                return processedMessage;
            },
            onBeforePropagateMessageToServer: (_originalMessage, processedMessage, _messageChanged) => {
                return processedMessage;
            }
        });
    }

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
        return this.clientManager.onDidRegister;
    }

    get onDidDispose(): vscode.Event<GlspVscodeClient<TDocument>> {
        return this.clientManager.onDidDispose;
    }

    get onServerActionMessage(): vscode.Event<ActionMessage> {
        return this.contributionActionListener.onServerAction;
    }

    get onClientActionMessage(): vscode.Event<ActionMessage> {
        return this.contributionActionListener.onClientAction;
    }

    get onVSCodeActionMessage(): vscode.Event<ActionMessage> {
        return this.contributionActionListener.onVscodeAction;
    }

    override get onDidChangeCustomDocument():
        | vscode.Event<vscode.CustomDocumentEditEvent<TDocument>>
        | vscode.Event<vscode.CustomDocumentContentChangeEvent<TDocument>> {
        return this.contributionDocumentManager.onDidChangeCustomDocument;
    }

    registerVscodeHandledAction(actionKind: string): Disposable {
        this.vscodeHandledActions.add(actionKind);
        return Disposable.create(() => {
            this.vscodeHandledActions.delete(actionKind);
        });
    }

    clientIdByDocument(document: TDocument): string | undefined {
        return this.clientManager.getClientId(document);
    }

    public override async registerClient(client: GlspVscodeClient<TDocument>): Promise<void> {
        const toDispose: Disposable[] = [
            Disposable.create(() => {
                this.diagnostics.set(client.document.uri, undefined); // this clears the diagnostics for the file
                this.clientMap.delete(client.clientId);
                this.documentMap.delete(client.document);
                this.clientSelectionMap.delete(client.clientId);
                this.clientProgressMap.get(client.clientId)?.forEach(reporter => reporter.deferred.resolve());
                this.clientProgressMap.delete(client.clientId);
            })
        ];
        this.clientMap.set(client.clientId, client);
        this.documentMap.set(client.document, client.clientId);
        this.clientProgressMap.set(client.clientId, new Map());
        this.clientManager.register(client, { managePanelLifecycle: false });

        // Cleanup when client panel is closed
        const panelOnDisposeListener = client.webviewEndpoint.webviewPanel.onDidDispose(async () => {
            this.onClientDispose(client, toDispose);
            panelOnDisposeListener.dispose();
        });

        toDispose.push(
            client.webviewEndpoint.onActionMessage(message => {
                this.onClientMessage(client, message);
            })
        );

        // Initialize glsp client
        const glspClient = await this.options.server.glspClient;
        toDispose.push(client.webviewEndpoint.initialize(glspClient));
        toDispose.unshift(
            Disposable.create(() =>
                glspClient.disposeClientSession({ clientSessionId: client.clientId, args: this.disposeClientSessionArgs(client) })
            )
        );
    }

    public sendActionToActiveServer(action: Action): void {
        this.clients.forEach(client => {
            if (client.webviewEndpoint.webviewPanel.active) {
                const message = {
                    clientId: client.clientId,
                    action: action
                };
                client.webviewEndpoint.sendMessage(message);
            }
        });
    }

    public sendActionToServer(clientId: string, action: Action): void {
        this.options.server.onSendToServerEmitter.fire({
            clientId,
            action
        });
    }

    override saveDocument(document: TDocument, destination?: vscode.Uri): Promise<void> {
        return this.contributionDocumentManager.saveDocument(document, destination);
    }

    override revertDocument(document: TDocument, diagramType: string): Promise<void> {
        return this.contributionDocumentManager.revertDocument(document, diagramType);
    }

    protected override sendMessageToClient(clientId: string, message: unknown): void {
        const client = this.clientManager.getClient(clientId);
        if (client && ActionMessage.is(message)) {
            client.webviewEndpoint.sendMessage(message);
        }
    }

    override dispatchAction(action: Action, clientId?: string): void {
        const client = clientId ? this.clientManager.getClient(clientId) : this.activeClient;
        if (!client) {
            console.warn('Could not dispatch action: No client found for clientId or no active client found.', action);
            return;
        }
        const message = { clientId: client.clientId, action };
        const dispatched = this.contributionActionDispatcher.dispatch(action, client.clientId);

        if (!dispatched && this.vscodeHandledActions.has(action.kind)) {
            this.contributionActionListener.emitVscodeAction(message);
        } else if (!dispatched) {
            console.warn('Could not dispatch action. No handler found for action kind:', action.kind);
        }
    }

    protected onClientMessage(_client: GlspVscodeClient<TDocument>, message: unknown): void {
        if (this.options.logging) {
            if (ActionMessage.is(message)) {
                console.log(`Client (${message.clientId}): ${message.action.kind}`, message.action);
            } else {
                console.log('Client (no action message):', message);
            }
        }

        // Run message through first user-provided interceptor (pre-receive)
        this.options.onBeforeReceiveMessageFromClient(message, (newMessage, shouldBeProcessedByConnector = true) => {
            const { processedMessage, messageChanged } = shouldBeProcessedByConnector
                ? this.processMessage(newMessage, MessageOrigin.CLIENT)
                : { processedMessage: message, messageChanged: false };

            const filteredMessage = this.options.onBeforePropagateMessageToServer(newMessage, processedMessage, messageChanged);

            if (typeof filteredMessage !== 'undefined') {
                this.options.server.onSendToServerEmitter.fire(filteredMessage);
            }
        });
    }

    protected override processMessage(message: unknown, origin: MessageOrigin): MessageProcessingResult {
        const client = ActionMessage.is(message) ? this.clientManager.getClient(message.clientId) : undefined;
        const composed = this.contributionActionRouter.processMessage(message, client, this.toContributionOrigin(origin));
        if (composed.messageChanged) {
            return composed;
        }

        const processed = super.processMessage(message, origin);

        if (processed.messageChanged) {
            return processed;
        }

        if (
            ActionMessage.is(message) &&
            (VscodeAction.isExtensionOnly(message.action) || this.vscodeHandledActions.has(message.action.kind))
        ) {
            return {
                processedMessage: undefined,
                messageChanged: true
            };
        }

        return { processedMessage: message, messageChanged: false };
    }

    protected onClientDispose(client: GlspVscodeClient<TDocument>, disposables: vscode.Disposable[]): void {
        disposables.forEach(disposable => disposable.dispose());
        this.clientManager.disposeClient(client.clientId);
    }

    protected disposeClientSessionArgs(client: GlspVscodeClient<TDocument>): Args | undefined {
        return {
            ['sourceUri']: client.document.uri.path
        };
    }

    protected toContributionOrigin(origin: MessageOrigin): ContributionMessageOrigin {
        return origin === MessageOrigin.CLIENT ? 'client' : 'server';
    }
}
