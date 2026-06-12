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

## TRD-009 - Background/Fog Scene Channels Blend During Page Transitions

Status: accepted

Problem: Background and fog are resolved scene channels, but they were applied
only by final `applyEnvironment(...)` commit. Dark-to-light and fog-density
changes therefore snapped at the end of otherwise smooth page transitions.

Decision: Background color, fog color, and fog density are
environment-scene transition channels. During page navigation, they blend over
the target page's `transition.duration` and `transition.easing`. Fog disabled
on either side maps to density `0` during the blend, while the final
enabled/disabled state is committed by the normal target environment apply.

Consequences: The transition runtime owns a narrow background/fog frame path
for renderer clear color, scene background/fog, topo fog uniforms, layer fog
density, and fog-driven post tint. This path must not call full
`applyEnvironment(...)` per frame and must not transition terrain light-mode
ramps, lighting, sun visuals, material presets, texture URLs/cache keys,
bounds, public clip, edge fade, edge outline, shaders, or geometry.

Revisit when: Full scene mood transitions are intentionally expanded to include
terrain ramps, lighting, sun, or other discrete environment channels.

Evidence: `Dark-Light-Scene-Transition-Audit-2026-06-05.md`,
`tests/tools/environment-scene-transition-source.test.mjs`.

## TRD-010 - Scene Section Masks And Helpers Blend During Page Transitions

Status: accepted

Problem: Scene section planes and section frames are resolved scene masks, but
incompatible section changes could still snap clipped render content to the
target mask while helper visuals crossfaded separately. Sectioned items are
tied to outside-opacity variables, so visible content should fade down or up
to the target section state on the same page-transition clock.

Decision: Scene section masks are transition-scene channels, not
`LayerTransitionKind` values. During page navigation, compatible section-frame
changes interpolate authored numeric section style values. Incompatible
section-frame, target, or enable-state changes use a dual-mask fade: evaluate
the source section mask and target section mask independently, then compute
final alpha as `lerp(sourceMaskAlpha, targetMaskAlpha, easedProgress)`.
`sceneSectionObjectVisibilityByAxis` and
`sceneSectionObjectVisibilityByFrameId` outside-opacity maps are continuous
opacity channels and do not by themselves force a discrete snap.

Consequences: Section materials must update shader/uniform state during
transition frames without rebuilding helper geometry. Ground traces, axes,
frame outlines, labels, and intersection traces use
`sceneSectionHelperTransitionOpacity` on the same target page
`transition.duration` and `transition.easing` only when the target page also has
active section helpers. Outgoing helper snapshots are allowed for active-to-active
section helper changes; they are not allowed to carry section-frame studio
controls into inactive/unrelated target pages. Public surface clip
remains a hard terrain/topo crop; texture URLs/cache keys, bounds, material
presets, edge fade, edge outline, shader identity, terrain geometry, lighting,
sun, and camera path remain outside this v1 section-mask transition owner.

Revisit when: Section helper geometry itself needs continuous morphing, or
section masks need a authored transition timing source separate from page
transition timing.

Evidence: `Scene-Section-Transition-Fade-Audit-2026-06-05.md`,
`tests/tools/scene-section-transition-behavior-source.test.mjs`.

## TRD-011 - Section ISO Overlay Roots Crossfade During Page Transitions

Status: accepted

Problem: Section ISO bands and isolines are generated overlay roots. Even after
TRD-010 made section masks and helper opacity transition-aware, target cut ISO
roots could still be created only at final full apply, causing bands or lines to
appear in one frame.

Decision: Section ISO overlay roots are derived transition-scene entities. On
page-transition start, source roots are snapshotted, target roots are built once
under the target style, and source/target roots crossfade on the same
`transition.duration` and `transition.easing` used by the page transition.
Delayed height-sampler retries attach target roots at the current Section ISO
transition opacity.

Consequences: Section ISO material opacity remains composed from authored
opacity, transition opacity, and threshold-surface attenuation. Geometry or
identity changes crossfade source and target roots rather than morphing contour
geometry every frame. Final full apply may land exact target state, but must not
make Section ISO roots appear at full opacity after the tween.

Revisit when: Section ISO contour geometry itself needs continuous morphing, or
when a non-page transition timing source is introduced for derived section
overlays.

Evidence: `tests/tools/section-iso-transition-smoothing-source.test.mjs`,
`docs/dev-context/Section-Iso-Transition-Smoothing-Temp-Log-2026-06-05.md`.

## TRD-012 - Scene Section No-Bleed Target-Active Guard

Status: accepted

Problem: TRD-010 and TRD-011 smoothed section masks, helper opacity, and Section
ISO roots, but active-to-inactive exits still carried source section visuals
into unrelated target page transitions. That smooth exit fade reads as bleed
when the target page has `sceneSectionEnabled !== true`.

Decision: Section transition smoothing is target-active. Active-to-active
section changes may use the TRD-010 dual-mask fade and helper crossfade.
Inactive-to-active changes may fade the target section state in. Active-to-inactive
and active-to-unrelated transitions must not carry source section masks, helpers,
frame controls, ground traces, or Section ISO roots. They apply the inactive
target section state at transition start, prevent helper snapshots, and discard
transition-owned Section ISO roots without promoting target roots.

Consequences: Transition graph diagnostics must treat scene-section frame
presence as active only when `sceneSectionEnabled === true` and
`sceneSectionFrameEnabled === true`. Section ISO root cancellation and final
commit remain separate paths: discard removes transition roots, while commit is
reserved for completed target-active transitions.

Revisit when: A page-level authoring option is added to deliberately show source
section exits on unsectioned target pages.

Evidence: `tests/tools/scene-section-transition-behavior-source.test.mjs`,
`tests/tools/section-iso-transition-smoothing-source.test.mjs`.

## TRD-013 - Transition Execution Layer Consumes Classifier Assignments

Status: accepted

Supersedes the TRD-008 classifier-only boundary.

Problem: The classifier (`classifyTransitionRenderGraphs`) produces correct
per-entity assignments every navigation, but no scene mutation consumes them.
Execution is decided by a parallel imperative ladder
(`shouldCrossfadeDiscreteData`, `shouldCrossfadeSceneSection`,
`shouldTweenScalarStyle`, `authoredProductTransitionKind`) and advanced by
`tickLayerTweens`. The seismic derived-entity graph (section/product,
figure-annotation, survey-geometry, comparison) classifies with stable identity
keys but drives nothing, so survey-geometry toggles crossfade the whole seismic
layer, figure annotations have no independent enter/exit, slice-fraction changes
crossfade instead of moving, and same-product sections fade between pages.

Decision: A transition execution layer consumes classifier assignments and is
the single owner of per-entity execution. It is an ownership/dispatch layer, not
a reimplementation. `buildTransitionExecutionPlan` maps each assignment's
execution mode to an executor kind; `evaluateTransitionExecutionPlan` advances it
per frame; a channel-executor registry dispatches each active operation to an
existing interpolation kernel. The TRD-009 environment-scene blend, the TRD-010
scene-section mask/helper owner, the TRD-011/012 Section ISO root owner, the
working-area focus tween, and the protected MT full-density scalar kernel are
re-framed as registered channel executors triggered by assignment, not as
independent deciders. Their interpolation math is unchanged. Seismic derived
entities gain a dedicated entity executor that applies per-identity opacity to
trace-header-tagged meshes.

Consequences: The imperative decision ladder in `transitionEffectiveLayersForPage`
is replaced by plan construction; `tickLayerTweens` becomes a plan evaluator that
dispatches through the registry. The protected MT-scalar/cloud path keeps its
exact kernel (`interpolatedScalarStyle`); only its dispatch trigger moves to the
assignment. All prior transition source-pattern tests remain the regression
contract and must stay green; assertions that grep a replaced decision-ladder
boolean are repointed at the assignment-driven equivalent in lockstep with this
entry. Page-id, page-index, page-title, and page-order remain non-identity.

Revisit when: A renderer needs a durable per-entity execution exception that
cannot be expressed as an assignment execution mode plus a registered executor
kind, or when the channel-executor registry needs an authored timing source
separate from page-transition timing.

Evidence: `tests/tools/transition-execution-plan.test.mjs`,
`tests/tools/seismic-graph-transition-executor.test.mjs`,
`tests/tools/transition-entity-channel-policy.test.mjs`. Peer durable decision
DEC-152 in `docs/03-decisions.md`.
