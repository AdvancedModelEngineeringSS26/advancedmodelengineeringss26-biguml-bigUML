# Feature 1 Contribution Module Architecture

## Purpose

`big-vscode-contribution` is the contribution-native runtime for VS Code GLSP
integration after Feature 1.

Its job is to own the live runtime behavior that used to be concentrated in the
upstream `GlspVscodeConnector` god class:

- client registration and lifecycle
- action observation and dispatch
- action-kind-specific message processing
- message propagation filtering
- document save/revert coordination
- selection tracking
- diagnostics, progress, export, and navigation handling
- endpoint creation and endpoint initialization hooks

`big-vscode` still exists, but only as a compatibility facade for frozen
consumers. New connector/runtime work should be built on the contribution
services documented here.

See also:

- `client/docs/feature1/compatibility-layer.md`

## Composition Root

The composition root is:

- `client/packages/big-vscode-contribution/src/env/vscode/connector.module.ts`

That module binds the runtime into small, focused services and exposes a few
extension points through multi-binding.

At a high level it binds:

- core state services: `ClientManager`, `SelectionTracker`, `DocumentManager`
- routing services: `ActionRouter`, `ActionDispatcher`, `ActionListener`
- built-in action handlers: message, selection, dirty-state, diagnostics,
  progress, navigation, export
- extension points: `VscodeActionHandler`, `MessagePropagationFilter`,
  `ClientRegistrationContribution`, `WebviewEndpointContribution`
- infrastructure: `ConnectorMessenger`, `WebviewEndpointFactory`,
  `HandledActionRegistry`

## Runtime model

The architecture is based on one principle:

- each responsibility should be owned by one focused service

That means:

- `VscodeConnector` coordinates
- `ClientManager` owns registered client state
- `ActionRouter` decides which handler processes an incoming action
- `ActionDispatcher` decides where an outgoing action should go
- `ActionListener` exposes observed action streams
- `DocumentManager` owns save/revert orchestration
- `WebviewEndpointFactory` owns endpoint creation

This is the replacement for “put more behavior into one connector subclass”.

## Service catalog

| Service | Responsibility | Use it when... |
| --- | --- | --- |
| `VscodeConnector` | High-level runtime coordinator | You need to register clients, dispatch routed actions, or work with document lifecycle |
| `ClientManager` | Client registration, lookup, active-client state, clientId-by-document mapping | You need client state, not message routing |
| `ActionRouter` | Processes inbound messages using DI-discovered handlers | You are adding a new handled action kind |
| `ActionDispatcher` | Sends routed actions to client, server, or extension host | You need to dispatch actions or requests |
| `ActionListener` | Exposes client/server/VS Code action streams | You need to observe actions |
| `ActionRequestHandlerRegistry` | Registers extension-host request/response handlers | You want to answer requests handled in the extension host |
| `HandledActionRegistry` | Tracks action kinds that are handled in the extension host | You are working on handled-action fallback or filtering internals |
| `HandledActionMessageFilter` | Prevents extension-host-handled actions from being forwarded to the server again | You are working on client-to-server propagation rules |
| `SelectionTracker` | Owns per-client selection state | You need current or per-client selection |
| `DocumentManager` | Owns save/revert coordination and custom document events | You need save/revert behavior |
| `DirtyStateHandler` | Converts `SetDirtyStateAction` into document-edit/document-change behavior | You are changing dirty-state handling |
| `DiagnosticsHandler` | Applies marker updates to VS Code diagnostics | You are working on markers |
| `ProgressHandler` | Maps GLSP progress actions to VS Code progress UI | You are working on progress reporting |
| `NavigationHandler` | Opens external targets in VS Code | You are working on navigation actions |
| `ExportHandler` | Handles SVG export flows | You are working on export behavior |
| `ConnectorMessenger` | Owns the shared `Messenger` instance | You need the runtime messenger |
| `WebviewEndpointFactory` | Creates endpoint-scoped endpoints | You need to create a webview endpoint |

## Main flows

### 1. Client registration flow

1. A consumer such as `uml-glsp-client` creates an endpoint through
   `WebviewEndpointFactory`.
2. The consumer builds a `GlspVscodeClient`.
3. The consumer calls `VscodeConnector.registerClient(client, options)`.
4. `VscodeConnector` asks `ClientManager` to register the client.
5. `VscodeConnector` initializes the endpoint against the GLSP server session.
6. `VscodeConnector` runs all bound `ClientRegistrationContribution`s.
7. The client session disposables are tracked centrally.

This is why client-specific setup should no longer be hardcoded inside editor
providers when a contribution hook is sufficient.

### 2. Incoming message flow

For messages from client or server:

1. `VscodeConnector` receives the message.
2. `ActionRouter.processMessage(...)` is called.
3. `ActionRouter` emits the observed action through `ActionListener`.
4. `ActionRouter` resolves a `VscodeActionHandler` by `action.kind`.
5. The matching handler returns the processed message result.
6. `VscodeConnector` applies all `MessagePropagationFilter`s in order.
7. The filtered message is forwarded to the next transport target, unless a
   filter returned `undefined`.

Important consequences:

- new action-specific behavior should be added with `VscodeActionHandler`
- new forwarding/drop rules should be added with `MessagePropagationFilter`
- connector subclassing is the wrong extension point now

### 3. Outgoing action flow

When code dispatches through `ActionDispatcher.dispatch(action, clientId)`:

1. `ActionDispatcher` resolves the target client from `clientId` or active
   client state.
2. If the endpoint declares the action as a client action, it sends the action
   to the webview endpoint.
3. If the endpoint declares the action as a server action, it forwards the
   action to the GLSP server.
4. If the action kind is registered in `HandledActionRegistry`, it emits the
   action through `ActionListener.onVscodeAction`.

This means one dispatcher owns routed delivery instead of scattered helper
methods on the legacy connector.

### 4. Request/response flow

`ActionRequestHandlerRegistry` is the extension-host request registration API.

When you call `handleGLSPRequest(...)` or `handleVSCodeRequest(...)`:

1. the action kind is registered in `HandledActionRegistry`
2. the request is observed on the correct action stream
3. the handler produces a response action
4. `ActionDispatcher` sends the response back to the originating client

This is why new request handlers should bind to the registry, not to the
compatibility `ActionListener`.

### 5. Document lifecycle flow

`DocumentManager` owns custom document lifecycle coordination.

Save flow:

1. `saveDocument(document, destination)` resolves the `clientId`
2. a pending save is recorded per client
3. `SaveModelAction` is dispatched
4. `DirtyStateHandler` observes a save-related dirty-state message
5. `DocumentManager.notifyDocumentSaved(clientId, document)` resolves the save

Revert flow:

1. `revertDocument(document, diagramType)` resolves the `clientId`
2. `RequestModelAction` is dispatched for that client

This removes the need for ad hoc save/revert logic on the connector.

### 6. Endpoint creation flow

`WebviewEndpointFactory.create(options)`:

1. creates a child Inversify container
2. binds endpoint options into that child container
3. resolves `InjectableWebviewEndpoint` from DI
4. runs all `WebviewEndpointContribution`s against the created endpoint

This is the replacement for hardcoded `new WebviewEndpoint(...)`.

## Extension points

### `VscodeActionHandler`

Use this when you want to handle one or more inbound action kinds.

Good fit:

- new handled actions
- custom message processing
- action-kind-specific behavior

Not a good fit:

- simple forwarding suppression
- client registration hooks

### `MessagePropagationFilter`

Use this when you want to drop or transform a routed message after it has been
processed.

Good fit:

- suppress forwarding to the server
- transform a message before it leaves the connector

Not a good fit:

- action-kind business logic

### `ClientRegistrationContribution`

Use this when behavior should run after a client is fully registered and
initialized.

Good fit:

- consumer-side theme sync
- registering client-specific listeners
- post-registration side effects

### `WebviewEndpointContribution`

Use this when behavior belongs to endpoint initialization itself.

Good fit:

- endpoint-local listeners
- endpoint-local setup

### `ActionRequestHandlerRegistry`

Use this for request/response actions handled in the extension host.

Good fit:

- a request action that must be answered by extension-host logic
- request kinds that should be recognized as handled and not forwarded again

## Responsibility boundaries

These are the main rules that keep the architecture clean.

### Use `VscodeConnector` as coordinator, not as a new god class

`VscodeConnector` should coordinate registration, routing, filtering, and
document methods. It should not absorb new feature-specific behavior.

### Keep runtime state ownership in focused services

Examples:

- active-client state belongs to `ClientManager`
- selection belongs to `SelectionTracker`
- pending saves belong to `DocumentManager`
- handled action kinds belong to `HandledActionRegistry`
- shared messenger ownership belongs to `ConnectorMessenger`

### Keep generic runtime code out of `big-vscode`

If new behavior is generic connector behavior, it belongs in
`big-vscode-contribution`.

`big-vscode` should only:

- preserve compatibility APIs for frozen packages
- host bigUML-specific compatibility glue that cannot yet be removed

### Keep UML-specific behavior out of `big-vscode-contribution`

If behavior is specific to UML consumers, it should stay in `uml-glsp-client`
and attach through contribution points such as
`ClientRegistrationContribution`.

## Choosing the right service

Use this quick rule of thumb:

- “I need to register a client or save/revert a document”:
  use `VscodeConnector`
- “I need the current or matching client”:
  use `ClientManager`
- “I need to dispatch an action”:
  use `ActionDispatcher`
- “I need to listen to actions”:
  use `ActionListener`
- “I need to answer a request action”:
  use `ActionRequestHandlerRegistry`
- “I need to add a new handled action kind”:
  bind `VscodeActionHandler`
- “I need to suppress or rewrite a routed message”:
  bind `MessagePropagationFilter`
- “I need custom behavior when a client comes up”:
  bind `ClientRegistrationContribution`
- “I need endpoint setup logic”:
  bind `WebviewEndpointContribution`

## Relationship to the compatibility layer

The compatibility layer in `big-vscode` is intentionally thin.

It still provides:

- `BigGlspVSCodeConnector`
- compatibility `ActionDispatcher`
- compatibility `ActionListener`
- `ConnectionManager`
- `SelectionService`

But those are no longer the architectural center.

The rule is:

- frozen consumers may keep using compatibility services
- new code should inject the contribution services directly

That separation is the main architectural outcome of Feature 1.
