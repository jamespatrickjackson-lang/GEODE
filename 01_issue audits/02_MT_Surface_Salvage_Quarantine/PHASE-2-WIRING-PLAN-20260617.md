# Per-Entity Clip Ownership — Phase 2 Wiring Plan (2026-06-17)

> SUPERSEDED — see sparring: per-group, manifest-driven model (manifest taxonomy
> + container-hierarchy grouping prior + page-state diff; one resolver + one
> applier; fade as branch zero). Kept as record.

Status: plan only. Hold implementation. Phase 1 (pure resolver) is committed at
`8f60677`. Phase 2 wires the resolver into the runtime, parity-gated (no visual
change vs `5603dda`) before Phases 3/4 flip exit/enter behavior.

## Phase 2 goal

Introduce a per-entity clip transition registry, populate it from
`resolveEntityClipDecision`, and tick it per frame — without changing rendering
yet. Phase 2 proves the plumbing is inert; Phases 3-6 activate behavior.

## Current clip data flow (grounded)

- `applySceneSectionPlanes(style, options?)`
  (`sceneSectionController.ts:4301`) applies one section `style` to every entity.
  When `options.maskTransition` is present it builds, per object, a
  `materialMaskTransition { progress, source{planes,frames,visibility},
  target{...} }` (`:4373-4397`) and passes it to `applySceneSectionMaterial`
  (`:4415`) -> `setSceneSectionUniforms` (`:2374`).
- The global mask transition is `SceneSectionStyleMaskTransition
  { fromStyle, toStyle, progress }`, built by
  `sceneSectionMaskTransitionForTween(tween, eased)` (`:3168`). One per scene.
- Per frame it is re-applied from `layerTweenRuntime.ts:200`
  (`applySceneSectionPlanes(tweenStyle, { maskTransition })` with updated
  `eased`).
- Setup branches in `transitionEffectiveLayersForPage.ts`:
  - active target section -> `sceneSectionStyleTween` set; mask transition
    applied (`:1483-1495`).
  - `transitionFrame` initial apply (`:1497-1500`).
  - **active -> inactive / unrelated (`:1501-1504`): `sceneSectionStyleTween =
    null`; inactive target section applied immediately; exit relies on the
    snapshot.** No section tween, so no per-frame mask driver runs here.
- Clip participation inputs available at setup: `fromSceneSectionStyle` /
  `targetSceneSectionStyle`, `sceneSectionLayerIds(style)` /
  `sceneSectionProductIds(style)`, `sceneSectionTransitionActiveForStyle`,
  working-area `workingAreaFocusTargetLayerIds(style)` /
  `workingAreaFocusOutsideOpacity(style, id)`; presence from
  `fromVisible` / `toVisible`.

## Key design consequence

The bug case `20->25` is the active->inactive branch, which today has **no
section tween** — so a per-entity hold cannot be expressed by re-mapping the
existing global mask transition (there is none). The per-entity clip registry
must therefore be its **own** per-frame driver, independent of
`sceneSectionStyleTween`. For active->active (move) it can defer to the existing
section-tween path; for exit-hold / enter it must drive the held clip itself.
This is why Phase 2 introduces a registry, not just a re-map.

## Phase 2 data structures

In `SceneManager` (typed in `transitionStyles.ts` alongside the other transition
types):

```
interface EntityClipTransition {
  entityId: string;            // layer id (derived-entity ids later)
  decision: EntityClipDecision; // from resolveEntityClipDecision (Phase 1)
  sourceClipStyle: EditableStyle; // section style feeding the source endpoint
  targetClipStyle: EditableStyle; // section style feeding the target endpoint
  startMs: number;
  durationMs: number;
  easing: EasingName;
}
```

- `this.entityClipTransitions: Map<string, EntityClipTransition>` — the registry.
- Lifecycle: populated at transition setup; ticked each frame; cleared at final
  commit and on interruption (alongside the existing tween clears).

## Phase 2 changes (parity-gated, inert)

1. **Types** — add `EntityClipTransition` + a `PER_ENTITY_CLIP_OWNERSHIP_ACTIVE`
   gate constant (default `false` in Phase 2) in `transitionStyles.ts`.
2. **Inputs helper** — in `transitionEffectiveLayersForPage.ts`, a small pure
   local builds `EntityClipInputs` per clip-affected entity:
   - `presentSource = fromVisible.has(id)`, `presentTarget = toVisible.has(id)`.
   - `clippedSource = (section targets id on source AND
     sceneSectionTransitionActiveForStyle(fromSceneSectionStyle)) OR
     (workingAreaFocusTargetLayerIds(sourceWAFStyle).has(id) AND outside<1)`.
   - `clippedTarget` = same against target styles.
   - Iterate the **dynamic live clip-target set per page**, not a fixed list:
     `sceneSectionLayerIds(style)` ∪ `sceneSectionProductIds(style)` ∪
     `workingAreaFocusTargetLayerIds(style)`, for source and target. NOTE
     (audit 2026-06-17): the default section scope is
     `{ MT_RESISTIVITY_VOLUME, MT_RESISTIVITY_FULL_DENSITY }` and `all-visible`
     scope is every visible layer, so this set can include the protected
     full-density cloud and, under `all-visible`, the whole scene.
     `SCENE_SECTION_AFFECTED_LAYER_IDS` is a narrower snapshot-crossfade set and
     must NOT be used as the clip-target enumeration.
3. **Populate registry** — call `resolveEntityClipDecision` per entity, build
   `EntityClipTransition` with `sourceClipStyle`/`targetClipStyle` selected by the
   decision's `maskFrom`/`maskTo` against `fromSceneSectionStyle` /
   `targetSceneSectionStyle`. Populate in BOTH setup branches (the
   section-tween branch and the active->inactive branch at `:1501`).
4. **Tick** — extend the per-frame driver (`layerTweenRuntime.ts`) to iterate
   `entityClipTransitions`. In Phase 2 the tick, when
   `PER_ENTITY_CLIP_OWNERSHIP_ACTIVE === false`, is a **no-op** (registry built
   and iterated, but apply still goes through the existing global path), so
   rendering is byte-for-byte the current behavior.
5. **Clear** — clear `entityClipTransitions` in the same places
   `sceneSectionStyleTween` / `scalarStyleTweens` are cleared (commit, interrupt,
   discard).

## Parity gate (the Phase 2 acceptance bar)

With `PER_ENTITY_CLIP_OWNERSHIP_ACTIVE = false`:
- registry is populated and ticked, but the clip apply path is unchanged;
- no visual difference vs `5603dda` on `20->25`, `25->20`, section->section, and
  a working-area page;
- the exit snapshot (DEC-173 / salvage) still owns the exit exactly as today.

Phases 3/4 set the gate true and route exit-hold / enter through the registry,
each with its own `42911` visual check, and Phase 3 disables the volume exit
snapshot when per-entity hold owns the exit (resolves the L2 double-owner).

## Exact edit points

- `src/scene/transitions/transitionStyles.ts` — `EntityClipTransition` type;
  gate constant; re-export `EntityClipDecision`.
- `src/scene/transitions/transitionEffectiveLayersForPage.ts` — inputs helper;
  registry population in both setup branches (`~:1141` tween branch and
  `~:1170-1196` active->inactive branch); store on `this`.
- `src/scene/transitions/layerTweenRuntime.ts` — registry tick (no-op under the
  gate in Phase 2).
- `src/scene/SceneManager.ts` — `entityClipTransitions` field; clears at commit
  (`finalizePageTransitionCommit`) and interrupt/discard paths.

## Guards (Phase 2)

- New source guard `tests/tools/per-entity-clip-wiring-source.test.mjs`:
  asserts the registry field, population in both setup branches, the tick, the
  clears, and that the gate constant exists and is `false` in Phase 2.
- Reuse `entity-clip-ownership.test.mjs` (Phase 1 resolver) unchanged.
- Protected batch must stay green (parity): `scalar-tween-eligibility`,
  `transition-high-fixes`, `section-iso-transition-smoothing`,
  `working-area-focus-transition`, `scene-section-transition-behavior`,
  `transition-page-agnostic`, plus `tsc -b`.

## Risks / watch items

- **Active->inactive has no section tween** — the registry must self-drive the
  per-frame clip for exit-hold (Phase 3); Phase 2 only proves the no-op path.
- **Snapshot interaction** — until Phase 3 disables it, the exit snapshot and any
  registry hold must remain mutually exclusive (Phase 2 keeps the snapshot as the
  sole exit owner; gate off).
- **Full-density point cloud IS clip-participating** (default section target +
  working-area consumer) — correction from audit 2026-06-17. It cannot be
  excluded by construction. Per-entity ownership may own its CLIP channel only;
  the protected scalar channel (`SCALAR_TRANSITION_STYLE_FIELDS`,
  `scalarInclusionFilterActive`, `scalarFullDensityAllValidMode`, scalar range /
  legend / edge generation, point density/opacity correctness) must remain
  byte-identical. A dedicated guard must assert the cloud's scalar path is
  untouched, and parity must include a full-density-visible clipped page.
- **Derived roots (Section ISO) keep their own owners** (DEC-169/171); the
  registry is for base-layer clip only in Phases 2-5.
- **Working-area** is computed into the inputs but only the section sub-channel is
  wired in Phases 2-5; working-area apply parity is Phase 6.
- **Per-frame cost** — decisions/styles resolved once at setup; the tick only
  reads. No per-frame allocation in the no-op path.

## Blast radius: non-included scene elements (audit 2026-06-17)

Audit question: how does this affect scene elements not changed/included? The
global section apply traverses EVERY layer/material (`this.layers` ->
`group.traverse`), so every material already carries section uniforms (inactive
when not targeted). Findings:

- **Protected full-density cloud is in scope.** Default section scope targets it;
  it also consumes working-area focus. Clip ownership therefore touches the
  protected path. Mitigation: own clip-channel only, never the scalar channel;
  dedicated guard + parity page.
- **`all-visible` scope = whole scene.** terrain, topo, hydrography, drills,
  atmosphere, labels can all be section-clipped. The registry must build from the
  live target set, and the per-frame cost/coverage must handle "all visible".
- **Non-targeted entities.** Must keep receiving inactive section uniforms every
  apply. The per-entity registry is an OVERRIDE on top of the existing global
  apply for targeted/registered entities only; entities not in the registry fall
  through to the unchanged global path, guaranteeing no stale clip and no
  behavior change for everything else.
- **Shared per-frame loop.** The registry tick must not perturb non-registry
  layers, terrain composite opacity, helper opacity, Section ISO roots, or the
  scalar/opacity tweens. Phase 2 keeps the tick a no-op under the gate to prove
  exactly this.
- **Derived entities** (Section ISO roots, ground traces, axes, helpers) keep
  their existing owners; clip ownership is base-layer clip only.

Parity must explicitly cover, in addition to the bug pages: a full-density-cloud
page (protected), an `all-visible`-scope page (whole-scene clip), a
non-section/non-working-area page (registry empty), and a working-area-only page.

## Out of scope for Phase 2

No behavior change; no snapshot retirement; no enter/exit pin activation; no
working-area apply change. Those are Phases 3-7 per
`PER-ENTITY-CLIP-OWNERSHIP-PLAN-20260616.md`.

## Verification (run on the parity build)

- `node tests/tools/entity-clip-ownership.test.mjs`
- `node tests/tools/per-entity-clip-wiring-source.test.mjs`
- protected batch (above) + `tsc -b`
- visual parity on `127.0.0.1:42911`: `20->25`, `25->20`, section->section,
  working-area page — identical to `5603dda`.

## Rollback

Atomic Phase 2 commit on `claude/mt-surface-salvage`; revert to `8f60677`
(Phase 1) or the `…-checkpoint @ 5603dda` return node if parity fails.
