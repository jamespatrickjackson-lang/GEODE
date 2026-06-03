# Toolkit

**Status:** active standalone editor spec.

The toolkit is the top bar and interaction model for `gui-editor.html`.
Controls are grouped into named sections and use icons wherever possible.

## Top Bar Sections

| Section | Controls |
| --- | --- |
| Mode | Component, Assembly, Product. |
| View | Grid, snap, guides, zoom reset, background image. |
| Create | Select, container, text, rectangle, ellipse, line, icon, divider, swatch, input, row, group. |
| Arrange | Bring forward, send backward, reorder, group, delete. |
| Align | Align left, centre, right, top, middle, bottom, distribute. |
| Library | Toggle floating Library, save selection. |
| History | Undo, redo, reset. |

Text labels are allowed for section names and important commands. Tool buttons
should use familiar icons plus tooltips.

## Modes

Modes set authoring intent:

- Component mode defaults new saved entries to Components.
- Assembly mode defaults new saved entries to Assemblies.
- Product mode defaults new saved entries to Products.

Mode does not change the runtime or navigate away from the editor.

## Pointer Tools

### Select

- Click selects a canvas element.
- Tree row click selects the same element.
- Shift-click can add or remove from selection where multi-select is enabled.

### Move

- Drag selected elements on the canvas.
- Use placement intent to decide move, nest, reorder, or reject.
- Show smart guides, target outline, insertion line, and Behavior Log updates.

### Resize

- Handles resize the selected element.
- Snap can affect resize edges.
- Resize does not auto-nest.

### Draw/Create

The active create tool inserts a new editable element. Drag-create should draw
from pointer down to pointer up where supported. Click-create uses the selected
valid parent or current viewport center.

## Keyboard And Modifiers

| Input | Behavior |
| --- | --- |
| `Alt` during drop | Suppress auto-nesting. |
| `Ctrl` or `Cmd` during drag | Suppress snapping. |
| `Delete` / `Backspace` | Delete selected editable elements. |
| `Ctrl/Cmd+Z` | Undo. |
| `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` | Redo. |
| Mouse wheel | Zoom canvas in/out around the pointer where possible. |

Shortcuts must not hide required UI. Every important action also needs a
visible control.

## Creation Defaults

New elements use the active mode and selected context:

- Inside valid selected container: place inside its padded content box.
- Selected leaf: place beside the leaf under its parent.
- No selection: place in the root product surface.
- Library drag: use the same placement engine as canvas drag.

## Arrange And Align

- Arrange operations update DOM order.
- Single-selection align uses the parent content box.
- Multi-selection align/distribute requires a common parent or explicit
  selection bounds.
- Distribute requires at least three selected elements.
- Cross-parent distribute is rejected and logged.

## Background And Zoom

- Background image loading is a first-class view tool.
- Wheel zoom must not resize the actual DOM data.
- Zoom state persists.
- Reset view returns to a predictable canvas view without clearing design data.

## Tool Acceptance

The toolkit is correct when:

1. Every active action has a visible top-bar control.
2. Controls are grouped and named.
3. Icons are used for compact tool buttons.
4. Tooltips explain unfamiliar icons.
5. Pointer and keyboard paths produce the same persisted edits.
