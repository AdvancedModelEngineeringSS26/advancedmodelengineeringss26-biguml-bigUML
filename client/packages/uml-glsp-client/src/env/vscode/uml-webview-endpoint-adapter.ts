/*********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 *********************************************************************************/

import type { VscodeWebviewEndpoint } from '@borkdominik-biguml/big-vscode-contribution';
import { InjectableWebviewEndpoint } from '@borkdominik-biguml/big-vscode-contribution/vscode';
import type { ActionMessage, Disposable, GLSPClient } from '@eclipse-glsp/vscode-integration';
import type { Event, WebviewPanel } from 'vscode';
import type { Messenger } from 'vscode-messenger';
import type { MessageParticipant } from 'vscode-messenger-common';

// Backward compatibility adapter:
// the UML editor still reuses the messenger participant directly until provider messaging
// is migrated to generic endpoint abstractions in a later cleanup phase.
export class UmlWebviewEndpointAdapter implements Disposable {
    readonly messenger: Messenger;
    readonly messageParticipant: MessageParticipant;
    readonly webviewPanel: WebviewPanel;

    constructor(protected readonly endpoint: VscodeWebviewEndpoint) {
        if (!(endpoint instanceof InjectableWebviewEndpoint)) {
            throw new Error('UmlWebviewEndpointAdapter requires a messenger-backed InjectableWebviewEndpoint.');
        }

        this.messenger = endpoint.messenger;
        this.messageParticipant = endpoint.messageParticipant;
        this.webviewPanel = endpoint.webviewPanel;
    }

    get onActionMessage(): Event<ActionMessage> {
        return this.endpoint.onActionMessage;
    }

    get serverActions(): string[] | undefined {
        return this.endpoint.serverActions ? [...this.endpoint.serverActions] : undefined;
    }

    get clientActions(): string[] | undefined {
        return this.endpoint.clientActions ? [...this.endpoint.clientActions] : undefined;
    }

    get ready(): Promise<void> {
        return this.endpoint.ready;
    }

    initialize(glspClient: GLSPClient): Disposable {
        return this.endpoint.initialize(glspClient);
    }

    sendMessage(actionMessage: ActionMessage): void {
        this.endpoint.sendMessage(actionMessage);
    }

    dispose(): void {
        this.endpoint.dispose();
    }
}
