# Transition Continuity Contract

Status: draft source-of-truth contract.

This document defines transition continuity intent. It is not a page-transition
fix plan and does not authorize visual tuning, camera smoothing, opacity
changes, contour cadence changes, section-helper changes, page JSON edits, or
fixture-specific remediation.

## Definition

A page transition is a deterministic diff between two resolved render graphs:

- Source graph: current live resolved render state at transition start.
- Target graph: target resolved render state after page/editor/environment
  normalization.
- Classification: pure comparison of source and target graph entities.
- Execution: later scene mutation that consumes exactly one assignment per
  entity/channel.
- Final commit: idempotent application of the target graph with no second
  visible snap.

## Render Graph Contract

| Concept | Definition | Requirement |
| --- | --- | --- |
| Resolved source render graph | The live visual state at transition start, including runtime show/hide, legend/control, and editor changes already applied to the scene. | Classification must not use stale saved page state as the source when live state differs. |
| Resolved target render graph | The target page/editor/environment state after normalization into the same entity graph shape as the source. | Legacy, duplicate, or partial state must be normalized before classification. |
| Stable entity identity | A durable key for the same visual thing across source and target graphs. | Page id, page index, page order, fixture name, project name, and tool label are not identity semantics. |
| Representation type | The render form used by the entity, such as mesh, line, points, volume, overlay, helper, label, or another declared representation. | Compatibility must be explicit; unknown compatibility falls back conservatively. |
| Presence / visibility | Whether the entity is absent, dormant, hidden, loading, ready, or visible. | Presence determines skip, enter, exit, hold, or preserve candidates. |
| Readiness | Whether the target representation can render safely. | Unready targets must not partially flash. |
| Owned channel values | Values owned by the entity, such as opacity, color/material, scalar range, spatial transform, geometry parameter, categorical state, runtime control, or readiness. | Only owned channels participate in interpolation or fallback assignment. |
| Channel ownership priority | Priority for resolving duplicate channel facts from live runtime, target effective state, persisted state, derived state, or adapter metadata. | Higher-priority facts win before diffing. This prevents stale saved state from ghosting through live runtime state. |
| Entity compatibility | A declared compatibility result for matched source/target representations. | Compatible entities can preserve identity; incompatible or unknown entities cannot interpolate by guess. |
| Derived-entity dependency | A dependency from a derived visual entity to its source entity. | Derived entities follow their source unless explicitly promoted to independent transition ownership. |
| Transition assignment | The single behavior assigned to an entity after graph comparison. | Each entity/channel receives one assignment only. |
| Execution from assignment | The generic execution mode implied by the assignment. | Scene mutation must consume assignments rather than independently deciding fades, opacity envelopes, helper motion, snapshots, or commit behavior. |
| Visually idempotent final commit | Final target graph application that does not visibly change already-committed target values. | Final commit must not reassert target state as a second snap. |

## Assignment Rules

| Source | Target | Compatibility | Assignment | Execution Mode |
| --- | --- | --- | --- | --- |
| Not visible | Not visible | Any | `skip` | `none` |
| Visible | Visible | Compatible | `preserve-interpolate` | `interpolate-channels` |
| Visible | Not visible | Any | `exit` | `exit` |
| Not visible | Visible and ready | Any | `enter` | `enter` |
| Visible | Visible but target not ready | Any | `hold-until-ready` | `hold-source` |
| Visible | Visible | Incompatible | `crossfade` or `discrete-commit` | `crossfade` or `commit-discrete` |
| Visible | Visible | Unknown | Conservative fallback | `crossfade`, `hold-source`, or `commit-discrete` |

## Environment-Scene Transition Channels

Background and fog are environment-scene transition channels, not layer
entities and not cinematic-post fields. Their execution owner is the
page-transition runtime's narrow environment-scene frame path.

Compatible background and fog colors interpolate over the page transition
duration/easing. Fog density interpolates numerically. Disabled fog is treated
as density `0` during the blend, and the final enabled/disabled state is
landed by the normal target environment commit. This keeps final commit
visually idempotent for background/fog without rebuilding the full environment
on every frame.

The v1 environment-scene owner is limited to renderer clear color, scene
background/fog, topo fog uniforms, layer fog density, and fog-driven post tint.
Terrain light-mode ramps, lighting, sun visuals, material preset identity,
texture URL/cache key, bounds, public clip, edge fade, edge outline, shader
choice, and geometry remain discrete follow-up channels unless a later
decision expands the scope.

## Invariants

1. Runtime transition behavior must not depend on page id, page index, page
   order, fixture name, project name, or tool label.
2. State resolution must happen before transition classification.
3. Current live state must be included in the source graph.
4. Target state must be resolved into the same graph shape before comparison.
5. Each entity/channel must receive one transition assignment only.
6. Compatible matched entities preserve identity and interpolate owned
   compatible channels.
7. Incompatible matched entities crossfade, hold, or commit discretely
   according to compatibility rules.
8. Entering entities enter.
9. Exiting entities exit.
10. Derived entities follow their source unless explicitly promoted.
11. Scene mutation must consume transition assignments, not independently
    decide fades, opacity envelopes, helper motion, snapshots, or commit
    behavior.
12. Final commit must be visually idempotent and must not reassert target state
    as a second snap.

## Implementation Boundary

Current allowed implementation scope:

- Pure classifier module in `src/scene/transitions`.
- Classifier tests and source guards.
- Documentation and decision log entries.
- Narrow environment-scene execution owner for background/fog channels accepted
  by TRD-009.

Current excluded implementation scope:

- Camera smoothing.
- Opacity behavior changes.
- Contour cadence or LOD changes.
- Section-helper behavior changes.
- Isoband or ground-line remediation.
- Snapshot execution changes.
- Page JSON or fixture composition edits.
- Wiring the pure classifier assignments into broad scene mutation.
- Terrain light-mode ramp, lighting, sun, and full scene mood interpolation.

Execution-layer consumers can be designed after this contract and classifier
shape are accepted.
