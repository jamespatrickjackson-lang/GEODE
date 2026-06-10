# Agent Guide: Camera Path Surfacing

This guide defines how agents should reason about Capture Director camera path
surfacing work. It is a runtime contract for `CaptureCameraPathV3` plus a
compatibility guide for older v2 paths. Capture Director upgrades v2 paths into
V3 in memory and keeps legacy `cameraKeyframes` export available for recipes.

## Required Mental Model

Camera path authoring has independent tracks:

- `A`: camera position on the spatial path.
- `T`: temporal easing and speed along the path.
- `D`: focus distance and aim geometry.
- `G`: geometric continuity and fairing through nodes.

Do not collapse these into one generic "easing" control. Timing, path shape,
and aim are different authoring problems.

## Terminology

- `Temporal easing`: speed profile over time. This is acceleration and
  deceleration along an already-defined path.
- `Geometric continuity`: the surfacing class of the curve through a node.
- `G0`: positional continuity only, hard corner allowed.
- `G1`: tangent continuity, no direction kink.
- `G2`: curvature continuity, matched bend radius.
- `G3`: curvature-flow continuity, matched rate of curvature.
- `Gd`: fairing influence distance from a node.
- `Fairing`: relaxing or tightening the rail around authored nodes without
  moving the nodes.
- `Curvature comb`: diagnostic overlay showing curvature quality along the
  path.

## Implementation Direction

Implementation uses `CaptureCameraPathV3` with:

- `timeCurve` for temporal easing;
- node-owned `splineControls` for runtime rail geometry;
- `pathFairing` as a compatibility/migration source for continuity, tension,
  bias, and in/out influence distance;
- `aimGeometry` for focus lock, path tangent following, target blend, and focus
  distance;
- `equationOverlayOptions` for global show/hide and selected-transition display.

Transition containers have separate sections for Timing, Path Shape, Aim, and
Equation Overlay. The lower timeline should continue to show both temporal ramp
curves and geometric continuity markers.

## V3.1 Spline-Control Rules

Runtime geometry uses node-owned handles:

- a segment samples `from.position`, `from.out`, `to.in`, and `to.position`;
- `Tangent` coupling keeps the selected node's in/out handles collinear;
- `Non-tangent` coupling breaks the handles so each side edits one adjacent
  segment;
- `Vector` handle mode is the hard-corner `G0` mode;
- old segment fairing fields should update the facing endpoint handles but
  must not be the primary runtime geometry source.

Loopback and overextension prevention are required. Clamp unsafe handles before
sampling instead of allowing the rail to reverse, explode, or leave the chord
envelope dramatically. If a G2/G3 solve or handle state is unstable, reduce
handle influence and keep the authored node positions fixed.

XYZ node handles are the explicit authority for node movement. G-continuity,
tension, influence length, and handle pulls are rail-shape edits; they must not
move nodes. When a node is moved explicitly, translate its manual handles by the
same delta so the local shape remains stable.

## Overlay Rules

Equation overlays are editor/session display state. They may draw:

- `A`, `T`, `D`, `G`, and `Gd` labels;
- temporal ramp graph;
- tangent arrows;
- `Gd` handles;
- curvature comb;
- focus distance vector;
- selected transition annotations.

These overlays must not appear in marketing output by default. They are not
part of scene-only, scene-annotations, presentation-ui, Render Out, or Still
Capture unless a future export option explicitly includes them.

## Do Not

- Do not overload `CaptureCameraPathSegmentV2.easing` to mean path fairing.
- Do not add hidden time-warp stages that replace or rewrite the authored
  `timeCurve`. The motion guard (DEC-144) is identity on calm geometry and any
  new shaping must stay bounded, monotonic, and endpoint-exact.
- Do not blend segment boundaries back toward raw linear time. Adjacent
  transitions meet exactly as their authored boundary equations dictate.
- Do not implement `G0` to `G3` as a single Catmull-Rom tension slider.
- Do not make segment `pathFairing` the primary runtime geometry source after
  V3.1; segment fields are compatibility inputs for node handles.
- Do not move authored node positions when changing continuity.
- Do not move authored node positions when dragging spline handles; only XYZ
  node handles move node positions.
- Do not write surfacing edits to page camera fields.
- Do not write surfacing edits to `projects/*/pages/**`,
  `projects/*/overlays/**`, `projects/*/project.json`, or
  `projects/*/environment.json`.
- Do not export equation overlays into marketing captures by default.
- Do not make browser display capture the surfacing preview/export path.

## Compatibility Requirement

V3 work must preserve V2 recipe compatibility:

- V2 paths load into V3 with default temporal and fairing controls.
- V3 recipes can still emit legacy `cameraKeyframes` for compatibility.
- Empty camera paths remain valid draft state and must serialize as
  `cameraPath: null` in render recipes until renderable.
