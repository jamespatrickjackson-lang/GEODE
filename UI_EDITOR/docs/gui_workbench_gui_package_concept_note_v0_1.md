# Archived v0.1 GUI Package Concept Note

**Archived:** this file is historical. It is not current implementation
guidance.

The current editor target is the standalone DOM editor:

- `UI_EDITOR/gui-editor.html`
- `UI_EDITOR/docs_v1/EDITOR-SPEC.md`
- `UI_EDITOR/docs_v1/03_canvas_engine.md`
- `UI_EDITOR/docs_v1/05_libraries.md`

## Original Role

This file explained the old GUI Package transfer-object idea.

## Current Replacement

The current editor does not use GUI Package files as its runtime model. It
edits live DOM, persists local state, and may read package catalogs only as
Library seeds.
