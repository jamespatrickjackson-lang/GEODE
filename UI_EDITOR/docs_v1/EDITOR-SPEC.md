# GUI Editor - Current Spec

This is the source of truth for the editor work.

The current editor is `UI_EDITOR/gui-editor.html`: a self-contained HTML/CSS/JS
file that edits real DOM nodes with a design overlay. It opens directly in a
browser, persists edits in `localStorage`, and does not require npm, Vite, a
server, package export, validation reports, or AI handoff files.

If another doc conflicts with this one, this one wins.

## Runtime Model

- The canvas contains real HTML elements.
- Any element marked `data-c` is editable.
- Elements nest as real DOM parent/child nodes.
- DOM order is the persisted layer order.
- Per-element edit state lives in `layout[id]`: offset, size, padding, gap,
  stack direction, kind, tier, lock, visibility, notes, and style.
- Library state lives in browser-local storage alongside the DOM snapshot.
- Read-only seed catalogs from `packages/geosee_editor_sidebar` may populate
  the Library panel. They are input catalogs only.
- The old abstract package model is parked. Do not build current editor work
  around package schemas, validation engines, change states, or generated AI
  briefs.

## Authoring Modes

| Mode | Purpose | Valid work |
| --- | --- | --- |
| Component | Atomic leaves | Text, icon, line, divider, shape, swatch, input, icon button. |
| Assembly | Small reusable composites | Icon-label rows, buttons, labelled sliders, labelled numeric controls, section headers. |
| Product | Full GeoSee UI surfaces | Sidebars, page managers, overlay cards, navigator bars, layer stacks, HUD controls. |

Modes change authoring intent and the default tier for new/saved items. They do
not create separate apps or runtimes.

## Required Layout

```text
+--------------------------------------------------------------------------------+
| Top bar: modes | view | background | create | arrange | align | history        |
+------------+------------------+------------------------------+----------------+
| Layers     | Floating Library | Canvas                       | Inspector      |
| tree       | C/A/P/tokens     | real UI + rulers + grid      | Selection      |
| Sidebar    | thumbnails       | guides, snap, nesting        | Kind / Tier    |
|   Header   | search + scale   | handles, padding, feedback   | Geometry       |
|   Rows     |                  | behavior log                 | Style/Layout   |
+------------+------------------+------------------------------+----------------+
```

The Library is floating so the canvas and layer tree stay usable while browsing
assets.

## Tools

| Tool | Requirement |
| --- | --- |
| Select | Click, shift-click, and tree selection work together. |
| Move | Drag selected elements with grid, sibling, parent-content, and guide snap. |
| Resize | Resize selected elements with handles. |
| Draw/Create | Add container, text, rectangle, ellipse, line, icon, divider, swatch, input, row, and group elements. |
| Nest | Drop an element into a valid container and update DOM plus tree. |
| Reorder | Tree drops and layout-aware canvas drops can place before or after siblings. |
| Group | Wrap selected elements in a group container. |
| Align | Align or distribute selected elements when the selection context is valid. |
| Library | Save selections and instantiate entries by click or drag. |
| Package seeds | Import package catalogs as read-only Library seeds when available. |
| GeoSee presets | Apply overlay-card, navigator, editor-chrome, label, page-row, and layer-row presets. |
| Guides | Create persistent snap guides and snap to them. |
| Undo/Redo | Restore structural and property edits. |
| Reset | Clear saved local edits and reload defaults. |

Everything operates on `layout[id]` and the real DOM.

## Placement Engine

Canvas drag, library drag, tree drag, and draw-create all resolve through the
same placement rules.

### Drop Intent

The engine computes one of these intents before commit:

- `move`: keep the same parent and update geometry.
- `nest`: move into a valid container and preserve visual position.
- `reorder-before`: place before a sibling.
- `reorder-after`: place after a sibling.
- `library-instantiate`: create an editable copy from a Library entry.
- `draw-create`: create a new editable object.
- `none`: reject or ignore the drop.

### Candidate Scoring

Targets are scored by:

- Pointer position inside the target content zone.
- Overlap ratio between dragged item and candidate container.
- Candidate depth, with deeper valid containers preferred.
- Valid child rules.
- Parent padding and content box.
- Whether the candidate is hidden, locked, the dragged item, or a descendant.

Hidden, locked, self, descendant, and leaf targets are excluded.

### Modifiers

- `Alt` suppresses auto-nesting and keeps the current parent when possible.
- `Ctrl` or `Cmd` suppresses snapping.
- Invalid drops show rejected feedback and keep the previous structure.

## Snapping

Snap targets include:

- Grid intersections.
- Persistent user guides.
- Parent content left, right, top, bottom, and centre lines.
- Visible sibling left, right, top, bottom, and centre lines.

Snap excludes dragged items, descendants, hidden items, and locked items. The
canvas shows only the active x/y smart guide lines used for the current move.

## Nesting And Ordering

- Containers, panels, rows, groups, assemblies, and product surfaces can accept
  children.
- Text, icons, lines, dividers, swatches, inputs, and leaf controls cannot
  accept children unless their kind is changed to a container-like kind.
- Auto-nest only when overlap or content-zone targeting is clear.
- Tree rows expose top, middle, and bottom drop zones: before, nest, after.
- Row/column parents show insertion lines and place children in flow order.
- Free parents preserve absolute child placement.
- DOM order remains the source of truth and the tree mirrors it.

## Inspector

The inspector edits the selected element:

- Identity: name, kind, tier, notes.
- Geometry: x, y, width, height.
- Layout: padding, gap, stack direction, alignment.
- Material: fill, opacity, blur, saturation, shadow.
- Stroke: border color, border alpha, border width, line width.
- Typography: font family, size, weight, color, label style.
- State: visible, locked.
- Library: save as Component, Assembly, or Product.

Single-selection align uses the parent content box. Multi-selection align and
distribute require a valid common parent or explicit selection bounds.

## Library

The Library contains:

- Components: leaves and small atomic controls.
- Assemblies: reusable nested structures.
- Products: larger authoring surfaces.
- Colours: swatches and material colors.
- Icons: visible glyph thumbnails and scalable icon entries.
- Tokens: spacing, sizing, typography, opacity, radius, and material values.
- Styles: overlay cards, navigator, editor chrome, labels, rows, and panels.

Every entry needs a visible thumbnail or preview. Click inserts at a sensible
default inside the selected valid parent. Drag uses the full placement engine.
Saved entries preserve nested structure.

## Behavior Log

The editor keeps a concise user-facing behavior log. Examples:

- `Nested Text into Sidebar`
- `Reordered Button before Slider`
- `Snapped x to Layer row right edge`
- `Cannot nest Icon inside Text`
- `Cannot drop parent into descendant`

This is product feedback, not noisy debug output.

## Persistence

Reload must restore:

- Element structure, parentage, order, geometry, padding, layout, styles, kind,
  tier, names, and notes.
- Library entries, search state where useful, preview scale, and floating panel
  position.
- Zoom, background image, grid, snap, and guides.

## GeoSee Concept Sources

Use the real GeoSee editor and Base GUI as concept references:

- GUI variables: overlay, navigator, labels, editor chrome, active overlay
  style, logo, page indent, bar radius, slider sizing, save icon sizing.
- Containers: editor sidebar shell, section stack, collapsible section, nested
  section header, layer tool container, control row, save footer, overlay card,
  navigator group, virtual capability container.
- Workflows: Pages, Cards, Cinematics, GUI Styles, Client Logo, Topo, Sections,
  layer visibility/opacity/fog, provenance, render preset, page override,
  environment inheritance, Sub Master/page child hierarchy.

Do not flatten GeoSee inheritance or topo material authority when using these
concepts. The standalone editor is a UI authoring surface, not the GeoSee
project persistence layer.

## Acceptance Checks

The editor is in good shape when all of these pass:

1. Component / Assembly / Product modes exist and switch active state.
2. Top bar controls are grouped into named icon sections.
3. The left tree shows real nesting and stays synced with canvas selection.
4. Text, icons, shapes, and controls appear under their actual parent.
5. Dragging into a valid padded container nests and preserves visual position.
6. Dragging over text/icon/input is rejected and leaves parentage unchanged.
7. Tree top/bottom drops reorder siblings before/after.
8. Canvas drags snap to sibling edges/centres, parent content edges, guides,
   and grid, with visible smart guides.
9. Holding `Alt` suppresses auto-nesting.
10. Holding `Ctrl` or `Cmd` suppresses snapping.
11. Selecting a padded container shows visible padding.
12. Changing padding updates placement and padding shading live.
13. Creation tools create editable DOM nodes.
14. The Kind dropdown changes the selected element kind and tree glyph.
15. Save as Component / Assembly / Product creates library entries.
16. Clicking and dragging library entries instantiate editable DOM copies.
17. Library entries show thumbnails and respect preview scale.
18. GeoSee variable presets appear and apply to a selected element.
19. Background image loading and wheel zoom work.
20. Behavior Log reports accepted and rejected actions.
21. Reload restores structure, nesting, order, geometry, padding, guides,
    zoom, background, style, notes, and library entries.

## Parked Work

These are not current editor requirements:

- React/Vite package workbench as the primary editor.
- Package export or package schemas as the runtime model.
- Validation rule packs and validation reports.
- Change-state machine.
- Write-server security model.
- AI-agent briefs, autonomous runbooks, or implementation handoff files.
- Host-app adapter work.

Keep those files only as history or reference until the standalone editor is
working well.
