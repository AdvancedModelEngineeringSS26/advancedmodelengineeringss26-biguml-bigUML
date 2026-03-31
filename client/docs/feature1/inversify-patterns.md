# InversifyJS Patterns Used in This Repository

This note captures the patterns already used in the repository so Feature 1 can follow the existing style where appropriate.

## 1. Root Container Bootstrapping

Current pattern in `big-vscode`:

- Create one root `Container` with `skipBaseClassChecks: true`.
- Bind runtime values with `toConstantValue(...)`.
- Load feature modules afterward.

Example source:

- `client/packages/big-vscode/src/env/vscode/vscode-common.module.ts`

Observed pattern:

```ts
const container = new Container({ skipBaseClassChecks: true });
container.bind(TYPES.ExtensionContext).toConstantValue(extensionContext);
container.bind(TYPES.GlspDiagramSettings).toConstantValue(options.diagram);
container.load(...modules);
```

### What to keep for Feature 1

- Keep runtime values as constant bindings.
- Keep module loading centralized.
- Do not spread container setup across unrelated entrypoints.

## 2. Feature Module Wrapper Pattern

`big-vscode` uses `VscodeFeatureModule` as a thin wrapper over `ContainerModule` to pass a richer binding context.

Example source:

- `client/packages/big-vscode/src/env/vscode/features/container/container.ts`

Pattern:

- expose `bind`
- expose `unbind`
- expose `isBound`
- expose `rebind`

### What to keep for Feature 1

- In `big-vscode`, follow the existing `VscodeFeatureModule(...)` style when integrating the new runtime.
- In the new generic package, do not depend on `VscodeFeatureModule`; use plain Inversify `ContainerModule` because the package must stay standalone.

## 3. Lifecycle Binding Pattern

The repository already uses DI-driven startup and disposal registration.

Example sources:

- `client/packages/big-vscode/src/env/vscode/features/container/bindings.ts`
- `client/packages/big-vscode/src/env/vscode/features/connector/connector.module.ts`

Pattern:

```ts
bindLifecycle(context, TYPES.SomeService, SomeServiceImpl);
```

This helper:

- ensures the service is bound once
- puts it in singleton scope
- aliases it to `TYPES.OnActivate`
- aliases it to `TYPES.OnDispose`

### What to keep for Feature 1

- Long-lived services should subscribe in `@postConstruct()` and clean up in `dispose()` / `@preDestroy()`.
- Services that must start automatically should stay wired into activation through lifecycle binding.
- Avoid heavy side effects in constructors.

## 4. Symbol-Based Service Identifiers

Current pattern:

- a shared `TYPES` object of `Symbol(...)` identifiers
- feature-specific symbols where needed

Example source:

- `client/packages/big-vscode/src/env/vscode/vscode-common.types.ts`

### What to keep for Feature 1

- Use symbol identifiers for cross-module contracts.
- Keep the generic package’s identifiers package-local.
- Add compatibility aliases in `big-vscode` rather than importing `big-vscode` symbols into the generic package.

## 5. Singleton-by-Default Services

The current extension-host services are generally singleton scoped:

- connector
- action dispatcher
- connection manager
- selection service
- output channel
- webview managers

### What to keep for Feature 1

- Treat connector services as singleton-scoped unless they are explicitly editor-scoped.
- Keep mutable shared state in dedicated singleton services rather than in static variables.

## 6. Child Container Pattern for Webview Isolation

The repository already isolates webview-scoped services by creating a child `Container` per provider instance.

Example sources:

- `client/packages/big-vscode/src/env/vscode/features/webview/view/webview-view.bindings.ts`
- `client/packages/big-vscode/src/env/vscode/features/webview/editor/webview-editor.bindings.ts`

Pattern:

```ts
const childContainer = new Container({ skipBaseClassChecks: true });
childContainer.parent = context.container as Container;
childContainer.bind(provider).toSelf().inSingletonScope();
childContainer.bind(TYPES.WebviewMessenger).to(WebviewMessenger).inSingletonScope();
childContainer.bind(TYPES.ActionWebviewMessenger).to(ActionWebviewMessenger).inSingletonScope();
```

### What to keep for Feature 1

- Endpoint instances should be resolved from child containers when instance-local dependencies are needed.
- Messenger instances must stay endpoint- or webview-scoped, not global singletons.
- Reuse parent bindings for shared services such as connector, extension context, and configuration.

## 7. Post-Construction Subscription Pattern

Many services subscribe to events in `@postConstruct()` and release them in `@preDestroy()` or `dispose()`.

Example sources:

- `client/packages/big-vscode/src/env/vscode/features/action/action-dispatcher.ts`
- `client/packages/big-vscode/src/env/vscode/features/connector/connection-manager.ts`
- `client/packages/big-vscode/src/env/vscode/features/connector/selection-service.ts`

### What to keep for Feature 1

- Create subscriptions after DI wiring is complete.
- Store disposables in one collection per service.
- Avoid subscriptions in constructors where dependencies may not be fully composed yet.

## 8. Service Composition Over Inheritance

The current code still contains inheritance in a few places, but the direction of Feature 1 should be composition-oriented:

- existing problem: `BigGlspVSCodeConnector` subclasses the upstream god class
- desired direction: focused services plus a thin facade

### What to keep for Feature 1

- Move mutable state to dedicated services such as `ClientManager` and `SelectionTracker`.
- Keep any compatibility facade thin.
- Do not recreate another monolithic subclass in the new package.

## 9. Current Compatibility Surface That Other Packages Rely On

Before changing anything, assume these are effectively public within the workspace:

- `TYPES.GlspVSCodeConnector`
- `TYPES.ActionDispatcher`
- `TYPES.ActionListener`
- `TYPES.ConnectionManager`
- `TYPES.SelectionService`

### What to keep for Feature 1

- Preserve these surfaces in early phases.
- If the implementation changes underneath, keep adapters in `big-vscode`.
- Mark adapters as temporary compatibility layers.

## 10. Recommended Pattern Mapping for Feature 1

Use the existing repository patterns like this:

| Need | Repository pattern | Feature 1 usage |
| --- | --- | --- |
| Root wiring | root container + module loading | keep in `big-vscode` bootstrap |
| Startup hooks | `bindLifecycle(...)` | use for connector-facing singletons in `big-vscode` |
| Extensibility | multi-binding via DI | use for `VscodeActionHandler` and endpoint contributions |
| Per-editor isolation | child container | use for endpoint factory instances |
| Runtime config | `toConstantValue(...)` | use for endpoint options and connector options |
| Thin aliases | `toService(...)` | use for compatibility surfaces and lifecycle aliases |

## 11. Anti-Patterns to Avoid

- Do not import `VscodeFeatureModule` into the new generic package.
- Do not put all connector logic back into one facade class.
- Do not make endpoint-scoped messengers singleton services in the root container.
- Do not use constructors for side-effect-heavy event subscription logic when `@postConstruct()` is already the repo convention.
- Do not break the current `big-vscode` service identifiers in the first migration phases.

## 12. Practical Guidance for the Planned Implementation

Use this translation layer between the current repo and the target architecture:

- Generic package:
  - plain `ContainerModule`
  - generic symbols
  - generic contracts
  - no bigUML imports
- `big-vscode` integration:
  - bind compatibility aliases from current `TYPES` to the new services or facade
  - keep current activation shape
  - keep current wrapper APIs stable until later cleanup
- `uml-glsp-client` migration:
  - defer until the connector runtime is stable
  - migrate endpoint creation last
  - keep UML-specific behavior as consumer-side contributions
