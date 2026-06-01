# Transition Decision Log

Status: draft decision source of truth.

Use this file to cement transition definitions. Evidence belongs in the
evidence register; implementation details belong in the changelog.

## Entry Format

```text
TRD-000 - Title
Status: draft | accepted | superseded
Problem:
Decision:
Consequences:
Revisit when:
Evidence:
```

## TRD-001 - Pages Are Disposable Fixtures

Status: accepted

Problem: Transition bugs were being described through specific page numbers and
paths, which creates pressure to patch content instead of the global logic.

Decision: Pages, page numbers, page ids, page titles, page indexes, matrix case
ids, and source/target fixture paths are evidence only. Runtime fixes must be
page-agnostic.

Consequences: Page-specific runtime branches fail review. Fixture JSON edits
are not transition fixes.

Revisit when: Product requirements intentionally introduce durable semantic
routes that are not disposable pages.

Evidence: `Transition-Page-Fixture-Evidence-Register-2026-05-31.md`.

## TRD-002 - Remediation Targets Feature Families

Status: accepted

Problem: Matrix cases and user observations can point at a fixture path, but
the same defect may appear on future pages.

Decision: Each transition remediation must name the affected feature family:
already-visible products, Section ISO, scene-section helpers, MT handoffs,
camera path, legends/show-hide, overlays/labels/assays, or another explicit
family.

Consequences: Tests and matrix tooling should select or label cases by feature
family. Observed page ids can remain in artifacts as evidence.

Revisit when: The transition taxonomy is finalized and family names change.

Evidence: `tools/capture-transition-matrix.mjs`,
`tests/tools/transition-page-agnostic-source.test.mjs`.

## TRD-003 - Human Visual Review Is the Visual Acceptance Gate

Status: accepted

Problem: Headless screenshots, traces, and videos can expose timing and state
issues but cannot settle visual quality.

Decision: User visual review accepts camera smoothness, fade quality, isoband
appearance, ground-line continuity, and contour/cadence tradeoffs.

Consequences: Automation can collect evidence and prevent regressions, but it
must not be reported as final visual approval.

Revisit when: A trusted headed/human-visible capture workflow is explicitly
accepted as an approval proxy.

Evidence: `Transition-Human-Review-Checklist-2026-05-31.md`.

## TRD-004 - Editor Writes Persist During Transition Gating

Status: accepted

Problem: Blocking live scene mutation during transitions must not drop saved
editor/page state.

Decision: Editor writes dispatch into page/editor state even when direct live
scene application is deferred until after the active transition.

Consequences: Transition gating protects the live scene without losing authoring
intent.

Revisit when: Editor state and scene state move to a different transaction
model.

Evidence: `tests/tools/editor-transition-gate-source.test.mjs`.

## TRD-005 - MT Boundary Visibility Uses Canonical Boundary State

Status: accepted

Problem: Legacy `mtThresholdSurfaceVisibility` and canonical boundary records
can disagree.

Decision: `mtSurfaceBoundariesById.*.visible` is the canonical MT boundary
visibility source. Legacy state mirrors it on writes and is normalized for
effective runtime state.

Consequences: Raw mismatch is evidence; normalized effective mismatch is an
error.

Revisit when: Legacy MT threshold visibility is removed from persisted page
state.

Evidence: `tests/tools/validate-project-pages.test.mjs`.

## TRD-006 - Section ISO Has Its Own Transition Envelope

Status: accepted

Problem: Section ISO bands and isolines can inherit the wrong opacity behavior
when scalar volume layer opacity and transition opacity share one path.

Decision: Section ISO overlay opacity remains independent from authored scalar
volume opacity and receives a separate transition-envelope opacity during page
fades.

Consequences: Runtime can fade transition envelopes without changing authored
Section ISO appearance or product-owned opacity.

Revisit when: The transition taxonomy defines a different already-visible
product ownership model.

Evidence: `tests/tools/section-iso-transition-source.test.mjs`.

## TRD-007 - Transition Policy Is Entity And Channel Driven

Status: accepted

Problem: Tool-specific transition rules create the same drift risk as
page-specific rules. A named tool or renderer can accidentally become a special
case instead of proving the global transition model.

Decision: Base transition policy derives from resolved entity identity,
representation compatibility, presence/visibility state, readiness, and
channel diffs. Named tools, editor panels, products, and render families may
provide adapters that declare identity keys, compatibility keys, channels, and
interpolation support. They must not define separate base visibility semantics.

Consequences: Same identity plus compatible representation preserves continuity
and interpolates compatible changed channels. Missing identities or
incompatible representations use enter, exit, hold, or crossfade fallback
behavior. Tool-family examples remain evidence for testing the generic contract,
not remediation targets.

Revisit when: A renderer needs a durable exception that cannot be expressed as
identity, compatibility, readiness, or channel capability.

Evidence: `Transition-Taxonomy-Draft.md`.

## TRD-008 - Transition Continuity Contract Defines The Classifier Boundary

Status: accepted

Problem: A transition architecture can drift into execution-layer patches before
the continuity model is defined. That creates ambiguity around source state,
target state, ownership, derived visuals, compatibility, and final commit
behavior.

Decision: A page transition is defined as a deterministic diff between a
resolved source render graph and a resolved target render graph. The first
implementation layer is a pure classifier only: it accepts resolved render
entities, channel facts, ownership priority, readiness, compatibility, and
derived-entity dependency; it emits transition assignments, execution modes,
final-commit policy, and trace reasons. Scene mutation must not consume
classifier output until the execution-layer contract is explicitly designed.

Consequences: Camera smoothing, opacity changes, contour cadence, section
helpers, snapshots, isobands, ground lines, and page JSON remain out of scope
for classifier work. Runtime consumers must be added in a later pass and must
consume assignments rather than independently deciding fades or final commits.

Revisit when: Execution-layer consumers are designed for the accepted
classifier contract.

Evidence: `Transition-Continuity-Contract.md`,
`tests/tools/transition-entity-channel-policy.test.mjs`.
