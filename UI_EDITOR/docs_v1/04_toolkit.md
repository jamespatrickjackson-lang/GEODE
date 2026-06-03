# v1 Toolkit

> Current status: reference only. Use this for tool behavior that agrees with
> `EDITOR-SPEC.md`. Ignore package schema, validation, export, and
> autonomous-agent language in this file.

## 1. Goal

Provide the 10 tools the author uses to interact with the Canvas. Each Tool is a modal interaction: only one is active at a time. The active Tool changes the cursor, the canvas pointer interpretation, and the available keyboard shortcuts.

## 2. Tool interface

`src/shell/toolkit/toolTypes.ts`:

```ts
import type { ShellState } from "../state/shellState";
import type { ShellAction } from "../state/shellActions";

export type ToolId =
  | "select"
  | "move"
  | "resize"
  | "container"
  | "text"
  | "divider"
  | "eyedropper"
  | "colour"
  | "align"
  | "distribute"
  // Shape primitives — added in [20_materials_and_shapes.md](20_materials_and_shapes.md) §4.5.
  | "rectangle"
  | "ellipse"
  | "line";

export interface ToolContext {
  state: ShellState;
  dispatch: (action: ShellAction) => void;
  canvasRect: DOMRect;
  frameOriginCanvas: { x: number; y: number };
}

export interface PointerEventPayload {
  pointerId: number;
  screenX: number;
  screenY: number;
  buttons: number;
  modifiers: { shift: boolean; alt: boolean; ctrl: boolean; meta: boolean };
}

export interface Tool {
  id: ToolId;
  label: string;
  cursorCss: string;                      // CSS cursor value, e.g. "default", "crosshair"
  keyboardShortcut: string;               // e.g. "v", "m", "r", "g"
  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void;
  onPointerDown(ctx: ToolContext, ev: PointerEventPayload): void;
  onPointerMove(ctx: ToolContext, ev: PointerEventPayload): void;
  onPointerUp(ctx: ToolContext, ev: PointerEventPayload): void;
  onKeyDown?(ctx: ToolContext, ev: KeyboardEvent): void;
}
```

All 10 tools live in `src/shell/toolkit/tools/<toolId>Tool.ts` and export a `Tool` object.

The `ToolkitBar` (`src/shell/toolkit/ToolkitBar.tsx`) renders a row of buttons (one per Tool) and dispatches `{ type: "SET_ACTIVE_TOOL", toolId }` on click. Keyboard shortcuts are wired globally in `ShellRoot`.

## 3. Per-tool specifications

### 3.1 Select Tool (`select`)

- **Shortcut:** `v`
- **Cursor:** `default`
- **Purpose:** click / shift-click / marquee select; click-and-drag empty space to marquee.
- **Behaviour:**
  - Pointer down on element → replace Selection with that element (or toggle with shift).
  - Pointer down on empty Canvas → begin marquee.
  - Pointer move while marquee → update marquee rect.
  - Pointer up → finalise Selection per [03_canvas_engine.md](03_canvas_engine.md) §12.
- **Multi-select:** yes, full support.
- **Dispatches:** `{ type: "SELECTION_SET", selection }`.
- **Acceptance:** clicking an element selects only that element; shift-clicking a second adds it; marquee includes all enclosed elements.

### 3.2 Move Tool (`move`)

- **Shortcut:** `m`
- **Cursor:** `move`
- **Purpose:** translate Selection by drag or arrow-key nudge.
- **Behaviour:**
  - Pointer down on a member of Selection → begin drag.
  - Pointer move while drag → compute snapped delta; dispatch `{ type: "ELEMENTS_MOVE_PREVIEW", delta }` for live preview.
  - Pointer up → dispatch `{ type: "ELEMENTS_MOVE_COMMIT", delta }`, which calls `core/editing/applyEdit` and produces a Change Record.
- **Multi-select:** yes; all selected elements translate by the same delta.
- **Snapping:** active (pixel grid + anchors + smart guides + guides). See [03_canvas_engine.md](03_canvas_engine.md) §7.
- **Arrow keys:** 1 px nudge; Shift + arrow = 10 px nudge. Each nudge is committed immediately (no drag preview).
- **Acceptance:** dragging a 100×100 element from (0, 0) to (50, 30) lands at (50, 30) when pixel grid is on; dragging across an Anchor surfaces a Smart Guide and snaps.

### 3.3 Resize Tool (`resize`)

- **Shortcut:** `s` (was `r` in earlier drafts; swapped because `r` now goes to Rectangle Tool per [20_materials_and_shapes.md](20_materials_and_shapes.md) §4.6.)
- **Cursor:** depends on hovered handle (e.g. `nw-resize`, `e-resize`).
- **Purpose:** drag Transform Handles to resize a single element.
- **Behaviour:**
  - Active Selection must be single-element. If Selection is empty or multi, Resize Tool draws no handles and pointer-down is a no-op.
  - Pointer down on a handle → begin resize.
  - Pointer move → compute snapped resize per [03_canvas_engine.md](03_canvas_engine.md) §11.2; dispatch `{ type: "ELEMENT_RESIZE_PREVIEW", handle, delta }`.
  - Pointer up → dispatch `{ type: "ELEMENT_RESIZE_COMMIT", handle, delta }`.
- **Modifiers:**
  - Shift = aspect-ratio lock on corner handles.
  - Alt = symmetric resize (opposite edge moves the inverse delta — element scales from its centre).
- **Acceptance:** all 8 handles work; min-size clamp at 8×8 (or per-Component override); aspect-ratio lock holds w/h ratio; symmetric resize keeps centre fixed.

### 3.4 Container Tool (`container`)

- **Shortcut:** `c`
- **Cursor:** `crosshair`
- **Purpose:** draw a new empty Container on the Canvas.
- **Behaviour:**
  - Pointer down on Canvas → begin draw at that Frame-space point.
  - Pointer move → update preview Container rect.
  - Pointer up → commit a new Container with the drawn rect.
- **Snapping:** active.
- **New Container defaults:**
  - id: `container-<newId()>`
  - archetype: the generic "blank container" archetype from the Library Panel (or whatever Container archetype is currently selected in the Library Panel).
  - constraints: `{ horizontal: "left", vertical: "left" }`.
  - locked: false, hidden: false.
  - parent: the Frame's root (or the Container under the cursor on pointer-down if "draw inside" modifier is held).
- **Acceptance:** drawing a 200×100 rectangle creates a Container at the drawn position and size; new Container is auto-selected; Layers Panel shows it.

### 3.5 Text Tool (`text`)

- **Shortcut:** `t`
- **Cursor:** `text`
- **Purpose:** insert an inline editable text Component.
- **Behaviour:**
  - Pointer down on Canvas → insert a new Text Component at that point with default size (width 120 px, height = font line height).
  - Component auto-enters inline edit mode; cursor in text field.
  - On blur or Escape → exit edit mode; commit text.
- **Defaults:**
  - text: "Text"
  - fontFamily: from active Token Library (default `TECHNICAL_MONO_FONT` for the bundled `geosee_editor_sidebar` package).
  - fontSize: from active Token Library (default 13 px).
  - colour: from active Colour Library default text Swatch.
- **Acceptance:** clicking on Canvas spawns an editable text field; typing updates the text in real time; clicking elsewhere commits.

### 3.6 Divider Tool (`divider`)

- **Shortcut:** `d`
- **Cursor:** `crosshair`
- **Purpose:** insert a horizontal or vertical Divider Component.
- **Behaviour:**
  - Pointer down → start drag from origin point.
  - Pointer move → preview a line from origin to current.
  - Pointer up → commit. If `|dx| > |dy|`, the Divider is horizontal (length = `|dx|`, height = 1); otherwise vertical (height = `|dy|`, width = 1).
- **Defaults:**
  - colour: from active Colour Library "divider" Swatch (or fallback Swatch).
  - thickness: 1 px.
- **Acceptance:** dragging right places a horizontal divider; dragging down places a vertical one; minimum length 4 px (otherwise the action is a no-op).

### 3.7 Eyedropper Tool (`eyedropper`)

- **Shortcut:** `i`
- **Cursor:** `crosshair`
- **Purpose:** sample a colour from the Canvas (background or element) and add it to the active Colour Library as a new Swatch.
- **Behaviour:**
  - Pointer down anywhere on the Canvas (including the background) → read the rendered RGBA at that pixel.
  - Pop a small dialog: "Add to library?" with input for Swatch name.
  - On confirm → dispatch `{ type: "SWATCH_ADD", swatch }`.
- **Implementation note:** since v1 renders via DOM/CSS, the Eyedropper does NOT use a canvas read. Instead, it walks `document.elementFromPoint(screenX, screenY)` to find the topmost element at the cursor and reads its computed `background-color` / `color`. For the BackgroundStressOverlay, it reads from a pre-loaded ImageBitmap of the background asset.
- **Acceptance:** clicking on the dark plain background returns `#0d0e12` (or near it); clicking on a coloured Container returns its fill colour; dialog appears and Swatch is added on confirm.

### 3.8 Colour Tool (`colour`)

- **Shortcut:** `k`
- **Cursor:** `pointer`
- **Purpose:** open the Colour picker for the active Selection.
- **Behaviour:**
  - On activate, if Selection is non-empty, open the Properties Inspector's Colour Editor for the Selection's `fill` property.
  - If Selection is empty, the Tool is a no-op (no visual indicator on the Canvas).
  - User can click a Swatch from the active Colour Library to apply, or pick an arbitrary colour.
- **Multi-select:** yes; the same colour is applied to all selected elements.
- **Acceptance:** Tool activation with a Selection opens the Colour Editor; choosing a Swatch updates the Selection's `fill`; the Change Record is appended.

### 3.9 Align Tool (`align`)

- **Shortcut:** `a`
- **Cursor:** `default`
- **Purpose:** align the Selection's elements to each other or to the Frame.
- **Behaviour:** the Tool is button-driven, not pointer-driven. On activation, a bar appears beneath the Toolkit with 6 align buttons:
  - Align Left
  - Align Centre (horizontal)
  - Align Right
  - Align Top
  - Align Middle (vertical)
  - Align Bottom
- **Reference:**
  - Selection size ≥ 2: align to Selection bounds (the bounding rect of all selected elements).
  - Selection size = 1: align to active Frame's bounds (or Frame's Safe Area, if the active Device Profile defines one).
  - Selection size = 0: bar disabled.
- **Implementation:** `core/geometry/distribute.ts` exports `alignSelection(rects, ref, axis, edge)` returning the new rects.
- **Acceptance:** with two elements selected, "Align Left" moves both to share the smaller of their two left edges; with one element selected, "Align Centre" centres it horizontally inside the Frame.

### 3.10 Distribute Tool (`distribute`)

- **Shortcut:** `shift+a`
- **Cursor:** `default`
- **Purpose:** distribute the Selection's elements at equal spacing.
- **Behaviour:** button-driven, with 2 distribute buttons:
  - Distribute Horizontally
  - Distribute Vertically
- **Requirements:** Selection size ≥ 3 (with 2 elements there is no inner spacing to distribute).
- **Reference:** the Selection's outermost left+right edges (or top+bottom) anchor the distribution; intermediate elements move to produce equal gaps between adjacent elements.
- **Implementation:** `distributeSelection(rects, axis)` in `core/geometry/distribute.ts`.
- **Acceptance:** with 4 elements at varying x positions selected and "Distribute Horizontally" pressed, the inner 2 elements move so all 3 gaps between successive elements are equal.

### 3.11 Rectangle Tool (`rectangle`)

- **Shortcut:** `r`
- **Cursor:** `crosshair`
- **Purpose:** draw a new `rectangle` Component. Distinct from Container Tool: Rectangle is a **leaf Component** (no children) used for decorative or structural shape; Container is a **structural Container** (holds children).
- **Behaviour:** drag to draw. Shift constrains to square.
- **Dispatches:** `{ type: "COMPONENT_ADD", component: <rectangle> }`.
- **Acceptance:** dragging produces a `rectangle` Component at the drawn rect.

### 3.12 Ellipse Tool (`ellipse`)

- **Shortcut:** `o`
- **Cursor:** `crosshair`
- **Purpose:** draw a new `ellipse` Component.
- **Behaviour:** drag to draw. Shift constrains to circle (1:1 aspect).
- **Dispatches:** `{ type: "COMPONENT_ADD", component: <ellipse> }`.
- **Acceptance:** Shift+drag yields a circle.

### 3.13 Line Tool (`line`)

- **Shortcut:** `l`
- **Cursor:** `crosshair`
- **Purpose:** draw a free-angle `line` Component. Distinct from Divider Tool: Divider is strictly horizontal or vertical (row chrome); Line is free-form (decorative).
- **Behaviour:** drag from start to end. Shift snaps angle to nearest 15° increment.
- **Dispatches:** `{ type: "COMPONENT_ADD", component: <line> }`.
- **Acceptance:** dragging at 30° produces a line at 30°; Shift+drag at 17° snaps to 15°.

### 3.14 Group / Ungroup (no Tool — keyboard only)

Not Tools in the modal sense; these are keyboard actions handled in `ShellRoot.tsx`'s key handler.

- **Group:** Ctrl/Cmd + G — invokes `ELEMENTS_GROUP` action per [20_materials_and_shapes.md](20_materials_and_shapes.md) §3.2.
- **Ungroup:** Ctrl/Cmd + Shift + G — invokes `ELEMENTS_UNGROUP` action per [20_materials_and_shapes.md](20_materials_and_shapes.md) §3.2.
- **Drill-in:** Double-click a `container-group` to enter edit-inside mode per [20_materials_and_shapes.md](20_materials_and_shapes.md) §3.4.
- **Drill-out:** Esc.

## 4. Tool switching

- Clicking a Tool button in the Toolkit sets the active Tool.
- Pressing the Tool's keyboard shortcut sets it.
- Pressing Escape while a Tool is mid-action (e.g. dragging a marquee) aborts the action but keeps the Tool active.
- Pressing Escape while no action is in flight reverts to the Select Tool.
- Switching Tools never modifies the Selection (Selection survives Tool changes).

## 5. Cursor management

- Each Tool declares its base cursor via `cursorCss`.
- During pointer-down drag, the Tool may set a transient cursor (e.g. Resize Tool sets `nw-resize` while a NW handle is dragged).
- After pointer-up, cursor reverts to the Tool's base.

Cursor is set on the `CanvasViewport` element via inline `style.cursor`. Always reset on Tool deactivate.

## 6. Toolkit chrome

- ToolkitBar is a horizontal row docked at the bottom of the screen (above the Validation Panel).
- Each button shows an icon + a small one-character key hint (e.g. "V") in the corner.
- The active Tool's button has a distinct visual state (full saturation accent).
- Disabled tools (e.g. Align with Selection = 0) appear at 40 % opacity and do not respond to clicks.

Visual style follows `src/shell/styles/theme.ts`. v1 uses a dark frosted style consistent with GeoSee's editor convention (visual continuity, not pixel-perfect match).

## 7. Acceptance criteria for the Toolkit phase

| # | Check | How to verify |
| --- | --- | --- |
| 1 | All 10 Tools registered | `src/shell/toolkit/tools/` contains 10 files; `ToolkitBar` renders 10 buttons. |
| 2 | Shortcuts work | Press each shortcut key; active Tool changes. |
| 3 | Select Tool — single click | Single click selects one; Layers Panel mirrors. |
| 4 | Select Tool — shift click | Shift-click adds; Selection becomes multi. |
| 5 | Select Tool — marquee | Drag from empty Canvas creates marquee; release selects enclosed elements. |
| 6 | Move Tool — drag | Drag Selection; preview shows; release commits; element moves; Change Record appended. |
| 7 | Move Tool — arrow nudge | Arrow key moves Selection by 1 px; Shift+arrow by 10 px. |
| 8 | Resize Tool — 8 handles | Each handle resizes correctly; min-size clamps. |
| 9 | Resize Tool — Shift lock | Shift held during corner resize preserves aspect ratio. |
| 10 | Container Tool | Draw rect; new Container appears in Layers Panel. |
| 11 | Text Tool | Click spawns editable text field; typing updates; commit on blur. |
| 12 | Divider Tool — horizontal | Drag right; horizontal Divider committed. |
| 13 | Divider Tool — vertical | Drag down; vertical Divider committed. |
| 14 | Eyedropper Tool | Click on a coloured element; dialog appears; confirm adds Swatch to Colour Library; Library Panel updates. |
| 15 | Colour Tool — Swatch apply | Select element; activate Colour Tool; click Swatch; element fill changes. |
| 16 | Align Tool — Selection ≥ 2 | Two elements; press Align Left; both share smallest left edge. |
| 17 | Align Tool — Selection = 1 | One element; press Align Centre (horizontal); element centres in Frame. |
| 18 | Distribute Tool | Three elements at uneven x; Distribute Horizontally; gaps equalise. |
| 19 | Escape aborts mid-action | Begin drag; press Escape; element returns to start; Tool stays active. |
| 20 | Escape with no action | Press Escape; active Tool becomes Select. |
| 21 | Tool switch preserves Selection | Select elements with Select; switch to Move; Selection unchanged. |
| 22 | Cursor changes | Activate each Tool; cursor matches `cursorCss`. |
