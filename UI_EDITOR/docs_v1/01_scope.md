# Current Scope

## 1. Goal

Make the standalone GUI editor in `UI_EDITOR/gui-editor.html` a complete,
usable direct-manipulation editor for GeoSee-style panels before resuming any
package export, validation, AI handoff, or embedded-host work.

The editor edits real DOM. Every editable object is a real HTML element marked
with `data-c`. Nesting is real parent/child DOM nesting. State is persisted in
`localStorage`.

## 2. In Scope Now

### 2.1 Standalone editor

- `gui-editor.html` is the active app.
- `Launch UI Editor.cmd` and `Open GUI Editor.cmd` open that file directly.
- No npm, server, package write plugin, validation engine, or build step is
  required for normal editor use.

### 2.2 Layers tree

- Left panel shows a real tree of every editable `data-c` element.
- The tree mirrors DOM nesting.
- Selecting a row selects the same element on canvas.
- Selecting on canvas highlights the same tree row.
- Tree state must stay coherent after create, group, delete, and drag-to-nest.

### 2.3 Canvas editing

- Design overlay outlines editable containers.
- Drag moves selected elements.
- Resize handle resizes selected elements.
- Dragging onto another container nests into that container.
- Grid, snap, rulers, guides, and alignment guides are editor features, not
  package-schema features.
- Padding is visible on selected or hovered containers.

### 2.4 Inspector

For one selected container, the inspector exposes:

- Kind picker.
- Geometry: x, y, width, height.
- Padding and layout: per-side padding, gap, stack mode.
- Style: fill, opacity, radius, border, text, lock.
- Notes: name and intent text.

### 2.5 Creation and structure tools

- Add Container, Text, Rect, Ellipse, and Row.
- New elements are created inside the selected container when possible.
- Group wraps a selection into a movable group.
- Delete removes selected elements.
- Undo and redo cover structural and property edits.

### 2.6 Persistence

- Reload restores structure, nesting, geometry, padding, kind, style, notes,
  guides, and history-relevant saved state from `localStorage`.
- Reset clears saved editor state after confirmation or clearly labeled action.

### 2.7 Documentation hygiene

- Current docs must point at `gui-editor.html`.
- Old package/AI automation docs must stay parked under `_superseded/`.
- Active docs may reference old catalogs only as reference material, never as
  build instructions.

## 3. Parked Scope

These are explicitly on hold:

- AI-agent briefs.
- Autonomous agent build runbooks.
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

1. `Launch UI Editor.cmd` opens `gui-editor.html`.
2. The first screen shows the layers tree, canvas, and inspector without
   requiring horizontal or vertical rescue scrolling.
3. Selecting a tree row selects the matching canvas element.
4. Selecting a canvas element highlights the matching tree row.
5. Changing Kind updates the selected element and tree glyph without breaking
   saved state.
6. Changing padding visibly updates padding shading.
7. Drag-to-nest changes real DOM nesting and the tree updates immediately.
8. Add, Group, Delete, Undo, Redo, grid, snap, guides, and alignment controls
   work without console errors.
9. Reload restores the same edited structure.
10. The docs and launchers no longer steer users toward the paused package/AI
    workbench as the current editor.
