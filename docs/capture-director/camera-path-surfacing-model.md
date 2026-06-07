# Capture Director Camera Path Surfacing Model

Status: implemented Camera Path V3 runtime model layered over V2 load
compatibility. Current Capture Director UI state upgrades v2 paths into
`CaptureCameraPathV3` in memory, while recipes can still emit legacy
`cameraKeyframes` for compatibility.

## Purpose

Camera Path authoring needs two different transition systems:

- temporal easing: how fast the camera moves through time;
- geometric fairing: how the camera rail bends through space.

These systems must stay independent. A speed ramp can soften acceleration
without changing the rail shape. A geometric continuity setting can round,
tighten, or sharpen the rail without changing transition duration.

The surfacing model uses four control stacks:

| Stack | Meaning | Authoring role |
| --- | --- | --- |
| `A` | camera position on the spatial path | sampled camera location on the rail |
| `T` | temporal easing, speed, acceleration, deceleration, ramp profile | how time maps onto distance along the path |
| `D` | focus distance and aim relationship from camera/path to focal point | where the camera points and how lens/FOV relates to target distance |
| `G` | geometric continuity and fairing through nodes | how smooth, sharp, or modelled the rail is at and around a node |

The sketch labels map to these stacks:

- `A`: the active camera position along the path at a sampled time.
- `D`: the focus vector or perpendicular distance from path/camera to the
  focal point, affected by look mode and lens settings.
- `G`: the continuity and fairing region around a node.
- `C`: the visible camera rail or spline curve.

## Temporal Easing Is Not Path Fairing

`segment.easing` in current `CaptureCameraPathV2` is temporal easing only. It
describes speed over normalized transition time:

- `linear`: constant time progression;
- `ease-in`: starts slow, accelerates;
- `ease-out`: decelerates into the target;
- `ease-in-out`: soft acceleration and deceleration;
- `custom-ramp`: future authored ramp curve.

Temporal easing does not change camera node positions, rail curvature, tangent
handles, focus points, or final path shape.

V3 names this explicitly as `timeCurve` and does not reuse generic `easing`
for both time and geometry.

## Geometric Continuity And Fairing

Path fairing controls the curve shape between nodes. Use surfacing/modeling
language, not only animation language.

Continuity classes:

- `G0 positional continuity`: connected points only. The path can form a hard
  corner. There is no tangent agreement.
- `G1 tangent continuity`: direction continuity through the node. The camera
  rail does not kink, but curvature can still jump.
- `G2 curvature continuity`: bend radius continuity. The path keeps a smoother
  cinematic flow through the node.
- `G3 curvature-flow continuity`: rate-of-curvature continuity. This is the
  high-end rail/surfacing mode for long, polished marketing moves.

Distance and tension controls:

- `Gd`: fairing influence distance from a node. This is the in/out handle reach
  that determines how far the continuity region extends.
- `influenceIn`: fairing distance before a node.
- `influenceOut`: fairing distance after a node.
- `tension`: tightens or relaxes the curve without moving the authored node.
- `bias`: favors incoming or outgoing direction when resolving handles.
- `autoHandles`: lets the solver derive tangent/curvature handles from
  neighboring nodes.

Node positions remain authored truth. Fairing changes the rail interpolation
around those nodes; it must not silently move the nodes themselves.

## Focus Distance And Aim Geometry

Aim is a separate track from camera position and path fairing. A camera can
travel on a relaxed `G2` rail while looking at a fixed focus point, or it can
travel on a sharp `G0` rail while following the path tangent.

Aim modes:

- `free-direction`: node stores an explicit target/look vector.
- `follow-path-tangent`: target resolves from the path tangent and optional
  forward distance.
- `focus-point-lock`: target resolves to a recipe-local world-space focus point.
- `target-blend`: blends between node targets or focus points through its own
  time curve.

Lens and focus-distance controls:

- `focusDistance`: distance from camera/path to focus point.
- `fixed-fov`: FOV stays fixed as the camera moves.
- `maintain-focus-size`: FOV can adjust to keep a focus subject stable.
- `dolly-zoom`: stylized mode where FOV and distance move in opposite
  directions.

Focus picking remains recipe/session state. It must not write page camera
fields or project fixtures.

## Implemented V3 Schema Shape

`CaptureCameraPathV3` keeps V2 recipe compatibility while separating the
transition stacks.

```ts
type CaptureTemporalCurveMode =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "custom-ramp";

type CapturePathContinuity = "G0" | "G1" | "G2" | "G3";

interface CaptureCameraPathTimeCurve {
  mode: CaptureTemporalCurveMode;
  ramp?: Array<{ t: number; value: number }>;
}

interface CaptureCameraPathFairing {
  continuity: CapturePathContinuity;
  tension: number;
  bias: number;
  fromInfluenceOut: number | "auto";
  toInfluenceIn: number | "auto";
  autoHandles: boolean;
}

interface CaptureCameraPathSplineControls {
  enabled: boolean;
  continuity: CapturePathContinuity;
  handleMode: "auto" | "manual" | "vector";
  coupling: "tangent" | "non-tangent";
  in: {
    mode: "auto" | "manual";
    length: number | "auto";
    direction?: [number, number, number];
    position?: [number, number, number];
  };
  out: {
    mode: "auto" | "manual";
    length: number | "auto";
    direction?: [number, number, number];
    position?: [number, number, number];
  };
  autoScale: number;
  maxLengthRatio: number;
  preventLoopback: boolean;
}

interface CaptureCameraPathAimGeometry {
  mode: "free-direction" | "follow-path-tangent" | "focus-point-lock" | "target-blend";
  focusPointId?: string;
  focusDistance?: number | "auto";
  tangentForwardDistance?: number;
  targetBlend?: {
    fromNodeId?: string;
    toNodeId?: string;
    curve: CaptureCameraPathTimeCurve;
  };
  lensMode: "fixed-fov" | "maintain-focus-size" | "dolly-zoom";
  dollyZoomStrength?: number;
}

interface CaptureCameraPathEquationOverlayOptions {
  visible: boolean;
  selectedTransitionOnly: boolean;
  showStackLabels: boolean;
  showTemporalRamp: boolean;
  showTangents: boolean;
  showInfluenceHandles: boolean;
  showCurvatureComb: boolean;
  showFocusDistance: boolean;
}
```

Transition containers expose:

- `Timing`: duration and temporal easing.
- `Path Shape`: continuity class, fairing/tension, in/out influence distance,
  bias, and curvature preview.
- `Aim`: focus lock, target blend, path tangent following, and focus distance.
- `Overlay`: equation/diagram display for that transition.

## V3.1 Node-Owned Spline Handles

V3.1 moves runtime geometry authority from segment-owned fairing to node-owned
spline handles. Segment `pathFairing` remains a compatibility and migration
source, but playback, scrub preview, Render Out, and Still Capture resolve
geometry from node handles first.

Each node owns:

- an incoming handle (`in`);
- an outgoing handle (`out`);
- a continuity class (`G0` through `G3`);
- a handle mode (`auto`, `manual`, or `vector`);
- a coupling mode (`tangent` or `non-tangent`);
- loopback guard settings.

Each segment reads the two handles that face it:

```text
P0 = from.position
P1 = from.out.position
P2 = to.in.position
P3 = to.position
```

The camera rail is a bounded cubic Bezier between those four points. Node
positions remain exact interpolation constraints.

### Tangent Versus Non-Tangent Handles

`Tangent` mode is the default cinematic rail mode. The incoming and outgoing
handles are collinear through the node. Pulling one side rotates the opposite
side so both adjacent curve sides share tangent direction. The two sides still
keep independent push/pull lengths.

`Non-tangent` mode is a broken-handle mode. Pulling the incoming handle changes
only the previous segment. Pulling the outgoing handle changes only the next
segment.

`Vector` mode is the hard-corner mode. It is equivalent to `G0` unless the node
is converted back to auto or manual handles.

### Robustness Rules

Spline handles are clamped before sampling:

- auto handles default to `0.35` of adjacent chord length and no more than
  `0.45` of that chord;
- manual handles can extend farther but are clamped to avoid reversal and
  loopback;
- unsafe handles are reduced instead of allowing NaN, infinite samples,
  backwards derivatives, or large unwanted curve extensions;
- time curves still change speed only and never edit handle positions.

XYZ node movement is explicit. Moving a node through an XYZ handle translates
the node position and any manual handles by the same delta. G-continuity edits,
handle pulls, tension, and influence-length edits must not move authored node
positions.

## Equation And Annotation Overlay

Equation overlays are authoring aids. They visualize the transition math on top
of the scene and can be toggled globally.

Minimum future overlay controls:

- `Show Equations`: global on/off.
- `Selected Transition Only`: reduce clutter by showing only selected segment
  math.
- `Show Stack Labels`: draw `A`, `T`, `D`, `G`, and `Gd` labels.
- `Show Temporal Ramp`: draw a small ramp graph for speed easing.
- `Show Tangents`: draw in/out tangent handles.
- `Show Influence Handles`: draw `Gd`, `influenceIn`, and `influenceOut`.
- `Show Curvature Comb`: draw curvature diagnostics along the rail.
- `Show Focus Distance`: draw `D` vector and focus distance label.

Scene overlay may draw:

- spline path;
- node/order labels;
- tangent arrows;
- curvature comb;
- `G0`, `G1`, `G2`, and `G3` continuity labels;
- `Gd` influence handles;
- focus vector `D`;
- path/time position marker `A`;
- optional mini ramp graph for temporal easing.

These overlays must stay out of `scene-only`, `scene-annotations`,
`presentation-ui`, Render Out, and Still Capture output unless a future explicit
export-overlay option is added.

## Timeline Language

The lower timeline shows both time and surface quality:

- hold blocks;
- transition blocks;
- temporal ramp curve inside each transition block;
- geometric continuity markers;
- `Gd` influence zones near node boundaries;
- focus/aim lane;
- equation overlay state tied to the selected transition.

This makes the timeline behave like a video editor for timing and like a
surfacing editor for rail quality.

## Implementation Guardrails

- Do not overload current `CaptureCameraPathSegmentV2.easing`; it is temporal
  easing only.
- Do not treat arbitrary Catmull-Rom tension as full `G0` through `G3`
  continuity.
- Do not write surfacing controls to page camera fields, page JSON, overlays,
  project JSON, environment files, or visual presets.
- Do not include equation overlays in marketing exports by default.
- Do not move authored node positions when changing fairing. Fairing changes
  interpolation and handle influence around nodes.
- Preserve V2 recipe compatibility. New V3 data should load V2 paths and
  upgrade them with default `timeCurve`, `pathFairing`, `aimGeometry`, and
  equation overlay settings.
