# Transition Taxonomy Draft

Status: draft working taxonomy.

This document is the workspace for defining transition entities, channel diffs,
desired behaviors, and owner allocation. It is not complete policy until
decisions are promoted into `Transition-Decision-Log.md`.

Core framing:

> Transition behavior should emerge from stable entity identity plus channel
> diffs, not from page numbers or hand-authored page-pair transition types.

Pages are only a way to produce source and target resolved visual states.

## Universal Transition Contract

Status: implementation draft, governed by TRD-007.

This is the policy layer. It must not name page ids, page indexes, editor tool
names, product families, or case-study renderers. Specific renderers may expose
adapters that declare identity, compatibility, channels, and interpolation
support, but the base rules below remain the same.

### Entity Record

| Field | Meaning | Implementation constraint |
| --- | --- | --- |
| `identityKey` | Stable logical entity across source and target states | Must not include page id, page index, case id, editor panel name, or transient DOM/component identity. |
| `representationKey` | Render representation used for compatibility checks | Same key means direct channel interpolation may be allowed; different keys require an adapter or fallback. |
| `presenceState` | absent, dormant, hidden, visible, loading, ready, or unavailable | Presence is a channel, not identity. |
| `readinessState` | whether target representation can safely render now | Unready targets cannot flash stale or partial visuals. |
| `channels` | Typed visual/runtime values exposed by the entity | Channels declare interpolation support and final commit behavior. |
| `sourceState` | live resolved visual state at transition start | Must include runtime/editor/session changes already affecting the scene. |
| `targetState` | resolved target visual state | Must include applicable runtime/global/session controls. |

### Channel Contract

| Channel class | Examples without naming tools | Default policy |
| --- | --- | --- |
| Presence / visibility | absent, dormant, hidden, visible, ready | Off/off remains off; on/on preserves; on/off exits; off/on enters. |
| Continuous scalar | opacity, size, thickness, range, density, feather, strength | Interpolate when identity and representation are compatible. |
| Color / material scalar | color stops, tint, brightness, material numeric values | Interpolate when renderer declares compatible material mutation. |
| Spatial transform | position, target, frame, crop bounds, slice/plane position | Move, slide, or interpolate when the same spatial reference persists. |
| Geometry parameter | threshold, range, contour location, sampled plane, mask boundary | Interpolate or regenerate continuously only when stable identity and representation allow it. |
| Discrete categorical | mode, inclusion policy, label text, selected option | Hold source, switch at a defined commit point, or crossfade if visual continuity is unsafe. |
| Representation | points, mesh, volume, line, overlay, UI consumer | Preserve only through an explicit compatibility adapter; otherwise crossfade or discrete commit. |
| Runtime control | session visibility, client filter, legend membership, temporary emphasis | Resolve into source and target graphs before diffing; never resurrect stale saved source state. |

### Base Visibility State Machine

| Source state | Target state | Required behavior | Failure mode to guard |
| --- | --- | --- | --- |
| Off / absent / dormant | Off / absent / dormant | Remain non-rendering throughout transition and after commit | Hidden ghost appears. |
| Visible and ready | Visible and ready, same identity, compatible representation | Preserve entity; interpolate only changed compatible channels | Fade out/in, opacity snap, stale saved-state ghost. |
| Visible and ready | Hidden, absent, or incompatible target | Run explicit exit or crossfade fallback from live source state | Abrupt disappearance or source reset before exit. |
| Hidden, absent, or incompatible source | Visible and ready | Run explicit enter or crossfade fallback into resolved target state | Target pops in at final commit. |
| Visible source | Target not ready | Hold source or show defined loading fallback; final commit only when target is ready | Partial target flash, missing entity snap. |

### Assignment Algorithm

| Phase | Rule | Testable assertion |
| --- | --- | --- |
| Resolve source graph | Capture the live effective visual graph at transition start | Runtime/editor/session mutations already visible are present in source. |
| Resolve target graph | Build the intended target effective visual graph | Target includes applicable runtime/global/session controls. |
| Match entities | Match by `identityKey`, not page path or tool family | Random fixture/page changes do not change matching behavior. |
| Check compatibility | Compare `representationKey` and adapter-declared compatibility | Incompatible pairs never use direct interpolation. |
| Diff channels | Classify each changed channel by channel class and capability | Presence, opacity, color, geometry, runtime controls, and readiness remain separate. |
| Assign behavior | Preserve/interpolate, enter, exit, hold, crossfade, or discrete commit | Same visible compatible entity never fades out and back in by default. |
| Execute transition | Run assigned policies against frozen source/target graphs | No mid-transition read from stale saved source state. |
| Final commit | Apply resolved target exactly once | No second visual jump at selection/page commit. |

### Breakage Tests To Add

| Test theme | What it should prove | Fixture strategy |
| --- | --- | --- |
| Same entity, scalar diff | Compatible visible entity stays mounted and interpolates scalar channels | Generate arbitrary source/target states with same identity and changed scalar values. |
| Same entity, spatial diff | Same spatial reference moves/interpolates instead of disappearing | Generate arbitrary frame/position/bounds changes. |
| Same entity, runtime source mutation | Live runtime changes become the source state | Mutate runtime/effective state before navigation and verify stale saved state is not used. |
| Incompatible representation | Direct interpolation is rejected without an adapter | Pair same logical concept with incompatible representation keys. |
| Missing source or target | Enter/exit fallback is selected | Generate absent-to-visible and visible-to-absent pairs. |
| Unready target | Source holds or approved fallback appears; no partial target flash | Mark target not ready during source/target diff. |
| No page/tool leakage | Policy output is invariant under page ids, page order, and tool names | Randomize fixture ids and family labels while keeping entity/channel graph identical. |

## Positive Pattern From Current Editor Logic

The current editor/runtime architecture already implies much of the transition
schema. Authoring controls expose controllable entities, stable authoring
targets, and active visual channels. Transition logic should reuse that
architecture through canonical state/effective visual state, not through React
component coupling or named-tool policy.

| Working principle | General rule | Example evidence |
| --- | --- | --- |
| Same identity and compatible render type preserve continuity | Keep the entity visible and transition changed channels only | Same MT point-cloud product with changed spectrum/trim/mask settings should ramp those controls, not fade out/in. |
| Spatial reference entities preserve orientation | Move, slide, or morph geometry when the same reference entity changes position or bounds | Same section plane, isoline/isoband group, ground trace, axis, or crop frame should move to the new resolved position. |
| Fade is fallback, not default | Fade enters/exits unmatched entities or crossfades incompatible representations | If a product or render type has no compatible identity in the other state, fade/crossfade is safer than pretending it is continuous. |
| Runtime state participates in the resolved graph | Compare current live source state to resolved target state | Client/editor changes made before navigation must not be replaced by stale saved source state mid-transition. |

The agnostic rule is:

`stable identity + compatible channel diff = preserve entity and interpolate channels`

`missing identity or incompatible representation = enter/exit or crossfade fallback`

The examples below are evidence probes for the universal contract. They are not
separate policy rules.

## Resolution Model

| Step | Input | Output | Rule |
| --- | --- | --- | --- |
| 1. Resolve source | Current visible page state plus runtime/session/editor changes | Source resolved visual graph `X` | Use what is actually visible now, not stale saved page state. |
| 2. Resolve target | Target page state plus applicable runtime/session/global controls | Target resolved visual graph `Y` | Use the state the scene should become after navigation. |
| 3. Match entities | Source and target graph entities | Matched, entering, exiting, or unmatched entities | Match by stable tool-defined identity, not by page id. |
| 4. Diff channels | Matched entity channel values | Channel-level diffs | Visibility, opacity, color, geometry, product, readiness, and consumer state are separate channels. |
| 5. Assign behavior | Identity match plus channel diffs | Preserve, interpolate, fade, crossfade, hold, or commit | Behavior emerges from compatibility and changed variables. |
| 6. Commit final | Transition result and target resolved graph | Final visible state `Y` | End state must match the target resolved state exactly. |

## Base Visibility Cases

| Source presence/visibility | Target presence/visibility | Desired behavior | Notes |
| --- | --- | --- | --- |
| Off / not present | Off / not present | Skip; remain hidden | No preload flash, no ghost, no snapshot. |
| On / shown | On / shown | Preserve entity; transition only changed channels | Must not fade out and back in just because navigation occurred. |
| On / shown | Off / not present | Exit policy, usually fade out | Source state should be the live resolved state at click time. |
| Off / not present | On / shown | Enter policy, usually fade in | Target state should be the resolved target state, not an intermediate saved ghost. |

## Identity And Compatibility Rules

| Source vs target relationship | Default behavior | Reason |
| --- | --- | --- |
| Same stable identity and same render type | Preserve entity, interpolate compatible channel diffs | This is the normal `on -> on` continuity path. |
| Same stable identity and compatible render type | Preserve if a morph/interpolation adapter exists; otherwise crossfade | Same concept, but render representation may not be directly interpolatable. |
| Related identity but incompatible render type | Crossfade source representation to target representation | Avoid pretending incompatible renderers are one continuous object. |
| Source exists, target missing | Fade out or explicit exit policy | No target identity to preserve. |
| Source missing, target exists | Fade in or explicit enter policy | No source identity to preserve. |
| Unknown identity or unknown compatibility | Conservative fallback: hold then commit, or crossfade | Unknowns should not create runtime ghosts or preserve the wrong object. |

## Channel Diff Allocation

| Channel | Examples | Compatible diff behavior | Fallback behavior |
| --- | --- | --- | --- |
| Visibility / presence | shown, hidden, loaded, absent | Preserve, fade in, or fade out based on base visibility case | Skip if off/off; hold if target not ready. |
| Opacity | layer alpha, product alpha, overlay alpha | Numeric opacity ramp | Crossfade if identity or renderer is incompatible. |
| Color / material | color ramp, boundary color, emissive, roughness | Color/material ramp if same renderer supports it | Discrete commit or crossfade. |
| Scalar controls | trim min/max, display range, focus range, transfer mode | Numeric ramp when renderer supports stable runtime mutation | Snapshot hold then commit. |
| Geometry / position | point size, section plane, crop frame, slice position | Interpolate/slide/ramp geometry | Crossfade or hold if geometry cannot be interpolated safely. |
| Product binding | product id, data source id, threshold id | Preserve only when product identity is stable | Crossfade, reload, or snapshot hold. |
| Render mode | points, mesh, volume, lines, overlay | Morph only with explicit compatibility adapter | Crossfade by default. |
| Runtime/client controls | show/hide, legend filter, client-side emphasis | Apply through canonical runtime/effective state before transition diff | Do not reintroduce saved stale state during transition. |
| Consumer UI | legends, overlays, labels, assays | Follow explicit source/target/progress policy | Discrete commit if no continuous policy exists. |
| Readiness | loaded, late-loaded, dormant, unavailable | Hold current source until target is ready when continuity is required | Skip intentionally dormant hidden state. |

## Evidence Families

| Family | Example stable identity | Active channels | Default behavior | Primary owner | Acceptance path |
| --- | --- | --- | --- | --- | --- |
| MT full-density point cloud | `layerId + productId + point-cloud` | visibility, opacity, point size, color ramp, scalar trim, inclusion, mask depth, mask feather, readiness | Same identity preserves entity; channel diffs ramp where supported; missing identity fades/crossfades | MT renderer + effective page state | Source tests, matrix/debug policy, user visual review |
| MT scalar volume | `layerId + scalarVolumeProductId + volume-renderer` | visibility, opacity, density, transfer mode, threshold min/max, mask, render mode, readiness | Preserve stable product; ramp compatible numeric channels; crossfade incompatible render/product changes | MT volume renderer + SceneManager | Source tests, matrix/debug policy, user visual review |
| MT threshold boundaries | `layerId + boundaryId + boundary-surface` | visibility, opacity, color/material, threshold identity, legend membership | Canonical visibility from `mtSurfaceBoundariesById`; ramp opacity/material if same boundary | Effective page state + MT renderer + legends | Validation, source tests, user visual review |
| Section ISO bands/isolines | `targetLayerId + plane/frame identity + band|line role` | visibility, transition envelope, band opacity, line opacity, color ramp, plane/crop geometry, contour readiness | Preserve `on -> on`; transition geometry/envelope separately from authored scalar volume opacity | SceneManager + Section ISO renderer | Source tests, debug policy, user visual review |
| Scene-section helpers | `scene-section + role + axis/frame identity` | ground trace, axes, frame outline, crop box, editor handles, opacity, geometry | Reference helpers stay independent from editor handles; compatible geometry interpolates | Scene-section controller | Source tests, user visual review |
| Camera | `main-camera` | position, target, zoom/FOV, controls basis, duration, easing, dynamic camera state | Interpolate path; final commit must not create a second jump | PageController + camera runtime | Future decision needed, user visual review |
| Editor page selection / commit | `editor-page-selection` | selected page visual state, transition progress, current/target page ids | UI may indicate in-progress state; full commit must not trigger scene jump | Editor state + PageController | Future decision needed, user visual review |
| Show/hide controls | `control + represented entity id` | authored visibility, runtime/session visibility, save scope, target entity | Write/read the same canonical target used by effective state and transition diff | Editor controls + effective page state | Validation and focused UI review |
| Legends | `legend item + represented entity id` | visibility, membership, color, label, source/target/progress policy | Follow represented entity state; do not invent separate visibility truth | Legends + effective page state | Validation, focused UI review |
| Overlays / labels / assays | `consumer type + item/group id` | visibility, content, target/source page policy, opacity, position | Explicit consumer transition policy; default discrete commit when no continuous channel exists | Consumer UI adapters | Source tests and user visual review |

## State Source Routing

| State layer | Meaning | Can affect source snapshot? | Can affect target snapshot? | Drift risk |
| --- | --- | --- | --- | --- |
| Project/environment persisted state | Global defaults and layer styles | Yes, through resolved current state | Yes, through resolved target state | Low if normalized. |
| Page persisted state | Page-local camera, visibility, layer overrides, overlays | Yes, only as already resolved into current live state | Yes, as target authored state | High if old saved source is recomputed after runtime changes. |
| Runtime/session state | Client-side show/hide, legend filters, temporary emphasis | Yes, if currently visible | Yes, if scope says it applies across pages | High if scope is undefined. |
| Editor unsaved state | Current authoring changes not yet persisted | Yes, if currently visible | Yes, if target is current authoring target or global scope | High if live scene gating drops dispatch. |
| Transition-local state | Snapshots, envelopes, source/target resolved graphs | Yes, frozen at transition start | Yes, frozen or updated by explicit policy | High if transition re-reads stale saved state mid-flight. |

## Draft Diff Algorithm

| Phase | Draft rule |
| --- | --- |
| Build source graph | Freeze the live resolved visual graph at click time. |
| Build target graph | Resolve target from saved target state plus applicable runtime/session/global controls. |
| Match identities | Use tool-defined stable identity, not layer alone and not page path. |
| Compare compatibility | Same identity/same renderer preserves; incompatible renderer crossfades unless an adapter exists. |
| Diff channels | Allocate each changed variable to a channel policy. |
| Execute transition | Run channel policies while preserving `on -> on` entity continuity. |
| Final commit | Apply target resolved state once, without reintroducing source saved state or causing a second visual jump. |

## Allocation Questions To Resolve

- Which entities already have stable identity in tool/editor contracts, and
  which need explicit identity fields?
- Which active editor/runtime controls are canonical channels versus derived
  display helpers?
- Which channel diffs are continuous interpolations versus discrete state commits?
- Which entities own authored opacity versus transition opacity?
- Which visible entities should preserve source render state until target render
  state is ready?
- Which runtime consumers should follow source page, target page, current page,
  or transition progress?
- Which state writes must be normalized at authoring time, save time, load time,
  and effective-state time?
- Which visual tradeoffs require explicit user approval before implementation:
  contour cadence, LOD, line simplification, opacity policy, camera duration,
  or camera path shaping?

## Promotion Rule

When a taxonomy item becomes stable, promote it into the decision log with:

- The transition family.
- Desired behavior.
- Runtime owner.
- Canonical state source.
- Test or guard.
- Human visual review requirement, if any.
