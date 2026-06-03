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

Active standalone scope now includes:

- Component / Assembly / Product authoring modes.
- Nested layers down to text/icon/control leaves.
- Drawing and creation tools for containers, text, shapes, lines, icons,
  dividers, swatches, inputs, and rows.
- A Library panel for Components, Assemblies, Products, Colours, Icons, Tokens,
  and Styles.
- GeoSee-derived library entries pulled from the real editor/Base GUI and the
  read-only `packages/geosee_editor_sidebar` catalogs.
- Save selection as Component / Assembly / Product.
- GeoSee variable presets for overlay cards, navigator, editor chrome, and
  labels.
- Inspector controls for fill alpha, opacity, text color, border color/alpha,
  radius, blur, saturation, shadow, typography, and line width.

## Paused Workbench

The React/Vite package workbench still exists under `src/`, `packages/`, and
`plugins/`. It is not the current product target. Its local dependencies may
need to be reinstalled before it builds or runs.

Use `Launch Package Workbench (paused).cmd` only when intentionally inspecting
that older package/schema workbench at `http://127.0.0.1:5174/`.

## Docs

- `docs_v1/EDITOR-SPEC.md` is the current editor specification.
- `docs_v1/01_scope.md` is the current scope.
- `docs_v1/05_libraries.md` is the current library behavior.
- `docs_v1/23_v1_1_direction.md` is now active tier-mode direction, not a
  parked package-workbench plan.
- `docs_v1/24_geosee_editor_inventory.md` is the active GeoSee concept
  inventory.
- `docs_v1/10_build_phases.md` is a stabilization plan for the standalone
  editor, not an autonomous AI build runbook.
- `docs_v1/_superseded/` contains historical package, validation, export,
  change-state, security, and AI-agent automation docs. Do not build from those
  docs unless the package workbench is explicitly resumed.

## Current Rule

When instructions conflict, prefer the standalone editor and
`docs_v1/EDITOR-SPEC.md`. Treat package catalogs under
`packages/geosee_editor_sidebar` as read-only seeds for the Library panel.
Treat package export, validation reports, generated briefs, and autonomous
agent runbooks as paused historical material.
