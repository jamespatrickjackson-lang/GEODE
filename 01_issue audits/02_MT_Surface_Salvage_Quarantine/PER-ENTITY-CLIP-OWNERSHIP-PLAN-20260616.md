# Per-Entity Clip Ownership — Implementation Plan (2026-06-16)

Status: plan only. No feature implementation. Branch scope: this is the declared
architectural move for `claude/mt-surface-salvage`.

## Problem this solves

Scene-section (and working-area) clipping is applied scene-globally: one
authored section `style` per page, and during a transition one global
`maskTransition` (a single source/target style pair + one progress) is applied
to every targeted entity. The clip channel therefore has no per-entity notion of
"this entity is leaving." When an entity is clipped in the source and **absent**
in the target, the global mask still drives its clip toward the target's
inactive/no-clip state, revealing previously-hidden exterior geometry before the
opacity fade finishes. The exit snapshot (DEC-173) is a workaround for this
limitation, not a model.

Governing invariant (not a state table): **no transition frame may reveal
geometry that neither endpoint shows.** Absent-in-target is not the same as
unclipped-in-target; an absent entity has no target clip to move toward.

## Current architecture (grounded)

- One authored scene-section style per page. Entities opt in via
  `sceneSectionTargetLayerIds` / `sceneSectionTargetProductIds`, refined
  per-object by `sceneSectionObjectVisibilityForObject`.
- `applySceneSectionPlanes` (`sceneSectionController.ts:4301`) iterates
  `this.layers`, computes per-object visibility, and applies clip two ways:
  - hard clip: THREE `clippingPlanes` on materials;
  - soft mask: `setSceneSectionUniforms` (`:2374`) writing `uSceneSection*`,
    including the DEC-172 source/target transition uniforms.
- Transition clip is global: one `sceneSectionStyleTween`
  (`transitionEffectiveLayersForPage.ts`), one `maskTransition` carrying
  `fromStyle`/`toStyle`/`progress`. Per-object source/target visibility is
  already resolved (`sceneSectionController.ts:4373-4395`) but from the global
  style pair + global progress.
- Working-area focus is a parallel channel (`workingAreaFocusController.ts`,
  per-layer apply, same uniform pattern).
- Clip-consuming surface (must all honor per-entity clip): `terrainMaterial.ts`,
  `loaders/loadScalarVolume.ts` (raymarch), `loaders/loadSeismicBrowser.ts`,
  `loaders/loadDrills.ts`, `loaders/topoLineMaterial.ts`,
  `shaders/mtSurfaceMaskShader.ts`, `shaders/sceneSectionObjectVisibilityShader.ts`,
  `shaders/workingAreaFocusShader.ts`, `shaders/pointDistanceLightShader.ts`,
  built-in `onBeforeCompile` injection.
- Exit workaround: `shouldSnapshotScalarVolumeSectionExit` (volume only) +
  detached source-root snapshot (salvage `5603dda`).

## Target architecture

Each render entity owns its clip transition, resolved from its own
source-page and target-page participation **and presence** — not from a single
scene-global style pair.

- `EntityClipState` = resolved clip for one entity on one page:
  `{ sectionPlanes, sectionFrames, objectVisibility, workingAreaFocus }`.
- `EntityClipTransition` = `{ entityId, source: EntityClipState,
  target: EntityClipState | null, behavior, startMs, durationMs, easing }`,
  where `behavior` is derived, not enumerated:
  - target present, source present → **interpolate** (move; preserves DEC-164/170).
  - target present, source absent → **enter**: clip = target from frame 0;
    opacity 0→1.
  - target absent, source present → **hold**: clip = source for the whole
    transition; opacity 1→0.
  - target absent, source absent → inert.
- The clip is applied through the existing per-material
  `setSceneSectionUniforms` / `clippingPlanes`, but the source/target/progress
  are resolved **per entity**, replacing the single global `maskTransition` for
  the clip channel only. Helpers, ground traces, axes, and Section ISO root
  ownership stay on their current owners.
- Consequence: an exiting live entity keeps its source clip while opacity fades,
  so the snapshot is no longer the clip-preservation mechanism. Snapshots remain
  only for representation-incompatible crossfades.

## Phases (each independently verifiable on 42911, committed atomically)

- **Phase 0 — Guards first.** Synthetic, page-agnostic guards encoding the
  invariant across every clip-consuming family: exit holds source clip; enter
  applies target frame 0; absent→absent inert; present→present interpolates.
  Protected-path guards: MT full-density scalar untouched; DEC-164/170
  move-follow intact; helper/ISO ownership intact.
- **Phase 1 — Pure clip resolver.** `resolveEntityClipState(env, page, entityId)`
  reusing `sceneSectionObjectVisibilityForObject` + working-area resolution. Unit
  tested. No runtime behavior change.
- **Phase 2 — Per-entity clip transition registry.** `Map<entityId,
  EntityClipTransition>` on SceneManager, ticked per frame, composed into the
  per-material apply. Initially mirrors current global behavior (parity gate: no
  visual change vs `5603dda`).
- **Phase 3 — Exit (hold).** Absent-in-target entities hold source clip; opacity
  owns the exit. Remove the volume-only exit-snapshot clip dependency. Verify
  `20→25`: clipped form fades, no exterior reveal. Generalizes to
  threshold/top/contact surfaces and seismic.
- **Phase 4 — Enter (apply-target).** Absent→present applies target clip from
  frame 0. Verify `25→20`: no unclipped flash, for volume **and** surfaces.
- **Phase 5 — Move (interpolate).** present→present interpolates per entity;
  confirm DEC-164/170 move-follow unchanged on section→section pages.
- **Phase 6 — Working-area parity.** Same per-entity model for working-area
  focus, composed with section (multiplicative mask), both directions.
- **Phase 7 — Retire the workaround.** Where per-entity ownership covers clip,
  drop snapshot clip-preservation; keep snapshots only for
  representation-incompatible crossfades. New decision entry superseding the
  clip-preservation reading of DEC-172/173.
- **Phase 8 — Full verification.** Protected guard batch + `tsc -b` + `build` +
  `check:workspace` + `check:visual-qa-clean`; visual acceptance on 42911 for
  exit/enter/move across volume, surfaces, seismic, working-area.

## Protected / unchanged

- MT full-density scalar/cloud path (`SCALAR_TRANSITION_STYLE_FIELDS`,
  `scalarInclusionFilterActive`, `scalarFullDensityAllValidMode`).
- Section ISO derived-root ownership (DEC-169/171), helper no-bleed
  (DEC-100/TRD-012), per-frame move-follow (DEC-164/170), right-handed helper
  orientation (DEC-165).
- No page-id / index / title / order / pair logic; clip behavior is entity- and
  presence-driven, applied globally.

## Risks

- Wide shader surface: every clip-consuming path must read per-entity clip. Risk
  of a missed path → Phase 1 completes the inventory and a guard asserts each
  family routes through the resolver.
- Hard clips (THREE `clippingPlanes`) are geometry-level and already per-material;
  per-entity hard clips must be set per object (current code already does).
- Per-frame per-entity resolution cost across many objects → cache resolver
  output per (entity, page) and only recompute on style/page change.
- The global `sceneSectionStyleTween` still drives **helpers**; only the clip
  channel moves per-entity. The two must not desync (helpers follow the section
  move; clip follows the entity).
- Interaction with the salvage exit snapshot during the transition window
  (Phase 3 removes the overlap; until then, keep them mutually exclusive).

## Interim state in the working tree

A narrow interim patch is present (uncommitted) in
`transitionEffectiveLayersForPage.ts`: the volume exit scalar-opacity tween is
gated `!shouldSnapshotScalarVolumeSectionExit` (mutual-exclusion of the two exit
owners). Phase 3 subsumes it. Options: keep as a stepping stone, or revert and
let Phase 3 own the exit. Recommended: revert before Phase 1 so the architecture
lands clean, since the per-entity model replaces the snapshot-based exit.

## Rollback

- Each phase commits atomically on `claude/mt-surface-salvage`.
- Return node `claude/mt-surface-salvage-checkpoint @ 5603dda` and main baseline
  tag `safety/main-salvage-baseline-20260616-231259 @ 02935eb` are the recovery
  anchors; any phase can `git reset --hard` to the checkpoint.
