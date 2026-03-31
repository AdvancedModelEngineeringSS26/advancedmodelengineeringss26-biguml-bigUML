/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { ActionMessage, GlspVscodeClient } from '@eclipse-glsp/vscode-integration';
import { injectable } from 'inversify';
import * as vscode from 'vscode';
import type { VscodeActionHandler } from '../common/action-handler.js';
import type { MessageOrigin, MessageProcessingResult } from '../common/message-routing.js';
import { unchangedMessage } from '../common/message-routing.js';

@injectable()
export class DiagnosticsHandler<TDocument extends vscode.CustomDocument = vscode.CustomDocument>
    implements VscodeActionHandler<TDocument>, vscode.Disposable
{
    // Phase 1 scaffold: exact action kind wiring and diagnostics lifecycle move in Phase 4.
    readonly actionKinds: readonly string[] = [];

    protected readonly diagnostics = vscode.languages.createDiagnosticCollection();

    handle(
        message: ActionMessage,
        _client: GlspVscodeClient<TDocument> | undefined,
        _origin: MessageOrigin
    ): MessageProcessingResult {
        return unchangedMessage(message);
    }

    dispose(): void {
        this.diagnostics.dispose();
    }
}
