# GUI Editor Docs - Current Map

**Current source of truth:** `EDITOR-SPEC.md`.

The current product target is the standalone editor in
`UI_EDITOR/gui-editor.html`. It is a direct DOM editor with local browser
persistence. Package export, validation reports, AI-agent handoff briefs,
autonomous build runbooks, and host-app adapters remain parked until the editor
itself is working well.

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Standalone DOM editor | Active | `gui-editor.html`; no npm, no server, no build required. |
| Component / Assembly / Product modes | Active | Three authoring modes in one editor. |
| Nested layers tree | Active | Mirrors actual `data-c` DOM nesting, including text, icons, controls, and shapes. |
| Drawing and creation tools | Active | Container, text, rectangle, ellipse, line, icon, divider, swatch, input, row, group. |
| Placement engine | Active | Canvas move, library drag, tree reorder, snap, auto-nest, reject feedback, and persistence use one ruleset. |
| Visible padding / layout editing | Active | Padding defines visual inset, drop zone, snap targets, and default child placement. |
| Floating Library | Active | Components, Assemblies, Products, Colours, Icons, Tokens, Styles, thumbnails, search, scaling. |
| GeoSee variable presets | Active | Overlay cards, navigator, editor chrome, labels, page rows, layer rows, control rows. |
| Behavior Log | Active | User-facing accepted/rejected placement messages. |
| React/Vite package workbench | Paused | Source remains; not the current editor target. |
| Package export / validation / change state | Paused | Historical package-workbench model. |
| AI-agent briefs / automation runbooks | Paused | Do not use while editor UX is being stabilized. |

## How To Run

Current editor:

```text
UI_EDITOR\Launch UI Editor.cmd
```

or:

```text
UI_EDITOR\Open GUI Editor.cmd
```

If a static/dev server is already serving `UI_EDITOR`, the same file is
available as `/gui-editor.html`.

Paused package workbench:

```text
UI_EDITOR\Launch Package Workbench (paused).cmd
```

Use it only when explicitly inspecting or resuming that separate workbench.

## Read Order

Read these first:

1. `EDITOR-SPEC.md` - current standalone editor behavior and acceptance.
2. `01_scope.md` - active and parked scope.
3. `03_canvas_engine.md` - placement, snapping, nesting, ordering, and guides.
4. `04_toolkit.md` - tools, top bar, and keyboard modifiers.
5. `05_libraries.md` - floating Library behavior.
6. `15_ui_states_and_feedback.md` - visual feedback and Behavior Log states.
7. `24_geosee_editor_inventory.md` - GeoSee concept inventory.

Use the remaining docs as supporting catalogs only, filtered through
`EDITOR-SPEC.md`.

## Historical Docs

`_superseded/` contains the old abstract package model:

- Package JSON files, validation rule packs, and export reports.
- Change-state machine and write-server security model.
- AI-agent brief generation and autonomous runbooks.

`../docs/` contains older v0.1 concept notes. Those files are archive pointers
now. They are not active build instructions.

The active editor may import package catalog files under
`packages/geosee_editor_sidebar` as Library seeds. That is not package export,
validation, or AI handoff work.

## Conflict Rule

If any doc, launcher, script, generated artifact, or old prompt conflicts with
`EDITOR-SPEC.md`, treat `EDITOR-SPEC.md` as correct.
