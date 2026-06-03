# GUI Editor - Current Spec

This is the source of truth for the editor work.

The current editor is `UI_EDITOR/gui-editor.html`: a self-contained HTML/CSS/JS
file that edits real DOM nodes with a design overlay. It opens directly in a
browser, persists edits in `localStorage`, and does not require npm, Vite, a
server, package export, validation reports, or AI handoff files.

If another doc conflicts with this one, this one wins.

## 1. Current Model

- The canvas contains real HTML elements.
- Any element marked `data-c` is an editable container.
- Containers nest as real DOM parent/child nodes.
- Per-container edit state lives in `layout[id]`: offset, size, padding, gap,
  stack direction, kind, lock state, and style.
- Edits apply to the real element immediately and persist to `localStorage`.
- The old abstract package model is parked. Do not build current editor work
  around `frames.json`, `containers.json`, validation engines, change states, or
  generated AI briefs.

## 2. Required Editor Layout

```text
+--------------------------------------------------------------------------+
| Toolbar: Design | Grid | Snap | Create tools | Group | Delete | Undo     |
+------------+---------------------------------------------+---------------+
| Layers     | Canvas                                      | Inspector     |
| tree       | real UI + rulers + grid + design overlay    | Selection     |
|            | selectable boxes, handles, padding visuals  | Kind          |
| Sidebar    | alignment guides, snap, nesting             | Geometry      |
|   Brand    |                                             | Padding/Layout|
|   Pages    |                                             | Style         |
|   ...      |                                             | Notes         |
+------------+---------------------------------------------+---------------+
```

### 2.1 Layers Tree

- Mirrors actual `data-c` DOM nesting.
- Indents child containers under parent containers.
- Click in tree selects the same container on canvas.
- Selecting on canvas highlights the tree row.
- Dragging/reparenting must update the tree.
- If nesting is not visible in the tree, nesting is not working.

### 2.2 Canvas

- Shows the real UI, not a schema preview.
- Shows rulers, optional grid, selectable outlines, and resize handles.
- Shows visible padding for the selected or hovered container.
- Shows alignment guides while moving elements near sibling edges or centers.
- Supports move, resize, drag-to-nest, guide creation, grid snap, and undoable
  edits.

### 2.3 Inspector

For a single selected container, show these sections in order:

1. **Kind**: dropdown for `container`, `row`, `button`, `text`, `menu`,
   `menu-item`, `slider-row`, `card`, `panel`, `section`, `shape`, and `image`.
2. **Geometry**: X, Y, width, height.
3. **Padding and Layout**: top/right/bottom/left padding, gap, and stack mode.
4. **Style**: fill, alpha, radius, border, text color, and lock state.
5. **Notes**: human-readable name and intent.

The kind catalogs in docs 05, 14, 20, and 21 are reference lists only. They are
not instructions to rebuild the old package compiler.

## 3. Required Tools

| Tool | Requirement |
| --- | --- |
| Select | Click, shift-click, and tree selection work together. |
| Move | Drag selected containers with grid/sibling/guide snap. |
| Resize | Resize selected containers with handles. |
| Create | Add container, text, rectangle, ellipse, and row elements. |
| Nest | Drop an element into a container and update DOM plus tree. |
| Group | Wrap selected elements in a group container. |
| Align | Align or distribute selected elements. |
| Guides | Drag from rulers to create persistent snap guides. |
| Undo/Redo | Restore structural and property edits. |
| Reset | Clear saved local edits and reload defaults. |

Everything must operate on `layout[id]` and the real DOM.

## 4. Acceptance Checks

The editor is in good shape when all of these pass:

1. The left tree shows real nesting and stays synced with canvas selection.
2. Dragging container A into container B nests A under B and indents A in the
   tree.
3. Selecting a padded container shows its padding visually on the canvas.
4. Changing padding values updates the visible padding live.
5. Dragging near siblings shows alignment guides and snaps to edges/centers.
6. The Kind dropdown changes the selected container's kind, glyph/chrome, and
   relevant inspector fields.
7. Group, align/distribute, guide, grid, snap, undo, redo, and reset work.
8. Reload restores structure, nesting, padding, kind, style, and notes from
   `localStorage`.

## 5. Parked Work

These are not current editor requirements:

- React/Vite package workbench as the primary editor.
- Package folders and package export.
- `frames.json`, `containers.json`, `components.json`, or schema manifests.
- Validation rule packs and validation reports.
- Change-state machine.
- Write-server security model.
- AI-agent briefs, autonomous runbooks, or implementation handoff files.
- Host-app adapter work.

Keep those files only as history or reference until the standalone editor is
working well.
