/*********************************************************************************
 * Copyright (c) 2023 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 *********************************************************************************/
import { TYPES as CONTRIBUTION_TYPES } from '@borkdominik-biguml/big-vscode-contribution';
import type { WebviewEndpointFactory as ContributionWebviewEndpointFactory } from '@borkdominik-biguml/big-vscode-contribution';
import { ReactHtmlProvider, TYPES, WebviewEditorProvider } from '@borkdominik-biguml/big-vscode/vscode';
import { type GLSPDiagramIdentifier, type GlspVscodeClient } from '@eclipse-glsp/vscode-integration';
import { inject, injectable } from 'inversify';
import {
    type CancellationToken,
    type CustomDocument,
    type CustomDocumentBackup,
    type CustomDocumentBackupContext,
    type CustomDocumentEditEvent,
    type Event,
    type Uri,
    type Webview,
    type WebviewPanel,
    type WebviewView
} from 'vscode';
import { GLSPIsReadyAction } from '../common/actions/editor.actions.js';
import type { ThemeIntegration } from './features/theme/theme-integration.js';

export const UmlDiagramEditorSettings = Symbol('UmlDiagramEditorSettings');
export interface UmlDiagramEditorSettings {
    viewType: string;
    diagramType: string;
}

@injectable()
export class UmlDiagramEditorProvider extends WebviewEditorProvider {
    @inject(TYPES.Theme)
    protected readonly themeIntegration: ThemeIntegration;
    @inject(CONTRIBUTION_TYPES.WebviewEndpointFactory)
    protected readonly webviewEndpointFactory: ContributionWebviewEndpointFactory;

    protected clients = new Map<string, GlspVscodeClient>();
    protected viewCounter = 0;

    constructor(@inject(UmlDiagramEditorSettings) protected readonly settings: UmlDiagramEditorSettings) {
        super({
            viewId: settings.viewType,
            viewType: settings.viewType,
            htmlOptions: {
                files: {
                    js: [['glsp-client', 'bundle.js']],
                    css: [['glsp-client', 'bundle.css']]
                }
            }
        });
    }

    override get onDidChangeCustomDocument(): Event<CustomDocumentEditEvent<CustomDocument>> {
        return this.connector.onDidChangeCustomDocument as Event<CustomDocumentEditEvent<CustomDocument>>;
    }

    override async resolveCustomEditor(document: CustomDocument, webviewPanel: WebviewPanel, token: CancellationToken): Promise<void> {
        const client = await this.prepareGLSPClient(document, webviewPanel);
        this.clients.set(document.uri.toString(), client);
        return super.resolveCustomEditor(document, webviewPanel, token);
    }

    protected override resolveMessenger(webview: WebviewView | WebviewPanel): void {
        this.toDispose.push(
            this.webviewMessenger,
            this.actionMessenger,
            this.resolveWebviewProtocol(this.webviewMessenger),
            this.resolveActionProtocol(this.actionMessenger),
            this.resolveWebviewEvents(webview)
        );
    }

    protected override resolveHtml(webview: Webview, context: CustomDocument): string {
        const clientId = this.clients.get(context.uri.toString())?.clientId ?? 'unknown';
        return new ReactHtmlProvider({
            rootProvider: () => `<div id="${clientId}_container" style="height: 100%;"></div>`,
            ...this.options.htmlOptions
        }).createHtml(this.extensionContext, webview);
    }

    override saveCustomDocument(document: CustomDocument, _cancellation: CancellationToken): Thenable<void> {
        return this.connector.saveDocument(document);
    }

    override saveCustomDocumentAs(document: CustomDocument, destination: Uri, _cancellation: CancellationToken): Thenable<void> {
        return this.connector.saveDocument(document, destination);
    }

    override revertCustomDocument(document: CustomDocument, _cancellation: CancellationToken): Thenable<void> {
        return this.connector.revertDocument(document, this.settings.diagramType);
    }

    override backupCustomDocument(
        _document: CustomDocument,
        context: CustomDocumentBackupContext,
        _cancellation: CancellationToken
    ): Thenable<CustomDocumentBackup> {
        return Promise.resolve({ id: context.destination.toString(), delete: () => undefined });
    }

    protected generateClientId(): string {
        return `${this.settings.diagramType}_${this.viewCounter++}`;
    }

    protected async prepareGLSPClient(document: CustomDocument, webviewPanel: WebviewPanel): Promise<GlspVscodeClient> {
        const clientId = this.generateClientId();
        const diagramIdentifier: GLSPDiagramIdentifier = {
            diagramType: this.settings.diagramType,
            uri: EditorProvider.serializeUri(document.uri),
            clientId
        };

        const endpoint = this.webviewEndpointFactory.create({
            diagramIdentifier,
            messenger: this.connector.messenger,
            webviewPanel
        });

        const client: GlspVscodeClient = {
            clientId: diagramIdentifier.clientId,
            diagramType: diagramIdentifier.diagramType,
            document,
            webviewEndpoint: endpoint
        };

        endpoint.onActionMessage(m => {
            if (GLSPIsReadyAction.is(m.action)) {
                this.themeIntegration.updateTheme(client);
            }
        });

        this.webviewMessenger.reuse(endpoint.messenger, endpoint.messageParticipant);
        await this.connector.registerClient(client);
        return client;
    }
}

export namespace EditorProvider {
    export function serializeUri(uri: Uri): string {
        let uriString = uri.toString();
        const match = uriString.match(/file:\/\/\/([a-z])%3A/i);
        if (match) {
            uriString = 'file:///' + match[1] + ':' + uriString.substring(match[0].length);
        }
        return uriString;
    }
}
