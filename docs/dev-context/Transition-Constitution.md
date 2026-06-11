# Transition Constitution

Status: draft source of truth.

Read before transition runtime, editor/save, show/hide, legend, page-state, or
matrix/tooling work. This document states durable intent. Historical prep logs
and matrix artifacts are evidence, not authority.

## Authority Order

1. This constitution.
2. `docs/dev-context/Transition-Continuity-Contract.md`.
3. `docs/dev-context/Transition-Decision-Log.md`.
4. `docs/dev-context/Transition-Guardrails.md`.
5. `docs/dev-context/Transition-Page-Fixture-Evidence-Register-2026-05-31.md`.
6. `docs/dev-context/Transition-Implementation-Changelog.md`.
7. Historical prep/audit logs and generated artifacts.

When documents disagree, use the highest item in this list and add or update a
decision record before implementing behavior.

## Core Rules

- Pages are disposable fixtures. Page ids, page numbers, page indexes, page
  titles, matrix case ids, and fixture paths are reproduction evidence only.
- Transition fixes must target global state, ownership, and rendering rules.
  Any page-number-specific runtime fix is an immediate fail.
- Transition policy must derive from resolved entity identity, representation
  compatibility, and channel diffs. Named tools, editor panels, render families,
  and case-study products are evidence or adapters, not top-level transition
  rules.
- Transition behavior is defined by the Transition Continuity Contract: a
  deterministic diff between resolved source and target render graphs.
- Current and future pages must be able to change, disappear, or be randomly
  altered without invalidating the transition logic.
- Visual acceptance belongs to the user for camera smoothness, opacity feel,
  isoband appearance, ground-line continuity, and contour/cadence tradeoffs.
- Instrumentation and headless captures are diagnostic evidence. They are not
  proof that visual behavior is acceptable.
- Editor/page state writes must persist even when live scene mutation is
  deferred during active transitions.
- Runtime-facing state should be normalized from canonical authoring sources.
  Duplicate legacy state is evidence unless normalized effective state remains
  inconsistent.

## Ambiguity Funnel

Every transition issue should be translated through this chain before code is
changed:

`symptom -> reproduction fixture -> transition family -> violated invariant -> decision needed -> implementation target -> guard/test -> human review when visual`

Do not jump from a fixture path directly to a code patch.

## Draft Invariants

- Already-visible products should not fade out and back in merely because page
  navigation occurred.
- Already-visible matched entities with compatible representations should stay
  continuous; only changed compatible channels should interpolate.
- Unmatched or incompatible entities should use explicit enter, exit, hold, or
  crossfade fallback behavior rather than pretending continuity exists.
- Product-owned opacity must compose with transition opacity; one must not
  overwrite the other.
- Hidden or intentionally dormant state should not appear during transitions.
- Scene-section reference helpers, ground traces, axes, frame outlines, and
  crop boxes need explicit ownership separate from editor handles.
- Camera path and page-selection commit timing need a defined base policy before
  smoothing changes are accepted.
- Show/hide, legends, save/load, editor controls, and transition runtime should
  read and write the same canonical authoring targets.

## Definition Work Queue

These are not fully cemented yet and should be defined next:

- Transition type taxonomy.
- Desired behavior for each transition family.
- Ownership allocation: editor state, effective page state, scene manager,
  product renderer, consumer UI, and matrix/debug tooling.
- Visual acceptance criteria for already-visible products, camera, section ISO,
  scene-section helpers, legends, overlays, labels, and assays.
- Revisit rules for changing cadence, LOD, opacity, or camera duration.

## Transition Runtime Operating Spec

Before transition runtime, editor/save transition gating, scene-section, Section ISO, working-area focus, opacity, or page-navigation work, read:

docs/dev-context/Transition-Runtime-Operating-Spec.md

This spec is the active operating contract for current transition work. Older audits and matrix logs are evidence only.

