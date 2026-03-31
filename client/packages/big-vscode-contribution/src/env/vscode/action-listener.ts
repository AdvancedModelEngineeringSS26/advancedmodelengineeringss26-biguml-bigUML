/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { ActionMessage } from '@eclipse-glsp/vscode-integration';
import { injectable } from 'inversify';
import * as vscode from 'vscode';

@injectable()
export class ActionListener implements vscode.Disposable {
    protected readonly onClientActionEmitter = new vscode.EventEmitter<ActionMessage>();
    readonly onClientAction = this.onClientActionEmitter.event;

    protected readonly onServerActionEmitter = new vscode.EventEmitter<ActionMessage>();
    readonly onServerAction = this.onServerActionEmitter.event;

    protected readonly onVscodeActionEmitter = new vscode.EventEmitter<ActionMessage>();
    readonly onVscodeAction = this.onVscodeActionEmitter.event;

    emitClientAction(message: ActionMessage): void {
        this.onClientActionEmitter.fire(message);
    }

    emitServerAction(message: ActionMessage): void {
        this.onServerActionEmitter.fire(message);
    }

    emitVscodeAction(message: ActionMessage): void {
        this.onVscodeActionEmitter.fire(message);
    }

    dispose(): void {
        this.onClientActionEmitter.dispose();
        this.onServerActionEmitter.dispose();
        this.onVscodeActionEmitter.dispose();
    }
}
