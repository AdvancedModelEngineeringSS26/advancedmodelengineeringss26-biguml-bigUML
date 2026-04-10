/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/
import { TYPES as CONTRIBUTION_TYPES } from '@borkdominik-biguml/big-vscode-contribution';
import { ContainerModule } from 'inversify';
import { TYPES } from '../../vscode-common.types.js';
import { ActionDispatcher } from './action-dispatcher.js';
import { ActionListener } from './action-listener.js';

export const actionModule = new ContainerModule(bind => {
    bind(TYPES.ActionDispatcher).to(ActionDispatcher).inSingletonScope();
    bind(TYPES.ActionListener).to(ActionListener).inSingletonScope();
    bind(TYPES.OnDispose).toService(CONTRIBUTION_TYPES.ActionDispatcher);
    bind(TYPES.OnDispose).toService(CONTRIBUTION_TYPES.ActionListener);
});
