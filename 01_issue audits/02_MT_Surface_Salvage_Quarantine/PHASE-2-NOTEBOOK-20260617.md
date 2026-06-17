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

## F0 — Scaffolding + flag (resolver decision type, applier interface, runtime flag)
Status: PENDING
Hypothesis: a resolver decision type + applier interface + runtime parity flag
can be added with the flag OFF and produce zero behavior change (parity trivially
holds), establishing the single chokepoints (tickLayerTweens setup +
transitionEffectiveLayersForPage) without touching any owner.
Change: (to fill)
Measure: (to fill)
Result: (to fill)
Insight: (to fill)
Disposition: (to fill)

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
