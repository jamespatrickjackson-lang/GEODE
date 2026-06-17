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
Disposition: keep (commit pending below).
