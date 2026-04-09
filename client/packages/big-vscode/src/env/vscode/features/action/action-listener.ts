/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { TYPES as CONTRIBUTION_TYPES } from '@borkdominik-biguml/big-vscode-contribution';
import type { ActionListener as ContributionActionListener } from '@borkdominik-biguml/big-vscode-contribution/vscode';
import {
    ActionRequestHandlerRegistry as ContributionActionRequestHandlerRegistry,
    type CacheActionListener as ContributionCacheActionListener
} from '@borkdominik-biguml/big-vscode-contribution/vscode';
import type { InferResponseType } from '@borkdominik-biguml/uml-glsp-server';
import {
    type ActionMessage,
    type Disposable,
    type MaybePromise,
    type RequestAction,
    type ResponseAction
} from '@eclipse-glsp/vscode-integration';
import { inject, injectable } from 'inversify';

/**
 * Compatibility adapter over the contribution-native action listener services.
 *
 * @deprecated Deprecated for new connector/runtime code. Retained so frozen
 * first-party packages can continue resolving `TYPES.ActionListener`.
 *
 * New code should inject contribution `ActionListener` for observation and the
 * contribution request-handler registry for request/response flows.
 *
 * See `client/docs/feature1/compatibility-layer.md`.
 *
 * `big-vscode` retains this wrapper so existing packages can keep resolving
 * `TYPES.ActionListener` while request handling and action observation are owned
 * by `big-vscode-contribution`.
 */
@injectable()
export class ActionListener implements Disposable {
    @inject(CONTRIBUTION_TYPES.ActionListener)
    protected readonly contributionActionListener: ContributionActionListener;
    @inject(ContributionActionRequestHandlerRegistry)
    protected readonly requestHandlerRegistry: ContributionActionRequestHandlerRegistry;

    dispose(): void {
        // Delegated state is owned by contribution services.
    }

    registerListener(callback: (action: ActionMessage) => void): Disposable {
        return this.contributionActionListener.registerListener(callback);
    }

    registerServerListener(callback: (action: ActionMessage) => void): Disposable {
        return this.contributionActionListener.registerServerListener(callback);
    }

    registerVSCodeListener(callback: (action: ActionMessage) => void): Disposable {
        return this.contributionActionListener.registerVSCodeListener(callback);
    }

    handleGLSPRequest<TRequest extends RequestAction<ResponseAction>>(
        kind: TRequest['kind'],
        handler: (action: ActionMessage<TRequest>) => MaybePromise<InferResponseType<TRequest>>
    ): Disposable {
        return this.requestHandlerRegistry.handleGLSPRequest(
            kind,
            handler as (action: ActionMessage<TRequest>) => MaybePromise<ResponseAction>
        );
    }

    handleVSCodeRequest<TRequest extends RequestAction<ResponseAction>>(
        kind: TRequest['kind'],
        handler: (action: ActionMessage<TRequest>) => MaybePromise<InferResponseType<TRequest>>
    ): Disposable {
        return this.requestHandlerRegistry.handleVSCodeRequest(
            kind,
            handler as (action: ActionMessage<TRequest>) => MaybePromise<ResponseAction>
        );
    }

    createCache(cachedActionKinds: string[]): CacheActionListener {
        return new CacheActionListener(this.contributionActionListener.createCache(cachedActionKinds));
    }
}

export class CacheActionListener implements Disposable {
    constructor(protected readonly delegate: ContributionCacheActionListener) {}

    get onDidChange() {
        return this.delegate.onDidChange;
    }

    getAction(kind: string): ActionMessage | undefined {
        return this.delegate.getAction(kind);
    }

    getActions(): ActionMessage[] {
        return this.delegate.getActions();
    }

    dispose(): void {
        this.delegate.dispose();
    }
}
