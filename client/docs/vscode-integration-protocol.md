# VS Code Integration Protocol

Audit of the VS Code Extension API surface for GLSP-based custom editors in bigUML. Each section covers what the API provides, whether GLSP/bigUML currently uses it, and a recommendation.

---

## 1. `CustomEditorProvider` Lifecycle

### What VS Code provides

`CustomEditorProvider<T>` is the main contract for non-text custom editors. Its lifecycle methods are:

| Method | Purpose |
| --- | --- |
| `openCustomDocument` | Create the document model from a URI |
| `resolveCustomEditor` | Mount the webview and initialize the editor for a document |
| `saveCustomDocument` | Persist the document to its original URI |
| `saveCustomDocumentAs` | Persist to a different URI |
| `revertCustomDocument` | Discard unsaved changes and reload from disk |
| `backupCustomDocument` | Write a hot-exit backup |
| `onDidChangeCustomDocument` | Event stream of edits; drives the dirty indicator and undo stack |

### Current usage in bigUML

| Method | Status | Notes |
| --- | --- | --- |
| `openCustomDocument` | Used | Returns a thin `{ uri, dispose }` wrapper |
| `resolveCustomEditor` | Used | Creates GLSP client, registers webview endpoint |
| `saveCustomDocument` | Used | Delegates to `DocumentManager.saveDocument` → `SaveModelAction` |
| `saveCustomDocumentAs` | Used | Same path with destination URI |
| `revertCustomDocument` | Used | Dispatches `RequestModelAction` to reload from disk |
| `backupCustomDocument` | Stub | Returns a resolved promise with a dummy backup — hot-exit is not supported |
| `onDidChangeCustomDocument` | Used | Fires `CustomDocumentEditEvent` (with undo/redo callbacks) on each GLSP operation, and `CustomDocumentContentChangeEvent` for non-undoable changes |

### Gaps and recommendations

- **Hot-exit (`backupCustomDocument`)** — Not implemented. VS Code calls this before shutdown to save unsaved work. A proper implementation would serialise the in-memory model state. Recommendation: *nice to have*.
- **`openCustomDocument` disposal** — The returned document's `dispose()` is a no-op. If the document model held resources (e.g., file watchers), they would leak. Recommendation: *low priority for current architecture*.

---

## 2. Undo / Redo

### What VS Code provides

`CustomDocumentEditEvent<T>` carries `undo` and `redo` callbacks. When VS Code's undo command fires for a custom editor, it calls `undo()` on the most recent unsaved edit event. The dirty indicator (title-bar dot) tracks whether the current undo-stack position matches the last-saved position.

### Current usage

`DirtyStateHandler` listens for `SetDirtyStateAction` from GLSP and calls `DocumentManager.notifyDocumentEdit` with callbacks that dispatch `UndoAction` / `RedoAction` back to the GLSP server. This is the correct approach.

### Identified gaps (now fixed)

| Gap | Fix applied |
| --- | --- |
| Webview captures `Ctrl+Z` before VS Code — sprotty undoes internally, VS Code edit stack is never called | Added `Ctrl+Z → undo` and `Ctrl+Shift+Z → redo` keybindings in `package.json` with `!inputFocus` guard; VS Code intercepts the keys before the webview iframe |
| Rapid GLSP operations (e.g. dragging) push many individual edit events; each `Ctrl+Z` undoes one micro-step | Debounce (300 ms) added to `DirtyStateHandler` — consecutive `reason='operation'` messages are batched into a single `CustomDocumentEditEvent` |
| When GLSP undoes back to a clean state it sends `SetDirtyStateAction(isDirty=false, reason='undo')` — VS Code dirty indicator was not updated | `DirtyStateHandler` now calls `notifyDocumentSaved` when `!isDirty && (reason === 'undo' \| reason === 'redo')` |

### Remaining consideration

VS Code's undo stack and GLSP's internal undo stack are still logically separate counters. If GLSP batches multiple operations into one undo step server-side, a single VS Code undo entry correctly undoes all of them (via `UndoAction`). If GLSP splits them, the debounce window controls grouping on the VS Code side. No further changes are required unless GLSP's operation batching strategy changes.

---

## 3. Keybinding Integration

### What VS Code provides

- `contributes.keybindings` in `package.json` — declare keybindings with `when` clauses that are evaluated before dispatching to a webview
- `activeCustomEditorId` — built-in context key set to the `viewType` of the active custom editor
- `inputFocus` — built-in context key, true when focus is inside a text input (including diagram label editors)
- `vscode.commands.executeCommand('setContext', key, value)` — set arbitrary context keys for use in `when` clauses

### Current usage in bigUML

Several diagram commands are declared with `when: "activeCustomEditorId == 'bigUML.diagramView'"`: `fit`, `center`, `selectAll`, `editor.showSearch`, etc.

### Gaps

| Keybinding | Gap | Status |
| --- | --- | --- |
| `Ctrl+Z` / `Cmd+Z` | Not claimed — webview sprotty handler fires instead | Fixed: added `undo` redirect |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Not claimed | Fixed: added `redo` redirect |
| `Delete` / `Backspace` | Not claimed — VS Code default and sprotty may conflict | Recommendation: *should fix* — add `glsp.delete → DeleteElementOperation` keybinding |
| `Ctrl+C` / `Ctrl+V` / `Ctrl+X` | Not claimed | Recommendation: *nice to have* — copy/paste/cut diagram elements |
| `Escape` | Not claimed | Used by sprotty to deselect; no VS Code conflict expected |

### Recommendation for `glspDiagramFocused` context

Setting a context key when the diagram panel is active allows more precise `when` clauses (e.g., excluding input fields with a single guard). Implementation sketch:

```typescript
// In ConnectionManager or a dedicated panel-state tracker:
this.connector.onDidRegister(client => {
    client.webviewEndpoint.webviewPanel.onDidChangeViewState(e => {
        vscode.commands.executeCommand('setContext', 'glspDiagramFocused', e.webviewPanel.active);
    });
});
```

This is a *nice to have* — `activeCustomEditorId` covers most cases without it.

---

## 4. Selection API

### What VS Code provides

VS Code has no native "selected elements" concept for custom editors. The approaches available are:

- `vscode.commands.executeCommand('setContext', key, value)` — expose selection data as context keys for `when` clauses
- No equivalent of `vscode.window.activeTextEditor.selection` exists for custom editors

### Current usage in bigUML

`DefaultCommandsProvider` already sets:
- `bigUML.editorSelectedElementsAmount` — count of selected elements
- `bigUML.editorSelectedElementsIds` — array of selected element IDs

These context keys power the `n` / `alt+n` navigator keybindings.

A `bigUML.getSelection` command is also registered that returns the current `SelectionState`.

### Gap

VS Code Chat's `#selection` variable and other VS Code built-ins that query "what is selected" cannot reach into a custom editor. There is no API to register a selection provider for custom editors. This is a VS Code limitation — *not applicable* to fix at the extension level.

---

## 5. `WebviewPanel` Integration Points

### What VS Code provides

| Property / Event | Purpose |
| --- | --- |
| `reveal(column?, preserveFocus?)` | Bring the panel into view programmatically |
| `onDidChangeViewState` | Fired when panel becomes active/inactive or changes column |
| `onDidDispose` | Panel closed |
| `options.retainContextWhenHidden` | Keep webview alive when panel is hidden |
| `webview.asWebviewUri(uri)` | Convert a local file URI to a webview-safe URI |
| `webview.cspSource` | Allowed CSP origin for inline content |

### Current usage

- `retainContextWhenHidden: true` — set, so GLSP state is preserved across tab switches
- `onDidChangeViewState` — used in `ConnectionManager` to emit `onDidViewStateChange`
- `onDidDispose` — used to clean up client sessions
- `reveal` — not used; could be useful for programmatic navigation (e.g., "jump to element in diagram" from a command)
- `asWebviewUri` — used for CSS/JS bundle URIs in HTML generation

### Recommendation

`reveal()` would enable a "show in diagram" feature (open diagram and scroll to a specific element). *Nice to have.*

---

## 6. Viewport Persistence

### What VS Code provides

- `ExtensionContext.workspaceState` — key/value store scoped to the workspace, persisted across sessions
- `ExtensionContext.globalState` — key/value store persisted globally

### Current usage

Not implemented. When a diagram editor is closed and reopened, the viewport (zoom level, scroll position) resets to default.

### Recommendation

Store and restore the last known viewport per document URI:

```typescript
// On SetViewportAction received from client:
context.workspaceState.update(`viewport:${document.uri.toString()}`, viewport);

// On editor open, after glspIsReady:
const saved = context.workspaceState.get<Viewport>(`viewport:${document.uri.toString()}`);
if (saved) {
    actionDispatcher.dispatch(SetViewportAction.create(saved), clientId);
}
```

Recommendation: *should fix* — straightforward to implement, high UX impact.

---

## 7. Breadcrumbs / Document Symbols

### What VS Code provides

`DocumentSymbolProvider` populates the breadcrumb bar and the "Go to Symbol" panel for text documents. There is no equivalent for custom editors — the breadcrumb bar is blank for custom editors.

### Current usage

Not applicable — bigUML does not register a symbol provider.

### Recommendation

VS Code does not expose a breadcrumb API for custom editors. This is a platform limitation. *Not applicable.*

---

## 8. Workspace Trust

### What VS Code provides

Extensions can declare `capabilities.untrustedWorkspaces` in `package.json` to describe their behaviour in untrusted workspaces. VS Code enforces this: in restricted mode, features that execute arbitrary code should be disabled.

### Current usage

`package.json` does not declare `capabilities.untrustedWorkspaces`. VS Code assumes the extension is not trust-aware and may restrict it in untrusted workspaces.

### Recommendation

Add a declaration:

```json
"capabilities": {
  "untrustedWorkspaces": {
    "supported": "limited",
    "description": "Diagram editing is available. Custom stylesheet and rendering plugin loading from the workspace is disabled in untrusted workspaces."
  }
}
```

The custom stylesheet feature (`.glsp/styles/`) reads workspace files and injects them into webviews — this should be gated on workspace trust. *Should fix alongside the stylesheet feature.*

---

## 9. Comparison with Theia

| Capability | Theia | VS Code |
| --- | --- | --- |
| Undo/redo | Native DI-managed `UndoRedoService`; GLSP integrates as a first-class `UndoableOperation` | `CustomDocumentEditEvent` callbacks; works but requires explicit keybinding claims to prevent webview bypass |
| Selection exposure | Theia `SelectionService` — any Theia contribution can query or set selection | No native custom-editor selection API; must use `setContext` workarounds |
| Keybinding scoping | Theia command/keybinding system is fully DI-based; diagram commands are scoped via contribution points | VS Code `when` clauses + `activeCustomEditorId`; effective but requires explicit declarations |
| Breadcrumbs | Theia `BreadcrumbsContribution` allows custom editors to provide breadcrumb items | No breadcrumb API for custom editors |
| Viewport persistence | Not built-in in Theia either; same `workspaceState` approach applies | Same — `workspaceState` approach available but not yet implemented |
| Hot-exit | Theia `StorageService` provides per-widget persistence | `backupCustomDocument` — available but not implemented in bigUML |

---

## Summary of Recommendations

| Item | Priority | Status |
| --- | --- | --- |
| Undo/redo keybinding claims (`Ctrl+Z`, `Ctrl+Shift+Z`) | Should fix | Done |
| Undo/redo edit grouping (debounce) | Should fix | Done |
| Dirty indicator on undo-to-clean | Should fix | Done |
| `Delete` / `Backspace` keybinding for element deletion | Should fix | Pending |
| Viewport persistence via `workspaceState` | Should fix | Pending |
| Workspace trust declaration | Should fix (with stylesheet feature) | Pending |
| `reveal()` for "show in diagram" navigation | Nice to have | Pending |
| `glspDiagramFocused` context key | Nice to have | Pending |
| Copy/paste/cut keybindings | Nice to have | Pending |
| Hot-exit via `backupCustomDocument` | Nice to have | Pending |
| Breadcrumbs for diagram hierarchy | Not applicable | N/A — platform limitation |
| Native selection provider for custom editors | Not applicable | N/A — platform limitation |
