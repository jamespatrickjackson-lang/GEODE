# GUI Editor — the real spec (single source of truth)

This is the **north-star** doc. It describes the editor that actually exists and
ships: `UI_EDITOR/gui-editor.html` (and the synced copy in `UI_EDITOR_v1_0/`).
A single self-contained HTML file, vanilla JS, no build, no server, persists to
`localStorage`. It edits **real DOM** with a design overlay — it is **not** a
JSON-schema modeler.

If anything here conflicts with the older numbered docs, **this wins**. The
docs that pushed the wrong (abstract JSON "Package") model have been moved to
`docs_v1/_superseded/` — see the README note.

---

## 1. The model (read this first)

- The canvas holds **real HTML elements**. Anything marked `data-c` is an
  editable **container** (the word covers everything: a sidebar, a row, a
  button, a text node, a shape).
- Containers **nest** by being real DOM children of other containers. Nesting is
  parent→child in the actual tree, so a child moves with its parent and obeys
  the parent's layout (padding, gap, stack direction).
- Each container has **edit state** in `layout[id]` (offset, size, padding,
  gap, stack, kind, lock, style) persisted to `localStorage`. State is applied
  to the real element every change.
- There is **no abstract package, no frames.json, no validation engine, no
  change-state machine**. Those belong to the superseded model. Delete that
  idea from your head.

## 2. Layout (three panels)

```text
┌───────────────────────────────────────────────────────────────────────┐
│ Toolbar: Design | Grid | Snap | + Container/Text/Rect/Ellipse/Row |    │
│          Group | Delete | Align ▾ | Undo | Redo | Reset                │
├───────────┬───────────────────────────────────────────┬───────────────┤
│ LAYERS    │  CANVAS (rulers + grid + design overlay)  │ INSPECTOR     │
│ (tree)    │                                           │               │
│           │   real UI with outline boxes on each      │ Kind picker   │
│ Sidebar   │   container; drag/resize/snap/guides;     │ Geometry      │
│  ├ Brand  │   VISIBLE padding shading inside a        │ Padding+layout│
│  ├ Pages  │   selected container; alignment guides    │ Style         │
│  ├ …      │   between siblings while dragging         │ AI note       │
│  └ Footer │                                           │               │
└───────────┴───────────────────────────────────────────┴───────────────┘
```

### 2.1 Layers tree (left) — REQUIRED

- A real tree mirroring the DOM nesting of every `data-c` container.
- Indented by depth. Each row: a disclosure caret (if it has children), a kind
  glyph, the container's label, and a lock/hide affordance.
- Click a row → selects that container on the canvas (and vice-versa: selecting
  on canvas highlights the tree row).
- Drag a tree row onto another row → reparents (same as drag-to-nest on canvas).
- The tree is the authoritative view of structure. If you can't see nesting in
  the tree, nesting is broken.

### 2.2 Canvas (centre)

- Rulers (top/left), optional grid, the real UI, and a **design overlay** of
  outline boxes (one per container) that carry the drag/resize handles.
- **Visible padding** — REQUIRED. When a container is selected (or hovered),
  shade its padding region (the inset between its border box and content box)
  so the author SEES the padding, not just a number. Each side uses its
  resolved padding value.
- **Alignment guides** — REQUIRED. While dragging, show thin lines when the
  moving element's edge/centre aligns with a sibling's edge/centre (and snap to
  it). This is how you align containers to each other.
- Drag to move, corner handle to resize, drag-onto-a-container to nest, drag
  from a ruler to drop a persistent guide.

### 2.3 Inspector (right)

For the selected container, in order:

1. **Kind** — a dropdown to set *what this container is*: `group`, `row`,
   `button`, `text`, `menu`, `menu-item`, `slider-row`, `card`, `panel`,
   `section`, `shape`, `image`. The kind drives default chrome + which inspector
   fields show + the glyph in the tree. The kind list is sourced from the
   archetype catalogs (docs 14 / 20 / 21) — those catalogs are the *menu of
   kinds*, nothing more.
2. **Geometry** — X, Y, Width, Height.
3. **Padding & layout** — per-side padding (T/R/B/L), gap, stack
   (free / column / row). Column/row makes the container lay its children in
   flow with the gap; free leaves them absolutely placed. Padding is shown
   visually on canvas (§2.2).
4. **Style** — fill (+alpha), radius, border, text, lock.
5. **AI note** — name + intent + behaviour. Free text. This is the payload a
   downstream agent reads to know what the container is *for*. (Concept survives
   from the old intent-annotations idea; the schema machinery does not.)

## 3. Tools (and how they work together)

| Tool | What it does | Works with |
| --- | --- | --- |
| **Select** | Click / shift-click / marquee select | Inspector, tree, align |
| **Move** (drag) | Translate; snaps to grid + sibling edges/centres + guides; shows alignment guides | Snap, guides, nesting |
| **Resize** (corner handle) | Resize selected; snaps to grid | Snap |
| **+ Container / Text / Rect / Ellipse / Row** | Create that element; **into the selected container if one is selected** (nesting), else into host root | Tree, nesting, kind |
| **Drag-to-nest** | Drop an element over a container → it becomes that container's child (Alt to drop free) | Tree, padding/stack |
| **Group** (Ctrl/Cmd+G) | Wrap selection in a group container; group moves children together | Tree |
| **Align ▾** | Align selection left/centre/right/top/middle/bottom and distribute, to the selection's bounds (≥2) or the parent (1) | Selection, snap |
| **Guides** | Drag from a ruler to drop a persistent snap line | Move/resize snap |
| **Undo / Redo** | History of all structural + property edits | everything |
| **Reset** | Clear saved edits | localStorage |

Everything mutates `layout[id]` + the real DOM and saves to `localStorage`.
There is no "validate", "export package", or "change state" — those were the
wrong model.

## 4. Acceptance — the editor is right when ALL hold

1. The **left tree** shows the real nesting; expanding a node shows its
   children; clicking a node selects it on canvas and vice-versa.
2. Dragging container A onto container B nests A under B — and the **tree
   updates to show A indented under B**.
3. Selecting a container with padding **visibly shades** the padding region on
   canvas; changing a per-side padding value changes that shading live.
4. Dragging a container near a sibling shows an **alignment guide** and snaps
   edge/centre to it.
5. The inspector has a **Kind** dropdown; changing kind changes the container's
   chrome/glyph and the available fields.
6. Group, align/distribute, undo/redo, guides, grid, snap all work and persist.
7. Reload → everything (structure, nesting, padding, kinds, styles) restores
   from `localStorage`.

## 5. What the catalogs are for now

`05_libraries.md`, `14_component_archetype_reference.md`,
`20_materials_and_shapes.md`, `21_interactive_overlays_and_primitives.md` are
**the menu of container kinds** for the §2.3 Kind picker — a list of names and
default props, nothing more. `03_canvas_engine.md` is the reference for the
snap/ruler/guide math. `04_toolkit.md` is the tool list (this doc's §3
supersedes its framing). `23`/`24` carry the tier idea (Component → Assembly →
Product) and the GeoSee inventory. Everything in `_superseded/` is dead.
