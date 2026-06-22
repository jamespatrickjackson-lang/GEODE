# Source-Contract Drift Risk Log

Policy: `docs/03-decisions.md` DEC-184. Harness: `tests/tools/reviewFlag.mjs`.

These are `SOURCE-CONTRACT-RISK` review flags — `test:tools` checks that assert
**source-code string patterns** which drifted when editor/scene code was
refactored. Each is **non-gating** (flagged, not failed), because the brittle
string-match is not itself proof of breakage. But each is a **latent risk**: the
refactor *may* have changed behaviour the assertion used to guard, and the
string-match can no longer verify it. This log records, per flag, what was
asserted, what current source actually contains, the residual risk, and the
recommended resolution.

Triaged 2026-06-21. All guarded features were confirmed to still **exist** in
current source (no live regression found); the assertions point at stale
locations / names. Resolve each by: re-verifying behaviour in current source,
then **rewrite as a behaviour test**, **update the assertion to the current
source shape**, or **retire it** if covered elsewhere.

| # | Flag | File | Risk | Current source finding |
|---|------|------|------|------------------------|
| 327 | MT Resistivity Cells Log10 lines ride the page scalar transition | `mt-resistivity-legend-cloud-toggle-source` | **High** | transition-clock internals renamed/moved; protected path |
| 523 | transition final commit applies page-local scene overrides | `showcase-candidate-authoring-source` | **Med** | `finalizePageTransitionCommit` + `applyPageScene(nextPage)` present; `applyEnvironment(environment)` call shape to re-verify |
| 521 | topo material edits persist to resolved authoring env | `showcase-candidate-authoring-source` | **Med** | `topoAuthoringEnvironment`/`setTopoAuthoringScene` no longer in `LayerPanelGroups.tsx` |
| 343 | topo atmosphere authors selected-page scene overrides | `page-atmosphere-source` | **Low–Med** | wiring moved to `EditorContext.tsx` w/ `mergeSceneEdit` |
| 522 | page scene edits persist as page-local overrides | `showcase-candidate-authoring-source` | **Low–Med** | `sceneOverrides` present in `pages/types.ts`+`effective.ts`; write moved to `EditorContext.tsx` |
| 302 | MT resistivity legend renders slice figure metadata | `geophysics-figure-legend-source` | **Low** | `buildMtResistivityFigureModel` no longer in `ResistivityLegend.tsx` |
| 420 | section ISO legend white rows + icon sub-controls | `scene-section-legend-contract-source` | **Low** | local `ISO_BUTTON_ACTIVE_BACKGROUND` constant removed in favour of shared `legendStyles.ts` |

---

## 327 — MT Resistivity Cells Log10 lines ride the page scalar transition  (High)

**Asserts:** a cluster of `SceneManager.ts` + `transitionEffectiveLayersForPage.ts`
patterns guaranteeing MT-cells Log10 lines enter on the page-transition clock and
are NOT snapped in by a post-commit replay — `assertFinalTransitionTargetState`
not driving a full visibility/style replay, `shouldTweenFullDensityScalarStyle`,
`scalarStyleTweens.set(id, { fromStyle, toStyle })`,
`applySettledMtCellPointsTargetStyle`, `suppressPostCommitTargetAssertion`.

**Current source:** the methods exist but several names/call-shapes appear to have
drifted (e.g. `assertFinalTransitionTargetState` references not all matching).

**Risk — High.** This directly guards the CLAUDE.md-protected MT full-density
scalar/transition path ("Log10 Resistivity Window pages with line controls on
must register the full-density scalar tween so isoline overlays enter on the
page-transition clock, not via a final-commit replay"). If a refactor changed
these internals, the contract is no longer verified and could regress to a
snap-in without any gate noticing.

**Action:** re-verify each asserted method against current
`SceneManager.ts` / `transitionEffectiveLayersForPage.ts`; update the regexes to
the current shapes (preferred) or convert to a runtime transition-clock behaviour
test. Highest priority of this log.

## 523 — transition final commit applies page-local scene overrides  (Med)

**Asserts:** `finalizePageTransitionCommit(...)` body contains
`this.applyEnvironment(environment)` and `this.applyPageScene(nextPage)`.

**Current source:** `finalizePageTransitionCommit` exists (`SceneManager.ts`
~3410) and calls `this.applyPageScene(nextPage)` (~3447); the
`applyEnvironment(environment)` call shape inside the method needs confirmation
(env application may have moved to a helper).

**Risk — Med.** Guards that final commit applies the resolved target environment
+ page scene through the proper owner so page-local topo overrides land after
navigation. Behaviour likely intact; assertion shape stale.

**Action:** read the current `finalizePageTransitionCommit` body; update the two
regexes to the current call shape, or assert via the page-scene/environment owner
the method now uses.

## 521 — topo material edits persist to the resolved authoring environment  (Med)

**Asserts (in `LayerPanelGroups.tsx`):** `topoAuthoringEnvironment`,
`scene: topoAuthoringEnvironment.scene ?? {}` (read-scope == write-scope),
`setTopoAuthoringScene`; plus `"envSnapshot"` in `editor/types.ts`.

**Current source:** `LayerPanelGroups.tsx` no longer contains `sceneOverrides` or
these authoring-environment symbols; topo scene writes now route through
`EditorContext.tsx`.

**Risk — Med.** The test guarded an important invariant — topo controls read the
same environment scope they write (no accidental display-only env). Verify that
invariant still holds in the relocated wiring.

**Action:** locate the current topo authoring-environment read/write in
`EditorContext.tsx` (and wherever the topo panel binds); rewrite the assertion to
the new symbols, preserving the read-scope==write-scope check.

## 343 — topo atmosphere controls author selected-page scene overrides  (Low–Med)

**Asserts (in `LayerPanelGroups.tsx`):** `setPageField(currentPage.id, {
sceneOverrides: mergeSceneProperties(currentPage.sceneOverrides, patch) })`,
`sceneHandle.manager.applyEnvironment(nextPageEnvironment)`; plus a
`topo-environment-controls` Environment section in `TopoMapPanel.tsx`.

**Current source:** the page-`sceneOverrides` write moved to `EditorContext.tsx`
and uses `mergeSceneEdit` (not `mergeSceneProperties`); `LayerPanelGroups.tsx`
has 0 `sceneOverrides` refs.

**Risk — Low–Med.** Feature exists (3 `sceneOverrides: mergeSceneEdit(...)` writes
in `EditorContext.tsx`). Stale file target + helper name. Confirm the topo
atmosphere path specifically writes page `sceneOverrides` and applies the resolved
page environment immediately.

**Action:** repoint the assertion at `EditorContext.tsx` + `mergeSceneEdit`;
confirm the `TopoMapPanel.tsx` Environment section testid still exists or update it.

## 522 — page scene edits persist as page-local overrides  (Low–Med)

**Asserts:** `sceneOverrides?: Partial<SceneProperties>` in `pages/types.ts`;
`sceneOverrides` merged in `effective.ts`; `setPageField(currentPage.id, {
sceneOverrides: ... })` in `LayerPanelGroups.tsx`; `areaOutlines` via
`sceneOverrides` in `LayerPanel.tsx`.

**Current source:** the model halves pass — `sceneOverrides` is present in
`pages/types.ts` and `effective.ts` (2 refs). Only the editor-write targets are
stale (moved to `EditorContext.tsx`); the `LayerPanel.tsx` areaOutlines pattern
needs re-checking.

**Risk — Low–Med.** Mostly stale targets; the data model + effective merge are
intact.

**Action:** split into the model assertions (keep) and the editor-write assertions
(repoint to `EditorContext.tsx`); re-verify the area-outline page-local path.

## 302 — MT resistivity legend renders slice figure metadata  (Low)

**Asserts (in `ResistivityLegend.tsx` / `mtResistivity/sliceProducts.ts`):**
`buildMtResistivityFigureModel`, `mtResistivitySliceById`,
`testId("resistivity-figure-box")`, `testId("resistivity-primary-axis")`,
`sourceWindowM`, `sectionLine`.

**Current source:** `buildMtResistivityFigureModel` / `resistivity-figure-box`
are not in `ResistivityLegend.tsx` (the figure model appears relocated; the
sibling seismic figure-model test still passes).

**Risk — Low.** Cosmetic legend metadata; no scene/transition impact.

**Action:** locate `buildMtResistivityFigureModel` in current source and repoint
the file target, or retire if the MT figure-model was intentionally removed.

## 420 — section ISO legend uses white primary rows with icon sub-controls  (Low)

**Asserts:** a local `ISO_BUTTON_ACTIVE_BACKGROUND = "#ffffff"` constant + icon-only
button markup in the section-ISO legend source.

**Current source:** quick legends were moved to the shared `src/ui/legendStyles.ts`
helpers, which CLAUDE.md now **mandates** ("use the compact quick legend helpers …
do not hand-tune local quick legend button geometry"). The local constant the
test asserts is the now-forbidden pattern.

**Risk — Low.** The test asserts an anti-pattern the guidelines prohibit; the
visual contract moved to the shared helpers + `UI-Visual-Standards.md`.

**Action:** rewrite to assert the shared-helper usage (white active background +
icon sub-controls via `legendStyles.ts`), or retire as covered by the
UI-Visual-Standards guard.
