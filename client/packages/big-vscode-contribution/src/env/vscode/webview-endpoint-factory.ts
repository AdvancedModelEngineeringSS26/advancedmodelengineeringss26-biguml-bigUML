/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { WebviewEndpointOptions } from '@eclipse-glsp/vscode-integration';
import { injectable } from 'inversify';
import type { WebviewEndpointFactory, VscodeWebviewEndpoint } from '../common/webview-endpoint.js';
import { InjectableWebviewEndpoint } from './webview-endpoint.js';

@injectable()
export class DefaultWebviewEndpointFactory implements WebviewEndpointFactory {
    create(options: WebviewEndpointOptions): VscodeWebviewEndpoint {
        // Phase 1 scaffold: replace direct construction with a child-container factory in Phase 5.
        return new InjectableWebviewEndpoint(options);
    }
}
