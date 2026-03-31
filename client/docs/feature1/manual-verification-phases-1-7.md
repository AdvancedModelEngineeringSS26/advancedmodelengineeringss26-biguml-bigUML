# Manual UI Verification Guide for Feature 1 Phases 1-7

This guide turns the phase requirements from `client/docs/feature1/implementation-plan.md` into concrete UI checks in the VS Code extension.

It is written for manual verification in the extension development host, not for automated testing.

## Scope

Use this guide for:

- Phase 1: Contribution package scaffolding
- Phase 2: Connector core behind compatibility facade
- Phase 3: Document lifecycle migration
- Phase 4: Remaining VS Code action handlers migration
- Phase 5: Endpoint factory and editor migration
- Phase 6: Runtime connector cutover
- Phase 7: Contribution-native custom action migration

## Known limitations in the current repo

Two Phase 4 checks do not currently have an obvious stable end-user trigger in the UI:

- progress notifications: there is a handler in the runtime, but there is no clear user-facing workflow in this repo that emits `StartProgressAction` / `UpdateProgressAction` / `EndProgressAction`
- external target navigation: there is a handler for `NavigateToExternalTargetAction`, but there is no clear producer for that action in the checked-in UI flows

For those two checks, either:

- use a separate scenario you already know emits those actions in your local branch, or
- mark the check as "handler present, no stable UI trigger available in current repo"

## Recommended test assets

Use two different diagrams so multi-editor behavior is easy to see:

- `client/workspace/asd/asd.uml`
- `client/workspace/class_diagram/class_1768132987976.uml`

Optional baseline example:

- `client/release/example/demo/model/demo.uml`

## UI landmarks to keep open during testing

In the extension development host, keep these visible:

- the custom UML editor
- the `UML` activity-bar view container
- `Properties`
- `Minimap`
- `Diagram Outline`
- `Code Generation`
- `Timeline`
- the `Problems` panel
- the `Output` panel, preferably the `bigUML Modeling Tool` channel

These surfaces are the easiest visual indicators that the connector state is still wired correctly.

## One-time setup

1. Open the repository workspace in VS Code.
2. Install dependencies and build if your local branch is not already built.
3. Start the extension from `client/application/vscode`.
4. Wait until the extension development host finishes activation.
5. In the development host, confirm the `UML` activity-bar icon is visible.
6. Open the `Output` panel and select `bigUML Modeling Tool`.
7. Confirm the extension started without activation errors.
8. Open `client/workspace/asd/asd.uml` with the `bigUML Editor`.
9. Open `client/workspace/class_diagram/class_1768132987976.uml` with the `bigUML Editor`.
10. Pin both editors side by side so switching focus is fast.

## Baseline smoke check before phase-specific verification

Run this once before checking a phase so you know the branch is generally usable.

1. Click inside the first diagram and confirm it renders.
2. Select a node in the diagram.
3. Confirm `Properties` updates to the selected element.
4. Confirm `Diagram Outline` highlights or follows the same element.
5. Confirm `Minimap` shows the current diagram.
6. Move one node slightly.
7. Confirm the editor tab becomes dirty.
8. Save with `Ctrl+S`.
9. Confirm the dirty indicator clears.

If this baseline already fails, stop and fix the environment first. The phase checks below assume the basic editor path is alive.

## Phase 1: Contribution Package Scaffolding

Goal: verify there was no runtime regression in a scaffolding-only phase.

1. Start the extension development host.
2. Open `asd.uml` in the custom editor.
3. Wait for the diagram to render fully.
4. Close the editor tab.
5. Reopen `asd.uml`.
6. Confirm the diagram renders again.
7. Open the `UML` side panel and confirm `Properties`, `Minimap`, `Diagram Outline`, `Code Generation`, and `Timeline` all still load normally.

Pass if:

- the extension starts normally
- opening and closing a diagram behaves exactly like baseline
- there is no visible runtime regression

## Phase 2: Connector Core Behind a Compatibility Facade

Goal: verify active-client tracking, selection propagation, and editor cleanup with two open diagrams.

1. Open `asd.uml` and `class_1768132987976.uml` side by side.
2. Click a node in `asd.uml`.
3. Confirm `Properties` shows the selected element from `asd.uml`.
4. Confirm `Diagram Outline` and `Minimap` reflect `asd.uml`.
5. Click a different node in `class_1768132987976.uml`.
6. Confirm `Properties` changes to the selection from `class_1768132987976.uml`.
7. Confirm `Diagram Outline` and `Minimap` now reflect `class_1768132987976.uml`.
8. Switch back and forth between the two editors several times.
9. Each time, confirm the side-panel state follows the focused editor rather than staying stuck on the previous one.
10. Close one editor tab.
11. Click inside the remaining editor.
12. Confirm selection still updates normally.
13. Confirm there is no stale selection in `Properties` or `Diagram Outline` from the closed file.

Pass if:

- active-editor dependent UI always follows the focused editor
- selection updates remain correct for both files
- closing one editor leaves the remaining editor fully functional

## Phase 3: Document Lifecycle Migration

Goal: verify dirty state, save, undo/redo, revert, and persistence.

1. Open `asd.uml`.
2. Select one class node and drag it to a new position.
3. Confirm the editor tab becomes dirty.
4. Save with `Ctrl+S`.
5. Confirm the dirty indicator clears.
6. Move the same node again.
7. Press `Ctrl+Z`.
8. Confirm the node returns to the previous position.
9. Press redo using the VS Code UI or keybinding.
10. Confirm the node moves back to the edited position.
11. Without closing the editor, run `File: Revert File` from the Command Palette or the File menu while the diagram editor is focused.
12. Confirm the diagram reloads from disk.
13. Confirm the last unsaved edit disappears.
14. Close the file.
15. Reopen `asd.uml`.
16. Confirm the saved state is preserved and the reverted unsaved edit did not return.

Pass if:

- dirty state appears only after edits
- save clears dirty state
- undo and redo still work
- revert reloads the persisted model
- reopening the file shows the persisted state

## Phase 4: Remaining VS Code Action Handlers Migration

Goal: verify diagnostics and export in the UI, and verify progress/navigation only if your branch has a known trigger.

### 4A. Diagnostics / markers

The current validator checks class names and data type names. A class name must start with an uppercase letter and be at least 5 characters long.

1. Open `asd.uml`.
2. Select the class node `NewClass1`.
3. In `Properties`, change the class name to `abc`.
4. Save if needed, then wait a moment for validation to propagate.
5. Open the `Problems` panel.
6. Confirm at least one marker appears for the UML file.
7. Confirm the marker message matches the invalid name, for example uppercase and/or minimum-length validation.
8. Change the class name to `ValidClass`.
9. Save again if needed.
10. Confirm the marker disappears or updates to a clean state in `Problems`.

Pass if:

- invalid model input creates markers
- fixing the model clears or updates the markers correctly

### 4B. SVG export

1. Open any UML diagram in the custom editor.
2. Run `bigUML: Export as SVG` from the Command Palette, or use the editor title `Diagram` submenu.
3. In the save dialog, pick a temporary output location and save the file.
4. Open the exported `.svg` file from the filesystem.
5. Confirm the file exists and contains the diagram drawing.

Pass if:

- the save dialog opens
- the SVG file is written successfully
- the exported image is not empty

### 4C. Progress reporting

1. If your branch contains a known UI action that emits GLSP progress, run it.
2. Confirm a VS Code progress notification appears.
3. Confirm it closes after the operation finishes.

If you do not have a known trigger, record:

- `progress handler present, no stable UI trigger available in current repo`

### 4D. External navigation

1. If your branch contains a known UI action that emits `NavigateToExternalTargetAction`, run it.
2. Confirm VS Code opens the target editor or file.

If you do not have a known trigger, record:

- `navigation handler present, no stable UI trigger available in current repo`

## Phase 5: Endpoint Factory and Editor Migration

Goal: verify the editor handshake, reload safety, and per-editor endpoint isolation.

1. Open `asd.uml`.
2. Confirm the diagram renders and the side panels populate.
3. Open `class_1768132987976.uml` in a second editor.
4. Confirm both editors render successfully.
5. Switch between them and confirm the `Properties`, `Minimap`, and `Diagram Outline` panels follow the active editor.
6. Run `Developer: Reload Window` from the Command Palette.
7. Wait for the extension development host to reload.
8. Reopen the same two UML files if VS Code did not restore them automatically.
9. Confirm each editor reconnects and renders again.
10. Select an element in the first diagram and confirm the side-panel state reflects that file.
11. Select an element in the second diagram and confirm the side-panel state switches correctly.
12. If you have theme switching enabled, change the VS Code theme once.
13. Confirm the diagram remains usable after the theme change.

Pass if:

- reload does not leave the editor blank or disconnected
- both editors come back with isolated state
- active-editor dependent UI still switches correctly after reload

## Phase 6: Runtime Connector Cutover

Goal: repeat the multi-editor state checks after the contribution runtime path becomes primary.

1. Open `asd.uml` and `class_1768132987976.uml`.
2. Select a different element in each file.
3. Switch focus between editors several times.
4. Confirm `Properties`, `Minimap`, and `Diagram Outline` always follow the focused editor.
5. Close one editor.
6. Confirm the remaining editor still supports selection, editing, saving, and side-panel updates.
7. Reopen the closed file.
8. Confirm it renders without requiring a full window reload.
9. Select an element in the reopened file.
10. Confirm the side panels switch to the reopened file instead of showing stale state from before it was closed.

Pass if:

- open, close, reopen, and focus switching work with no stale connector state
- reopened editors get a fresh usable session

## Phase 7: Contribution-Native Custom Action Migration

Goal: verify request/response flows that previously relied on legacy helper APIs.

### 7A. Code generation request/response

1. Open `asd.uml`.
2. Open the `Code Generation` view in the `UML` side panel.
3. Leave the language as `Java` or switch to `TypeScript`.
4. Click `Select Folder` and choose an empty temporary folder.
5. Optionally toggle `Generate multiple files`.
6. Click `Generate`.
7. Inspect the chosen folder in VS Code Explorer or on disk.
8. Confirm files were created.
9. For single-file mode, expect `output.java` or `output.ts`.
10. For multi-file mode, expect one file per generated element.

Pass if:

- the request reaches the extension host
- a response returns without the panel breaking
- output files are written to the chosen folder

### 7B. Revision management request/response

1. Open `asd.uml`.
2. Open the `Timeline` view in the `UML` side panel.
3. Click `Create New Timeline Entry`.
4. Confirm a new timeline entry appears.
5. Expand that entry.
6. Confirm the preview SVG is visible.
7. Click the edit icon on the entry and rename it.
8. Confirm the new name is stored in the list.
9. Click `Export Snapshot`.
10. Confirm the flow completes without errors.
11. Click the delete icon for the same entry and confirm deletion in the modal.
12. Confirm the entry disappears.

Pass if:

- timeline requests still round-trip through the extension host
- entry creation, rename, and delete work
- snapshot export does not break the panel

### 7C. Multi-editor request correlation

1. Open both `asd.uml` and `class_1768132987976.uml`.
2. Activate `asd.uml`.
3. In `Code Generation`, generate output to folder `A`.
4. Switch to `class_1768132987976.uml`.
5. In `Code Generation`, generate output to folder `B`.
6. Confirm each folder receives files that correspond to the currently active diagram.
7. Open `Timeline` while `asd.uml` is active and create a timeline entry.
8. Switch to `class_1768132987976.uml` and create another timeline entry.
9. Confirm the timeline content follows the active document and does not mix entries between files unexpectedly.

Pass if:

- request/response flows remain tied to the correct active editor
- actions from one diagram do not leak into another diagram's UI state

## Suggested evidence to capture

For each phase, record:

- branch or commit hash
- date
- tester
- pass or fail
- screenshots for any failure
- short notes for any flaky behavior

For Phases 4-7, also record:

- exported SVG path
- generated code output folder
- whether progress/navigation were truly verified or only noted as not currently triggerable

## Fast execution order

If you want the shortest practical run, use this order:

1. Run the baseline smoke check.
2. Run Phase 1 once after startup.
3. Run Phase 2 and Phase 6 together on the same two-editor setup.
4. Run Phase 3 on `asd.uml`.
5. Run Phase 4 diagnostics and export.
6. Run Phase 5 with `Developer: Reload Window`.
7. Run Phase 7 with `Code Generation` and `Timeline`.

## Source mapping

These UI steps are grounded in the current extension wiring:

- commands, custom editor, and `UML` side-panel views: `client/application/vscode/package.json`
- extension module composition: `client/application/vscode/src/extension.config.ts`
- custom editor save/revert/reload path: `client/packages/uml-glsp-client/src/env/vscode/editor.webview-editor-provider.ts`
- active-editor dependent side panels:
  - `client/packages/big-property-palette/src/env/vscode/property-palette.webview-view-provider.ts`
  - `client/packages/big-minimap/src/env/vscode/minimap.webview-view-provider.ts`
  - `client/packages/big-outline/src/env/vscode/outline.tree-provider.ts`
  - `client/packages/big-code-generation/src/env/vscode/code-generation.webview-view-provider.ts`
  - `client/packages/big-revision-management/src/env/vscode/revision-management.webview-view-provider.ts`
- marker validation rules:
  - `client/packages/uml-glsp-server/src/env/vscode/features/validator/generic-diagram-model-validator.ts`
  - `client/packages/uml-model-server/src/gen/validation/validation-elements.ts`
- contribution-side handlers:
  - `client/packages/big-vscode-contribution/src/env/vscode/diagnostics-handler.ts`
  - `client/packages/big-vscode-contribution/src/env/vscode/progress-handler.ts`
  - `client/packages/big-vscode-contribution/src/env/vscode/navigation-handler.ts`
  - `client/packages/big-vscode-contribution/src/env/vscode/export-handler.ts`
