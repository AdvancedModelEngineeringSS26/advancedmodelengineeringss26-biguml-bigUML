# Feature 1 Working Set

This folder contains the local planning and reference material for Feature 1: the VS Code GLSP architecture rewrite around InversifyJS.

## Files

- `implementation-plan.md`
  Multi-phase migration plan with explicit boundaries, requirements, acceptance criteria, and manual verification steps.
- `inversify-patterns.md`
  Repository-specific DI and container patterns to follow during the implementation.
- `vscode-topic.md`
  Recovered local copy of the Feature 1 brief from git history.
- `glsp-vscode-integration/`
  Local notes pointing at the recovered upstream reference in git history.

## Notes

- The files in this folder were recovered or reconstructed from git history because they are not present in the current worktree.
- The implementation plan intentionally keeps the first migration phases inside `big-vscode` plus the new contribution package so the VS Code extension can be verified manually after each step.
