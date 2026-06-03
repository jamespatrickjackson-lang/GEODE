# Archived v0.1 Safe Editing Boundary Charter

**Archived:** this file is historical. It is not current implementation
guidance.

The current editor target is the standalone DOM editor:

- `UI_EDITOR/gui-editor.html`
- `UI_EDITOR/docs_v1/EDITOR-SPEC.md`
- `UI_EDITOR/docs_v1/03_canvas_engine.md`

## Original Role

This file described safety boundaries for a broader package/embedded editing
system.

## Current Replacement

Current safety is local editor behavior: valid drop rules, rejection feedback,
undo/redo, lock/visibility handling, and clear separation from package export
or host-app mutation. Use `../docs_v1/03_canvas_engine.md`.
