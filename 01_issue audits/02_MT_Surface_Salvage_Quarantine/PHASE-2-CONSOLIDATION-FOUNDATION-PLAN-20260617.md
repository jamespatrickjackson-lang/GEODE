# Phase 2 — Consolidation Foundation Plan (2026-06-17)

Plan only. Builds the resolver + single applier ("the pipeline"), fade as the
default case, behind a runtime parity flag, migrating ONE owner first. Consumes
preflight A (decision map), B (taxonomy/grouping), D (carve-outs+guard),
E (locked decisions). Expected to fail at increments; failures are recorded as
data in the notebook (required artifact).

## Foundation success criterion (narrow, achievable)

The pipeline drives ONE owner end-to-end (opacity → fade) with the flag ON, with
no regression vs flag OFF, and every other owner untouched. NOT full migration.
F2+ owners are follow-on prompts.

## Notebook discipline (required — the point of the exercise)

`PHASE-2-NOTEBOOK-20260617.md`, append-only. No increment lands without an entry:

- **Hypothesis** — what the change should do and why.
- **Change** — files touched, the lever.
- **Measure** — flag A/B on 42911 (forward verification), `tsc -b`, carve-out +
  protected guard batch.
- **Result** — observed, including failure, verbatim.
- **Insight** — what the result teaches about the model (every failure earns one).
- **Disposition** — keep (commit hash) or revert (to prior tip), one line.

Failure protocol: on a failed increment, record Hypothesis-vs-Observed + Insight,
then revert to the prior commit. Do NOT pile fixes on a failing increment — each
clean failure narrows the model more than a patched one.

## Components

1. **Resolver** (extends Phase-1 `entityClipOwnership`). Inputs: manifest
   taxonomy (entity vs channel by scope width), container-hierarchy grouping
   prior (subsection grain), page-state diff (`effectiveStyle` /
   `effectiveVisibility` per layer). Output: per-group behavior decision (verb +
   channel composition). Default = **fade**; prior-vs-diff conflict or
   undetermined = **fade**. Pure, dependency-light, unit-tested.
2. **Applier** (single consumer). Per-frame at `tickLayerTweens`
   (layerTweenRuntime.ts); setup at `transitionEffectiveLayersForPage.ts`. For a
   migrated owner the applier OWNS the behavior; non-migrated owners fall through
   the existing path unchanged (override model — guarantees no collateral change).
3. **Parity flag** — runtime-toggleable (debug-settable, A/B on 42911). Default
   OFF = current scattered behavior. ON = pipeline for migrated owners only.

## Increments (small, reversible, flag-gated)

- **F0 — Scaffolding + notebook.** Resolver decision type + applier interface +
  runtime flag. Flag OFF. Zero behavior change (parity trivially holds). Seed the
  notebook. `tsc -b` + guard batch green. Commit.
- **F1 — First migration: opacity → fade.** Route the `layerTweens` opacity owner
  through resolver+applier for entity groups. Flag ON drives the fade from the
  resolver default. Verify: flag OFF == current; flag ON == same opacity fades
  (forward verification + eye); every non-migrated owner unchanged; carve-out
  guard green. Notebook entry. Commit or revert.
- **F2+ (separate prompts).** Section clip channel; then morph; derived (ISO /
  helpers keep their owners). Each its own increment + notebook + flag.

## First owner: layerTweens (opacity → fade) — rationale

Simplest channel; fade is the default case, so migrating it first validates the
resolver→applier shape with the least risk and the clearest signal, before any
clip work.

## Carve-outs / protected (preflight D, guard stays green)

MT full-density cloud excluded (special kitten; user-held restore point);
protected scalar path; DEC-169/171 (ISO roots), DEC-100/TRD-012 (helper
no-bleed), DEC-164/170 (move-follow). No page-id / index / title / order / pair
logic.

## Verification per increment

`tsc -b` exit 0; `clip-ownership-carveouts-source.test.mjs` + protected batch
green; flag A/B on 42911 (forward verification — no regression baseline; the
cloud is the only invariant and is carved out). Notebook entry recorded.

## Rollback

Each increment is an atomic commit on `claude/mt-surface-salvage`; revert to the
prior tip on failure. Return points intact: `…-checkpoint @ 5603dda`,
`8f60677`, tags. main / 002 / 003 / cloud untouched.

## Out of scope (foundation)

No migration beyond F1; no clip/morph/derived migration; no removal of the
scattered owners (they stay until their owner is migrated under its own flag).
