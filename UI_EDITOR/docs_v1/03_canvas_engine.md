# v1 Canvas Engine

> Current status: reference only. Use this for canvas, ruler, guide, snap, and
> overlay behavior that agrees with `EDITOR-SPEC.md`. Ignore package schema,
> validation, export, and autonomous-agent language in this file.

## 1. Goal

Render Frames on an infinite 2D Canvas with pan, zoom, multi-select, drag transforms, rulers, snapping (pixel grid + anchors + guides + smart guides), constraints, and a safe-area overlay. All behaviour must be predictable, agent-testable, and pure where possible.

## 2. Coordinate systems

Three coordinate systems exist. Agent code must convert at boundaries.

| Space | Origin | Units | Used by |
| --- | --- | --- | --- |
| **Screen space** | Browser viewport top-left | CSS pixels | Pointer events from the DOM |
| **Canvas space** | Conceptual canvas origin (0, 0); pan-independent | "canvas units" — 1 unit = 1 px at zoom = 1.0 | Frame positions, Guides |
| **Frame space** | Active Frame's top-left | px | Element positions inside a Frame, Anchors, Safe Area, Ruler tick labels |

Conversion helpers live in `src/core/geometry/canvasMath.ts` (the math is canvas-side, pure) and `src/shell/canvas/canvasMath.ts` (the DOM-side wrapper that reads viewport state). Mandatory functions:

```ts
// src/core/geometry/canvasMath.ts
export interface Viewport {
  panX: number;        // canvas-space offset
  panY: number;
  zoom: number;        // 1.0 = 100%
}

export function screenToCanvas(p: { x: number; y: number }, vp: Viewport, viewportRect: Rect): { x: number; y: number };
export function canvasToScreen(p: { x: number; y: number }, vp: Viewport, viewportRect: Rect): { x: number; y: number };
export function canvasToFrame(p: { x: number; y: number }, frameOriginCanvas: { x: number; y: number }): { x: number; y: number };
export function frameToCanvas(p: { x: number; y: number }, frameOriginCanvas: { x: number; y: number }): { x: number; y: number };
```

## 3. Viewport (pan + zoom)

- **Pan**:
  - Space + LMB drag.
  - MMB drag.
  - Trackpad two-finger scroll (without Ctrl/Cmd).
- **Zoom**:
  - Mouse wheel + Ctrl/Cmd. Zoom centre = pointer position.
  - Trackpad pinch.
  - Shortcuts: `+` (zoom in 25 %), `-` (zoom out 25 %), `0` (zoom to 100 %), `1` (fit active Frame to viewport).
- **Zoom range**: 0.1 (10 %) to 8.0 (800 %). Clamped.
- **Pan range**: unbounded.
- **Persistence**: viewport state is **not** persisted to the package. On package load, the viewport resets to "fit active Frame".

Implementation lives in `src/shell/canvas/CanvasViewport.tsx`. State is in `ShellState.viewport`. All pan/zoom changes dispatch `{ type: "VIEWPORT_SET", patch }`.

## 4. Rulers

- Two rulers per Canvas: horizontal along top, vertical along left.
- Drawn in **Frame space** of the active Frame. Origin = active Frame's top-left = ruler 0.
- Tick interval auto-selects from `{1, 2, 5, 10, 20, 50, 100, 200, 500, 1000}` based on zoom such that major ticks are ≥ 50 screen px apart.
- Minor ticks at major / 5; minor tick labels suppressed.
- Pointer position is reflected as a thin highlight stripe in both rulers.
- Selected elements' edges are reflected as solid highlight stripes (one per edge).

Files:
- `src/shell/canvas/RulerHorizontal.tsx`
- `src/shell/canvas/RulerVertical.tsx`

Both consume the active Frame's screen-space rect (computed by the parent `CanvasRoot`) and the current pointer / selection.

## 5. Pixel Grid

- Optional snap target. On by default.
- Size: 1, 2, 4, or 8 px in Frame space (configurable via View menu).
- Stored in `ShellState.snap.pixelGridSize`.
- Snap rounding: nearest grid coordinate to the cursor, in Frame space.
- Visual: faint dots at grid intersections, drawn only when zoom ≥ 1.0 to avoid moiré at small zoom.

## 6. Anchors

Anchors are alignment references computed on demand. They are NOT persisted as schema entities.

### 6.1 Anchor sources

For a given active Frame at a given moment, the workbench computes the following Anchor lines (axis-aligned):

| Source | Anchor lines produced |
| --- | --- |
| Frame edges | left, top, right, bottom, centre-h, centre-v |
| Safe Area (per active Device Profile) | left, top, right, bottom |
| Each visible Container inside the Frame | its 4 edges + 2 centres |
| Each visible Component inside the Frame | its 4 edges + 2 centres |
| Each user Guide on the Frame | the Guide line itself |

Hidden / locked elements are excluded. The element currently being moved / resized is excluded from its own anchor set.

### 6.2 Computation

`src/core/geometry/anchorsForFrame.ts`:

```ts
export interface AnchorLine {
  axis: "x" | "y";
  position: number;          // in Frame space
  sourceKind: "frame-edge" | "frame-centre" | "safe-area" | "container-edge" | "container-centre" | "component-edge" | "component-centre" | "guide";
  sourceId?: string;         // id of the container/component/guide
}

export function anchorsForFrame(
  frame: Frame,
  containers: readonly Container[],
  components: readonly Component[],
  safeArea: SafeArea,
  guides: readonly Guide[],
  excludeIds: ReadonlySet<string>,
): readonly AnchorLine[];
```

## 7. Snapping

Snap math is pure and lives in `src/core/geometry/snap.ts`. The shell calls it with the proposed Frame-space coordinates and an Anchor set; it returns the snapped coordinates plus the Anchor(s) that triggered the snap (used to draw Smart Guides).

```ts
export interface SnapResult {
  x: number;
  y: number;
  triggeredAnchors: readonly AnchorLine[]; // 0–2 (one x, one y)
}

export function snapPoint(
  desired: { x: number; y: number },
  anchors: readonly AnchorLine[],
  pixelGridSize: 1 | 2 | 4 | 8 | null,
  thresholdPx: number,
  zoom: number, // threshold is in screen px, so we divide by zoom for Frame-space comparison
): SnapResult;
```

Resolution rules:

1. Compute candidate snap targets: pixel grid (nearest grid x and grid y) and all Anchors.
2. For each axis independently, pick the candidate whose Frame-space distance to the desired coordinate is smallest **and** ≤ `thresholdPx / zoom`.
3. If no candidate qualifies, return the desired coordinate unchanged for that axis.
4. Pixel-grid snap wins ties only when **both** the grid and an Anchor are within 1 Frame-space unit; otherwise the Anchor wins.

Snap applies to the element's reference point. For Move, the reference point is the element's top-left corner. For Resize, the reference point is the dragged Transform Handle (which may be any of the 8 perimeter handles). For each Resize, snap evaluates separately for the x and y of the handle.

## 8. Smart Guides

Smart Guides are short, ephemeral lines drawn at runtime when a moving / resizing element's edge or centre aligns with another element's edge or centre.

- Computed in `src/core/geometry/smartGuides.ts`.
- Rendered in `src/shell/canvas/GuidesLayer.tsx`.
- A Smart Guide spans from the aligning edge of the moving element to the aligning edge of the partner element.
- Multiple partners may produce multiple Smart Guides simultaneously (e.g. both top edge and centre-v align).
- Smart Guides disappear when the pointer stops, the modifier is released, or the alignment breaks.
- Do not persist to disk.

## 9. Guides (user-dragged)

- Drag horizontally from the vertical ruler to drop a horizontal Guide; drag vertically from the horizontal ruler to drop a vertical Guide.
- Guide position is in Frame space.
- Guides persist in the package at `guides.json`.
- Snap targets include Guides when `snap.snapToGuides` is true.
- Per-Frame; not global.
- Delete: select a Guide (click on its line), press Delete / Backspace.
- Lock: a Guide can be locked from the right-click context menu to prevent accidental drag.

Schema in `src/core/schema/guide.ts`:

```ts
export interface Guide {
  id: string;            // kebab-case
  frameId: string;
  axis: "x" | "y";       // x = vertical guide (constant x), y = horizontal guide (constant y)
  position: number;      // Frame space
  locked: boolean;
}
```

## 10. Safe Area

Drawn as a dashed inset boundary inside the active Frame.

Computation:
- Each Frame stores a `safeArea: { left, top, right, bottom } | null` field. `null` means "use the active Device Profile's default safe-area insets".
- Device Profile defaults are in `src/core/schema/profiles.ts`. v1 ships:
  - `desktop-1080p` → `{ 0, 0, 0, 0 }` (no inset)
  - `tablet-portrait` → `{ 24, 24, 24, 24 }` (representative)
  - `phone-portrait` → `{ 16, 56, 16, 16 }` (representative; phone profile not selectable in v1 but defined for forward compat)
  - `projector-1080p` → `{ 64, 64, 64, 64 }` (large title-safe margin)
- An element entirely outside the Safe Area triggers `layout.element-outside-safe-area.forbidden` (see [08_validation_rules.md](08_validation_rules.md)).
- Anchors include all four Safe Area edges; snapping treats them like any other Anchor.

## 11. Transforms

Pure math in `src/core/geometry/transform.ts`. Two operations in v1.

### 11.1 Move

Inputs: element id, delta (dx, dy) in Frame space.
Output: new element rect.

```ts
export interface Rect { x: number; y: number; w: number; h: number; }

export function applyMove(
  rect: Rect,
  delta: { dx: number; dy: number },
  parentRect: Rect,
  constraints: Constraints | null,
): Rect;
```

Behaviour:
- Translate `(x, y)` by `(dx, dy)`.
- If Constraints are present, apply them (see §13).
- Clamp to the parent Container's rect (if a parent exists).
- Snap is applied **before** calling `applyMove`; the shell snaps the cursor delta, not the raw event delta.

### 11.2 Resize

Inputs: element id, Transform Handle, delta in Frame space.
Output: new element rect.

```ts
export type HandleId = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export function applyResize(
  rect: Rect,
  handle: HandleId,
  delta: { dx: number; dy: number },
  parentRect: Rect,
  constraints: Constraints | null,
  minSize: { w: number; h: number },
): Rect;
```

Behaviour:
- Each handle moves the corresponding edge(s) (corner handles move two edges; side handles move one).
- `minSize` clamps both dimensions (defaults: w ≥ 8 px, h ≥ 8 px; can be overridden per Component).
- Aspect-ratio lock (Shift modifier): on corner handles, maintain the original w/h ratio.
- Constraints applied after the raw resize (e.g. a "stretch" Constraint may push other edges).

### 11.3 Arrow-key nudge

- Arrow keys translate Selection by 1 px in Frame space.
- Shift + arrow translates by 10 px.
- Snapping is honoured (the resulting position snaps to the nearest Anchor / grid within threshold).

## 12. Selection

State in `ShellState.selection`. v1 supports:

- **Single click** — replaces Selection with the topmost element under the pointer.
- **Click empty space** — clears Selection.
- **Shift + click** — toggle membership of the clicked element in Selection.
- **Marquee drag** (from empty space) — Selection = all elements whose rect is wholly within the marquee. Modifier rules:
  - No modifier: replace Selection with elements in marquee.
  - Shift: add marquee result to current Selection.
  - Alt: subtract marquee result from current Selection.
- **Ctrl/Cmd + A** — select all elements on the active Frame.
- **Escape** — clear Selection.
- **Tab** — move Selection to the next sibling in Layers Panel order.

Selection on the Canvas is mirrored in the Layers Panel and Properties Inspector.

## 13. Constraints

Modelled after Figma. Stored per element in `Container.constraints` and `Component.constraints`:

```ts
// src/core/schema/anchor.ts
export type AnchorKind = "left" | "right" | "centre" | "scale" | "stretch";

export interface Constraints {
  horizontal: AnchorKind;   // applies along x
  vertical: AnchorKind;     // applies along y
}
```

Meaning when the parent Container resizes:

| AnchorKind | Behaviour along that axis |
| --- | --- |
| `left` | Element's left/top edge stays pinned to parent's left/top. Right/bottom edge floats. |
| `right` | Right/bottom edge stays pinned. Left/top floats. |
| `centre` | Element stays centred. Size unchanged. |
| `scale` | Element's position and size both scale proportionally. |
| `stretch` | Both edges pin; element's size grows / shrinks with parent. |

Default for a freshly-instantiated Component: `{ horizontal: "left", vertical: "left" }`.

Constraints are applied inside `applyMove` / `applyResize` and inside the parent-resize cascade (when a Container resizes, its children's positions / sizes recompute).

## 14. Z-order and Layers

- Current standalone editor: real DOM order is the structure source. The layers
  tree mirrors DOM nesting and ordering.
- Visual convention: top of the Layers panel should represent the visually
  topmost editable item when ordering is exposed.
- A container's children remain grouped with their parent. Do not present a
  child as an unrelated top-level sibling.

## 15. Lock and Hide

- Per element: `locked: boolean` and `hidden: boolean`.
- Locked elements are not selectable, not draggable, not resizable. Still rendered.
- Hidden elements are not rendered, not selectable. Still count for Anchors? **No** — hidden elements are excluded from Anchor computation.
- Lock / hide toggles are in the Layers Panel and via shortcuts: `Ctrl/Cmd + L` toggles lock on Selection; `Ctrl/Cmd + ;` toggles hide.

## 16. Background Stress Overlay

Background stress testing is parked for now. If it is resumed for the
standalone editor, it should be a visual-only preview mode that swaps the
canvas backdrop and helps judge readability. It should not depend on package
export, generated validation findings, or background assets in a package
folder.

### 16.1 Bundled asset specifications

All four files are 1920×1200 PNG, 8-bit RGB (no alpha). The agent generates them procedurally at Phase 10 of [10_build_phases.md](10_build_phases.md) via Node + `node-canvas` (or sharp, or a small custom PNG writer — implementer's choice). Files saved to `packages/geosee_editor_sidebar/assets/backgrounds/`.

| File | Algorithm | Why |
| --- | --- | --- |
| `plain_dark.png` | Solid fill `#0d0e12`. | Establishes worst-case low-luminance contrast environment. Matches GeoSee's editor surround. |
| `plain_light.png` | Solid fill `#f4f0e8`. | Establishes worst-case high-luminance contrast environment. Matches GeoSee's vibrancy label colour. |
| `noise_low_contrast.png` | White noise (uniform random), each channel sampled independently, then normalised to luminance range `[128, 144]` (very subtle). Seeded with constant `0xC0FFEE` for reproducible round-trips. | Stresses readability against busy-but-flat backgrounds typical of low-contrast textures. |
| `terrain_capture.png` | Procedural fake-terrain: vertical gradient from `#3a4a3a` (top) through `#7a6b4a` (mid) to `#4a3e2e` (bottom); overlay 1px-wide pseudo-contour lines at every 8th vertical pixel in `#2a2a2a` at 40% alpha; overlay diagonal noise at 8% opacity in luminance `[100, 140]`. Seeded with constant `0x12345`. | Stands in for a real GeoSee terrain screenshot until / unless one is checked in. Captures the visual character (warm earth tones + linework + texture) sufficient for stress-testing transparent panel readability. |

Historical note: deterministic procedural backgrounds were part of the old
package workbench. The current editor does not require generated background
assets.

## 17. Frame management

Frame/package management is parked with the React package workbench. The
current standalone editor edits the live host surface in `gui-editor.html`.
- Resize Frame: drag the Frame's outer border with the Resize Tool active.

## 18. Acceptance criteria for the Canvas Engine phase

Agents must verify all of the following pass before declaring the Canvas Engine phase complete.

| # | Check | How to verify |
| --- | --- | --- |
| 1 | Pan + zoom work | Manual: open dev server, pan with space-drag, zoom with Ctrl+wheel; viewport state updates. |
| 2 | Rulers show correct Frame-space coordinates | Drag a 100×100 Container to (50, 30); rulers tick under cursor display `50` / `30`. |
| 3 | Pixel-grid snap at 1 px | Move an element; final position is integer-valued. |
| 4 | Pixel-grid snap at 8 px | Switch grid to 8; move an element; final position % 8 === 0. |
| 5 | Anchor snap to Frame edges | Move an element near left edge; it snaps to x = 0 with a left-edge Smart Guide showing. |
| 6 | Anchor snap to Safe Area | Set device profile to `tablet-portrait`; move an element near left of safe area; snaps to x = 24. |
| 7 | Anchor snap to sibling | Place two elements; align the second's left to the first's right; Smart Guide shows; snap occurs. |
| 8 | Smart Guide dismissal | Cursor stops, alignment breaks; Smart Guides clear within one frame. |
| 9 | User Guide drag-from-ruler | Drag from horizontal ruler; horizontal Guide appears; persists in `guides.json` after save. |
| 10 | Guide delete | Click Guide line + Delete; Guide removed from state and `guides.json`. |
| 11 | Resize honours min size | Resize an 8×8 minimum element below 8 px; size clamps to 8. |
| 12 | Aspect-ratio lock | Hold Shift while resizing a 200×100 by NW handle; w/h ratio stays 2:1. |
| 13 | Constraints — left | Element with `horizontal: "left"`; resize parent wider; element stays at original left, original width. |
| 14 | Constraints — right | Element with `horizontal: "right"`; resize parent wider; element stays at original distance from right edge. |
| 15 | Constraints — stretch | Element with `horizontal: "stretch"`; resize parent wider; element widens to match. |
| 16 | Multi-select via marquee | Marquee from empty space; all wholly-enclosed elements selected. |
| 17 | Multi-move | Move Selection of 3 elements by drag; all three translate by the same delta. |
| 18 | Multi-resize | Not supported in v1 (Resize is single-element). Verify Resize Tool ignores multi-Selection (no-op or shows single-target chrome only). |
| 19 | Layers panel mirrors Selection | Click element on Canvas; Layers Panel highlights matching row. |
| 20 | Lock prevents drag | Lock an element; attempt Move; no movement occurs. |
| 21 | Hide excludes from Anchors | Hide an element; move a sibling near where the hidden one was; no Smart Guide / snap to the hidden element's edges. |
| 22 | Background swap re-renders contrast findings | Switch from plain-dark to noise-low-contrast; contrast rule re-evaluates; finding count may change. |
| 23 | Frame add / delete | Add a Frame; it appears; delete it; cascades remove Containers / Components. |
| 24 | Multiple Frames coexist | Two Frames on Canvas; each pans/zooms with the shared viewport; active Frame indicator visible. |
