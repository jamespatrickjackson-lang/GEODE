# Editor Exposure Rules

## Purpose

Stop new app features, scene variables, layer variables, render settings, or
project/page config fields from being added without being exposed in the GUI
editor.

The editor is part of the feature contract. If a human author cannot see,
change, save, reload, and visually confirm a user-facing setting, the feature
is not complete.

## Hard Rules

### 0. Editor Exposure Requirement

Any new user-facing scene, render, layer, page, environment, or style variable
must be exposed in the GUI editor unless explicitly marked `internal-only`. A
feature is not complete if it is config-only, type-only, or runtime-only.

### 1. User-Facing Config Requires Editor Exposure

Any new user-facing config field must have editor exposure. It must be visible
and editable in the appropriate GUI panel unless explicitly marked
`internal-only`.

Examples:

- Project-level scene defaults belong in a global/environment editor panel.
- Page-level presentation deltas belong in a selected-page editor panel.
- Layer style values belong in the relevant layer/editor controls.
- Presenter-only display controls may live in presenter UI if they are not
authoring state.

### 2. Scene / Render Variables Must Answer Five Questions

Any new scene or render variable must answer:

- Where is it stored?
- Where is it applied at runtime?
- Where is it shown in the editor?
- How is it saved?
- How can the user visually confirm it changed?

If any answer is missing, the feature is still in progress.

### 3. Every New Field Needs a Classification

Every new field must be classified as one of:

- `editor-global`
- `editor-page`
- `editor-layer`
- `presenter-only`
- `internal-only`

Use the classification in code comments, docs, schema notes, or the
implementation receipt when the placement could be ambiguous.

### 4. Internal-Only Fields Need a Reason

`internal-only` fields require a comment explaining why they are not exposed.

Valid reasons include:

- cache or derived runtime state
- implementation detail that must not be manually authored
- diagnostic-only value
- migration shim for legacy config
- unsupported or unsafe user input

Internal-only must not be used to hide unfinished user-facing controls.

## Definition of Done for Scene / Render Features

A scene/render feature is not done until all of these are true:

- Type/schema added
- Default value added
- Runtime application added
- Editor control added
- Dirty/save flow works
- Value reloads after refresh
- Manual QA steps written
- At least one visible before/after effect exists

For docs-only planning, mark missing items clearly as planned or not yet
implemented.

## Completion Claim Rule

Codex must not claim a feature is complete if it is only added to
types/config/runtime but not visible in the editor.

Acceptable wording:

- "Typed model added; editor exposure still pending."
- "Runtime behavior added; save/reload/editor verification still pending."
- "Editor selector added; screenshot-backed visual QA still pending."

Unacceptable wording:

- "Feature complete" when no editor control exists.
- "Implemented" when the value cannot be saved and reloaded.
- "Done" when the user cannot visually confirm the result.

## Render Preset Rules

For render presets specifically:

- The user must be able to select the active render preset in the GUI editor.
- The selector must include `Current / Custom` or an equivalent no-preset
  state that applies no preset patch and preserves authored scene settings.
- The selected preset must visibly affect the scene.
- The selected preset must save and reload.
- Page-level preset overrides must clearly support inherit vs override.
- Presets must remain a thin patch over existing scene/world-building fields,
  not a parallel renderer.
- Presets must not change technical MT/scalar/seismic data rendering unless a
  separate explicitly approved technical-renderer task says so.

## Manual QA Expectations

For any new editor-exposed scene/render setting, record manual QA steps that
cover:

- where the control appears
- how to change it
- what visual effect should be visible
- how to save it
- how to refresh/reopen and confirm persistence
- how to reset or inherit, if supported

If the setting affects a project/page/layer, name at least one concrete screen
or page to inspect.

## Review Gate

Before scene/editor/render work is considered ready for review, confirm:

- no new user-facing field is config-only
- no runtime-only variable lacks editor exposure unless documented
- internal-only fields have comments
- user-facing render behavior has manual visual QA steps
- project/page/layer save paths were verified
