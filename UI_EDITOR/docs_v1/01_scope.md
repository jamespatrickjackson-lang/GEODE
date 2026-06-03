# Current Scope

## Goal

Make `UI_EDITOR/gui-editor.html` a complete standalone direct-manipulation
editor for GeoSee-style panels before resuming package export, validation,
AI handoff, or embedded-host work.

The editor edits real DOM. Every editable object is a real HTML element marked
with `data-c`. Nesting is real parent/child DOM nesting. State persists in
`localStorage`.

## In Scope Now

### Authoring Modes

- **Component** mode edits leaf controls: text, icons, lines, shapes, swatches,
  dividers, inputs, and icon buttons.
- **Assembly** mode edits reusable composites: icon-label rows, buttons,
  labelled sliders, labelled numeric controls, nested section headers, and
  small tool rows.
- **Product** mode edits full GeoSee surfaces: sidebars, page managers,
  overlay cards, navigator bars, layer-card stacks, tool palettes, and
  floating HUD panels.

### Layers Tree

- The left panel shows every editable `data-c` element.
- The tree mirrors DOM nesting, including nested text/icons inside rows.
- Canvas and tree selection stay synced.
- Tree drag supports before, after, and nest zones.
- Tree state stays coherent after create, group, delete, drag-to-nest,
  reorder, and library instantiation.

### Canvas Editing

- Design overlay outlines editable elements.
- Drag moves selected elements.
- Resize handles resize selected elements.
- Snapping uses grid, persistent guides, parent content edges/centres, and
  sibling edges/centres.
- Auto-nesting happens only when a valid target is clear by overlap or content
  zone.
- Invalid targets show rejection feedback and do not mutate parentage.
- Padding is visible on the selected container and is used for placement.
- Wheel zoom and background image loading are active editor features.

### Creation Tools

- Add Container, Text, Rect, Ellipse, Line, Icon, Divider, Swatch, Input, Row,
  and Group.
- New elements are created inside the selected container when it can accept
  children; otherwise they are created beside the selected leaf.
- Library click and drag create editable DOM instances.
- Undo and redo cover structural and property edits.

### Inspector And Variables

For one selected element, the inspector exposes:

- Kind and tier.
- Save as Component, Assembly, or Product.
- GeoSee variable presets: overlay card, navigator, editor chrome, label,
  page row, layer row, and control row.
- Geometry: x, y, width, height.
- Padding and layout: per-side padding, gap, stack direction, alignment.
- Style: fill, opacity, radius, border, text, typography, blur, saturation,
  shadow, line width, lock, and visibility.
- Notes: name and intent.

### Libraries

- The Library is a floating searchable panel.
- Sections: Components, Assemblies, Products, Colours, Icons, Tokens, Styles.
- Every entry has a visible thumbnail or preview, not just a name.
- Preview scale is adjustable.
- Saved selections appear in the matching library section.
- Library drag uses the same placement engine as canvas drag.
- Read-only package catalog entries may seed the Library, but package export is
  still parked.

### Documentation Hygiene

- Current docs point at `gui-editor.html`.
- Old package/AI automation docs stay parked or archived.
- Active docs may reference old catalogs only as seed/reference material, never
  as build instructions.

## Parked Scope

These are explicitly on hold:

- AI-agent briefs and autonomous build runbooks.
- Package export and round-trip.
- Validation engine and validation reports.
- Change-state machine.
- Vite write plugin and package filesystem mutation.
- React package workbench as the main editor.
- Host-App Adapter implementation.
- Embedded GeoSee editing.

The code for some parked items still exists and may still build. That does not
make it active product scope.

## Done Criteria

The standalone editor is in a good state when all of these are true:

1. The first screen shows modes, grouped icon top bar, layers, floating
   library, canvas, and inspector.
2. The layers tree shows nested children under parents.
3. Selecting a tree row selects the matching canvas element.
4. Selecting a canvas element highlights the matching tree row.
5. Changing Kind updates the selected element and tree glyph.
6. Changing padding visibly updates padding shading and child placement.
7. Drag-to-nest changes real DOM nesting and the tree updates immediately.
8. Invalid drops are visibly rejected and keep the previous parent.
9. Tree row top/bottom drops reorder siblings before/after.
10. Canvas and library drags snap to valid targets and show smart guides.
11. Drawing and creation tools create editable DOM nodes.
12. Save as Component / Assembly / Product creates library entries.
13. Clicking or dragging a library entry instantiates it with a thumbnail-backed
    preview.
14. Reload restores edited structure, geometry, parentage, order, library,
    zoom, background, and guides.
15. Docs and launchers no longer steer users toward paused package/AI work.
