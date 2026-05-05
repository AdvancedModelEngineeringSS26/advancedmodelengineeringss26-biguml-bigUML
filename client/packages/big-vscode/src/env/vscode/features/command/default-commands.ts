/*********************************************************************************
 * Copyright (c) 2023 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 *********************************************************************************/
import { TYPES, type ActionDispatcher, type GlspDiagramSettings, type SelectionService } from '@borkdominik-biguml/big-vscode/vscode';
import { EnableToolsAction, FocusDomAction } from '@borkdominik-biguml/uml-glsp-server';
import { CenterAction, FitToScreenAction, RequestExportSvgAction, SelectAllAction } from '@eclipse-glsp/protocol';
import { inject, injectable, postConstruct } from 'inversify';
import { SetUIExtensionVisibilityAction } from 'sprotty/lib/base/ui-extensions/ui-extension-registry.js';
import * as vscode from 'vscode';

@injectable()
export class DefaultCommandsProvider {
    constructor(
        @inject(TYPES.ExtensionContext) protected readonly extensionContext: vscode.ExtensionContext,
        @inject(TYPES.GlspDiagramSettings) protected readonly diagramSettings: GlspDiagramSettings,
        @inject(TYPES.ActionDispatcher) protected readonly actionDispatcher: ActionDispatcher,
        @inject(TYPES.SelectionService) protected readonly selectionService: SelectionService
    ) {}

    @postConstruct()
    protected init(): void {
        let selectedElements: string[] = [];

        this.extensionContext.subscriptions.push(
            this.selectionService.onDidSelectionChange(({ state }) => (selectedElements = [...state.selectedElementsIDs]))
        );

        this.extensionContext.subscriptions.push(
            vscode.commands.registerCommand(`${this.diagramSettings.name}.fit`, () => {
                this.actionDispatcher.dispatch(FitToScreenAction.create(selectedElements));
            }),
            vscode.commands.registerCommand(`${this.diagramSettings.name}.center`, () => {
                this.actionDispatcher.dispatch(CenterAction.create(selectedElements));
            }),
            vscode.commands.registerCommand(`${this.diagramSettings.name}.selectAll`, () => {
                this.actionDispatcher.dispatch(SelectAllAction.create());
            }),
            vscode.commands.registerCommand(`${this.diagramSettings.name}.show.umlPanel`, () => {
                vscode.commands.executeCommand('bigUml.panel.property-palette.focus');
            }),
            vscode.commands.registerCommand(`${this.diagramSettings.name}.exportAsSVG`, () => {
                this.actionDispatcher.dispatch(RequestExportSvgAction.create());
            }),
            vscode.commands.registerCommand(`${this.diagramSettings.name}.editor.activateResizeMode`, () => {
                this.actionDispatcher.dispatch(EnableToolsAction.create(['glsp.resize-tool']));
            }),
            vscode.commands.registerCommand(`${this.diagramSettings.name}.editor.showSearch`, () => {
                this.actionDispatcher.dispatch(
                    SetUIExtensionVisibilityAction.create({
                        extensionId: 'search-autocomplete-palette',
                        visible: true
                    })
                );
            }),
            vscode.commands.registerCommand(`${this.diagramSettings.name}.editor.focusToolPalette`, () => {
                this.actionDispatcher.dispatch(FocusDomAction.create('tool-palette'));
            }),
            vscode.commands.registerCommand(`${this.diagramSettings.name}.editor.focusDiagram`, () => {
                this.actionDispatcher.dispatch(FocusDomAction.create('graph'));
            }),
            vscode.commands.registerCommand(`${this.diagramSettings.name}.editor.enablePrimaryElementNavigator`, () => {
                this.actionDispatcher.dispatch(EnableToolsAction.create(['uml.primary-element-navigator-tool']));
            }),
            vscode.commands.registerCommand(`${this.diagramSettings.name}.editor.enableSecondaryElementNavigator`, () => {
                this.actionDispatcher.dispatch(EnableToolsAction.create(['uml.secondary-element-navigator-tool']));
            })
            /*
        vscode.commands.registerCommand(`${this.diagramSettings.name}.layout`, () => {
            this.connector.sendActionToActiveClient(LayoutOperation.create([]));
        })
        */
        );

        this.extensionContext.subscriptions.push(
            this.selectionService.onDidSelectionChange(({ state }) => {
                selectedElements = [...state.selectedElementsIDs];
                vscode.commands.executeCommand(
                    'setContext',
                    `${this.diagramSettings.name}.editorSelectedElementsAmount`,
                    selectedElements.length
                );
            })
        );
    }
}
