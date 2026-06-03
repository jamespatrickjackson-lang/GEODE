# Standalone Editor Stabilization Plan

This is no longer an autonomous agent build runbook. It is the current work
plan for making `gui-editor.html` solid.

## Phase 0 - Stop The Confusion

Goal: make every top-level entry point identify the standalone editor as the
current target.

Checklist:

- `README.md` points to `gui-editor.html`.
- `Launch UI Editor.cmd` opens `gui-editor.html`.
- A separate paused launcher exists for the old React/Vite package workbench.
- `00_README.md`, `01_scope.md`, and this file describe the current state.
- `_superseded/` is clearly historical.

Verification:

- Double-clicking `Launch UI Editor.cmd` opens the standalone editor.
- `http://127.0.0.1:5174/` is described as the paused package workbench when
  Vite is intentionally running.
- `http://127.0.0.1:5174/gui-editor.html` serves the standalone editor when
  Vite is intentionally running.

## Phase 1 - Baseline Visual QA

Goal: prove the current editor loads and identify visible usability defects.

Checklist:

- Open `gui-editor.html`.
- Confirm the layers tree is populated.
- Select `Pages` from the tree.
- Confirm mode controls appear: Component, Assembly, Product.
- Confirm the Library panel appears with Components, Assemblies, Products,
  Colours, Icons, Tokens, and Styles.
- Confirm inspector sections appear: Kind, Tier & Library, GeoSee Variables,
  Geometry, Padding & Layout, Style, Notes.
- Confirm console has no errors.
- Capture one screenshot at the first viewport.

## Phase 2 - Tree And Nesting Quality

Goal: make structure editing trustworthy.

Checklist:

- Tree mirrors real DOM nesting.
- Tree selection and canvas selection stay synchronized.
- Drag-to-nest updates the DOM and tree immediately.
- Group and ungroup keep tree rows coherent.
- Delete removes rows and overlays without stale selection.

## Phase 3 - Inspector Quality

Goal: make property editing clear and stable.

Checklist:

- Kind picker is obvious and reversible.
- Geometry fields update without layout drift.
- Padding values visibly update selected padding regions.
- Stack mode and gap are understandable.
- Notes are plain human notes, not AI workflow controls.
- Locked elements visibly refuse editing.

## Phase 4 - Canvas Tool Quality

Goal: make direct manipulation feel dependable.

Checklist:

- Drag, resize, grid, snap, guides, and alignment guides are visually legible.
- Add Container/Text/Rect/Ellipse/Line/Icon/Divider/Swatch/Input/Row inserts
  into the selected container when appropriate.
- Component/Assembly/Product modes assign sensible default tiers.
- Save as Component/Assembly/Product creates library entries.
- Clicking a library entry instantiates an editable DOM copy.
- GeoSee variable presets apply overlay-card, navigator, editor-chrome, and
  label styling concepts.
- Undo/redo covers creates, deletes, moves, resizes, grouping, and property
  changes.
- The overlay never blocks normal inspection of the edited panel.

## Phase 5 - Persistence And Reset

Goal: make saved browser state predictable.

Checklist:

- Reload restores layout, nesting, kind, padding, style, notes, and guides.
- Reset clearly states that it clears browser-local edits.
- No regenerated asset or stale URL assumption is required.

## Phase 6 - Documentation Lock

Goal: prevent future work from drifting back to the parked package/AI model by
accident.

Checklist:

- Active docs contain a current-status banner where old terminology is still
  useful only as reference.
- `_superseded/README.md` lists the parked package/AI model.
- Top-level README explains the difference between the current editor and the
  paused workbench.
- Any future task starts from `EDITOR-SPEC.md` unless explicitly resuming the
  package workbench.
