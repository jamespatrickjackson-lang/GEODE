# GUI Editor

Current focus: make the standalone GUI editor in `gui-editor.html` useful,
predictable, and documented before returning to package export, AI handoff, or
host-app integration.

## Current Editor

Use the self-contained editor:

- Double-click `Launch UI Editor.cmd` or `Open GUI Editor.cmd`.
- Direct file: `gui-editor.html`.
- If a local server is already running for `UI_EDITOR`, open
  `http://127.0.0.1:5174/gui-editor.html`.

The editor is vanilla HTML/CSS/JS. It edits real DOM nodes marked with
`data-c`, shows a nested layers tree, supports canvas manipulation, and
persists edits to `localStorage`. It does not need npm, Vite, package export,
validation reports, or AI tooling.

## Active Scope

The standalone editor now includes:

- Component, Assembly, and Product authoring modes in one editor.
- A nested layers tree that mirrors real DOM parent/child structure.
- Creation tools for containers, text, rectangles, ellipses, lines, icons,
  dividers, swatches, inputs, rows, and groups.
- Canvas drag, resize, snap, auto-nest, reorder, reject feedback, smart guides,
  rulers, grid, wheel zoom, and background image loading.
- A floating searchable Library with thumbnails, preview scaling, and
  Component, Assembly, Product, Colour, Icon, Token, and Style sections.
- Click and drag library instantiation using the same placement rules as canvas
  moves.
- Save selection as Component, Assembly, or Product.
- Inspector controls for kind, tier, geometry, padding, gap, stack, alignment,
  fill, opacity, radius, border, typography, blur, saturation, shadow, lock,
  visibility, names, and notes.
- GeoSee-derived presets and library entries for overlay cards, navigator
  chrome, labels, page rows, layer rows, editor panels, Topo Environment,
  local atmosphere/cloud controls, and control rows.
- A concise Behavior Log for accepted and rejected placement actions.

## Paused Workbench

The React/Vite package workbench still exists under `src/`, `packages/`, and
`plugins/`. It is not the current product target. Its local dependencies may
need to be reinstalled before it builds or runs.

Use `Launch Package Workbench (paused).cmd` only when intentionally inspecting
that older package/schema workbench at `http://127.0.0.1:5174/`.

## Docs

- `docs_v1/EDITOR-SPEC.md` is the current source of truth.
- `docs_v1/00_README.md` maps the active docs.
- `docs_v1/01_scope.md` defines active and parked scope.
- `docs_v1/03_canvas_engine.md` defines placement, snapping, nesting, and
  canvas behavior.
- `docs_v1/05_libraries.md` defines floating Library behavior.
- `docs_v1/24_geosee_editor_inventory.md` maps GeoSee editor concepts into
  standalone library and inspector capabilities.
- `docs_v1/_superseded/` contains historical package, validation, export,
  change-state, security, and AI-agent automation docs.
- `docs/` contains archived v0.1 concept notes and now points back to the
  current docs.

## Current Rule

When instructions conflict, prefer the standalone editor and
`docs_v1/EDITOR-SPEC.md`. Treat package catalogs under
`packages/geosee_editor_sidebar` as read-only seeds for the Library panel.
Treat package export, validation reports, generated briefs, autonomous agent
runbooks, and host-app adapter work as paused historical material.
