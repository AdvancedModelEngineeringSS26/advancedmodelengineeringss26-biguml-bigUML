/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { ActionMessage, Disposable, GLSPClient, WebviewEndpointOptions } from '@eclipse-glsp/vscode-integration';
import type * as vscode from 'vscode';

export interface VscodeWebviewEndpoint {
    readonly webviewPanel: vscode.WebviewPanel;
    readonly serverActions?: readonly string[];
    readonly clientActions?: readonly string[];
    readonly ready: Promise<void>;
    readonly onActionMessage: vscode.Event<ActionMessage>;
    initialize(glspClient: GLSPClient): Disposable;
    sendMessage(actionMessage: ActionMessage): void;
    dispose(): void;
}

export interface WebviewEndpointFactory {
    create(options: WebviewEndpointOptions): VscodeWebviewEndpoint;
}

export interface WebviewEndpointContribution {
    onEndpointInitialized(endpoint: VscodeWebviewEndpoint): Disposable | void;
}
