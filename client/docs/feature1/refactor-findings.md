# Feature 1 Refactor Findings

This document records problems, risks, and unresolved behaviors found while
moving the VS Code GLSP runtime from `big-vscode` into
`big-vscode-contribution`.

## Open findings

### Save can wait forever if completion never arrives

Status:
- open

Affected code:
- `client/packages/big-vscode-contribution/src/env/vscode/document-manager.ts`

Problem:
- `DocumentManager.saveDocument(...)` records a pending save and waits for
  `notifyDocumentSaved(...)` to resolve it.
- The current implementation rejects the save only when dispatch fails, the
  client is disposed, or the document manager is disposed.
- If the expected save completion signal never arrives while the client stays
  alive, the returned promise can remain pending indefinitely.

Why this matters:
- Feature 1 explicitly requires verification that saving still works after the
  refactor.
- An unbounded pending save can leave the VS Code custom editor save flow stuck.

Historical note:
- This is not a new weakness introduced by Feature 1 from the repository's
  original baseline.
- In the root commit `9c4c384f7afffc5ca94aaed6ca6cc6e98e99555a`, the upstream
  `GlspVscodeConnector.saveDocument(...)` also waited indefinitely for
  `onDocumentSavedEmitter` with no timeout.
- The current refactor improved cleanup on client or manager disposal, but it
  does not yet provide a bounded failure path for a missing save completion
  message.

Suggested follow-up:
- Decide whether Feature 1 should preserve baseline behavior or strengthen it.
- If stronger behavior is desired, add a bounded timeout or another explicit
  failure path for pending saves.
