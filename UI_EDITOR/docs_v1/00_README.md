# GUI Editor Docs - Current Map

**Current source of truth:** `EDITOR-SPEC.md`.

The current product target is the standalone editor in
`UI_EDITOR/gui-editor.html`. Work on package export, validation reports,
AI-agent handoff briefs, autonomous build runbooks, and host-app adapters is
parked until the editor itself is working well.

## 1. Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Standalone DOM editor | Active | `gui-editor.html`; no npm, no server, no build required. |
| Real layers tree | Active | Must mirror actual `data-c` DOM nesting. |
| Visible padding / layout editing | Active | Must be visible and editable in the inspector. |
| Kind picker | Active | Plain container kind menu; not a package archetype compiler. |
| Notes | Active | Human-readable name and intent fields for selected containers. |
| React/Vite package workbench | Paused | Source remains; local dependencies may need reinstall before it builds. |
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

Both open `gui-editor.html` directly in the browser.

Paused package workbench:

```text
UI_EDITOR\Launch Package Workbench (paused).cmd
```

That starts the old React/Vite package workbench at
`http://127.0.0.1:5174/`. Use it only when explicitly inspecting or resuming
that separate workbench.

## 3. Read Order

Read these first:

1. `EDITOR-SPEC.md` - current standalone editor behavior and acceptance.
2. `01_scope.md` - current scope and parked scope.
3. `10_build_phases.md` - current stabilization plan.

Use these only as supporting references, filtered through `EDITOR-SPEC.md`:

| Doc | Current Use |
| --- | --- |
| `03_canvas_engine.md` | Snap, ruler, guide, and canvas-behavior reference only. Ignore package/frame schema language. |
| `04_toolkit.md` | Tool behavior reference only. |
| `05_libraries.md` | Kind/catalog vocabulary reference only. |
| `06_straw_subject.md` | GeoSee sidebar inventory reference only. |
| `09_glossary.md` | Term reference; current meanings come from `EDITOR-SPEC.md`. |
| `14_component_archetype_reference.md` | Kind/default-prop catalog reference only. |
| `15_ui_states_and_feedback.md` | General UI feedback reference only. |
| `20_materials_and_shapes.md` | Shape/material idea catalog only. |
| `21_interactive_overlays_and_primitives.md` | Overlay/control idea catalog only. |
| `23_v1_1_direction.md` | Historical tier-model direction. Not active build scope. |
| `24_geosee_editor_inventory.md` | GeoSee editor inventory reference. |

## 4. Superseded Docs

`_superseded/` contains the old abstract package model:

- `frames.json`, `containers.json`, `components.json`
- validation rule packs and validation reports
- package export and round-trip requirements
- change-state machine
- security model for write-server package editing
- AI-agent brief generation
- autonomous Codex/Claude runbooks

These files are not deleted because they preserve design history. They are not
current instructions.

## 5. Conflict Rule

If any doc, launcher, script, or generated artifact conflicts with
`EDITOR-SPEC.md`, treat `EDITOR-SPEC.md` as correct.

Do not infer that "superseded" means code has been disabled. It means those
documents no longer define the current editor target.
