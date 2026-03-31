/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import {
    ActionMessageNotification,
    ClientStateChangeNotification,
    Deferred,
    DisposableCollection,
    DisposeClientSessionRequest,
    InitializeClientSessionRequest,
    InitializeNotification,
    InitializeServerRequest,
    type ActionMessage,
    type Disposable,
    type GLSPClient,
    type GLSPDiagramIdentifier,
    type WebviewEndpointOptions,
    WebviewReadyNotification,
    ShutdownServerNotification,
    StartRequest,
    StopRequest
} from '@eclipse-glsp/vscode-integration';
import { injectable } from 'inversify';
import * as vscode from 'vscode';
import { Messenger } from 'vscode-messenger';
import type { MessageParticipant } from 'vscode-messenger-common';
import type { VscodeWebviewEndpoint } from '../common/webview-endpoint.js';

@injectable()
export class InjectableWebviewEndpoint implements VscodeWebviewEndpoint {
    readonly webviewPanel: vscode.WebviewPanel;
    readonly messenger: Messenger;
    readonly messageParticipant: MessageParticipant;
    readonly diagramIdentifier: GLSPDiagramIdentifier;

    protected readonly onActionMessageEmitter = new vscode.EventEmitter<ActionMessage>();
    readonly onActionMessage = this.onActionMessageEmitter.event;
    protected readonly readyDeferred = new Deferred<void>();
    protected readonly toDispose = new DisposableCollection();

    protected serverActionKinds?: readonly string[];
    protected clientActionKinds?: readonly string[];

    constructor(protected readonly options: WebviewEndpointOptions) {
        this.webviewPanel = options.webviewPanel;
        this.messenger = options.messenger ?? new Messenger();
        this.diagramIdentifier = options.diagramIdentifier;
        this.messageParticipant = this.messenger.registerWebviewPanel(this.webviewPanel);

        this.toDispose.push(
            this.webviewPanel.onDidDispose(() => {
                this.dispose();
            }),
            this.messenger.onNotification(
                WebviewReadyNotification,
                () => {
                    if (this.readyDeferred.state === 'resolved') {
                        void this.sendDiagramIdentifier();
                    } else {
                        this.readyDeferred.resolve();
                    }
                },
                {
                    sender: this.messageParticipant
                }
            ),
            this.onActionMessageEmitter
        );
    }

    get ready(): Promise<void> {
        return this.readyDeferred.promise;
    }

    get serverActions(): readonly string[] | undefined {
        return this.serverActionKinds;
    }

    get clientActions(): readonly string[] | undefined {
        return this.clientActionKinds;
    }

    initialize(glspClient: GLSPClient): Disposable {
        const endpointDisposables = new DisposableCollection();
        endpointDisposables.push(
            this.messenger.onNotification(
                ActionMessageNotification,
                message => {
                    this.onActionMessageEmitter.fire(message);
                },
                {
                    sender: this.messageParticipant
                }
            ),
            this.messenger.onRequest(StartRequest, () => glspClient.start(), { sender: this.messageParticipant }),
            this.messenger.onRequest(
                InitializeServerRequest,
                async params => {
                    const result = await glspClient.initializeServer(params);
                    if (!this.serverActionKinds) {
                        this.serverActionKinds = result.serverActions[this.diagramIdentifier.diagramType];
                    }
                    return result;
                },
                {
                    sender: this.messageParticipant
                }
            ),
            this.messenger.onRequest(
                InitializeClientSessionRequest,
                params => {
                    if (!this.clientActionKinds) {
                        this.clientActionKinds = params.clientActionKinds;
                    }
                    glspClient.initializeClientSession(params);
                },
                {
                    sender: this.messageParticipant
                }
            ),
            this.messenger.onRequest(DisposeClientSessionRequest, params => glspClient.disposeClientSession(params), {
                sender: this.messageParticipant
            }),
            this.messenger.onRequest(ShutdownServerNotification, () => glspClient.shutdownServer(), {
                sender: this.messageParticipant
            }),
            this.messenger.onRequest(StopRequest, () => glspClient.stop(), {
                sender: this.messageParticipant
            }),
            glspClient.onCurrentStateChanged(state =>
                this.messenger.sendNotification(ClientStateChangeNotification, this.messageParticipant, state)
            )
        );

        this.toDispose.push(endpointDisposables);
        void this.sendDiagramIdentifier();
        return endpointDisposables;
    }

    sendMessage(actionMessage: ActionMessage): void {
        this.messenger.sendNotification(ActionMessageNotification, this.messageParticipant, actionMessage);
    }

    trackDisposable(disposable: Disposable | void): void {
        if (disposable) {
            this.toDispose.push(disposable);
        }
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected async sendDiagramIdentifier(): Promise<void> {
        await this.ready;
        this.messenger.sendNotification(InitializeNotification, this.messageParticipant, this.diagramIdentifier);
    }
}
