/*********************************************************************************
 * Copyright (c) 2023 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 *********************************************************************************/
import { TYPES as CONTRIBUTION_TYPES } from '@borkdominik-biguml/big-vscode-contribution';
import type {
    ConnectorMessenger as ContributionConnectorMessenger,
    DefaultWebviewEndpointFactory as ContributionWebviewEndpointFactory
} from '@borkdominik-biguml/big-vscode-contribution/vscode';
import { ReactHtmlProvider, WebviewEditorProvider } from '@borkdominik-biguml/big-vscode/vscode';
import { type GLSPDiagramIdentifier, type GlspVscodeClient } from '@eclipse-glsp/vscode-integration';
import { inject, injectable } from 'inversify';
import {
<<<<<<< HEAD
=======
    EventEmitter,
    FileType,
    Uri,
    workspace,
>>>>>>> 5ab0ace (Inject custom CSS stylesheets from .glsp/styles/ into diagram webview)
    type CancellationToken,
    type CustomDocument,
    type CustomDocumentBackup,
    type CustomDocumentBackupContext,
    type CustomDocumentEditEvent,
    type Event,
    type Webview,
    type WebviewPanel,
    type WebviewView
} from 'vscode';

export const UmlDiagramEditorSettings = Symbol('UmlDiagramEditorSettings');
export interface UmlDiagramEditorSettings {
    viewType: string;
    diagramType: string;
}

@injectable()
export class UmlDiagramEditorProvider extends WebviewEditorProvider {
    @inject(CONTRIBUTION_TYPES.WebviewEndpointFactory)
    protected readonly webviewEndpointFactory: ContributionWebviewEndpointFactory;
    @inject(CONTRIBUTION_TYPES.ConnectorMessenger)
    protected readonly connectorMessenger: ContributionConnectorMessenger;

    protected clients = new Map<string, GlspVscodeClient>();
    protected viewCounter = 0;
    protected customStyleLinks: string[] = [];

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
        this.customStyleLinks = await this.collectCustomStyleLinks(document, webviewPanel.webview);
        return super.resolveCustomEditor(document, webviewPanel, token);
    }

    protected override getLocalResourceRoots(document: CustomDocument): Uri[] {
        const roots = super.getLocalResourceRoots(document);
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            roots.push(workspaceFolder.uri);
        }
        return roots;
    }

    protected async collectCustomStyleLinks(document: CustomDocument, webview: Webview): Promise<string[]> {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return [];
        }
        const stylesDir = Uri.joinPath(workspaceFolder.uri, '.glsp', 'styles');
        try {
            const entries = await workspace.fs.readDirectory(stylesDir);
            return entries
                .filter(([name, type]) => name.endsWith('.css') && type === FileType.File)
                .map(([name]) => webview.asWebviewUri(Uri.joinPath(stylesDir, name)).toString());
        } catch {
            return [];
        }
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
            ...this.options.htmlOptions,
            customStyleLinks: this.customStyleLinks
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
            messenger: this.connectorMessenger.messenger,
            webviewPanel
        });

        const client: GlspVscodeClient = {
            clientId: diagramIdentifier.clientId,
            diagramType: diagramIdentifier.diagramType,
            document,
            webviewEndpoint: endpoint
        };

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
