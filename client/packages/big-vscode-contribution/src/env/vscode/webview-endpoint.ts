/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { ActionMessage, GLSPClient, WebviewEndpointOptions } from '@eclipse-glsp/vscode-integration';
import { Disposable } from '@eclipse-glsp/vscode-integration';
import { injectable } from 'inversify';
import * as vscode from 'vscode';
import type { VscodeWebviewEndpoint } from '../common/webview-endpoint.js';

@injectable()
export class InjectableWebviewEndpoint implements VscodeWebviewEndpoint {
    protected readonly onActionMessageEmitter = new vscode.EventEmitter<ActionMessage>();
    readonly onActionMessage = this.onActionMessageEmitter.event;

    readonly ready = Promise.resolve();
    readonly serverActions: readonly string[] = [];
    readonly clientActions: readonly string[] = [];
    readonly webviewPanel: vscode.WebviewPanel;

    constructor(protected readonly options: WebviewEndpointOptions) {
        this.webviewPanel = options.webviewPanel;
    }

    initialize(_glspClient: GLSPClient): Disposable {
        return Disposable.create(() => undefined);
    }

    sendMessage(_actionMessage: ActionMessage): void {
        throw new Error('InjectableWebviewEndpoint.sendMessage is not implemented yet.');
    }

    dispose(): void {
        this.onActionMessageEmitter.dispose();
    }
}
