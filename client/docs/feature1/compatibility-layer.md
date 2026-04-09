# Feature 1 Compatibility Layer

## Purpose

Feature 1 moves the real VS Code GLSP runtime into `big-vscode-contribution`.
The compatibility classes in `big-vscode` still exist only because frozen
first-party packages continue to resolve their services through `big-vscode`.

These compatibility APIs are:

- supported for frozen consumers
- deprecated for new code
- not the preferred architecture for future connector/runtime work

If you are changing `big-vscode`, `big-vscode-contribution`, or
`uml-glsp-client`, prefer the contribution-native services directly.

See also:

- `client/docs/feature1/contribution-module.md`

## Why the compatibility layer still exists

The migration plan requires public and de facto public APIs to remain stable
while internals move behind compatibility layers.

Frozen consumers still depend on these `big-vscode` service identifiers:

- `TYPES.GlspVSCodeConnector`
- `TYPES.ActionDispatcher`
- `TYPES.ActionListener`
- `TYPES.ConnectionManager`
- `TYPES.SelectionService`

The goal of the current architecture is therefore:

- contribution services own runtime behavior
- compatibility wrappers preserve old source-level APIs

## Preferred services by task

| If you are trying to... | Inject this now |
| --- | --- |
| Register clients, dispatch routed actions, save, revert | contribution `VscodeConnector` |
| Look up clients, active client, or client by document | contribution `ClientManager` |
| Dispatch actions or requests | contribution `ActionDispatcher` |
| Observe client, server, or extension-host actions | contribution `ActionListener` |
| Register extension-host request handlers | contribution `ActionRequestHandlerRegistry` |
| Read or update selection state | contribution `SelectionTracker` |
| React to a new registered client | contribution `ClientRegistrationContribution` |
| Create webview endpoints | contribution `WebviewEndpointFactory` |
| Customize endpoint initialization | contribution `WebviewEndpointContribution` |
| Add custom message processing | contribution `VscodeActionHandler` |
| Drop or transform routed messages | contribution `MessagePropagationFilter` |

## Compatibility API Mapping

### Connector surface

| Previous pattern | Status | Use instead | Notes |
| --- | --- | --- | --- |
| `BigGlspVSCodeConnector` | Deprecated for new code | contribution `VscodeConnector`, `ClientManager`, `ActionDispatcher`, `ActionListener` | Split usage by responsibility instead of injecting one god object |
| `connector.clients` | Compatibility-only | `clientManager.clients` | Same runtime data, owned by `ClientManager` |
| `connector.documents` | Compatibility-only | `clientManager.clients.map(client => client.document)` | There is no dedicated `documents` service anymore |
| `connector.activeClient` | Compatibility-only | `clientManager.activeClient` | |
| `connector.onDidRegister` | Compatibility-only | `clientManager.onDidRegister` or `vscodeConnector.onDidRegister` | Use `ClientRegistrationContribution` when wiring client initialization |
| `connector.onDidDispose` | Compatibility-only | `clientManager.onDidDispose` or `vscodeConnector.onDidDispose` | |
| `connector.onDidChangeCustomDocument` | Compatibility-only | `vscodeConnector.onDidChangeCustomDocument` | Backed by `DocumentManager` |
| `connector.clientIdByDocument(document)` | Compatibility-only | `clientManager.getClientId(document)` | |
| `connector.registerClient(client)` | Compatibility-only | `vscodeConnector.registerClient(client, options)` | Supports contribution hooks and explicit registration options |
| `connector.dispatchAction(action, clientId?)` | Compatibility-only | `actionDispatcher.dispatch(action, clientId)` | |
| `connector.saveDocument(document, destination?)` | Compatibility-only | `vscodeConnector.saveDocument(document, destination)` | Backed by `DocumentManager` |
| `connector.revertDocument(document, diagramType)` | Compatibility-only | `vscodeConnector.revertDocument(document, diagramType)` | Backed by `DocumentManager` |
| `connector.messenger` | Compatibility-only | contribution `ConnectorMessenger` | Shared runtime messenger now lives in `big-vscode-contribution` |
| `connector.processMessage(message, origin)` | Internal legacy connector pattern | bind `VscodeActionHandler` and `MessagePropagationFilter` instead | Do not add new behavior by overriding connector processing |

### Legacy connector helpers

| Previous helper | Status | Use instead | Notes |
| --- | --- | --- | --- |
| `connector.sendActionToActiveClient(action)` | Deprecated | `actionDispatcher.dispatch(action, clientManager.activeClient?.clientId)` | |
| `connector.sendActionToActiveServer(action)` | Deprecated | `clientManager.activeClient?.webviewEndpoint.sendMessage(...)` | Use only when intentionally bypassing routed dispatch |
| `connector.sendActionToServer(clientId, action)` | Deprecated | `glspServer.onSendToServerEmitter.fire({ clientId, action })` | Use only when intentionally bypassing connector routing |
| `connector.onClientActionMessage` | Deprecated | `actionListener.onClientAction` or `actionListener.registerListener(...)` | |
| `connector.onServerActionMessage` | Deprecated | `actionListener.onServerAction` or `actionListener.registerServerListener(...)` | |
| `connector.onVSCodeActionMessage` | Deprecated | `actionListener.onVscodeAction` or `actionListener.registerVSCodeListener(...)` | |

### Action wrapper services

| Previous pattern | Status | Use instead | Notes |
| --- | --- | --- | --- |
| `big-vscode` `ActionDispatcher` | Compatibility-only | contribution `ActionDispatcher` | |
| `dispatcher.dispatch(action)` | Compatibility-only | `actionDispatcher.dispatch(action, clientManager.activeClient?.clientId)` | New dispatcher makes target client explicit |
| `dispatcher.dispatchToClient(clientId, action)` | Compatibility-only | `actionDispatcher.dispatch(action, clientId)` | |
| `dispatcher.request(action)` | Compatibility-only | `actionDispatcher.request(action, clientManager.activeClient?.clientId)` or explicit `clientId` | |
| `dispatcher.broadcast(action)` | Compatibility-only | iterate `clientManager.clients` and call `actionDispatcher.dispatch(action, client.clientId)` | Broadcast is no longer a first-class runtime API |
| `big-vscode` `ActionListener` | Compatibility-only | contribution `ActionListener` and `ActionRequestHandlerRegistry` | |
| `listener.registerListener(...)` | Compatibility-only | contribution `ActionListener.registerListener(...)` | |
| `listener.registerServerListener(...)` | Compatibility-only | contribution `ActionListener.registerServerListener(...)` | |
| `listener.registerVSCodeListener(...)` | Compatibility-only | contribution `ActionListener.registerVSCodeListener(...)` | |
| `listener.handleGLSPRequest(...)` | Compatibility-only | contribution `ActionRequestHandlerRegistry.handleGLSPRequest(...)` | |
| `listener.handleVSCodeRequest(...)` | Compatibility-only | contribution `ActionRequestHandlerRegistry.handleVSCodeRequest(...)` | |
| `listener.createCache(...)` | Compatibility-only | contribution `ActionListener.createCache(...)` | |

### Connection and selection services

| Previous pattern | Status | Use instead | Notes |
| --- | --- | --- | --- |
| `ConnectionManager` | Compatibility facade | contribution `ClientManager` for connector-internal work | Keep `ConnectionManager` only if you need its retained event semantics |
| `connectionManager.activeClient` | Compatibility facade | `clientManager.activeClient` | |
| `connectionManager.hasAnyClient()` | Compatibility facade | `clientManager.clients.length > 0` | |
| `connectionManager.hasActiveClient()` | Compatibility facade | `clientManager.activeClient !== undefined` | |
| `SelectionService` | Compatibility facade | contribution `SelectionTracker` | |
| `selectionService.selection` | Compatibility facade | `selectionTracker.selection` | |
| `selectionService.getSelection(clientId)` | Compatibility facade | `selectionTracker.getSelection(clientId)` | |

### Legacy customization patterns

| Previous pattern | Status | Use instead | Notes |
| --- | --- | --- | --- |
| Subclass connector to override one behavior | Deprecated architecture | bind a focused service such as `VscodeActionHandler`, `MessagePropagationFilter`, or `ClientRegistrationContribution` | Feature 1 explicitly replaces god-class subclassing |
| Add new action kind by editing connector `processMessage()` | Deprecated architecture | bind `TYPES.VscodeActionHandler` | Handlers are DI-discovered by action kind |
| Drop/transform messages by editing connector send/receive logic | Deprecated architecture | bind `TYPES.MessagePropagationFilter` | Filters run after routing and can suppress forwarding |
| Create `WebviewEndpoint` directly with `new` | Deprecated architecture | inject `WebviewEndpointFactory` and call `create(options)` | The factory now creates endpoint-scoped DI instances |
| Inline endpoint setup in editor provider | Legacy integration style | bind `ClientRegistrationContribution` or `WebviewEndpointContribution` | Choose hook based on whether logic is client-level or endpoint-level |
| Use connector as owner of `Messenger` | Deprecated architecture | inject `ConnectorMessenger` | Shared messenger is contribution-owned |
| Wire UML-specific ready logic directly in provider | Deprecated architecture | bind a UML-side `ClientRegistrationContribution` | Keeps generic package generic |

## Common migrations

### Dispatch an action to the active client

Old style:

```ts
@inject(TYPES.ActionDispatcher)
protected readonly dispatcher: ActionDispatcher;

this.dispatcher.dispatch(MyAction.create());
```

Preferred style:

```ts
@inject(CONTRIBUTION_TYPES.ActionDispatcher)
protected readonly dispatcher: ContributionActionDispatcher;

@inject(CONTRIBUTION_TYPES.ClientManager)
protected readonly clientManager: ContributionClientManager;

this.dispatcher.dispatch(MyAction.create(), this.clientManager.activeClient?.clientId);
```

### Dispatch an action to a specific client

Old style:

```ts
this.dispatcher.dispatchToClient(clientId, MyAction.create());
```

Preferred style:

```ts
this.dispatcher.dispatch(MyAction.create(), clientId);
```

### Request/response

Old style:

```ts
@inject(TYPES.ActionDispatcher)
protected readonly dispatcher: ActionDispatcher;

const response = await this.dispatcher.request(MyRequestAction.create());
```

Preferred style:

```ts
@inject(CONTRIBUTION_TYPES.ActionDispatcher)
protected readonly dispatcher: ContributionActionDispatcher;

const response = await this.dispatcher.request(
  MyRequestAction.create(),
  this.clientManager.activeClient?.clientId
);
```

### Broadcast

Old style:

```ts
this.dispatcher.broadcast(MyAction.create());
```

Preferred style:

```ts
const action = MyAction.create();
this.clientManager.clients.forEach(client => {
  this.dispatcher.dispatch(action, client.clientId);
});
```

### Observe client actions

Old style:

```ts
@inject(TYPES.GlspVSCodeConnector)
protected readonly connector: BigGlspVSCodeConnector;

this.connector.onClientActionMessage(message => {
  // ...
});
```

Preferred style:

```ts
@inject(CONTRIBUTION_TYPES.ActionListener)
protected readonly listener: ContributionActionListener;

this.listener.registerListener(message => {
  // ...
});
```

### Observe server or VS Code actions

Old style:

```ts
this.connector.onServerActionMessage(message => {
  // ...
});

this.connector.onVSCodeActionMessage(message => {
  // ...
});
```

Preferred style:

```ts
this.listener.registerServerListener(message => {
  // ...
});

this.listener.registerVSCodeListener(message => {
  // ...
});
```

### Register an extension-host request handler

Old style:

```ts
@inject(TYPES.ActionListener)
protected readonly listener: ActionListener;

this.listener.handleVSCodeRequest("myRequest", async message => {
  return MyResponseAction.create(message.action.requestId);
});
```

Preferred style:

```ts
@inject(ActionRequestHandlerRegistry)
protected readonly requests: ActionRequestHandlerRegistry;

this.requests.handleVSCodeRequest("myRequest", async message => {
  return MyResponseAction.create(message.action.requestId);
});
```

### Work with active clients

Old style:

```ts
@inject(TYPES.GlspVSCodeConnector)
protected readonly connector: BigGlspVSCodeConnector;

const client = this.connector.activeClient;
const clientId = this.connector.clientIdByDocument(document);
```

Preferred style:

```ts
@inject(CONTRIBUTION_TYPES.ClientManager)
protected readonly clientManager: ContributionClientManager;

const client = this.clientManager.activeClient;
const clientId = this.clientManager.getClientId(document);
```

### Save and revert documents

Old style:

```ts
await this.connector.saveDocument(document, destination);
await this.connector.revertDocument(document, diagramType);
```

Preferred style:

```ts
@inject(CONTRIBUTION_TYPES.VscodeConnector)
protected readonly vscodeConnector: ContributionVscodeConnector;

await this.vscodeConnector.saveDocument(document, destination);
await this.vscodeConnector.revertDocument(document, diagramType);
```

### React when a client is registered

Old style:

```ts
this.connector.onDidRegister(client => {
  // custom setup
});
```

Preferred style:

```ts
@injectable()
class MyClientContribution implements ClientRegistrationContribution {
  onClientRegistered(client: GlspVscodeClient) {
    return client.webviewEndpoint.onActionMessage(message => {
      // custom setup
    });
  }
}
```

### Attach UML-specific client initialization

Old style:

```ts
const endpoint = endpointFactory.create(...);
endpoint.onActionMessage(message => {
  if (GLSPIsReadyAction.is(message.action)) {
    themeIntegration.updateTheme(client);
  }
});
```

Preferred style:

```ts
@injectable()
class UmlContribution implements ClientRegistrationContribution {
  onClientRegistered(client: GlspVscodeClient) {
    return client.webviewEndpoint.onActionMessage(message => {
      if (GLSPIsReadyAction.is(message.action)) {
        themeIntegration.updateTheme(client);
      }
    });
  }
}
```

### Customize action routing

Old style:

```ts
class MyConnector extends BigGlspVSCodeConnector {
  processMessage(message, origin) {
    if (isMyAction(message)) {
      return this.handleMyAction(message);
    }
    return super.processMessage(message, origin);
  }
}
```

Preferred style:

```ts
@injectable()
class MyActionHandler implements VscodeActionHandler {
  readonly actionKinds = [MyAction.KIND] as const;

  handle(message, client, origin) {
    // handle one focused action kind
    return { processedMessage: undefined, messageChanged: true };
  }
}

bind(TYPES.VscodeActionHandler).to(MyActionHandler).inSingletonScope();
```

### Drop or transform routed messages

Old style:

```ts
class MyConnector extends BigGlspVSCodeConnector {
  protected onClientMessage(message) {
    if (shouldDrop(message)) {
      return;
    }
    super.onClientMessage(message);
  }
}
```

Preferred style:

```ts
@injectable()
class MyFilter implements VscodeMessagePropagationFilter {
  filter(message, origin) {
    if (origin === "client" && shouldDrop(message)) {
      return undefined;
    }
    return message;
  }
}

bind(TYPES.MessagePropagationFilter).to(MyFilter).inSingletonScope();
```

### Create endpoints

Old style:

```ts
const endpoint = new WebviewEndpoint(options);
```

Preferred style:

```ts
@inject(CONTRIBUTION_TYPES.WebviewEndpointFactory)
protected readonly endpointFactory: WebviewEndpointFactory;

const endpoint = this.endpointFactory.create(options);
```

### Customize endpoint initialization

Old style:

```ts
const endpoint = endpointFactory.create(options);
endpoint.registerActionHandler(...);
endpoint.onActionMessage(...);
```

Preferred style:

```ts
@injectable()
class MyEndpointContribution implements WebviewEndpointContribution {
  onEndpointInitialized(endpoint: VscodeWebviewEndpoint) {
    return endpoint.onActionMessage(message => {
      // endpoint-specific initialization
    });
  }
}
```

## Support policy

- Frozen first-party packages may keep using the compatibility layer unchanged.
- New connector/runtime work should not introduce new dependencies on the
  compatibility layer.
- Removing the compatibility layer is out of scope until frozen consumers can
  migrate.
