# Dev Mode Inspector — Closeout Plan Robustness Audit

Date: 2026-06-20
Author: Claude (Opus 4.8)
Status: Audit of the approved closeout plan
(`~/.claude/plans/ok-take-no-actions-clever-russell.md`). No implementation.
Goal: confirm the plan is robust, effective, non-damaging to other systems, and
sound long-term BEFORE building the broad reorder + Phase 6 work.

## Method

Pressure-tested each reorder target against the actual data model and render
path (EditorContext reducer, LayerPanelGroups, SceneManager). Several plan
assumptions did not survive.

## Findings

### F1 (HIGH) — "Layer order drives SceneManager render order" is FALSE

- Evidence: `SceneManager.ts` sets `mesh.renderOrder = SURFACE_RENDER_ORDER.*`
  per mesh TYPE (e.g. `:4327`), not from a layer-list index. `manifest.layers`
  is a flat catalog mutated only by add/remove (`EditorContext.tsx:1081`,
  `:1104`) with NO reorder action; the sidebar derives lists by CATEGORY filter
  (`LayerPanelGroups.tsx` topo/surface/atmosphere/other splits).
- Impact: reordering layers cannot change the 3D render order. The plan's
  highest-risk item — editing `SceneManager.ts` render-order derivation — is
  unnecessary and, if attempted, would touch the transition/scene path (and the
  Transition Runtime Operating Spec) for ZERO behavioural benefit.
- Fix: REMOVE the SceneManager change. Re-scope layer reorder to SIDEBAR LIST
  ARRANGEMENT: a `reorderLayer(layerId, toIndex)` that moves within
  `manifest.layers`, constrained to the sibling group/category. No render impact;
  persists through the existing manifest save. Verify it re-renders the sidebar
  in the new order at implementation.

### F2 (HIGH) — Page-block reorder is redundant AND the stepsForMove mapping is wrong

- Evidence: pages already have native drag-reorder (Page Manager grip,
  `PagePanel.tsx:1474` -> `REORDER_PAGE`). `REORDER_PAGE` moves ATOMIC BLOCKS by
  neighbour-block, not single positions (`EditorContext.tsx:1490-1514`,
  group-aware DEC-079). Translating a per-row DOM drop index into N up/down steps
  via `stepsForMove` (which assumes uniform single-position steps) does not match
  block-granular stepping.
- Impact: dev-mode page-block reorder would duplicate existing functionality and
  produce wrong/janky moves (row indices != block steps).
- Fix: DROP dev-mode page-block reorder entirely. Pages are already covered
  natively and correctly. Do not double-wire.

### F3 (MEDIUM) — Overlay reorder is list arrangement, not visual restacking

- Evidence: `page.sceneOverlays` is a per-page array (`EditorContext.tsx` ~1012-
  1050). SceneManager shows no array-order -> render/z mapping for overlays
  (only per-mesh `renderOrder` constants + debug state, `:3174`, `:4327`).
- Impact: reorder rearranges the per-page overlay LIST (and editor entries), not
  3D stacking. Fine as a feature, but must not be sold as visual restacking.
- Fix: implement `reorderSceneOverlay(pageId, overlayId, toIndex)` as an array
  move; document as list ordering; only claim a render effect if one is verified.

### F4 (MEDIUM) — Reorder drag collides with dev-mode lock/hover and the native page grip

- Evidence: `reorderDrag.tsx` adds document CAPTURE-phase
  pointerdown/move/up while dev mode is on; the shell also runs a capture-phase
  hover `pointermove` and a capture-phase click-to-lock `click`
  (`DevModeInspector.tsx`). Page rows additionally host the native
  `startPageDrag` grip with `setPointerCapture` (`PagePanel.tsx`).
- Impact: dragging a tagged row could also update hover, fire click->lock on
  release, or (on page rows) double-trigger with the native grip.
- Fix: add a shared "reorder dragging" guard the hover and click-to-lock handlers
  consult (skip while dragging); the drag must `preventDefault`/`stopPropagation`
  on its own pointer events; never tag a row that already hosts a native drag
  grip (reaffirms: pages excluded).

### F5 (MEDIUM) — Discard must accumulate per edited element, not snapshot once

- Evidence: text/style edits target the currently LOCKED element's `textElement`;
  a session spans multiple locks. The plan's "snapshot on session start" captures
  only one element.
- Impact: Discard would leave later live DOM edits to other elements un-reverted.
- Fix: snapshot each element's original `textContent` + inline `style` the FIRST
  time it is edited (a Map), and restore all entries on Discard.

### F6 (MEDIUM) — Phase 6 is a dev-tooling PROPOSAL flow, not a runtime reorder

- Evidence: sidebar structure order is JSX + manifest
  (`EditorRoot.tsx:1454+` `<CollapsibleSection manifestId=…>`); there is no
  data-driven order array to mutate at runtime.
- Impact: a dev-mode drag cannot reorder bars/groups live. The
  "manifest-rewrite workflow" can only EMIT a proposed order (manifestIds +
  sourceAnchors) for a developer/agent to apply as a code change, then
  `npm run check:editor-controls`.
- Fix: build Phase 6 as a guard-routed proposal emitter (no runtime mutation);
  set that expectation explicitly. This is the only guard-compliant design and is
  robust (manifest stays canonical), but it is not a self-applying feature.

### F7 (LOW) — Compliance reaffirmed

- Each protected-panel edit (`EditorRoot`, `PagePanel`, `LayerPanel*`,
  `OverlayPanel`/`SceneOverlayControls`) needs a manifest companion (lastReviewNote
  bump) or `check:editor-controls` fails. Dev-mode reorder controls stay OUTSIDE
  the sidebar manifest (consistent with existing dev-mode controls). Tests use
  synthetic ordered-collection fixtures — never live pageOrder/ids.

## Validated safe (no change needed)

- Capture isolation holds: `captureOverlayRenderer.ts` is canvas-drawn (no DOM
  screenshot); `compositedCaptureRecorder.ts` has no DOM-capture path;
  `DevModeInspector` unmounts in `presenterMode` (`EditorRoot.tsx:1320`). Dev
  overlays cannot reach exports; capture timeline drag is untouched.
- Persistence flows through the existing manifest/page save (REORDER_PAGE marks
  dirty "project"; manifest edits persist) — no new storage, honours the
  persistence lock.
- The reorder engine pure functions (`reorder.ts`) are sound and unit-tested.

## Revised, de-risked scope (recommendation)

- Pages: NATIVE already — do nothing.
- Layers: reorder within the sidebar category group via a `manifest.layers` move.
  SIDEBAR ARRANGEMENT only; NO SceneManager change. Low risk.
- Overlays: reorder the per-page `sceneOverlays` array. List arrangement. Low-med.
- Page-blocks: DROP (native + wrong mapping).
- SceneManager render-order edit: REMOVE (F1 false premise).
- Phase 6: proposal-emitter only (F6).
- Polish: per-element discard accumulation (F5 fix); re-apply overrides on page
  change. SKIP pointer-listener consolidation.

## Needs user re-confirmation

The "broad (layers + overlays)" decision was taken on the implicit premise that
reordering layers is a meaningful operation. The audit shows layer (and overlay)
reorder is SIDEBAR/LIST ARRANGEMENT — it organises the editor UI; it does NOT
change 3D render order or visual stacking. Confirm that editor-UI arrangement is
the intended value. If the goal was actual 3D draw-order / stacking control, that
is a different and much larger feature (per-mesh renderOrder policy), not this
reorder primitive.

## Net assessment

Plan is effective and safe for: overrides robustness, discard (with F5 fix),
Phase 6 as a proposal flow, and reorder as SIDEBAR ARRANGEMENT for layers +
overlays. It is NOT safe/correct as written for: SceneManager render-order edits
(remove), page-block duplication (drop), and the drag/lock interaction (must add
guards). With F1-F6 applied, the closeout is low-risk and durable.
