# Canvas Engine

**Status:** active standalone editor spec.

This document defines how `gui-editor.html` places, moves, nests, snaps,
orders, draws, and persists editable DOM elements.

## Runtime Surface

- The canvas is a live DOM surface.
- Editable elements are real HTML nodes with `data-c`.
- Selection, tree rows, overlays, and inspector state all refer to the same DOM
  node id.
- `layout[id]` stores geometry, padding, stack, kind, tier, style, lock,
  visibility, notes, and related editor state.
- DOM parent/child structure and DOM order are the source of truth.

## Coordinate Spaces

The engine tracks:

- **Viewport coordinates:** pointer and browser event coordinates.
- **Canvas coordinates:** pointer coordinates after pan/zoom conversion.
- **Parent-local coordinates:** element x/y relative to its parent content box.
- **Content box:** parent bounds minus padding.
- **Visual bounds:** current painted box in canvas coordinates.

Every drag/drop operation converts once into canvas space, evaluates intent,
then writes parent-local geometry.

## Placement Intent

All placement actions compute one `DropIntent`:

| Intent | Meaning |
| --- | --- |
| `move` | Keep current parent and update geometry. |
| `nest` | Reparent into a valid container while preserving visual position. |
| `reorder-before` | Place before a sibling in DOM order. |
| `reorder-after` | Place after a sibling in DOM order. |
| `library-instantiate` | Create an editable copy from a Library entry. |
| `draw-create` | Create a new editable element from a tool. |
| `none` | Reject or ignore the drop. |

Canvas drag, tree drag, library drag, and draw-create use this same intent path.

## Valid Targets

Targets are rejected when they are:

- The dragged item.
- A descendant of the dragged item.
- Hidden or locked.
- A leaf kind: text, icon, line, divider, swatch, input, or scalar control.
- Outside the active editable canvas.

Containers, panels, rows, groups, assemblies, and product surfaces can accept
children. A leaf can accept children only after its kind is changed to a
container-like kind.

## Auto-Nesting

Auto-nesting is accepted when one of these is true:

- The dragged item is mostly inside a valid container.
- The pointer is clearly inside the valid parent content box.
- A library drop lands inside a valid padded content zone.

When multiple targets qualify, the deeper valid target wins. Brief cursor
crossing is not enough. If `Alt` is held, auto-nesting is suppressed and the
item stays in its current parent when possible.

## Reorder

Tree rows use three drop zones:

- Top half: `reorder-before`.
- Middle/content: `nest` when valid.
- Bottom half: `reorder-after`.

Canvas reorder is layout-aware:

- Column parents use vertical insertion lines.
- Row parents use horizontal insertion lines.
- Free parents preserve absolute placement unless the user clearly drops near a
  sibling boundary.

## Snapping

Snap targets include:

- Grid lines.
- Persistent user guides.
- Parent content edges and centre lines.
- Visible sibling edges and centre lines.

Snap excludes the dragged item, descendants, hidden items, and locked items.
Only the active x/y guides chosen by the solver are displayed. `Ctrl` or `Cmd`
temporarily disables snapping.

## Padding

Padding affects more than CSS:

- It defines the visible content zone.
- It is used for auto-nesting target tests.
- It contributes snap targets.
- It controls default placement for new children.
- It defines align-to-parent behavior for single-selection align.

Padding changes must update canvas shading and placement behavior immediately.

## Resize

Resize handles write width and height to `layout[id]`. The element remains in
the same parent unless the user performs a drag/drop action after resizing.
Snap may affect resize edges when snapping is enabled.

## Draw And Create

Creation tools generate editable DOM:

- Container
- Text
- Rectangle
- Ellipse
- Line
- Icon
- Divider
- Swatch
- Input
- Row
- Group

Default placement uses the selected valid parent content box. If the selected
item is a leaf, the new element is placed beside it under the same parent.

## Feedback

During interaction, the canvas shows:

- Selection outlines.
- Resize handles.
- Padding overlays.
- Candidate target outlines.
- Accept/reject states.
- Smart guide lines.
- Insertion lines for reorder.
- Library drag previews.

The Behavior Log records the committed or rejected action in plain language.

## Persistence

On reload, the editor must restore:

- DOM structure.
- Parentage and order.
- Geometry and padding.
- Guide positions.
- Zoom and background image.
- Library entries and floating panel state.

Any visual DOM change that is part of editing must be persisted.
