# Interactive Overlays And Primitives

**Status:** active standalone editor overlay spec.

Overlays are editor feedback layers. They must help the user understand and
control the design, and they must not be left as always-on debug visuals.

## Editor Overlays

| Overlay | Purpose | Default |
| --- | --- | --- |
| Selection outline | Shows selected editable element. | On for selected item. |
| Hover outline | Shows pointer target. | On while hovering. |
| Resize handles | Allows resizing selected element. | On when selected and unlocked. |
| Padding overlay | Shows selected parent content inset. | On for selected containers. |
| Smart guides | Shows active snap line. | On during snap. |
| User guides | Persistent snap/reference guides. | On when guides enabled. |
| Grid | Canvas spacing reference. | Toggleable. |
| Drop target outline | Shows likely nest target. | On during drag. |
| Reject state | Shows invalid drop target. | On during rejected drag/drop. |
| Insertion line | Shows before/after sibling order. | On during reorder. |
| Library drag preview | Shows item being instantiated. | On during library drag. |
| Background image | Reference image behind canvas. | User loaded. |

Debug overlays must be named, toggleable, and default off.

## Primitive Controls

The editor must be able to create and edit:

- Container.
- Text.
- Icon.
- Rectangle.
- Ellipse.
- Line.
- Divider.
- Swatch.
- Input.
- Row.
- Group.
- Slider row assembly.
- Icon-label row assembly.
- Overlay card.
- Navigator group.

## Padding Primitive

Padding is both visual and behavioral:

- Overlay shows top/right/bottom/left inset.
- Inspector edits values.
- New children land inside the content box.
- Snap targets include content edges.
- Drop target scoring uses content box, not outer border.

## Guides Primitive

Guides are persistent snap references:

- They can be created through ruler/guide controls where supported.
- They are visible when guides are enabled.
- They contribute snap targets.
- They persist after reload.

## Background Image Primitive

Background image loading supports reconstruction and comparison:

- User can load a local/reference image.
- Image sits behind the editable DOM surface.
- Wheel zoom should keep canvas and background aligned.
- Background state persists after reload.

## Behavior Log Primitive

Behavior Log is an editor primitive because it explains placement decisions.
It records accepted/rejected actions and helps diagnose where the placement
engine is still weak.

## Acceptance

1. Every overlay has a clear purpose.
2. Placement feedback appears before structural mutation.
3. Debug-only visuals are toggleable and default off.
4. Padding, guides, smart guides, insertion lines, and library previews render
   coherently over the canvas.
5. Background image and zoom work together.
