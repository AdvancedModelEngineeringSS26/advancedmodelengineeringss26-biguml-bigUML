# VS Code Integration & GLSP Customization

## Overview

Improve the existing VS Code integration of GLSP and reduce the functional gap compared to Eclipse Theia. Focus on feature completeness, usability improvements, and developer experience. Additionally, improve the visual design and user experience of standalone GLSP applications and platform integrations — enable third parties to include their own styling and rendering customizations.

This topic is **research-heavy.** You will investigate, prototype, and experiment. Not everything will get implemented — being transparent about what worked, what didn't, and why is part of the progress. You don't need to solve everything.

You will primarily work in a **new package** called `big-vscode-contribution` and verify your changes against the existing bigUML codebase.

## How to Read This Document

This document is comprehensive — it contains far more detail than you need to absorb at once. Here's what matters:

- **Each feature has a Goal** — that's your target. Work towards the goal.
- **Everything else** (approach options, implementation sketches, code examples, file tables) are **starting points**, not prescriptions. They show one way to solve it. You may find a better way — that's fine.
- **If something is unclear**, ask Copilot to explain it. Seriously, paste the section and ask "what does this mean?" — it's surprisingly good at that.

> **Fair warning:** You could probably paste an entire feature description into Copilot and get a working implementation back. And honestly? That's a fine starting point! But we want **generic, well-structured, and maintainable code** — so you still need to review it, understand it, and fix the parts where Copilot got creative with your architecture. Think of it as a very enthusiastic junior developer that codes fast but doesn't always read the project conventions. 😄

## Table of Contents

1. [Feature: Rewrite the Architecture with InversifyJS](#1-feature-rewrite-the-architecture-with-inversifyjs)
2. [Feature: Native Extension Host Action Handling](#2-feature-native-extension-host-action-handling)
3. [Feature: Bug Fixes & VS Code Native Integrations](#3-feature-bug-fixes--vs-code-native-integrations)
4. [Feature (Optional): Fix Problem Marker Removal Strategy](#4-feature-optional-fix-problem-marker-removal-strategy)
5. [Feature: Customization API — Stylesheets & Rendering Plugins](#5-feature-customization-api--stylesheets--rendering-plugins)
6. [Current Architecture Context](#6-current-architecture-context)
7. [Architecture Reference](#7-architecture-reference)
8. [Related Documentation](#8-related-documentation)

---

## 1. Feature: Rewrite the Architecture with InversifyJS

### Goal

Decompose the monolithic `GlspVscodeConnector` class from the upstream [glsp-vscode-integration](https://github.com/eclipse-glsp/glsp-vscode-integration) into modular, DI-managed services using InversifyJS (version 6, **not** 7/8). The new architecture should follow best practices from both the [Theia integration](https://github.com/eclipse-glsp/glsp-theia-integration/tree/master/packages/theia-integration) and the GLSP Node server.

### Why This Feature Is Needed

The current upstream `GlspVscodeConnector` is a **god class** that handles:

- Client registration and lifecycle management
- Action message routing (client ↔ server)
- Message interception and processing
- Selection state tracking
- Dirty state and document change events
- Progress reporting
- Diagnostic marker management
- SVG export handling
- Navigation to external targets
- Document save/revert operations

This makes it nearly impossible to:

1. **Override a single behavior** — e.g., changing how selection works requires subclassing the entire connector
2. **Add new action handlers** — each new action type requires modifying the `processMessage()` method
3. **Test in isolation** — the class has too many responsibilities to mock effectively
4. **Contribute upstream** — third-party integrators must accept or reject the entire class

Similarly, the `GlspEditorProvider` creates `WebviewEndpoint` via `new` with constructor-configured action handling, making it impossible to inject custom behavior without rewriting the provider.

**Comparison with Theia integration:**

The Theia integration uses InversifyJS extensively:

- Each concern (commands, keybindings, context menus, action dispatching, diagram management) is a separate `@injectable()` class
- Services are contributed via Theia's `ContainerModule` system
- Action handlers use the same GLSP pattern as the client/server (bound in DI, automatically discovered)
- The `GLSPDiagramManager` and `GLSPDiagramWidget` are injectable and overridable
- `TheiaGLSPConnector` is a focused class that delegates to other services

In contrast, the VS Code integration uses plain classes with `new` instantiation and `options` bags, making customization very difficult.

### Research Topics (Students)

Before implementing, study the following:

1. **Current upstream VS Code integration:**
    - [GlspVscodeConnector](https://github.com/eclipse-glsp/glsp-vscode-integration/blob/master/packages/vscode-integration/src/common/glsp-vscode-connector.ts) — the god class you'll decompose
    - [GlspEditorProvider](https://github.com/eclipse-glsp/glsp-vscode-integration/blob/master/packages/vscode-integration/src/common/quickstart-components/glsp-editor-provider.ts) — hardcoded `new WebviewEndpoint`
    - [WebviewEndpoint](https://github.com/eclipse-glsp/glsp-vscode-integration/blob/master/packages/vscode-integration/src/common/quickstart-components/webview-endpoint.ts) — non-injectable endpoint

2. **Theia integration (DI best practices):**
    - [glsp-theia-integration/src/browser/](https://github.com/eclipse-glsp/glsp-theia-integration/tree/master/packages/theia-integration/src/browser) — DI-managed services, `GlspDiagramManager`, `TheiaGLSPConnector`
    - [glsp-theia-integration/src/browser/diagram/](https://github.com/eclipse-glsp/glsp-theia-integration/tree/master/packages/theia-integration/src/browser/diagram) — diagram widget, features split into separate classes

3. **GLSP Node server (action handler pattern):**
    - How `ActionHandler` and `OperationHandler` are registered via DI modules
    - How the server discovers handlers by action kind using multiinjection
    - Study `@eclipse-glsp/server` and its `DiagramModule` / `FeatureModule` pattern

4. **bigUML's existing DI layer** (packages/big-vscode):
    - The `BigGlspVSCodeConnector` subclass with its workarounds

5. **InversifyJS 6.x:**
    - `@injectable()`, `@inject()`, `@multiInject()`, `@optional()`
    - `ContainerModule` / `Container`
    - Singleton scope, transient scope, request scope

### Architecture Decomposition Plan

The connector should be split into focused services. Here is a **suggested** decomposition — you may find a better split:

| Service                  | Responsibility                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `ClientManager`          | Client registration, lifecycle, panel tracking (replaces `clientMap`, `documentMap`)                 |
| `ActionRouter`           | Routes `ActionMessage`s between clients and server (replaces message interception logic)             |
| `ActionDispatcher`       | Public API for dispatching actions (replaces `dispatchAction()`, `sendActionToActiveClient()`)       |
| `SelectionTracker`       | Tracks per-client selection (replaces `clientSelectionMap`, `handleSelectAction()`)                  |
| `DirtyStateHandler`      | Handles `SetDirtyStateAction`, emits document change events (replaces `handleSetDirtyStateAction()`) |
| `DiagnosticsHandler`     | Handles `SetMarkersAction`, manages VS Code diagnostics (replaces `handleSetMarkersAction()`)        |
| `ProgressHandler`        | Handles `StartProgressAction` etc., manages VS Code progress (replaces progress methods)             |
| `NavigationHandler`      | Handles `NavigateToExternalTargetAction` (replaces `handleNavigateToExternalTargetAction()`)         |
| `ExportHandler`          | Handles `ExportSvgAction`, shows save dialog (replaces `handleExportSvgAction()`)                    |
| `DocumentManager`        | Coordinates save/revert/backup via `SaveModelAction` (replaces `saveDocument()`, `revertDocument()`) |
| `WebviewEndpointFactory` | Injectable factory for creating endpoints (replaces `new WebviewEndpoint(...)`)                      |

### Action Handler Pattern

One of the primary goals is making action handling extensible — similar to how the GLSP client and server handle it. Instead of a monolithic `processMessage()` with `if/else` chains, action handlers should be **bound in DI and discovered by kind**:

```typescript
// Action handler interface (extension host side)
interface VscodeActionHandler {
    readonly actionKinds: string[];
    handle(message: ActionMessage, client: GlspVscodeClient | undefined, origin: MessageOrigin): MessageProcessingResult;
}

// Registration in a module
bind(TYPES.VscodeActionHandler).to(SelectionActionHandler).inSingletonScope();
bind(TYPES.VscodeActionHandler).to(DirtyStateActionHandler).inSingletonScope();
bind(TYPES.VscodeActionHandler).to(DiagnosticsActionHandler).inSingletonScope();
// ... etc.

// In ActionRouter: discover handlers by multiinjection
@multiInject(TYPES.VscodeActionHandler) @optional()
private readonly handlers: VscodeActionHandler[];

processMessage(message: ActionMessage, origin: MessageOrigin): MessageProcessingResult {
    const handler = this.handlers.find(h => h.actionKinds.includes(message.action.kind));
    if (handler) {
        return handler.handle(message, client, origin);
    }
    return { processedMessage: message, messageChanged: false };
}
```

This allows third parties (and bigUML feature packages) to add action handlers by simply binding to `TYPES.VscodeActionHandler` in their module — no subclassing required.

### WebviewEndpoint Extensibility

The `WebviewEndpoint` currently:

- Creates a `Messenger` directly in the constructor
- Registers fixed notification/request handlers inline
- Has no injection points for custom initialization

The new design should:

1. Make `WebviewEndpoint` `@injectable()` with a factory pattern
2. Allow additional initialization hooks via DI
3. Support custom notification/request handlers added by modules

```typescript
// Factory approach
interface WebviewEndpointFactory {
    create(options: WebviewEndpointOptions): WebviewEndpoint;
}

// Or a more injectable approach
@injectable()
class WebviewEndpoint {
    @inject(TYPES.Messenger) protected readonly messenger: Messenger;
    @multiInject(TYPES.WebviewEndpointContribution)
    @optional()
    protected readonly contributions: WebviewEndpointContribution[];

    async initialize(glspClient: GLSPClient): Promise<Disposable> {
        // ... base initialization ...
        for (const contribution of this.contributions) {
            contribution.onEndpointInitialized(this);
        }
    }
}
```

### Package Structure

Create a new package (example):

```
packages/big-vscode-contribution/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── config/
│   └── tsconfig.node.json
├── src/
│   └── env/
│       ├── common/          ← Shared types, action handler interface, DI symbols
│       │   ├── types.ts
│       │   ├── action-handler.ts
│       │   └── index.ts
│       ├── vscode/          ← Extension host services (connector decomposition)
│       │   ├── client-manager.ts
│       │   ├── action-router.ts
│       │   ├── action-dispatcher.ts
│       │   ├── selection-tracker.ts
│       │   ├── dirty-state-handler.ts
│       │   ├── diagnostics-handler.ts
│       │   ├── progress-handler.ts
│       │   ├── navigation-handler.ts
│       │   ├── export-handler.ts
│       │   ├── document-manager.ts
│       │   ├── webview-endpoint.ts
│       │   ├── editor-provider.ts
│       │   ├── connector.module.ts
│       │   └── index.ts
│       ├── glsp-server/     ← GLSP node server extensions (if needed)
│       │   └── index.ts
│       ├── glsp-client/     ← GLSP client extensions (if needed)
│       │   └── index.ts
│       └── browser/         ← VS Code integration bootstrap for GLSP client webview
│           └── index.ts
└── build/
```

> **Important:** This package must **not** import from any bigUML-specific packages. It should only depend on `@eclipse-glsp/*` packages, `inversify` (v6), `vscode`, and `vscode-messenger`. The goal is to make this a standalone contribution to the upstream glsp-vscode-integration repository.

### Verification

After building the new architecture:

1. Update bigUML's `big-vscode` and `uml-glsp-client` packages to use the new `big-vscode-contribution` instead of the upstream base classes
2. Verify that the existing functionality still works: opening diagrams, editing, saving, undo/redo, selection, diagnostics, progress reporting
3. Verify that the new action handler pattern works by migrating bigUML's custom action handling (see `BigGlspVSCodeConnector`)

### Files to Study

| File                                                                                                                                                             | Relevance                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [packages/big-vscode/src/env/vscode/features/connector/glsp-vscode-connector.ts](packages/big-vscode/src/env/vscode/features/connector/glsp-vscode-connector.ts) | bigUML's current connector subclass — the workarounds you'll replace |
| [packages/big-vscode/src/env/vscode/features/action/action-dispatcher.ts](packages/big-vscode/src/env/vscode/features/action/action-dispatcher.ts)               | bigUML's action dispatch wrapper — pattern to absorb natively        |
| [packages/big-vscode/src/env/vscode/features/action/action-listener.ts](packages/big-vscode/src/env/vscode/features/action/action-listener.ts)                   | bigUML's action listener — pattern to absorb natively                |
| [packages/big-vscode/src/env/vscode/features/connector/connection-manager.ts](packages/big-vscode/src/env/vscode/features/connector/connection-manager.ts)       | Client lifecycle tracking — factor into `ClientManager`              |
| [packages/big-vscode/src/env/vscode/features/connector/selection-service.ts](packages/big-vscode/src/env/vscode/features/connector/selection-service.ts)         | Selection state — factor into `SelectionTracker`                     |
| [packages/big-vscode/src/env/vscode/vscode-common.module.ts](packages/big-vscode/src/env/vscode/vscode-common.module.ts)                                         | How bigUML builds its DI container — pattern to follow               |
| [packages/big-vscode/src/env/vscode/vscode-common.types.ts](packages/big-vscode/src/env/vscode/vscode-common.types.ts)                                           | DI type symbols — pattern to follow                                  |
| [packages/uml-glsp-client/src/env/vscode/editor.webview-editor-provider.ts](packages/uml-glsp-client/src/env/vscode/editor.webview-editor-provider.ts)           | bigUML's editor provider — verify new architecture against this      |

---