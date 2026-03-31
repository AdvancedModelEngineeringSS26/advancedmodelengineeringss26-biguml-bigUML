# Feature 1 Multi-Phase Implementation Plan

## Goal

Implement Feature 1 from `client/docs/feature1/vscode-topic.md`: decompose the upstream `GlspVscodeConnector` architecture into smaller InversifyJS-managed services while keeping the VS Code extension runnable and manually verifiable after every migration step.

## Planning Constraints

- Primary verification is manual testing of the VS Code extension.
- Early phases should avoid changing packages other than:
  - `client/packages/big-vscode`
  - the new `client/packages/big-vscode-contribution`
  - documentation
- Existing consumers in other packages should continue to work through a compatibility layer until parity is proven.
- If an API surface changes and the change is justified, add a backward compatibility layer and mark it clearly as temporary.
- The new contribution package must remain generic and must not import any `@borkdominik-biguml/*` packages.

## Migration Rules

### Allowed early-package scope

Phases 0 through 4 should stay inside:

- `client/packages/big-vscode`
- `client/packages/big-vscode-contribution`
- `client/docs/feature1`

The first planned cross-package migration is Phase 5.

### Backward compatibility rule

Wherever a public or de facto public API is already consumed by the rest of the extension, keep it stable first and migrate internals behind it. Temporary adapters should be named and documented as compatibility layers, for example:

- `CompatibilityVscodeConnector`
- `LegacyActionListenerAdapter`
- `LegacyWebviewEndpointAdapter`

Each compatibility layer must include:

- why it exists
- which old API it preserves
- the target phase for removal

### Manual verification rule

Do not merge multiple risky behavior changes into one phase. Every phase must end with a manual smoke check of the extension so regressions can be isolated quickly.

## Current Baseline to Preserve

The current `big-vscode` stack already provides the behaviors that later phases must keep working:

- connector registration and message routing through `BigGlspVSCodeConnector`
- wrapper services around the connector:
  - `ActionDispatcher`
  - `ActionListener`
  - `ConnectionManager`
  - `SelectionService`
- DI-driven activation and registration via the `vscodeModule(...)` container
- per-webview child containers for editor and view providers
- a custom UML editor provider with a reload-safe endpoint workaround

## Phase Overview

| Phase | Name | Runtime risk | Cross-package changes |
| --- | --- | --- | --- |
| 0 | Baseline and contract freeze | none | no |
| 1 | Contribution package scaffolding | low | no |
| 2 | Connector core behind compatibility facade | medium | no |
| 3 | Document lifecycle migration | medium | no |
| 4 | Remaining VS Code action handlers migration | medium | no |
| 5 | Endpoint factory and editor migration | high | yes, first intentional one |
| 6 | Cleanup and compatibility debt reduction | medium | yes, but only after parity |

## Phase 0: Baseline and Contract Freeze

### Boundary

Documentation and discovery only. No production behavior changes.

### Requirements

- Recover or snapshot the Feature 1 brief and upstream reference code locally.
- Record the current compatibility surface that other packages rely on in `big-vscode`.
- Record the manual smoke-test baseline before any migration starts.
- Confirm the package boundary for the first implementation phases.

### Acceptance Criteria

- `client/docs/feature1/vscode-topic.md` exists locally.
- `client/docs/feature1/glsp-vscode-integration/` contains the upstream reference notes needed for comparison.
- The compatibility surface is explicitly listed:
  - `TYPES.GlspVSCodeConnector`
  - `TYPES.ActionDispatcher`
  - `TYPES.ActionListener`
  - `TYPES.ConnectionManager`
  - `TYPES.SelectionService`
- The first implementation phases are documented as `big-vscode`-only plus new package work.

### Manual Testing Steps

1. Launch the VS Code extension in development mode.
2. Open at least one UML diagram in the custom editor.
3. Confirm the editor loads and renders.
4. Confirm one sidebar feature that depends on the connector still reacts to the active diagram.
5. Edit the diagram and confirm the document becomes dirty.
6. Save the document and confirm the dirty indicator clears.

## Phase 1: Contribution Package Scaffolding

### Boundary

Create the generic `big-vscode-contribution` package and define its contracts, but do not switch the running extension to the new implementation yet.

### Requirements

- Add `client/packages/big-vscode-contribution`.
- Define package-local DI symbols and shared contracts.
- Add the composition-oriented service skeletons:
  - `ClientManager`
  - `ActionRouter`
  - `ActionDispatcher`
  - `ActionListener`
  - `SelectionTracker`
  - `DirtyStateHandler`
  - `DiagnosticsHandler`
  - `ProgressHandler`
  - `NavigationHandler`
  - `ExportHandler`
  - `DocumentManager`
  - `VscodeConnector`
  - `WebviewEndpointFactory`
- Provide a plain Inversify `ContainerModule` for the new package.
- Keep the package free of `@borkdominik-biguml/*` imports.

### Acceptance Criteria

- The new package builds in isolation.
- The package exports are generic and do not depend on `big-vscode`.
- Action-handler extension points exist in the new package API.
- No runtime wiring in the VS Code extension has changed yet.

### Manual Testing Steps

1. Run the extension exactly as before.
2. Open and close a UML diagram.
3. Confirm there is no runtime regression, since this phase should be scaffolding-only.

## Phase 2: Connector Core Behind a Compatibility Facade

### Boundary

Replace connector internals in `big-vscode` with the new composition-based services while preserving the current consumer-facing API used by the rest of the extension. Do not change `uml-glsp-client` yet.

### Requirements

- Introduce a compatibility facade in `big-vscode` for `TYPES.GlspVSCodeConnector`.
- Move client registration, active-client lookup, passive action observation, and selection tracking to the new services.
- Keep existing `ActionDispatcher`, `ActionListener`, `ConnectionManager`, and `SelectionService` behavior stable from the perspective of current consumers.
- Preserve the current endpoint type expected by the UML editor provider.
- Keep all first-party sidebar features working without edits in their packages.

### Backward Compatibility Layer

Expected temporary layers in this phase:

- a connector facade that still satisfies the existing `big-vscode` expectations
- adapters if existing wrappers still need old method names or event shapes

These layers should be marked as temporary and targeted for review in Phase 6.

### Acceptance Criteria

- `big-vscode` resolves its connector-related services from the new composition layer.
- Existing consumer packages do not need code changes.
- The following still work:
  - active-client resolution
  - action dispatch from extension host code
  - action observation for client and server traffic
  - selection propagation for the active editor

### Manual Testing Steps

1. Open two UML diagrams in separate editors.
2. Switch focus between them.
3. Confirm active-client dependent features follow the focused editor.
4. Select elements in each diagram and confirm dependent UI updates correctly.
5. Close one editor and confirm no stale selection or active-client behavior remains.

## Phase 3: Document Lifecycle Migration

### Boundary

Move dirty-state handling and document operations into dedicated services while keeping the editor provider contract stable.

### Requirements

- Migrate `SetDirtyStateAction` handling into a dedicated handler/service.
- Move `saveDocument(...)` and `revertDocument(...)` orchestration into `DocumentManager`.
- Preserve current undo/redo bridging behavior from dirty-state events.
- Preserve `onDidChangeCustomDocument` semantics expected by the custom editor provider.
- Do not migrate diagnostics, progress, navigation, or SVG export yet unless required for shared infrastructure.

### Acceptance Criteria

- Dirty state still updates correctly.
- Save and save-as still route through the correct client session.
- Revert still triggers model reload for the active editor.
- Undo/redo still work after the migration.
- No consumer package outside `big-vscode` had to change.

### Manual Testing Steps

1. Open a UML diagram.
2. Perform an edit and confirm the tab becomes dirty.
3. Save the diagram and confirm the dirty indicator clears.
4. Perform another edit, then undo and redo it.
5. Use revert and confirm the diagram reloads to the persisted state.
6. Reopen the same file and confirm the saved state is retained.

## Phase 4: Remaining VS Code Action Handlers Migration

### Boundary

Complete the move away from the monolithic connector logic by migrating the remaining message-processing responsibilities into DI-discovered action handlers.

### Requirements

- Introduce the extension-host `VscodeActionHandler` registry in the live runtime path.
- Migrate the following behaviors to dedicated handlers:
  - message actions / notifications
  - diagnostics / markers
  - progress
  - navigation to external targets
  - SVG export
- Define handler resolution behavior explicitly.
- Preserve or intentionally wrap `registerVscodeHandledAction(...)` if still required by current consumers.

### Acceptance Criteria

- The compatibility facade no longer contains a large `if/else` message-processing block.
- Action processing is delegated by kind through DI-managed handlers.
- Existing wrapper services still function.
- Diagnostics, progress reporting, export, and navigation still work in the extension.

### Manual Testing Steps

1. Open a diagram that can produce validation markers and confirm markers still appear.
2. Clear or fix the validation issue and confirm markers update correctly.
3. Trigger an operation that produces progress reporting and confirm progress opens and closes.
4. Trigger any action that opens an external target and confirm VS Code navigation still works.
5. Trigger SVG export and confirm the file is written successfully.

## Phase 5: Endpoint Factory and Editor Migration

### Boundary

This is the first intentional cross-package phase. Only start it after Phases 2 through 4 have been manually verified. Migrate editor endpoint creation away from hardcoded construction and toward the injectable factory/contribution model.

### Requirements

- Implement `WebviewEndpointFactory` in the new package.
- Preserve reload-safe behavior currently implemented by the UML-specific endpoint workaround.
- Migrate `uml-glsp-client` to use the new factory or a documented compatibility adapter.
- Keep UML-specific behavior outside the generic package:
  - client ID generation
  - theme integration
  - any UML-only post-ready handling
- If the current UML endpoint shape cannot be removed immediately, add a marked backward compatibility adapter.

### Acceptance Criteria

- `uml-glsp-client` no longer needs to hardcode endpoint creation directly against upstream types.
- Reloading the editor still reinitializes the GLSP client correctly.
- UML-specific behavior remains consumer-side rather than leaking into the generic package.

### Manual Testing Steps

1. Open a UML diagram and confirm the initial handshake completes.
2. Reload the webview or reload the VS Code window.
3. Confirm the editor reconnects and renders again without a broken session.
4. Open multiple UML editors and confirm each editor keeps isolated endpoint state.
5. Confirm theme updates or other UML-specific readiness behavior still run.

## Phase 6: Cleanup and Compatibility Debt Reduction

### Boundary

Remove or reduce temporary adapters only after the extension has passed the full manual verification matrix on the new architecture.

### Requirements

- Audit temporary compatibility layers introduced in earlier phases.
- Remove adapters that are no longer needed.
- Deprecate any compatibility surface that must remain temporarily.
- Update docs to list the remaining debt and the intended removal point.

### Acceptance Criteria

- All temporary layers are either removed or explicitly documented.
- The live architecture is composition-based rather than wrapper-heavy.
- The remaining compatibility surface is small, deliberate, and documented.

### Manual Testing Steps

1. Repeat the full smoke test matrix from Phases 2 through 5.
2. Confirm no regressions were introduced by removing compatibility code.
3. Validate at least one scenario with multiple editors, save/revert, selection, markers, and progress in one run.

## Recommended Implementation Order Inside `big-vscode`

Use this order to keep risk localized:

1. Bind new services and facades first.
2. Move passive observation and state tracking before mutating document lifecycle logic.
3. Migrate dirty-state and document operations before progress/diagnostics/export.
4. Delay endpoint factory adoption until connector parity is stable.

## Repo-Specific Constraints to Keep During Implementation

- Follow the current DI and lifecycle patterns documented in `client/docs/feature1/inversify-patterns.md`.
- Preserve the `vscodeModule(...)` bootstrap shape used by the extension.
- Preserve child-container isolation for webview-scoped services.
- Keep the new generic package on plain Inversify `ContainerModule` rather than `big-vscode`'s `VscodeFeatureModule`.

## Full Manual Regression Matrix

Run this after every phase that changes runtime behavior:

1. Start the extension in a VS Code extension development host.
2. Open a UML file in the custom editor.
3. Confirm the diagram renders.
4. Change selection and confirm dependent UI follows.
5. Edit the model and confirm dirty state changes.
6. Undo and redo the edit.
7. Save and confirm the dirty state clears.
8. Revert and confirm the model reloads.
9. Close and reopen the editor.
10. If available, verify markers, progress, navigation, and export.

## Exit Condition for Feature 1

Feature 1 is ready to close when all of the following are true:

- The monolithic connector responsibilities have been split into DI-managed services.
- Action processing is extension-host extensible through DI-managed handlers.
- The VS Code extension passes the manual regression matrix after the final migration step.
- Early migration was achieved without unnecessary edits in other packages.
- Any remaining compatibility layer is explicitly marked and tracked for later removal.
