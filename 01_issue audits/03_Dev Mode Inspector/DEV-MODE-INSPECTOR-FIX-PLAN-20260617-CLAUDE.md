# Dev Mode Inspector — Implementation Plan

Date: 2026-06-17
Author: Claude (Opus 4.8)
Status: PLAN ONLY. No code written. Companion to
`DEV-MODE-INSPECTOR-SCOPED-CONTROLS-AUDIT-20260617-CLAUDE.md`.

## Locked Decisions (operator, 2026-06-17)

- D1. Dev save commits ALL dev-mode edits: chrome/layout patches, live text +
  style edits, and reorder changes. Unsaved dev edits are DISCARDABLE.
- D2. Controls from a parent/sibling that affect the clicked container are shown
  INLINE under a SEPARATE heading from the container's own controls.
- D3. Reorder applies to ALL reorderable collections.
- D4. Container name labels must NOT stack/overlap.
- D5. Scope is exactly these four items; nothing else added.

## Flag Resolutions (operator, 2026-06-17)

- R1 (text persistence fragility) AGREED -> tag-required persistence is locked:
  only text/style edits on elements carrying a stable `data-dev-source` /
  `data-dev-text-source` key persist; untagged edits stay session-only and are
  visibly marked non-persistable.
- R2 (sidebar-structure reorder vs manifest) RESOLVED via guardrail, not by
  narrowing scope: a `devModeReorderGuard` note was added to
  `docs/dev-context/editor-control-manifest.json` and a "Dev-Mode Reorder Guard"
  section to `docs/dev-context/Editor-Control-Manifest-Policy.md`. Reorder scope
  stays ALL (D3); before any dev-mode reorder of manifest-governed structure the
  agent must check the manifest and confirm with the operator, and a persisted
  structural reorder must also rewrite the manifest + source and pass
  `npm run check:editor-controls`.

## Grounding Findings (carried from the audit + manifest read)

- Dev mode is one component, `src/editor/DevModeInspector.tsx`, mounted at
  `src/editor/EditorRoot.tsx:1556`.
- The click panel (`DevContainerControlPanel`, DevModeInspector.tsx:412) renders
  a fixed GLOBAL control superset; it is not scoped to the clicked container.
- Chrome/layout controls persist (`patchEditorChrome` -> `setEnvScene` ->
  dirty/save). Live text/style edits (`writeEditableText` 1234, `applyTextStyle`
  1276) mutate the DOM only and have NO persistence — central to D1.
- Container outline labels already exist (`ContainerOutline` 359) but are
  `pointerEvents:"none"` — directly relevant to item 2.
- Page reorder by direct manipulation ALREADY exists as a manifest-governed grip
  (`aria-label="Drag page to reorder"`, Editor-Control-Manifest-Policy.md
  "Page Manager Guard"). It is the working reference for the reorder primitive.
- `DevModeInspector.tsx` is NOT in the manifest `protectedSourceFiles`; editing
  it alone does not trip the manifest companion rule. `EditorRoot.tsx`,
  `PagePanel.tsx`, `LayerPanel.tsx`, etc. ARE protected — any reorder/text wiring
  touching them needs manifest companion updates + `npm run check:editor-controls`.

## Shared Infrastructure (built once, used by items 1/3/4)

### S1. Dev-mode session boundary (enables D1 save-all + discard)

- On dev-mode open, capture a snapshot of every state surface dev mode can edit:
  `environment.scene.gui.editor` (chrome), the new text/style override store
  (S4), and the ordered-collection models in scope (S3 targets).
- All dev-mode edits continue to apply LIVE (immediate visual feedback) but are
  marked as belonging to the dev session.
- Dev save = flush the dev session into the normal editor dirty/save path
  (`commitPending`). Dev discard = restore the snapshot and clear dev-session
  dirty marks.
- Decision needed at build time, not now: whether the snapshot is taken on
  dev-open or lazily on first edit. Lazy-on-first-edit avoids snapshotting when
  dev mode is only used to inspect. Recommend lazy.

### S2. Control-descriptor registry (item 1 scoping)

- A static map keyed by `data-dev-container-type` (and optionally
  `data-dev-source`) to the list of `EditorChromeSettings` field ids that drive
  that container, e.g. top-bar pill -> `topBarHeightPx`, `barRadiusPx`,
  `pillTextInsetPx`, `sectionMarginXPx`; panel shell -> `panelWidthPx`,
  `panelMarginPx`, `panelCornerRadiusPx`, `uiScale`, `panelLeftPx`, `panelTopPx`.
- The panel renders ONLY the matched groups for the clicked container, replacing
  the current fixed superset.
- Inherited group (D2): walk the clicked element's ancestor `data-dev-container`
  chain; for each ancestor whose padding/gap/indent field produces the clicked
  element's offset (cross-check via `readBoxModel`, DevModeInspector.tsx:1412),
  emit those ancestor fields under a separate "Inherited — from <ancestor name>"
  heading. Each inherited control still edits the ancestor's field (same manifest
  id), just surfaced in the child's panel.
- Manifest posture: this is RE-PRESENTATION of existing manifest-backed fields,
  not new controls — allowed over existing ids. Any field surfaced that is not
  yet a manifest entry must be added to the manifest first.

### S3. Ordered-collection reorder primitive (item 3, "all")

- Generic primitive over an "ordered collection" behavior family. Each
  reorderable container declares, via data attributes, the collection it belongs
  to and its stable item id, e.g. `data-dev-order-group="<groupKey>"` and
  `data-dev-order-id="<itemId>"`. A group-key -> reorder-dispatch registry maps a
  drop to a model mutation. NO direct DOM reordering (would desync from React and
  not persist).
- In-scope collections (D3 = all) — split by backing model and risk:
  - Content/data collections (legitimate authoring; write the data model):
    pages (`pageOrder` — reuse existing grip dispatch), layer order, overlay
    order, section order within a page. These mark editor dirty and persist via
    the existing Vite dev save plugin.
  - Manifest-governed sidebar STRUCTURE (bars, peer groups, subsections,
    control rows): reordering these is a change to the canonical control
    inventory, NOT runtime data. TENSION: the manifest is the source of truth for
    control order/inventory; a runtime reorder would diverge unless it also
    rewrites the manifest. Recommend: phase content collections first; gate
    sidebar-structure reorder behind a defined manifest-update workflow (reorder
    emits a manifest edit + source companion, run through
    `npm run check:editor-controls`). NOW ENFORCED by the `devModeReorderGuard`
    manifest note + policy "Dev-Mode Reorder Guard" section (R2): check the
    manifest and confirm with the operator before persisting a structural reorder.
- Reorder dispatch reality (verified 2026-06-17): only PAGE reorder dispatch
  exists today — `reorderPage(pageId, "up"|"down")` and group-aware
  `movePageBlock` (EditorContext.tsx:165, DEC-079), step-wise up/down, NOT
  arbitrary drag-to-index. No layer / overlay / arbitrary-index reorder dispatch
  exists. The primitive must either (a) translate a drag into repeated existing
  up/down steps, or (b) add arbitrary-index dispatches for pages plus NEW
  dispatches for layers/overlays/sections. (b) is larger but cleaner.
- Interaction: press-and-hold with a drag threshold distinguishes REORDER from
  the existing click-to-lock (DevModeInspector.tsx:164). Below threshold = select
  (current behavior); past threshold = start drag, show ghost + drop indicators,
  commit order on drop.
- Page-agnostic ban: the primitive and its tests use synthetic ordered-collection
  fixtures. No live `pageOrder` discovery, page ids/titles/indexes, or page-pair
  coupling as proof. Page reorder is user authoring on user data — distinct from
  a behavior fix — but the PRIMITIVE is validated generically.

### S4. Dev override store for text/style (item 4 "save all")

- Live text/style edits need a backing field to persist (D1). Two cases:
  - Text/style targets that already map to an editor-backed field or a resolvable
    `data-dev-text-source` -> route the edit to that existing field/override.
  - Pure static-JSX text/style with no backing field -> needs a NEW keyed
    override store (e.g. `environment.scene.gui.editor.devTextOverrides`, keyed by
    a stable source/container key) so a saved override re-applies on load.
- The override store and any field it introduces are NEW persisted variables ->
  require manifest entries BEFORE wiring (manifest "Included Controls" covers
  "persisted variables").
- LOCKED (R1, operator-agreed 2026-06-17): tag-required persistence. Keys are
  `data-dev-source` + `data-dev-text-source` (stable, author-assigned). Untagged
  text/style edits stay session-only and surface a visible "not persistable — add
  a data-dev-text-source tag" note. No brittle source-location keys are persisted.

## Phased Plan (smallest/safest first)

### Phase 1 — Clickable container labels (item 2 + D4)

- Make `ContainerOutline` labels interactive: clicking a label locks
  `outline.element` and opens its scoped panel. Mark labels as dev-mode control
  surfaces so the global capture `onClick` does not re-resolve to a child
  (`isDevModeControlTarget` pattern, DevModeInspector.tsx:1058).
- D4 no-stack: in `collectContainerOutlines` / `containerLabelGeometry`
  (1062, 1152), detect label-rect collisions and resolve deterministically —
  vertical nudge / lane-packing so labels never overlap; when space is exhausted,
  collapse to a single stacked-count chip that expands on hover. Decide the exact
  collision rule at build; requirement is only "must not stack."
- Files: `DevModeInspector.tsx` only. No manifest impact.
- Tests: unit/DOM test that label click selects the intended element; geometry
  test that N overlapping containers yield non-overlapping label rects.

### Phase 2 — Scoped control panel + inherited heading (item 1 + D2)

- Add S2 registry; rewrite `DevContainerControlPanel` (412) to render matched
  groups for the clicked container plus the separate "Inherited" group.
- Files: `DevModeInspector.tsx`; manifest only if a surfaced field is not already
  an entry.
- Tests: given a synthetic container of type X, panel renders exactly the mapped
  field set and an inherited group sourced from the ancestor; no global superset.

### Phase 3 — Dev save/discard boundary (item 4 + D1, chrome scope first)

- Add S1 session boundary and a dev-mode Save / Discard control (reuse
  `styles.ts` material tokens + footer save semantics). Initially commit/discard
  the chrome/layout patches already in the dirty set (proves snapshot + rollback).
- Files: `DevModeInspector.tsx`, plus `EditorRoot.tsx` for the
  snapshot/commit/discard wiring (PROTECTED — manifest companion update +
  `check:editor-controls`).
- Tests: edit chrome field -> discard restores snapshot; edit -> dev save flushes
  to dirty/save path.

### Phase 4 — Text/style persistence into save-all (item 4 + D1 completion)

- Add S4 override store + manifest entries; route `writeEditableText` /
  `applyTextStyle` through it so saved edits persist and reload-restore; discard
  reverts. Un-taggable text edits stay session-only with the visible note.
- Files: `DevModeInspector.tsx`, manifest (NEW persisted-variable entries),
  possibly the env-scene type in `src/pages/types.ts`.
- Tests: tagged text/style edit -> save -> reload reapplies; discard reverts;
  untagged edit -> session-only, not persisted.

### Phase 5 — Reorder primitive, content collections (item 3 + D3, data-backed)

- Add S3 primitive + group registry for pages/layers/overlays/sections; press-
  and-hold drag, ghost, drop-commit -> dirty -> save (in the dev session, so
  discardable per D1).
- Files: `DevModeInspector.tsx`; the panels that own each collection
  (`PagePanel.tsx`, `LayerPanel.tsx`, `OverlayPanel.tsx` — PROTECTED) for
  `data-dev-order-*` tags and dispatch wiring + manifest companion updates.
- Tests: synthetic ordered-collection fixture — drag item from index i to j
  produces the expected reordered model; no live deck-state coupling.

### Phase 6 — Reorder for manifest-governed sidebar structure (item 3 tail)

- Highest risk / heaviest. The manifest-update workflow is now governed by the
  `devModeReorderGuard` (manifest note + policy "Dev-Mode Reorder Guard"): a
  sidebar-structure reorder must check the manifest, confirm with the operator,
  then rewrite the manifest + source order and pass `check:editor-controls`. No
  separate scope decision is outstanding — the guard is the gate.

## Constraints Compliance Summary

- Manifest guard: Phases touching `EditorRoot.tsx` / panel files or adding
  persisted variables update the manifest first and run
  `npm run check:editor-controls`. Re-presentation of existing fields (Phase 2)
  needs no new ids.
- Page-to-page false-fix ban: reorder primitive + all behavior tests use
  synthetic fixtures and the "ordered collection" / "effective-state" families.
  No live `pageOrder`, page id/title/index, or page-pair proofs.
- Persistence lock: all saves flow through editor state + the dev-only Vite
  plugin to `projects/<project>/`. No IndexedDB/LocalStorage/backend.
- UI standards: dev surfaces reuse `styles.ts` tokens, `TransientSlider`, and
  existing material/label vibrancy variables.

## Risks / Notes

- R1. RESOLVED — tag-required text persistence locked (see S4). Untagged edits
  session-only.
- R2. RESOLVED — sidebar-structure reorder gated by the `devModeReorderGuard`
  (manifest note + policy section); scope stays ALL, guard enforces check +
  operator confirm + manifest/source rewrite before persisting.
- R3. Press-and-hold vs click disambiguation must not regress the current
  click-to-lock or text-edit interactions.
- R4. `EditorRoot.tsx` and the listed panels are manifest-protected; every edit
  there carries the companion-update + check cost.

## Verification Strategy (per phase)

- Synthetic-fixture unit/DOM tests for each behavior family (label select,
  scoping, snapshot/rollback, override persistence, ordered-collection reorder).
- Scoped live dev-server pass at the end of each phase: enter dev mode, exercise
  the new affordance, confirm save persists across reload and discard reverts.
- No live page ids/order used as test proof.

## Build Log

### Phase 0 + Phase 1 — landed 2026-06-18

Phase 0 (mechanical split): `DevModeInspector.tsx` reduced from ~1,896 lines to a
697-line thin entry (state, effects, control panel, placement); every extracted
module is well under the 800-line editor-dir ceiling (largest: styles.ts 365,
inspect.ts 273, containerOutlines.tsx 236). Extracted into
`src/editor/devMode/`: `constants.ts`, `types.ts`, `util.ts`, `text.ts`,
`boxModel.ts`, `inspect.ts`, `styles.ts`, `controls.tsx`, `textControls.tsx`.
Behavior-neutral; `inspectAtPoint` refactored to share a `resolveHoverInfo` core
with the new `inspectElement`. No protected files touched (DevModeInspector is not
in `protectedSourceFiles`); `EditorRoot.tsx` import path unchanged.

Phase 1 (clickable labels + no-stack):
- `devMode/containerOutlines.tsx` holds `collectContainerOutlines`,
  `ContainerOutlinesLayer`, `ContainerOutline`, `containerLabelGeometry`,
  `BoxModelOverlay`. Labels are now `<button data-dev-mode-control="true">`;
  clicking one calls `inspectElement(outline.element, { lock:true })` so a
  back-panel container is selectable even when children intercept the pointer.
- D4 no-stack: `devMode/labelLayout.ts` `packLabelRects` (pure, no DOM/React)
  de-overlaps all labels (vertical nudge + left-column wrap); the layer recomputes
  line leaders from packed positions.
- Perf: outline collection moved off the hover render into state, recomputed on
  enable / scroll (rAF-throttled) / resize / lock / chrome-setting change.

Verification:
- `npx tsc -b --force` -> EXIT 0.
- `node --test tests/tools/dev-mode-inspector-source.test.mjs
  tests/tools/dev-mode-inspector-runtime.test.mjs` -> 10/10 pass (2 pre-existing
  structure tests preserved + 5 new source checks + 3 runtime packing checks).
- `npm run check:editor-controls` -> passed (164 entries, 48 source ids).
- Live (geosee-dev :5273): `d` toggles dev mode; 14 clickable labels render,
  all `pointer-events:auto`; measured label overlaps = 0; clicking the "Pages"
  label opened the control panel scoped to `Pages` / `top-level-section` /
  `CollapsibleSection / panelStyle`; no console errors; state restored after test.
- Companion doc `src/editor/CLAUDE.md` updated to describe the `devMode/` layout.

### Phases 2-6 — landed 2026-06-18

Phase 2 (scoped panel + inherited heading): `DevContainerControlPanel` +
`controlPanelPlacement` moved out of the shell into `devMode/ControlPanel.tsx`
(keeps the shell under its 800-line test cap). `devMode/controlRegistry.ts` maps
a container type to its relevant control groups; the panel renders only those by
default with a "Show all chrome" expander, plus an "Inherited - <ancestor>"
group derived from the ancestor `data-dev-container` chain (D2). Existing
control-ordering test repointed to `ControlPanel.tsx`.

Phase 3 (dev Save/Discard, D1): `devMode/session.ts` captures a lazy snapshot on
first dev edit; the shell wraps patches so a "Dev edits pending" bar offers Save
(commit via new `EditorRoot` `onDevCommit` -> `commitPending`) and Discard
(`buildRestorePatch` reverts every touched key, including clearing
session-added keys). `EditorRoot.tsx` (protected) gained one prop; manifest
`lastReviewNote` updated as the companion.

Phase 4 (text/style persistence, D1 + R1): `EditorChromeSettings.devTextOverrides`
(+ `DevTextOverride` type) added in `src/pages/types.ts`. `devMode/overrideStore.ts`
keys overrides by `data-dev-text-source` / `data-dev-source`; `applyOverridesToDocument`
re-applies them on load (effect runs regardless of dev mode). `DevTextControls`
persists tagged edits through the session patch and shows a "Session only - not
persistable" note for untagged targets.

Phase 5 (reorder primitive, D3): `devMode/reorder.ts` (pure `computeDropIndex` /
`reorderArray` / `stepsForMove`), `devMode/reorderRegistry.ts` (group ->
dispatch, data vs manifest-guarded), and `devMode/reorderDrag.tsx` (press-hold
drag over `data-dev-order-*` with ghost + drop indicator). The engine is
tested with synthetic fixtures; live wiring is contract-ready via the
`data-dev-order-group` / `data-dev-order-id` attributes. Pages already have
native Page Manager drag-reorder, so no collection is tagged by default.

Phase 6 (manifest-governed structure, R2): `reorderRegistry` marks sidebar
structure groups `manifest-guarded`; `commitReorder` refuses them and emits the
`devModeReorderGuard` guidance instead of silently reordering. No structural
reorder is performed at runtime.

Verification (all phases):
- `npx tsc -b --force` -> EXIT 0.
- `node --test` dev-mode source + runtime suites -> 20/20 pass (scoping,
  session restore, reorder math + guard, label packing, clickable labels).
- `npm run check:editor-controls` -> passed (protected `EditorRoot` change has a
  manifest companion).
- Live (geosee-dev :5273, Utah FORGE, 1440x900): Phase 2 panel scoped to 3
  groups by default, "Show all chrome" reveals Panel/Header/Sliders; clicking a
  nested header showed "Inherited - Pages"; Phase 3 editing the align select
  raised the Save/Discard bar and Discard cleared it; tagged text showed no
  untagged note (conditional correct); no console errors; dev mode exited clean.
  (Note: the preview eval context can report `window.innerWidth` as 0 until a
  `preview_resize`, which makes the viewport-bounds filter drop all outlines —
  an environment artifact, not app behavior.)

### Known boundaries / follow-ups

- Reorder is engine-complete and guard-enforced but not yet turned on for a
  specific collection beyond what Pages already provide natively; tagging
  layers/overlays/sections needs their own arbitrary-index dispatches in
  `EditorContext.tsx` (a deliberate later step, per the page-agnostic ban using
  the "ordered collection" family with synthetic fixtures).
- Discard reverts persisted chrome + the override store immediately; a live,
  un-persisted DOM text mutation on a key with no prior override reverts on the
  next reload rather than instantly.
