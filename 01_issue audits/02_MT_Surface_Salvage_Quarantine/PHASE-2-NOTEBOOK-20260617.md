# Phase 2 Notebook (2026-06-17)

Append-only lab notebook for the consolidation foundation. Every increment gets
an entry before it lands. Failures are expected and are the data — each failure
earns an Insight line. No increment lands without an entry. Newest at bottom.

Entry format:

```
## <increment id> — <short title> — <date/time>
Hypothesis: ...
Change: <files / lever>
Measure: flag A/B on 42911; tsc -b; carve-out + protected batch
Result: <observed, incl. failure, verbatim>
Insight: <what it teaches about the model>
Disposition: keep <commit> | revert to <commit>
```

---

## F0 — Scaffolding + flag (applier skeleton, runtime flag, chokepoint wiring) — done
Status: DONE
Hypothesis: an applier skeleton + runtime parity flag can be added with the flag
OFF and produce zero behavior change, establishing the two chokepoints
(tickLayerTweens per-frame, transitionEffectiveLayersForPage setup) without
touching any owner.
Change:
- new `src/scene/transitions/entityBehaviorApplier.ts` (both entries return false).
- SceneManager: `perEntityBehaviorActive=false` + `setPerEntityBehaviorActive` /
  `isPerEntityBehaviorActive`; `tickLayerTweens` consults the applier first when
  the flag is on, else legacy.
- transitionEffectiveLayersForPage: same consult-first guard at setup entry.
- scene.ts: DEV-only `window.__geoseeBehaviorPipeline(v)` A/B hook.
Measure: tsc -b exit 0; carve-out + protected batch green (5/8/3/3/13/2/11/17/3);
flag OFF, applier returns false -> legacy runs; no console errors on 42911.
Result: zero behavior change. Inert by construction (flag default OFF; applier
returns false even when ON, since no owner migrated yet).
Insight: the consult-first/fall-through shape composes cleanly at both
chokepoints with the existing Impl-delegation pattern; the setup chokepoint is
`void`-returning so the early-return guard is type-safe.
Disposition: keep (commit pending below).

## F1 — First migration: opacity -> fade (generic fade branch through the pipeline) — done
Status: DONE (parity)
Hypothesis: routing the opacity owner through resolver+applier reproduces current
opacity fades when the flag is ON, with every non-migrated owner unchanged.
Change:
- new `src/scene/transitions/entityBehaviorResolver.ts` (`resolveOpacityFade`,
  pure; fade vs constant at the legacy 0.001 epsilon).
- `entityBehaviorApplier.ts`: `applyEntityOpacityFade` — single place that sets
  the layer's generic fade tween via the resolver; returns true (owns it) /
  false (fall through).
- `transitionEffectiveLayersForPage.ts`: the generic fade branch (was the inline
  `layerTweens.set(id,{from:fromOpacity,to:toOpacity,...})`) now: flag ON &&
  applier-handled -> applier owns it; else legacy set (mutual exclusion).
- new `tests/tools/entity-behavior-resolver.test.mjs` (4/4).
Measure: tsc -b exit 0; resolver test 4/4; carve-out + protected batch green;
42911 — DEV hook `window.__geoseeBehaviorPipeline` present, toggles ON/OFF with
no error; scene mounts; no console errors.
Result: parity holds by construction — the applier sets identical from/to
endpoints, so flag ON == flag OFF for the generic fade. Flag-ON transition A/B
(navigate pages) remains a human eye-check.
Insight: the F0 all-or-nothing chokepoints (whole-frame / whole-setup skip)
CANNOT migrate a single owner — the opacity tween is interwoven with snapshot /
scalar / section / render-opacity logic in the same per-layer loop. Per-owner
migration must INTERLEAVE the applier at the specific owner site (here: the
generic fade branch) with mutual exclusion, not replace the whole setup. The
all-or-nothing chokepoints are reserved for a future full cutover; per-owner
increments hook the owner's exact site. Scope this slice = generic fade branch
only; the snapshot-path and late-attach opacity sets stay legacy (next slices).
Disposition: keep (b6ce8fa).

## F1.1 — observability readout (so a parity step is verifiable) — done
Status: DONE
Hypothesis: a parity step has no visible signal; a counter the applier bumps when
it owns a tween makes flag ON vs OFF a hard number (eye cannot prove parity).
Change:
- SceneManager: `entityBehaviorOpacityOwned` counter + `noteEntityBehaviorOpacityOwned`
  / `entityBehaviorStats` / `resetEntityBehaviorStats`.
- applier: `applyEntityOpacityFade` calls `host.noteEntityBehaviorOpacityOwned()`
  when it owns a tween.
- scene.ts DEV hooks: `__geoseeBehaviorStats()`, `__geoseeBehaviorReset()`.
Measure: tsc -b exit 0; guards green; on 42911 both hooks present, scene mounts,
`__geoseeBehaviorStats()` -> { opacityTweensOwned: 0 } at rest.
Result: readout live. A/B sequence: reset -> flag ON -> navigate -> stats shows
opacityTweensOwned > 0; flag OFF -> reset -> navigate -> stays 0 (legacy path).
Insight: observability is a foundation feature, not a one-off — every later
increment (fade floor, clip) gets a verifiable number for its notebook entry
instead of relying on the eye for parity.
Disposition: keep (200e464).

## F2 — finish the opacity owner (snapshot-path + late-attach), parity — done
Status: DONE (parity)
Hypothesis: routing the remaining opacity sites through the applier reproduces
their fades identically (parity), with the owned-count climbing.
Change:
- transitionEffectiveLayersForPage.ts snapshot-path live-layer tween (from:0 ->
  toOpacity) now flag-gated through `applyEntityOpacityFade`, else legacy.
- SceneManager.ts late-attach FADE branch (from:0 -> targetOpacity) same.
- Snap-on branch (remainingMs <= 150) left legacy (that is F3's target).
Measure: tsc -b exit 0; guards green; counter climbs further with flag ON.
Result: parity by construction (identical endpoints). Generic fade + snapshot +
late-attach fade now all owned by the pipeline when the flag is on.
Insight: each opacity site is its own narrow interleave at the owner's exact
location; "the opacity owner" is several sites, not one — confirms the
per-owner-interleave model over the all-or-nothing chokepoint.
Disposition: keep (4dab7d7).

## F3 — fade floor at late-attach (first behavior change, flag-gated) — ready for eye-check
Status: DONE (code); VISUAL eye-check PENDING
Hypothesis: with the flag ON, a near-end late arrival (remainingMs <= 150,
targetOpacity > 0.001) that legacy snaps to full opacity instead fades over a
floor (max(remainingMs, 250ms)) through the pipeline. Flag OFF keeps the legacy
snap-on. This is the v1 fade-floor idea done through the pipeline, observable via
the counter.
Change: SceneManager late-attach tail rewritten — hidden target instant; near-end
+ flag OFF = legacy snap; otherwise fade via applyEntityOpacityFade with
`lateFadeMs` (floor for near-end). New const ENTITY_BEHAVIOR_FADE_FLOOR_MS=250.
Measure: tsc -b exit 0; full guard batch green (incl. transition-high-fixes 3/0 —
READINESS_ENTER_MIN_REMAINING_MS=150 + readiness prune intact).
Result (code): flag OFF == legacy (parity); flag ON near-end fades. VISUAL/eye on
42911 is the gate: A/B `30 -> 31` (and other late-attach enters) flag ON vs OFF.
Failure modes to watch (failure = data): (1) the floor fade tail extends past
transition commit and gets truncated/flickers; (2) `30 -> 31` snap is NOT
late-attach (surfaces ready at setup) -> no change -> the snap lives in
discrete-commit/derived-root, which is the next slice (F4); (3) counter does not
climb for the case -> the path is not the one snapping.
Verdict (eye-check 2026-06-17): 30->31 and other pages work fine — no snap there
for F3 to fix, and no regression. F3 is harmless but its target case did not
reproduce (late-attach near-end snap was not the visible symptom). The remaining
visible bug is 20->25: the MT/ISO surface "cloud" appears (exterior reveal) on
exit from the sectioned page to the full-density page. 25->20 is fine. That is
the CLIP channel exit-reveal, NOT opacity — confirms the headline bug is
clip-hold-on-exit. Next owner = F4 (clip channel).
Disposition: keep (651095b).

## F4 — clip channel exit-hold (the 20->25 reveal) — ready for eye-check
Status: DONE (code, flag-gated); VISUAL eye-check PENDING on 20->25
Change: when the flag is ON and the held-clip source snapshot owns a sectioned
volume exit (shouldSnapshotScalarVolumeSectionExit), the live scalar exit tween
is suppressed (mutual exclusion) so the live (inactive-target, un-clipped) volume
does not render its exterior while fading — only the clipped snapshot fades.
exitHoldsOwned counter added to entityBehaviorStats. This is the reverted L2 fix,
now flag-gated and observable (the v1 idea done through the pipeline).
Measure: tsc -b exit 0; full guard batch green (high-fixes 3/0, scalar-tween 3/0).
Result (code): flag OFF == current (reveal still present, parity); flag ON
suppresses the live volume so only the held clip fades. VISUAL gate on 42911:
A/B `20->25` flag ON vs OFF; `__geoseeBehaviorStats().exitHoldsOwned` > 0 on the
`20->25` transition confirms the pipeline took the exit.
Scope/limits (failure = data): leverages the EXISTING volume-only snapshot
(DEC-173); the threshold/top/contact SURFACES are not snapshotted, so if the
"cloud" reveal is the surface family (not the raymarch volume) this will not
fully clear it -> F5 extends the held-clip exit snapshot to the surface family.
Not the full per-entity section-hold architecture yet; this is the targeted,
proven L2 fix flag-gated.
Disposition: keep (commit pending below); revert if the eye-check regresses.

(superseded planning note below)
## F4 (planning) — clip channel exit-hold
Status: PLANNED (headline bug; the per-entity clip ownership this branch exists for)
Target: 20->25 (and any clipped-source -> absent-target). An entity clipped in
the source and absent in the target must HOLD its source clip while opacity
fades; today the active->inactive exit applies the inactive (scene-global)
section to the live entity, un-clipping it so the exterior shows during the fade.
Resolver: Phase-1 `resolveEntityClipDecision` already returns `exit-hold` for
clipped-source + absent-target — the decision exists; F4 is the APPLIER + the
hold at the active->inactive exit path, flag-gated.
Risk: clip is scene-global today (`applySceneSectionPlanes(targetSceneSectionStyle)`
applied to all); per-entity hold is the real architectural step. Interacts with
the salvage exit snapshot (DEC-173) and the reverted L2 mutual-exclusion. Needs
its own plan + prompt.
