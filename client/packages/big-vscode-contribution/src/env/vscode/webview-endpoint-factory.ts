/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { WebviewEndpointOptions } from '@eclipse-glsp/vscode-integration';
import { injectable, multiInject, optional } from 'inversify';
import { TYPES } from '../common/types.js';
import type { WebviewEndpointContribution, WebviewEndpointFactory, VscodeWebviewEndpoint } from '../common/webview-endpoint.js';
import { InjectableWebviewEndpoint } from './webview-endpoint.js';

@injectable()
export class DefaultWebviewEndpointFactory implements WebviewEndpointFactory {
    constructor(
        @multiInject(TYPES.WebviewEndpointContribution) @optional()
        protected readonly contributions: WebviewEndpointContribution[] = []
    ) {}

    create(options: WebviewEndpointOptions): VscodeWebviewEndpoint {
        const endpoint = new InjectableWebviewEndpoint(options);
        for (const contribution of this.contributions) {
            endpoint.trackDisposable(contribution.onEndpointInitialized(endpoint));
        }
        return endpoint;
    }
}
