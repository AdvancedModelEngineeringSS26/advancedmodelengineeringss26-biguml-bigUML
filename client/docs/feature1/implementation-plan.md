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
| 6 | Runtime connector cutover | high | yes |
| 7 | Contribution-native custom action migration | medium | yes |
| 8 | Endpoint API cleanup and compatibility reduction | medium | yes |
| 9 | Final architecture cleanup and verification | medium | yes |

## Status Update After Phase 5

Phases 0 through 5 established the new package and migrated a meaningful part of the architecture, but they did so under the compatibility-first rules of this document.

That means the next work is not more scaffolding. The remaining work is about making the new contribution layer the actual runtime architecture and removing the places where the extension still depends on the copied upstream connector shape or on temporary wrappers in `big-vscode`.

The remaining phases below are the alignment plan for closing the gap between:

- the implementation sequence used so far
- the assignment requirements in `client/docs/feature1/vscode-topic.md`
- the upstream responsibility list copied into `client/docs/feature1/glsp-vscode-integration/`

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

## Phase 6: Runtime Connector Cutover

### Boundary

Switch the live runtime path from the upstream-style compatibility connector to the contribution-based connector and services. This is the phase where the new architecture becomes the real integration rather than a sidecar.

### Requirements

- Make the contribution-side server listener and message-processing pipeline the primary runtime path.
- Reduce `BigGlspVSCodeConnector` to either:
  - a thin facade over contribution services, or
  - a temporary compatibility shell with no ownership of connector state.
- Remove direct reliance on upstream connector internals from `big-vscode`, including:
  - client registration maps
  - document-to-client maps
  - selection maps
  - progress maps
  - diagnostics managed on the legacy connector instance
- Preserve the current public compatibility surface consumed by the rest of the extension during this phase:
  - `TYPES.GlspVSCodeConnector`
  - `TYPES.ActionDispatcher`
  - `TYPES.ActionListener`
  - `TYPES.ConnectionManager`
  - `TYPES.SelectionService`

### Acceptance Criteria

- No live runtime behavior depends on inherited upstream `GlspVscodeConnector` state.
- The contribution services own connector state and message routing.
- Existing packages continue to resolve the same top-level `big-vscode` service identifiers.
- Opening, closing, and switching between multiple UML editors still works.

### Manual Testing Steps

1. Open two UML diagrams in separate editors.
2. Switch focus between them and confirm active-client dependent features follow correctly.
3. Close one editor and confirm the remaining editor still works without stale state.
4. Reopen the closed file and confirm a fresh client session is created.

## Phase 7: Contribution-Native Custom Action Migration

### Boundary

Replace the remaining workaround-based custom action flow in `big-vscode` and first-party packages with DI-registered contribution handlers.

### Requirements

- Implement request/response support in the contribution `ActionDispatcher`.
- Introduce a contribution-native way to register extension-host request handlers by action kind.
- Migrate first-party features that still depend on legacy request helper APIs, especially:
  - code generation
  - revision management
  - any other package using `handleVSCodeRequest(...)`, `handleGLSPRequest(...)`, or `registerVscodeHandledAction(...)`
- Preserve behavior for packages that only need passive action observation.
- Keep the generic package free of `@borkdominik-biguml/*` imports.

### Acceptance Criteria

- Custom extension-host action handling is registered through DI-managed contribution points.
- The legacy workaround APIs are either removed or become thin adapters over the contribution layer.
- Existing request/response flows still work end to end.
- No new feature code needs to bind directly to the legacy connector workaround API.

### Manual Testing Steps

1. Trigger a code-generation request and confirm the response still returns to the initiating UI.
2. Trigger a revision-management action that uses extension-host handling and confirm the flow still completes.
3. Confirm request/response actions still correlate correctly when multiple editors are open.

## Phase 8: Endpoint API Cleanup and Compatibility Reduction

### Boundary

Finish the endpoint migration so the generic factory and endpoint contracts are sufficient on their own, without requiring UML code to depend on contribution implementation details.

### Requirements

- Expand or refine the public endpoint contract if needed so consumers do not need to downcast to concrete endpoint classes.
- Preserve reload-safe behavior currently handled by the UML compatibility adapter.
- Keep UML-specific behavior outside the generic package:
  - client ID generation
  - theme integration
  - UML-only readiness hooks
- Replace or shrink `UmlWebviewEndpointAdapter` so it is either:
  - removable, or
  - a very small documented compatibility layer with a clear removal target
- Add endpoint contribution points only where the generic contract can actually support them cleanly.

### Acceptance Criteria

- `uml-glsp-client` uses the generic endpoint factory contract cleanly.
- Endpoint customization no longer depends on reaching into contribution implementation internals.
- Reloading the editor or VS Code window still restores a working GLSP session.
- Multiple UML editors still keep isolated endpoint state.

### Manual Testing Steps

1. Open a UML diagram and confirm the initial handshake completes.
2. Reload the webview or reload the VS Code window.
3. Confirm the editor reconnects and renders again without a broken session.
4. Open multiple UML editors and confirm they remain isolated.
5. Confirm theme updates or similar post-ready hooks still run.

## Phase 9: Final Architecture Cleanup and Verification

### Boundary

Remove compatibility debt that is no longer justified and run the full verification matrix against the final architecture.

### Requirements

- Audit all temporary compatibility layers introduced during Phases 2 through 8.
- Remove adapters that are no longer needed.
- Deprecate and document any intentionally retained compatibility surface.
- Update this plan and related docs to describe the final live architecture.
- Run the full manual regression matrix after cleanup.

### Acceptance Criteria

- The live architecture is composition-based rather than wrapper-heavy.
- Any remaining compatibility layer is small, deliberate, and documented.
- The extension passes the full verification matrix after cleanup.
- Feature 1 can be closed against the assignment requirements, not just against the migration history.

### Manual Testing Steps

1. Repeat the full smoke test matrix from Phases 2 through 8.
2. Validate one end-to-end scenario covering multiple editors, selection, edit, save, revert, markers, progress, navigation, and export.
3. Confirm no regressions were introduced by removing compatibility code.
4. Record any remaining temporary surfaces and why they were intentionally retained.

## Recommended Implementation Order Inside `big-vscode`

Use this order to keep risk localized:

1. Bind new services and facades first.
2. Move passive observation and state tracking before mutating document lifecycle logic.
3. Migrate dirty-state and document operations before progress/diagnostics/export.
4. Delay endpoint factory adoption until connector parity is stable.
5. Cut over runtime ownership from the compatibility connector to contribution services.
6. Migrate custom action handling off workaround listener APIs.
7. Remove endpoint and connector compatibility shims only after full parity is proven.

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
- The live runtime path no longer depends on inherited upstream `GlspVscodeConnector` state.
- Any remaining compatibility layer is explicitly marked and tracked for later removal.
