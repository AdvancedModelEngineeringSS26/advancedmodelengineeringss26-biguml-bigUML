/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { ContainerModule } from 'inversify';
import { TYPES } from '../common/types.js';
import { ActionDispatcher } from './action-dispatcher.js';
import { ActionListener } from './action-listener.js';
import { ActionRouter } from './action-router.js';
import { ClientManager } from './client-manager.js';
import { DiagnosticsHandler } from './diagnostics-handler.js';
import { DirtyStateHandler } from './dirty-state-handler.js';
import { DocumentManager } from './document-manager.js';
import { ExportHandler } from './export-handler.js';
import { NavigationHandler } from './navigation-handler.js';
import { ProgressHandler } from './progress-handler.js';
import { SelectionTracker } from './selection-tracker.js';
import { VscodeConnector } from './vscode-connector.js';
import { DefaultWebviewEndpointFactory } from './webview-endpoint-factory.js';

export function createVscodeContributionModule(): ContainerModule {
    return new ContainerModule(bind => {
        bind(TYPES.ClientManager).to(ClientManager).inSingletonScope();
        bind(TYPES.ActionListener).to(ActionListener).inSingletonScope();
        bind(TYPES.ActionRouter).to(ActionRouter).inSingletonScope();
        bind(TYPES.ActionDispatcher).to(ActionDispatcher).inSingletonScope();
        bind(TYPES.SelectionTracker).to(SelectionTracker).inSingletonScope();
        bind(TYPES.DocumentManager).to(DocumentManager).inSingletonScope();
        bind(TYPES.WebviewEndpointFactory).to(DefaultWebviewEndpointFactory).inSingletonScope();
        bind(TYPES.VscodeConnector).to(VscodeConnector).inSingletonScope();

        bind(TYPES.DirtyStateHandler).to(DirtyStateHandler).inSingletonScope();
        bind(TYPES.DiagnosticsHandler).to(DiagnosticsHandler).inSingletonScope();
        bind(TYPES.ProgressHandler).to(ProgressHandler).inSingletonScope();
        bind(TYPES.NavigationHandler).to(NavigationHandler).inSingletonScope();
        bind(TYPES.ExportHandler).to(ExportHandler).inSingletonScope();

        bind(TYPES.VscodeActionHandler).toService(TYPES.DirtyStateHandler);
        bind(TYPES.VscodeActionHandler).toService(TYPES.DiagnosticsHandler);
        bind(TYPES.VscodeActionHandler).toService(TYPES.ProgressHandler);
        bind(TYPES.VscodeActionHandler).toService(TYPES.NavigationHandler);
        bind(TYPES.VscodeActionHandler).toService(TYPES.ExportHandler);
    });
}
