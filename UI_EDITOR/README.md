# GUI Editor

Current focus: get the standalone GUI editor working fully and clearly before
returning to package export, AI handoff, or host-app integration work.

## Current Editor

Use the self-contained editor:

- Double-click `Launch UI Editor.cmd` or `Open GUI Editor.cmd`.
- Direct file: `gui-editor.html`.
- If the Vite dev server is already running, the same file is also available at
  `http://127.0.0.1:5174/gui-editor.html`.

This editor is vanilla HTML/CSS/JS. It edits real DOM nodes marked with
`data-c`, shows a layers tree, supports direct canvas manipulation, and
persists edits to `localStorage`. It does not need npm, a build step, package
export, validation, or AI tooling.

## Paused Workbench

The React/Vite package workbench still exists under `src/`, `packages/`, and
`plugins/`. It is not the current product target. Its local dependencies may
need to be reinstalled before it builds or runs.

Use `Launch Package Workbench (paused).cmd` only when intentionally inspecting
that older package/schema workbench at `http://127.0.0.1:5174/`.

## Docs

- `docs_v1/EDITOR-SPEC.md` is the current editor specification.
- `docs_v1/01_scope.md` is the current scope.
- `docs_v1/10_build_phases.md` is now a stabilization plan for the standalone
  editor, not an autonomous AI build runbook.
- `docs_v1/_superseded/` contains historical package, validation, export,
  change-state, security, and AI-agent automation docs. Do not build from those
  docs unless the package workbench is explicitly resumed.

## Current Rule

When instructions conflict, prefer the standalone editor and
`docs_v1/EDITOR-SPEC.md`. Treat references to package export, validation
reports, `frames.json`, `ai_agent_brief.md`, and autonomous agent runbooks as
paused historical material.
