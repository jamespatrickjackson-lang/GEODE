# Build Phases

**Status:** active stabilization plan for `gui-editor.html`.

This is not an autonomous AI runbook. It is a practical order for getting the
standalone editor into a non-confusing, tested state.

## Phase 1 - Documentation And Entry Points

Goal: every entry point identifies the standalone editor as current.

Acceptance:

- `UI_EDITOR/README.md` points to `gui-editor.html`.
- `docs_v1/EDITOR-SPEC.md` is the source of truth.
- Old package and AI docs are parked or archived.
- Launchers separate current editor from paused package workbench.

## Phase 2 - Core Editor Shell

Goal: the first screen is a usable editor, not a marketing or package page.

Acceptance:

- Grouped icon top bar renders.
- Layers tree renders.
- Floating Library renders with thumbnails.
- Canvas renders the straw subject.
- Inspector renders selected element properties.
- Behavior Log is visible or reachable.

## Phase 3 - Layers And Selection

Goal: visible hierarchy and selection are reliable.

Acceptance:

- Tree mirrors real DOM nesting.
- Text, icons, controls, and shapes appear under their actual parents.
- Canvas selection highlights tree row.
- Tree selection highlights canvas element.
- Group/delete/create updates tree immediately.

## Phase 4 - Placement Engine

Goal: movement behaves like a real visual editor.

Acceptance:

- Canvas drag computes placement intent.
- Auto-nesting works only on clear valid targets.
- Invalid leaf drops reject without mutating structure.
- Tree top/bottom zones reorder siblings.
- Library drag/drop uses the same rules.
- Behavior Log records accepted/rejected actions.

## Phase 5 - Snap, Guides, And Padding

Goal: placement is predictable and visible.

Acceptance:

- Drag snaps to grid, guides, parent content edges/centres, and sibling
  edges/centres.
- Smart guides show the active snap line.
- `Ctrl`/`Cmd` suppresses snap.
- `Alt` suppresses auto-nesting.
- Padding overlay is visible.
- Padding defines drop zone, snap targets, default placement, and align target.

## Phase 6 - Drawing And Shapes

Goal: the editor can create the primitives needed to rebuild its own UI.

Acceptance:

- Tools exist for container, text, rectangle, ellipse, line, icon, divider,
  swatch, input, row, and group.
- Created elements are editable DOM nodes.
- Created elements land in the selected valid parent or sensible root context.
- Shape-specific fields are editable in the inspector.

## Phase 7 - Library

Goal: reusable pieces are visible, searchable, and useful.

Acceptance:

- Library sections: Components, Assemblies, Products, Colours, Icons, Tokens,
  Styles.
- Every entry has a thumbnail or preview.
- Preview scale works.
- Save selection creates entries.
- Click and drag instantiation work.
- Saved entries preserve nested structure.
- GeoSee and package-seed entries are present as DOM templates.

## Phase 8 - Inspector And Variables

Goal: the inspector exposes the variables needed to recreate GeoSee panels.

Acceptance:

- Geometry, padding, gap, stack, alignment, kind, tier, name, notes, lock, and
  visibility are editable.
- Fill, opacity, radius, border, text, typography, blur, saturation, shadow,
  and line width are editable.
- GeoSee overlay, navigator, editor chrome, label, page row, and layer row
  presets apply compatible values.

## Phase 9 - Persistence And Reset

Goal: user edits survive reload and can be cleared deliberately.

Acceptance:

- Reload restores structure, parentage, order, geometry, styles, padding,
  guides, zoom, background, and library entries.
- Reset clears local editor state and reloads defaults.
- Undo/redo restores structural and property edits.

## Phase 10 - Verification

Goal: regressions are caught before handoff.

Acceptance:

- `node UI_EDITOR/tests/verify-gui-editor.js --timeout-ms 30000` passes.
- Tests cover rendering, nested tree, selection sync, snap, auto-nest, invalid
  rejection, tree reorder, library drag/drop, padding, zoom/background, and
  persistence.
- Generated test artifacts are cleaned up after verification unless needed for
  debugging.

## Future Phases

These are deliberately after the standalone editor is stable:

- Package export.
- Validation rule packs.
- AI-agent handoff.
- Host-app adapter.
- React/Vite package workbench resumption.
