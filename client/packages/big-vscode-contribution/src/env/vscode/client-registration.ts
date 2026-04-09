/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { Disposable, GlspVscodeClient } from '@eclipse-glsp/vscode-integration';
import type * as vscode from 'vscode';

/**
 * Contribution point for consumer-side client initialization that should run
 * after the contribution-native connector has registered and initialized a
 * client session.
 */
export interface ClientRegistrationContribution<TDocument extends vscode.CustomDocument = vscode.CustomDocument> {
    onClientRegistered(client: GlspVscodeClient<TDocument>): Disposable | void;
}
