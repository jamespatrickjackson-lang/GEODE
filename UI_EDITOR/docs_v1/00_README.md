# GUI Editor Docs - Current Map

**Current source of truth:** `EDITOR-SPEC.md`.

The current product target is the standalone editor in
`UI_EDITOR/gui-editor.html`. It is a direct DOM editor with local browser
persistence. Package export, validation reports, AI-agent handoff briefs,
autonomous build runbooks, and host-app adapters remain parked until the editor
itself is working well.

## 1. Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Standalone DOM editor | Active | `gui-editor.html`; no npm, no server, no build required. |
| Component / Assembly / Product modes | Active | Three authoring modes in one editor. |
| Real layers tree | Active | Must mirror actual `data-c` DOM nesting, including nested text/icons. |
| Drawing and creation tools | Active | Container, text, rectangle, ellipse, line, icon, divider, swatch, input, row. |
| Visible padding / layout editing | Active | Must be visible and editable in the inspector. |
| Libraries | Active | Components, Assemblies, Products, Colours, Icons, Tokens, Styles; includes read-only seeds from `packages/geosee_editor_sidebar`. |
| GeoSee variable presets | Active | Overlay card, navigator, editor chrome, labels. |
| Notes | Active | Plain human-readable name and intent fields. |
| React/Vite package workbench | Paused | Source remains; not the current editor target. |
| Package export / validation / change state | Paused | Historical package-workbench model. |
| AI-agent briefs / automation runbooks | Paused | Do not use while editor UX is being stabilized. |

## 2. How To Run

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

## 3. Read Order

Read these first:

1. `EDITOR-SPEC.md` - current standalone editor behavior and acceptance.
2. `01_scope.md` - current active and parked scope.
3. `05_libraries.md` - active library behavior.
4. `23_v1_1_direction.md` - active Component / Assembly / Product direction.
5. `24_geosee_editor_inventory.md` - GeoSee concept inventory.

Use the remaining docs as supporting catalogs only, filtered through
`EDITOR-SPEC.md`.

## 4. Superseded Docs

`_superseded/` contains the old abstract package model:

- `frames.json`, `containers.json`, `components.json`
- validation rule packs and validation reports
- package export and round-trip requirements
- change-state machine
- security model for write-server package editing
- AI-agent brief generation
- autonomous Codex/Claude runbooks

These files preserve design history. They are not current instructions.

The active editor may import package catalog files under
`packages/geosee_editor_sidebar` as Library seeds. That is not package export,
validation, or AI handoff work.

## 5. Conflict Rule

If any doc, launcher, script, or generated artifact conflicts with
`EDITOR-SPEC.md`, treat `EDITOR-SPEC.md` as correct.
