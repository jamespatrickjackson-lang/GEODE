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

## F1 — First migration: opacity -> fade (layerTweens through the pipeline)
Status: PENDING
Hypothesis: routing the opacity owner through resolver+applier with the resolver
default = fade reproduces current opacity fades when the flag is ON, with every
non-migrated owner unchanged. Likely failure modes: double application (pipeline
+ old owner both run), flag scoping leaks to other owners, per-frame cost, or the
group/diff inputs not matching the old per-layer behavior 1:1.
Change: (to fill)
Measure: (to fill)
Result: (to fill)
Insight: (to fill)
Disposition: (to fill)
