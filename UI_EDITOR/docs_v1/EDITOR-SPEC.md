# GUI Editor - Current Spec

This is the source of truth for the editor work.

The current editor is `UI_EDITOR/gui-editor.html`: a self-contained HTML/CSS/JS
file that edits real DOM nodes with a design overlay. It opens directly in a
browser, persists edits in `localStorage`, and does not require npm, Vite, a
server, package export, validation reports, or AI handoff files.

If another doc conflicts with this one, this one wins.

## 1. Current Model

- The canvas contains real HTML elements.
- Any element marked `data-c` is editable.
- Elements nest as real DOM parent/child nodes.
- Per-element edit state lives in `layout[id]`: offset, size, padding, gap,
  stack direction, kind, tier, lock state, notes, and style.
- Library state lives in browser-local storage alongside the DOM snapshot.
- Read-only seed catalogs from `packages/geosee_editor_sidebar` may populate
  the Library panel. They are input catalogs only; the edited surface remains
  live DOM in `gui-editor.html`.
- The old abstract package model is parked. Do not build current editor work
  around `frames.json`, `containers.json`, validation engines, change states, or
  generated AI briefs.

## 2. Authoring Modes

| Mode | Purpose | Valid work |
| --- | --- | --- |
| Component | Atomic leaves | Text, icon, line, divider, shape, swatch, input. |
| Assembly | Small reusable composites | Icon-label rows, buttons, labelled sliders, labelled numeric controls. |
| Product | Full GeoSee UI surfaces | Sidebars, page managers, overlay cards, navigator bars, layer stacks. |

Modes change authoring intent and the default tier for new/saved items. They do
not create separate apps or runtimes.

## 3. Required Editor Layout

```text
+--------------------------------------------------------------------------------+
| Toolbar: modes | Design | Grid | Snap | Create tools | Group | Delete | Undo    |
+------------+-----------+--------------------------------------+----------------+
| Layers     | Library   | Canvas                               | Inspector      |
| tree       | assets    | real UI + rulers + grid + overlay    | Selection      |
| Sidebar    | C/A/P     | selectable boxes, handles, padding   | Kind / Tier    |
|   Brand    | tokens    | alignment guides, snap, nesting      | Geometry       |
|   Pages    | styles    |                                      | Padding/Layout |
+------------+-----------+--------------------------------------+----------------+
```

## 4. Required Tools

| Tool | Requirement |
| --- | --- |
| Select | Click, shift-click, and tree selection work together. |
| Move | Drag selected elements with grid/sibling/guide snap. |
| Resize | Resize selected elements with handles. |
| Create | Add container, text, rectangle, ellipse, line, icon, divider, swatch, input, and row elements. |
| Nest | Drop an element into a container and update DOM plus tree. |
| Group | Wrap selected elements in a group container. |
| Align | Align or distribute selected elements. |
| Library | Save selections as Components, Assemblies, or Products and instantiate entries. |
| Package seeds | Import `libraries.json`, `components.json`, `containers.json`, and `tokens.json` as read-only Library entries when available. |
| GeoSee presets | Apply overlay-card, navigator, editor-chrome, and label variable presets. |
| Guides | Drag from rulers to create persistent snap guides. |
| Undo/Redo | Restore structural and property edits. |
| Reset | Clear saved local edits and reload defaults. |

Everything must operate on `layout[id]` and the real DOM.

## 5. Acceptance Checks

The editor is in good shape when all of these pass:

1. Component / Assembly / Product modes exist and switch active state.
2. The left tree shows real nesting and stays synced with canvas selection.
3. Text and icons inside rows appear as children in the tree.
4. Dragging container A into container B nests A under B and indents A in the
   tree.
5. Selecting a padded container shows its padding visually on the canvas.
6. Changing padding values updates the visible padding live.
7. Drawing and creation tools create editable DOM nodes.
8. The Kind dropdown changes the selected element's kind and tree glyph.
9. Save as Component / Assembly / Product creates library entries.
10. Clicking a library entry instantiates it.
11. GeoSee variable presets appear and apply to a selected element.
12. GeoSee-derived and package-backed Library entries are present.
13. Style and token entries can apply compatible values such as panel width,
    blur/saturation, text colour, border alpha, shadows, typography, and line
    width.
14. Group, align/distribute, guide, grid, snap, undo, redo, and reset work.
15. Reload restores structure, nesting, padding, kind, tier, style, notes, and
    library entries from `localStorage`.

## 6. GeoSee Concept Sources

Use the real GeoSee editor and Base GUI as concept references:

- GUI variables: overlay, navigator, labels, editor chrome, active overlay
  style, logo.
- Containers: editor sidebar shell, section stack, collapsible section, nested
  section header, layer tool container, control row, save footer, overlay card,
  navigator group, virtual capability container.
- Workflows: Pages, Cards, Cinematics, GUI Styles, Client Logo, Topo, Sections,
  layer visibility/opacity/fog, provenance, render preset, page override,
  environment inheritance, Sub Master/page child hierarchy.

Do not flatten GeoSee inheritance or topo material authority when using these
concepts. The standalone editor is a UI authoring surface, not the GeoSee
project persistence layer.

The current Library should house both:

- Hand-authored GeoSee reference entries from the real editor/Base GUI.
- Read-only imported entries from `packages/geosee_editor_sidebar` package
  catalogs.

Imported entries are allowed because they help find standalone editor gaps.
They do not resume package export, validation, or AI handoff behavior.

## 7. Parked Work

These are not current editor requirements:

- React/Vite package workbench as the primary editor.
- Package export.
- Package schemas as the runtime model. `components.json`, `containers.json`,
  and token catalogs may be read as Library seeds only.
- Validation rule packs and validation reports.
- Change-state machine.
- Write-server security model.
- AI-agent briefs, autonomous runbooks, or implementation handoff files.
- Host-app adapter work.

Keep those files only as history or reference until the standalone editor is
working well.
