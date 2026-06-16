# Transition Runtime Operating Spec

Status: active transition-system operating spec.

Purpose: define the intended page-to-page transition model before runtime code changes.

## Non-negotiable rules

- Do not fix transitions by editing page JSON, overlays, project pageOrder, page IDs, page titles, page indexes, or page-to-page fixture pairs.
- Do not add runtime branches keyed to a page id, page index, page title, page number, page order position, matrix case, or source/target page pair.
- Do not weaken MT full-density / scalar cloud transitions during broad transition work. Treat the MT scalar/cloud path as a protected success path unless a later narrow task explicitly targets it.
- Do not tune easing/duration before entity ownership and channel transitions are correct.
- Do not use full final reapply as a visual fix. Final commit must be visually idempotent.

## Core model

A page transition is a deterministic diff between:

1. Source live render graph:
   The actual current visible runtime state at transition start, including user/editor changes already applied.

2. Target resolved render graph:
   The target page/editor/environment state after normalization into the same graph shape.

The transition engine compares source and target render entities and assigns exactly one behavior to each entity/channel.

## Entity identity

A render entity is not just a layer id.

Stable identity should include, as relevant:

- layer id
- product id
- derived object id
- section frame id
- section axis / plane id
- helper id
- overlay/root id
- scalar source id
- working-area focus state
- representation type

Page id, page title, page index, and page order are not entity identity.

## Representation compatibility

If source and target have the same entity identity and compatible representation, preserve identity and interpolate compatible channels.

If representation is incompatible, crossfade or commit discretely.

If target is not ready, hold source or attach target later at the current transition envelope.

## Assignments

Each entity/channel receives one assignment:

- skip
- preserve
- interpolate
- move
- enter
- exit
- crossfade
- hold-until-ready
- commit-discrete

No subsystem may independently invent its own opacity envelope, helper snapshot, late root promotion, or final reapply outside assignment ownership.

## Channel categories

Transition channels include:

- visibility / presence
- opacity
- color
- material uniforms
- scalar range / scalar filter
- transform
- position
- plane equation
- crop/window bounds
- section mask
- working-area mask
- helper opacity
- derived-root opacity
- legend state
- readiness/loading state

Unsupported channels must be explicitly declared discrete. They must not silently snap because they were forgotten.

Declared-discrete channel families (no executor interpolates them yet):

- color / material color channels (`color-material`, DEC-163): commit
  discretely. A future color-lerp executor may upgrade same-identity
  visible-in-both layers per family with a new decision entry.
- categorical channels (`discrete-categorical`): commit discretely.

## Enter / exit

Visible in source and absent/hidden in target:
- exit unless the target-active rule says discard immediately.

Absent/hidden in source and visible in target:
- enter once target is ready.

Visible in both:
- preserve/interpolate if compatible.

## Move

When the same entity exists on both pages but its spatial channel changes, it should move/interpolate, not disappear/reappear.

Move channels include:
- section plane position
- section plane normal when compatible
- section frame bounds/window
- helper frame position
- ground trace geometry when compatible
- axes/tick/label placement when compatible
- derived ISO cut position when bound to a moving section

If geometry cannot be morphed safely, use a declared crossfade, not an accidental rebuild/snap.

Move is decided **per frame**, not per section (DEC-164). A frame whose
discrete identity matches on both pages moves even when a *different* frame on
the same section is added, removed, or toggled. Only the changed frame
crossfades. A section-wide snap because one axis toggled is the recurring
"Y-section" regression; see `sceneSectionFramePartition`.

## Derived entities

Derived entities follow their source unless explicitly promoted to independent transition ownership.

Derived entities include:
- Section ISO bands
- Section ISO isolines/isobars
- MT/seismic cut ISO roots
- ground traces
- helper handles
- section-frame outlines
- axes/ticks/labels
- working-area clipped derivatives
- scalar edge/line overlays
- topo/graticule derived labels

Derived roots must never appear at full opacity during a transition if they were created late.

## Section and Section ISO rules

Section transition behavior is target-active.

Active-to-active:
- compatible section channels interpolate
- incompatible helper geometry crossfades
- derived Section ISO roots crossfade

Inactive-to-active:
- target section state fades in

Active-to-inactive or active-to-unrelated:
- source section masks, helpers, frame controls, ground traces, axes, and Section ISO roots must not carry into the target transition
- inactive target section state applies at transition start
- transition-owned Section ISO roots are discarded, not promoted

## Working-area focus

Working-area focus is a mask/attenuation channel, not a visibility hack.

When working-area focus is unchanged, no focus tween should start.

When focus changes, it must compose with layer/product opacity and section/ISO opacity. It must not overwrite them.

## Opacity composition

Opacity is composed, not overwritten.

Effective visual opacity should be represented as:

authored opacity
× page/layer transition opacity
× product/source opacity
× section/working-area mask
× derived-root transition opacity
× attenuation/readability factors

No code path should directly set material opacity as if it owns the whole visual result unless that material is documented as the only opacity owner.

## Final commit

Final commit applies the target graph after transition completion.

It must not:
- rebuild target roots at full opacity
- reassert global/default state over page-local target state
- replay source state
- trigger a visible second snap
- duplicate target apply through overlay-end, tween-completion, and deferred editor reapply paths

## User/editor mutation during transition

A user can jump from any page to any page at any time and can change state before, during, or after transition.

Therefore the system must distinguish:
- saved page state
- selected authoring target state
- live current scene state
- source transition snapshot
- target transition snapshot
- in-flight editor mutations
- delayed async loaded state

The source graph must come from live current scene state at transition start, not stale saved page JSON.

The target graph must be resolved from target effective state, including page-local state, not global defaults unless the target actually resolves to global defaults.

## Readiness

If target geometry/material/texture/data is not ready:
- do not flash partial target state
- hold source or attach target at current transition opacity when ready
- record readiness in debug state

## Sanctioned non-transition camera moves

Some camera moves do not create a transition context and must not. The
free-look return / pose-restore tweens in `PageController` (`tweenTo(pose,
...)`) move the camera back to the active page's pose without a layer
transition, commit gate, or visibility envelope. This is correct: a same-page
camera return changes no effective page/environment state, so there is nothing
to transition.

Rule: any path that changes effective page or environment state must go through
`transitionEffectiveLayersForPage` plus the commit gate. A bare pose tween is
allowed only when the effective graph is unchanged (camera-only return on the
same page). Do not reuse the free-look pose-tween paths to land on a different
page or a changed environment; that would silently skip layer transitions,
readiness handling, and final commit (review success-factor A8).

## Protected MT scalar/cloud path

MT full-density scalar/cloud transitions currently behave better than other paths.

Do not alter:
- full-density-scalar transition kind
- scalar inclusion mode semantics
- scalar range interpolation
- scalar legend target-mode authority
- scalar edge/isoline overlay generation
- MT point cloud density/opacity correctness

unless a narrow MT-specific task is approved.

## First likely code target

The first code pass should target Section ISO / scene-section / working-area derived roots because current symptoms cluster there:

- isobars/isolines snapping
- section roots ghosting
- sections persisting to unrelated pages
- section changes crossfading instead of moving
- derived roots attaching late at full opacity
- working-area sectioned entities ghosting

## Required evidence before code

Before runtime code changes, produce:

1. transition state ownership map
2. render entity/channel inventory
3. current unsupported channel list
4. first-slice implementation plan
5. source guards to prevent page-specific runtime fixes
