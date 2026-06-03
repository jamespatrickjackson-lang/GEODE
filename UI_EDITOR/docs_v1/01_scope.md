# Current Scope

## 1. Goal

Make the standalone GUI editor in `UI_EDITOR/gui-editor.html` a complete,
usable direct-manipulation editor for GeoSee-style panels before resuming any
package export, validation, AI handoff, or embedded-host work.

The editor edits real DOM. Every editable object is a real HTML element marked
with `data-c`. Nesting is real parent/child DOM nesting. State is persisted in
`localStorage`.

## 2. In Scope Now

### 2.1 Authoring modes

- **Component** mode edits leaf controls: text, icons, lines, shapes, swatches,
  dividers, and inputs.
- **Assembly** mode edits reusable composites: icon-label rows, buttons,
  labelled sliders, labelled numeric controls, and small tool rows.
- **Product** mode edits full GeoSee surfaces: sidebars, page managers,
  overlay cards, navigator bars, layer-card stacks, and floating HUD panels.

### 2.2 Layers tree

- Left panel shows a real tree of every editable `data-c` element.
- The tree mirrors DOM nesting, including nested text/icons inside rows.
- Tree and canvas selection stay synced.
- Tree state stays coherent after create, group, delete, drag-to-nest, and
  library instantiation.

### 2.3 Canvas editing

- Design overlay outlines editable elements.
- Drag moves selected elements.
- Resize handle resizes selected elements.
- Dragging onto another container nests into that container.
- Grid, snap, rulers, guides, and alignment guides are editor features.
- Padding is visible on the selected container.

### 2.4 Creation tools

- Add Container, Text, Rect, Ellipse, Line, Icon, Divider, Swatch, Input, and
  Row.
- New elements are created inside the selected container when it can accept
  children; otherwise they are created beside the selected leaf.
- Group wraps a selection into a movable group.
- Undo and redo cover structural and property edits.

### 2.5 Inspector and variables

For one selected element, the inspector exposes:

- Kind picker.
- Tier picker.
- Save as Component / Assembly / Product.
- GeoSee variable presets: overlay card, navigator, editor chrome, label.
- Geometry: x, y, width, height.
- Padding and layout: per-side padding, gap, stack mode.
- Style: fill, opacity, radius, border, text, lock.
- Notes: name and intent text.

### 2.6 Libraries

- Library panel includes Components, Assemblies, Products, Colours, Icons,
  Tokens, and Styles.
- Starter entries are available immediately.
- Saved selections appear in the matching tier library.
- Clicking a library component instantiates it on the canvas and preserves
  nested DOM where available.

### 2.7 Documentation hygiene

- Current docs point at `gui-editor.html`.
- Old package/AI automation docs stay parked under `_superseded/`.
- Active docs may reference old catalogs only as reference material, never as
  build instructions.

## 3. Parked Scope

These are explicitly on hold:

- AI-agent briefs and autonomous agent build runbooks.
- Package export and round-trip.
- Validation engine and validation reports.
- Change-state machine.
- Vite write plugin and package filesystem mutation.
- React package workbench as the main editor.
- Host-App Adapter implementation.
- Embedded GeoSee editing.

The code for some parked items still exists and may still build. That does not
make it active product scope.

## 4. Done Criteria

The standalone editor is in a good state when all of these are true:

1. The first screen shows modes, layers, library, canvas, and inspector.
2. The layers tree shows nested children under parents.
3. Selecting a tree row selects the matching canvas element.
4. Selecting a canvas element highlights the matching tree row.
5. Changing Kind updates the selected element and tree glyph.
6. Changing padding visibly updates padding shading.
7. Drag-to-nest changes real DOM nesting and the tree updates immediately.
8. Drawing and creation tools create editable DOM nodes.
9. Save as Component / Assembly / Product creates library entries.
10. Clicking a library entry instantiates it.
11. Reload restores edited structure.
12. Docs and launchers no longer steer users toward paused package/AI work.
