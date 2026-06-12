# Transition Implementation Changelog

Status: draft implementation ledger.

Log behavior and guardrail changes here after implementation. Link each entry
to a decision or evidence item. Do not use this file for raw observations.

## 2026-06-12 - Registered Entity-Opacity Execution Slice

Decision links: TRD-013, TRD-014, DEC-152, DEC-153.

Changes:

- Added the generic `transitionEntityKey` runtime object contract for exact-key
  entity-opacity consumers.
- Added a generic entity-opacity executor that composes base material opacity,
  parent layer opacity, and per-entity transition opacity.
- Migrated seismic survey-geometry and figure-annotation fades onto exact
  entity keys. Survey geometry now uses product-agnostic role entities, and
  figure annotation identity wraps the runtime seismic section graph key.
- Updated execution-layer source guards so registered assignment consumers are
  allowed while broad seismic kind collectors and page-specific fixes remain
  blocked.
- Clarified that environment-scene, scene-section, Section ISO, working-area,
  and protected MT scalar/cloud paths remain guarded legacy kernels until
  separately migrated.

Verification:

- `node tests/tools/transition-entity-opacity-executor.test.mjs`
- `node tests/tools/seismic-graph-transition-executor.test.mjs`
- `node tests/tools/seismic-section-graph-basis.test.mjs`
- `node tests/tools/transition-render-graph-adapter.test.mjs`
- `node tests/tools/transition-entity-channel-policy.test.mjs`

## 2026-05-31 - Pre-Showcase Transition Stabilization

Decision links: TRD-008.

Changes:

- Kept final page-transition landing behind the commit ownership gate.
- Added deterministic assignment ordering by dependency depth, then entity key.
- Kept channel diffs sorted by channel key.
- Added generic target-readiness hold behavior for target-only loading entities.
- Prevented target-not-ready layers from entering the active transition
  visibility envelope.
- Routed post-landing page-selection reapply through the commit gate so the
  immediate index-change effect cannot visibly reassert target state.

Verification:

- `node -e "await import('./tests/tools/transition-page-agnostic-source.test.mjs')"`
- Focused transition source/adapter/analyzer/stitch tests.
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`
- `npm run check:pages`
- `npm run build`
- Browser smoke pass over the showcase route.

## 2026-05-31 - Commit Ownership Gate And Terminal Observer

Decision links: TRD-008.

Changes:

- Added a pure final-commit gate and terminal/target/committed graph observer.
- Routed page-transition landing through `SceneManager.finalizePageTransitionCommit`.
- Added commit traces to transition debug state.
- Guarded duplicate overlay-end, tween-completion, and deferred editor reapply
  target assertions after finalization.

Verification:

- `node --test tests\tools\transition-commit-gate.test.mjs`
- Focused transition source/adapter/analyzer/stitch tests.
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`
- `npm run check:pages`
- `npm run build`
- `git diff --check`

## 2026-05-31 - Transition Continuity Contract Classifier Boundary

Decision links: TRD-007, TRD-008.

Changes:

- Added `docs/dev-context/Transition-Continuity-Contract.md`.
- Extended the pure transition classifier with channel ownership priority,
  derived-entity dependency, execution mode, idempotent final-commit policy, and
  trace reasons.
- Added a source guard proving classifier assignments are not consumed by scene
  mutation while the execution-layer contract is still draft.
- Removed the provisional classifier-to-scene-transition wiring from the prior
  implementation attempt.

Verification:

- `node tests\tools\transition-entity-channel-policy.test.mjs`

## 2026-05-31 - Page-Agnostic Hygiene Guardrails

Decision links: TRD-001, TRD-002.

Changes:

- Added `tests/tools/transition-page-agnostic-source.test.mjs`.
- Refactored `tools/capture-transition-matrix.mjs` supplemental and
  interruption selection from fixed page indexes to feature-family predicates.
- Added fixture-boundary comments to Utah snapshot/regression fixtures.
- Added a fixture-boundary line to transition matrix reports.
- Added source-of-truth docs for constitution, guardrails, decision log,
  implementation changelog, and taxonomy draft.

Verification:

- `node -e "await import('./tests/tools/transition-page-agnostic-source.test.mjs')"`
- Focused source/in-process transition tests.
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`
- `npm run check:pages`
- `npm run build`
- `git diff --check`

## 2026-05-31 - Page-Level Fixture Repairs Removed

Decision links: TRD-001.

Changes:

- Restored Utah FORGE environment/page JSON fixture edits to repository
  baseline.
- Moved removed page edits into the evidence register.
- Kept generic editor/save/effective-state logic and validation work.

Verification:

- `npm run check:pages`
- Focused in-process source tests.

## 2026-05-31 - Transition-Gated Editor Writes Persist

Decision links: TRD-004.

Changes:

- Editor page layer/style/visibility writes persist authored state while direct
  live scene mutation is deferred during active transitions.

Verification:

- `tests/tools/editor-transition-gate-source.test.mjs`

## 2026-05-31 - MT Boundary Visibility Normalization

Decision links: TRD-005.

Changes:

- Canonical effective state uses `mtSurfaceBoundariesById.*.visible`.
- Legacy MT threshold visibility is warning/evidence when normalization can
  resolve it.

Verification:

- `tests/tools/validate-project-pages.test.mjs`
- `npm run check:pages`

## 2026-05-31 - Section ISO Transition Envelope

Decision links: TRD-006.

Changes:

- Section ISO overlay authored opacity stays independent from scalar volume
  opacity.
- Page-transition opacity uses a separate transition envelope for Section ISO.

Verification:

- `tests/tools/section-iso-transition-source.test.mjs`

## 2026-06-05 - Section ISO Overlay Root Crossfade

Decision links: TRD-011.

Changes:

- Section ISO overlay roots are snapshotted at page-transition start.
- Target roots are built once and attached at the current transition opacity.
- Source/target roots crossfade on the page transition clock, including delayed
  height-sampler rebuilds.

Verification:

- `tests/tools/section-iso-transition-smoothing-source.test.mjs`
- `tests/tools/section-iso-transition-source.test.mjs`
- `tests/tools/scene-section-transition-behavior-source.test.mjs`
- `tests/tools/scene-section-helper-transition-source.test.mjs`
- `npm run check:pages`
- `npm run build`
- `npm run check:workspace`
