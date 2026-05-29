# Longitude/Latitude Graticule Random Line Artifact

Status: resolved

Opened: 2026-05-28

Resolved: 2026-05-28 via shader-level near-plane clipping in
`src/loaders/topoLineMaterial.ts`. See "Shader Near-Plane Clip For Topo Lines"
section below for the implementation and acceptance evidence. Manual visual
review at the failing oblique camera confirmed the artifact no longer appears
and white edge leaders, four-role split, render orders, section exclusion,
and the `CAMERA_FAR_M` setting from commit `7b84fa9` remain intact.

## Summary

The Utah FORGE longitude/latitude graticule is producing random long line
segments during oblique camera views. The lines can appear white, dark, or the
authored graticule color, can float off the terrain/grid plane, and can snap to
new angles as the camera moves. The artifact becomes less visible or disappears
when the camera is farther away.

This issue is separate from the zoom-out camera far-plane clipping issue. The
far-plane clipping was resolved in commit `7b84fa9` by raising the scene camera
far plane to `5_000_000m` and documenting that camera far-plane clipping must
not be used as a visual crop.

## Reference Image Context From Chat

The current chat images are not stored as repo files. The notes below preserve
the image context and should be replaced with local screenshots under
`docs/dev-context/Visual-Review/` if the issue needs image-backed review outside
the chat.

- Reference 1: wide black-background view with several white/gray lines floating
  above the topo grid and angling away from the graticule edge. Lines appear
  detached from the terrain surface and from the expected edge label anchors.
- Reference 2: oblique view with a red hand-drawn terrain/edge trace. White edge
  lines appear to cross the page and snap to the wrong side, suggesting edge
  crossing or gradient-side selection may be inverted.
- Reference 3: green debug-color graticule view. Stray green lines appear in the
  same family as the white lines, indicating the artifact is not only the white
  edge-leader role.
- Reference 4: close oblique green-grid view with random green and white line
  segments floating above and through the MT volume. Some segments appear in
  space; some appear to be clipped by sectioning.
- Reference 5: sectioned view where the stray graticule-like lines are also cut
  by section behavior. This conflicts with the intended contract that topo
  graticule lines and edge labels are terrain/reference context and should not
  be affected by scene-section clipping.
- Reference 6: zoomed-out view after the far-plane fix. Camera clipping no
  longer removes the image, but the random-line behavior remains the active
  graticule issue.

Additional named capture set, in chat load order:

- `1 high camera angle.jpg`: high oblique view with the green graticule active.
  Multiple long green segments rise away from the topo grid plane on the left
  side of the view. A long white diagonal line crosses near the MT volume. This
  shows the artifact can affect both authored graticule-color lines and white
  edge/leader-colored lines in the same camera state.
- `3 zoomed in from 2 note many new lines and no white.jpg`: closer view of the
  same area. Many additional green lines appear, including long near-parallel
  chords and steep angled segments near the MT volume. White lines are not
  prominent in this capture, which suggests the artifact is not dependent on the
  white leader material.
- `2 more parallel to the grid comapered to 1 note more white and differnt lines lines.jpg`:
  camera more parallel to the grid. The visible stray-line set changes compared
  with capture 1, and more white lines appear on the right side. This supports a
  camera-orientation-dependent endpoint, culling, or role-selection bug rather
  than fixed bad source geometry.
- `4 zoomed out from 3, no lines.jpg`: same problem region after zooming out.
  The long stray line artifacts are gone while the graticule, labels, and MT
  volume remain visible. This confirms camera distance suppresses or avoids the
  artifact without removing the grid itself.
- `5 top down zoomed out no lines.jpg`: top-down zoomed-out view. The grid
  reads as a stable rectangular graticule with labels along the edge and no long
  off-plane lines. This suggests top-down projection avoids the bad edge/leader
  branch.
- `6 top down zoom,ed oin no lines.jpg`: top-down zoomed-in view. The grid still
  remains stable with no long random line artifacts, indicating zoom alone is not
  sufficient to trigger the bug; oblique camera orientation appears required.

## Observations

- Most visible at oblique camera angles, approximately plus/minus 45 degrees to
  the grid orientation.
- Lines jump or snap while the camera moves; new segments can appear and
  disappear dynamically.
- Moving farther away reduces or removes the line artifact, which points toward
  a view-dependent graticule edge/leader, culling, projection, or material path
  rather than a fixed source-data line.
- Top-down views, both zoomed out and zoomed in, do not show the artifact in the
  named capture set. Oblique angle appears more important than distance alone.
- A closer oblique zoom can increase the number of green stray lines while a
  more parallel oblique angle can increase the white stray-line component.
- Turning off edge fade/edge awareness removed some crossing white lines, but
  did not resolve the root issue.
- Removing white edge lines was a bad fix: expected white edge cues disappeared
  and the artifact persisted. White edge leaders must remain as a feature.
- The green graticule debug color showed green stray segments, so at least part
  of the artifact is likely coming from graticule interior/edge geometry or
  shared graticule material behavior, not only from a separate white leader
  object.
- Some stray lines appear to be section-clipped, so either graticule materials
  are still receiving clipping planes or the artifact is being produced by a
  line role outside the intended topo-graticule exclusion path.

## Handoff Context For Another Agent

Goal: diagnose and fix the random graticule-like lines without removing expected
white edge cues or weakening the visual contract for public topo graticules.

Primary source entry points:

- `src/topoMap/graticuleRuntime.ts`: edge-aware graticule geometry rebuild,
  role grouping, leader generation, and runtime debug metadata.
- `src/loaders/topoLineMaterial.ts`: topo line material and shader patching for
  dash/fade/color/depth behavior.
- `src/loaders/loadTopoGraticule.ts`: graticule layer load path and initial
  geometry/material construction.
- `src/topoMap/publicSurfaceClipRuntime.ts`: public surface clip plane
  application that may affect line roles.
- `src/loaders/loadTerrain.ts` and `src/scene/terrainMaterial.ts`: terrain
  surface/lift/clip context used by graticule placement.
- `src/scene/SceneManager.ts`: style application, transition state, material
  clipping, and scene debug state wiring.

High-value checks before changing behavior:

- Confirm whether the floating lines are `Line2`, `LineSegments2`,
  `THREE.Line`, or a mesh/ribbon generated by a helper path.
- Identify object names, `userData` roles, material colors, and render orders
  for every visible stray line in the failing camera view.
- Log per-role world-space bounds and Z ranges. Any longitude/latitude line role
  with a large Z span or points far above terrain is suspect.
- Compare segment counts and bounds before/after a small camera orbit at the
  oblique failing angle. Any geometry that rebuilds or changes endpoints during
  pure camera movement is suspect.
- Inspect material `clippingPlanes` and renderer/local clipping state for all
  graticule and edge-label objects. Topo graticule lines and edge labels should
  not receive scene-section clipping.
- Separate public-surface clip helpers from graticule edge leaders. The artifact
  may be a helper/leader role with the wrong material rather than the main grid.

Non-goals:

- Do not delete white edge leaders as the fix.
- Do not hide the longitude/latitude grid at oblique angles.
- Do not use camera distance fade as the root fix unless the bad geometry source
  has first been isolated.
- Do not treat the far-plane clipping fix as related to this artifact; it is
  already resolved by `7b84fa9`.

Suggested first diagnostic implementation:

- Add a temporary or debug-only scene-state report that lists every topo
  graticule object by role with name, visible flag, segment count, material
  color, opacity, depth flags, clipping plane count, render order, world-space
  bounding box, and Z span.
- In the failing camera view, compare this report with the screenshot. The role
  whose bounds or Z span match the stray lines should be fixed directly.
- If the bad role is leader geometry, make leader endpoints derive from stable
  terrain/public-clip boundary crossings rather than camera-projected side
  choices.
- If the bad role is interior graticule geometry, fix source segment clipping or
  dashed-line expansion so it cannot emit long cross-page chords.
- If the bad role is material/clipping leakage, split materials by role and
  explicitly clear scene-section clipping from topo graticule roles.

## Strategic AI Orientation

Role contract: secondary AI is strategy-only. It should diagnose likely causes,
propose minimal investigation steps, identify code risks, and answer questions.
It should not implement, rewrite, or broadly refactor. Questions from the
secondary AI should be routed back through the primary agent for repo inspection.

Repo root: `C:\GeoSee\GeoSee_Dev`.

Start here:

- `docs/dev-context/Longitude-Latitude-Graticule-Line-Issue.md`
- `docs/dev-context/Active-Build-Context.md`
- `docs/dev-context/UI-Visual-Standards.md` section `Scene Overlay And Transition Rendering`

Do not start with archives, screenshots folders, `node_modules`, `dist`, large
project data, or full-file reads of `src/scene/SceneManager.ts`.

Primary code orientation:

- `src/loaders/loadTopoGraticule.ts`
  - `makeGraticuleLine(...)` around lines 323-360 creates `LineSegments2`
    roles with `userData.topoGraticuleLineRole`.
  - Around lines 480-526, the loader creates exactly four line roles:
    `interior`, `interior-dashed`, `leader`, `leader-dashed`.
  - Current render order is `4560` for interiors and `4561` for leaders.

- `src/topoMap/graticuleRuntime.ts`
  - `rebuildTopoGraticuleEdgeLines(...)` around lines 394-575 is the main
    geometry rebuild path. It reads stored source lines, clips interior segments,
    creates leader segments, and stores segment counts in `userData`.
  - Pay close attention to `topoGraticulePreferredCrossing`,
    `topoGraticuleNearestCrossing`, `terrainEdgeStraightSideEligible`,
    `edgeOutwardLineTangent`, and `topoGraticuleEdgeTextBasis`.
  - Around lines 725-889, style application sets lift, opacity, line colors,
    line widths, public clip planes, and calls `setTopoGraticuleEdgeFade(...)`.

- `src/loaders/topoLineMaterial.ts`
  - Around lines 200-243, the line shader computes camera-depth width fade and
    edge fade from world-space segment endpoints.
  - Around lines 261-272, fragment alpha is composed with distance fade.
  - `setTopoGraticuleEdgeFade(...)` around lines 306-328 stores uniforms and
    currently marks edge color/alpha blend debug flags false.

- `src/topoMap/publicSurfaceClipRuntime.ts`
  - Around lines 302-340, public clip planes are applied to public layers.
  - Important condition: graticule line materials can still receive public
    surface clip planes when public clip is enabled.

- `tests/utah-forge/shared.ts`
  - Around lines 2132-2426, existing Playwright debug state already reports
    graticule line object counts, role counts, segment counts, first material
    clipping plane count, depth flags, label state, and underside grid state.

Important current behavior:

- White edge leaders are expected and must remain.
- The bug is not the camera far plane; commit `7b84fa9` fixed zoom-out frustum
  clipping by raising `CAMERA_FAR_M` to `5_000_000`.
- The random lines are most visible near oblique grid views, roughly +/-45
  degrees, and become less visible or disappear farther away.
- Green debug graticule color showed green stray lines, so the source is not only
  the white leader material.
- Some stray lines appear section-clipped, which violates the intended contract:
  topo graticule lines and edge labels should not be affected by scene-section
  clipping.

First diagnostic questions to answer:

- Which exact object role produces the visible stray line: `interior`,
  `interior-dashed`, `leader`, `leader-dashed`, label geometry, public clip
  helper, or another line object?
- Does the offending object have a large world-space Z span or endpoints far
  above terrain?
- Do segment counts, bounds, or endpoints change during pure camera movement?
- Does any graticule material have scene-section `clippingPlanes` when it should
  not?
- Are leader endpoints derived from stable terrain/public-clip boundary geometry
  or from camera/projection-dependent side selection?

Recommended first debug shape:

- Extend the existing graticule debug report to list every graticule line object
  by name and role, with `visible`, segment count, material color, opacity,
  depth flags, clipping plane count, render order, world bounding box, and Z
  span.
- Capture that report at the failing oblique view before changing visual logic.
- Fix the identified role directly; do not mask the symptom with distance fade
  or by hiding edge leaders.

## Secondary Advisor Analysis

Ranked root-cause candidates:

1. `LineSegments2` / `LineMaterial` near-plane projection streaks. Highest
   confidence. `loadTopoGraticule.ts` extends candidate source lines beyond
   terrain bounds through `domainMarginDeg`, and `graticuleRuntime.ts` can push
   unclipped candidate segments when edge awareness is off. At close oblique
   views, long segments can straddle the camera/near plane. The patched shader in
   `topoLineMaterial.ts` computes distance fade from the midpoint depth, so a
   straddling segment can remain full width/full alpha and render as a long
   screen-space streak. This matches orientation dependence, zoom-out
   disappearance, green interior-role streaks, and snapping during camera motion.
2. Leader endpoint Z anchored to elevated boundary terrain. Leader endpoints are
   extended outward from `outer.position` and then forced to `outer.position.z`.
   If the boundary crossing is elevated, a white leader can extend horizontally
   outside the terrain footprint at that elevation, producing floating white
   lines.
3. Wrong outer crossing when a source line has multiple terrain-edge
   intersections. `topoGraticuleNearestCrossing(...)` can scan all candidate
   segments for the outer crossing. Near a rounded-square edge or corner, it may
   choose the wrong crossing and produce a leader rooted to the wrong side.
4. Non-graticule line role producing section-clipped strays. If a visible stray
   is section-clipped, it may not be one of the graticule roles because the
   intended graticule contract excludes those roles from scene-section clipping.
5. Edge-fade uniform staleness. If a graticule material keeps default terrain
   bounds or stale edge-fade uniforms, edge fade may silently disable and leave
   exterior interior segments fully opaque. This is secondary to the projection
   and crossing hypotheses.

First probes recommended before any visual logic change:

1. Capture the existing `tests/utah-forge/shared.ts` graticule debug report at
   the failing oblique camera state matching `1 high camera angle.jpg`. Record
   per role: name, visible state, segment count, material color, opacity,
   depth flags, clipping plane count, render order, world AABB, and Z span.
2. Walk `scene.traverseVisible` and list every `LineSegments2`, `Line2`, and
   `THREE.Line` with bounding box, object name, and `userData` keys. Filter to
   objects whose world or screen bounds overlap a sampled stray line. This
   separates graticule roles from public clip helpers or other line systems.
3. Temporarily recolor the four graticule roles to distinct debug colors:
   `interior=#00ff00`, `interior-dashed=#00ffff`, `leader=#ff00ff`, and
   `leader-dashed=#ffff00`. A failing-view screenshot then identifies the exact
   offending role without guessing.
4. For each visible interior segment in the failing view, print whether either
   endpoint has camera/view-space `z >= 0`. Segments with one endpoint in front
   and one behind the camera/near plane are candidate projection streak sources.
5. Compare captures with `edgeAware` forced true and false at the same camera.
   If forcing edge-aware clipping removes green strays while white strays remain,
   interior projection streaks and leader crossing issues are likely separate
   problems.

Green versus white attribution:

- Green strays likely come from `interior` or `interior-dashed` roles. The green
  capture color is a debug recolor of authored graticule lines. Most likely
  source is long source-candidate segments from the domain margin halo that
  straddle the camera/near plane in oblique close views.
- White strays likely come from `leader` or `leader-dashed` roles. Because leader
  length is intended to be short, long white artifacts are more likely wrong
  crossing selection or elevated-Z leader endpoint behavior than simple interior
  segment length. A more parallel camera can still amplify projected leader
  width through the same midpoint-depth shader behavior.

Additional must-not-change items:

- Preserve `leader` and `leader-dashed` as visible white edge cues.
- Do not lower or revert `CAMERA_FAR_M = 5_000_000`.
- Keep topo graticule lines and labels excluded from scene-section clipping.
- Preserve `userData.topoGraticule`, `topoGraticuleLines`,
  `topoGraticuleLineRole`, `topoGraticuleLineMaterial`,
  `topoGraticuleLabel`, and `topoGraticuleLabelMaterial` tags because runtime,
  clipping, and debug paths key off them.
- Preserve the four-role split and render-order split: interiors at `4560`,
  leaders at `4561`.
- Do not change label placement policy or persistence architecture for this
  issue.

Minimal fix strategy after the offending role is confirmed:

- If `interior` / `interior-dashed` projection streaks are confirmed, clip
  interior segments to terrain bounds even when edge awareness is off. Use the
  existing visible-segment machinery with a bounds-only edge or rectangular
  fallback so long cross-page source chords cannot reach the line renderer.
- If leader Z placement is confirmed, derive `leaderEnd.z` from terrain height at
  `leaderEnd.xy` rather than from `outer.position.z`, preserving leader length
  and outward direction.
- If wrong outer crossing is confirmed, constrain the outer-crossing search to
  the source segment adjacent to the chosen inner crossing instead of scanning
  all candidate segments.
- If a non-graticule role is confirmed, fix that role's own clipping or tagging
  path. Do not broaden graticule code to hide unrelated line systems.
- If stale edge-fade uniforms are confirmed, force `setTopoGraticuleEdgeFade` to
  write actual terrain bounds on every style apply, including when edge-aware
  behavior is disabled.

Open checks to resolve before implementing a fix:

- Exact `edgeAware` and `terrainEdgeFadeState` values for the `1 high camera
  angle.jpg` capture.
- Whether any non-graticule `LineSegments2` objects overlap the stray-line screen
  region.
- Confirmation that the green reference color is the graticule interior role and
  not a separate debug helper line.

## Response To Secondary Advisor Open Questions

Current authored state for the capture set:

- `projects/utah-forge/environment.json` currently has
  `utah-forge-topo-graticule.graticuleEdgeFadeAware: true` and
  `graticuleEdgeFadeStrength: 1`.
- Current graticule styling is `color: "#37f312"`, `opacity: 0.78`,
  `lineWidth: 4.75`, `graticuleLiftM: 244`,
  `graticuleEdgeLineColor: "#d4d4d4"`,
  `graticuleEdgeLineWidth: 2.85`,
  `graticuleEdgeLabelColor: "#d6d6d6"`,
  `graticuleEdgeLabelOffsetM: 31000`, and
  `graticuleEdgeLabelGapM: -32000`.
- The terrain style currently has `publicSurfaceClipEnabled: false`, so the
  visible capture state is not expected to include authored public-surface crop
  clipping.

Question responses:

- `edgeAware` is very likely `true` for the named captures because the active
  authored style has `graticuleEdgeFadeAware: true`, and
  `applyTopoGraticuleRuntimeStyle(...)` resolves it with
  `style.graticuleEdgeFadeAware !== false`.
- Exact runtime `terrainEdgeFadeState` values for `1 high camera angle.jpg` are
  not available from the screenshot or persisted JSON alone. The state is built
  at runtime from the terrain edge/bounds path and must be captured from the
  existing Playwright/debug scene report at the failing camera.
- Non-graticule `LineSegments2` objects inside the stray-line region have not
  been ruled in or out yet. Probe 2 is still required: traverse the visible
  scene at the failing camera and list all `LineSegments2`, `Line2`, and
  `THREE.Line` objects with name, role/userData keys, material color, clipping
  plane count, render order, and world bounds.
- The green reference lines are strongly attributable to graticule
  `interior`/`interior-dashed` roles rather than a separate helper because the
  active authored graticule line color is `#37f312`. In
  `src/topoMap/graticuleRuntime.ts`, leader roles receive
  `graticuleEdgeLineColor`, labels receive `graticuleEdgeLabelColor`, and
  non-leader line roles receive the authored `color`.

Reply to the secondary advisor:

- Candidate 1 remains the leading hypothesis for green/authored-color strays:
  interior or dashed-interior `LineSegments2` segments are likely producing
  near-plane/screen-space projection streaks in close oblique views.
- Candidates 2 and 3 remain plausible for white/gray strays because those colors
  match the edge leader/label color path, not the authored interior line color.
- No fix should proceed before the runtime object-role probe confirms whether
  any non-graticule line object is present in the stray-line region.

## Revised Diagnosis After Runtime State

The current runtime/style state changes the likely ranking. With
`graticuleEdgeFadeAware: true`, `graticuleEdgeFadeStrength: 1`, and
`publicSurfaceClipEnabled: false`, the simple version of the long-source-segment
hypothesis is less likely as the dominant green-line cause. In
`src/topoMap/graticuleRuntime.ts`, the edge-aware path clips interior segments
through `topoGraticuleVisibleSegment(...)` with
`innerThreshold = edge.fadeDistanceM`. Interior graticule geometry should
therefore live inside the terrain edge/fade boundary rather than freely using
the full `domainMarginDeg` source halo.

The earlier manual observation that turning off edge fade/edge awareness removed
some crossing white lines but did not resolve the issue is important. With
`edgeAware` false, `leader.visible = edgeAware && positions.length > 0` makes
the graticule `leader` and `leader-dashed` objects invisible. Any white/gray
stray that survives with edge awareness disabled is not a graticule
`leader`/`leader-dashed` object. That pushes the non-graticule line-role
hypothesis into the top tier for white/gray strays.

Revised ranking:

1. Non-graticule line role for white/gray strays. This is now top-tier for any
   white/gray artifact that remains when edge-aware leaders are disabled. The
   section-clipped stray-line observation also points away from graticule
   materials, because `sceneSectionController.ts` excludes topo graticule line
   materials from scene-section clipping. Suspects include terrain edge frames,
   public/topo boundary helpers, scene-section frame outlines, working-area
   focus outlines, axis/handle helpers, and any separate label-leader mesh path.
2. Interior clipping breakdown for green strays. Since `#37f312` is the authored
   graticule line color, green strays still point toward
   `interior`/`interior-dashed` or a graticule-colored sibling. With edge-aware
   clipping active, persistent green strays imply one of these failures:
   `edge.fadeDistanceM` is near zero, `terrainEdgeFadeState` has stale/default
   bounds, source segments with multiple boundary crossings are not split
   correctly, or another style/application path rewrites positions after the
   clipped rebuild.
3. Wrong outer crossing for graticule leaders. Still plausible for white/gray
   strays that disappear when edge awareness is disabled, because
   `topoGraticuleNearestCrossing(...)` can scan all candidate segments for the
   outer crossing and may choose the wrong side near rounded-square terrain
   edges or corners.
4. Leader Z anchored to elevated boundary terrain. Plausible for a smaller,
   stable subset of floating white/gray leaders, but less likely to explain
   camera-snap behavior.
5. Stale edge-fade material uniforms. Still worth checking after runtime
   `terrainEdgeFadeState` is captured, but secondary to object-role attribution.

Refined mandatory probe:

- Traverse the rendered scene at the failing camera and list every
  `LineSegments2`, `Line2`, `THREE.Line`, `THREE.LineSegments`, and mesh whose
  material behaves like a line/helper. Include object name, constructor name,
  visible state including parent visibility, material color, opacity,
  transparency, depth flags, clipping-plane count, `userData` key list,
  render order, world bounding box, Z span, and segment count.
- Include whether each object would pass the scene-section graticule exclusion
  check: any of `topoGraticule`, `topoGraticuleLines`,
  `topoGraticuleLabel`, or `topoMapBranding` set to true.
- Filter the report by color family: `#d0d0d0` through `#ffffff` for white/gray
  artifacts and `#37f312` for green artifacts.
- Also filter by approximate overlap with a sampled stray-line midpoint in the
  failing screenshot. Approximate world conversion by raycast or terrain-plane
  projection is acceptable; the goal is object-role attribution, not final
  geometry measurement.
- Attach one one-shot runtime capture to probe 2: log the actual
  `terrainEdgeFadeState` passed into `rebuildTopoGraticuleEdgeLines(...)`.
  Required fields are shape, bounds min/max, `fadeDistanceM`, `insetM`, and
  `cornerRadiusM`. The trigger site is in `src/topoMap/graticuleRuntime.ts`
  around the style-application call to `rebuildTopoGraticuleEdgeLines(...)`.
- This terrain-edge state is required before choosing between the current
  candidate variants. Authored knobs such as `graticuleEdgeFadeAware`,
  `graticuleEdgeFadeStrength`, line color, edge line color, and edge label color
  are not enough because the clipping geometry path runs on `fadeDistanceM` and
  the terrain bounds tuple.

Hold-fire confirmation:

- No graticule fix should land before the probe identifies the visible
  stray-line object roles and captures runtime `terrainEdgeFadeState`.
- Premature edits to `rebuildTopoGraticuleEdgeLines(...)` may miss a
  non-graticule white-line source and risk regressing the expected white edge
  cues already required by visual review.

## Probe 2 Decision Tree

After probe 2 returns, use the captured line taxonomy and
`terrainEdgeFadeState` to choose a fix target directly:

- Branch A: green stray object has
  `userData.topoGraticuleLineRole === "interior"` or
  `"interior-dashed"`.
  - If `terrainEdgeFadeState.fadeDistanceM <= 0`, bounds min/max are default
    `[-1, -1]` / `[1, 1]`, or bounds do not match the actual terrain footprint,
    the fix target is upstream of `rebuildTopoGraticuleEdgeLines(...)`: the
    call site is feeding a misconfigured `TerrainEdgeFadeState`.
  - If `fadeDistanceM` is reasonable and bounds match terrain, the likely bug is
    the two-point visible-segment check in `graticuleRuntime.ts`. Fix scope:
    split/sub-sample candidate segments against the edge function so
    multi-crossing segments in rounded-square or circular shapes are clipped
    into valid inside runs rather than kept or dropped as a whole.
- Branch B: green stray object has any other `userData` signature.
  - The signature identifies the unknown sibling. Fix that sibling's clipping or
    visibility path; do not change `graticuleRuntime.ts` first.
- Branch C: white/gray stray object has
  `userData.topoGraticuleLineRole === "leader"` or `"leader-dashed"`.
  - If endpoints span a wide XY range that crosses the terrain footprint, the
    likely issue is wrong outer-crossing selection. Fix scope:
    constrain `topoGraticuleNearestCrossing(...)` for the outer crossing to
    candidate segments adjacent to the inner-crossing index, not a free scan
    over all candidates.
  - If endpoints span a short XY range but Z lifts above terrain, the likely
    issue is elevated leader endpoint Z. Fix scope: re-sample `leaderEnd.z` from
    terrain height at `leaderEnd.xy`, which likely requires passing a height
    sampler into `rebuildTopoGraticuleEdgeLines(...)`.
- Branch D: white/gray stray object has no graticule-role tag.
  - The object constructor and `userData` keys identify the owning subsystem.
    Likely owners are terrain edge frame, public surface clip helper,
    section-frame outline, working-area focus, axis/handle helper, or label
    leader geometry. Fix that subsystem. The graticule material section
    exclusion path is not the first target because the object is not a tagged
    graticule material.

Probe 2 capture schema:

```json
{
  "name": "string",
  "constructorName": "LineSegments2 | Line2 | Line | LineSegments | Mesh | ...",
  "visible": true,
  "ancestorVisible": true,
  "userDataKeys": ["string"],
  "topoGraticuleLineRole": "interior | interior-dashed | leader | leader-dashed | null",
  "color": "#rrggbb",
  "opacity": 1,
  "transparent": true,
  "depthTest": true,
  "depthWrite": false,
  "clippingPlaneCount": 0,
  "renderOrder": 4560,
  "worldAABB": {
    "min": [0, 0, 0],
    "max": [0, 0, 0]
  },
  "zSpan": 0,
  "segmentCount": 0,
  "sectionExcluded": true,
  "matchesArtifactColorFamily": "green | white-gray | null",
  "containsSampledArtifactPoint": true
}
```

Terrain-edge state capture schema:

```json
{
  "shape": "square | rounded-square | circle",
  "boundsMin": [0, 0],
  "boundsMax": [0, 0],
  "fadeDistanceM": 0,
  "insetM": 0,
  "cornerRadiusM": 0
}
```

Acceptance gate before any fix:

- Probe 2 line-taxonomy capture exists and is parsed against branches A-D.
- Runtime `terrainEdgeFadeState` capture exists and is compared against the
  actual terrain footprint.
- White edge leader feature contract remains unchanged.
- The patch preserves the four-role split, render orders `4560`/`4561`, current
  `userData` tags, and section-exclusion paths.

## Probe 2 Console Capture Recipe

`window.__scene` is exposed in `src/scene.ts` and provides `scene`, `camera`,
`renderer`, and `manager` for in-page runtime inspection. These captures can be
run from `page.evaluate(...)` or the browser DevTools console at the failing
camera view, after the artifact is visible. No runtime source edits are required.

Capture output `probe-2a-line-taxonomy.json`:

```js
(() => {
  const scene = window.__scene.scene;
  const isLineLike = (o) =>
    o.isLine2 ||
    o.isLineSegments2 ||
    o.isLine ||
    o.isLineSegments ||
    (o.material &&
      (o.material.isLineMaterial ||
        o.material.isLineBasicMaterial ||
        o.material.isLineDashedMaterial));
  const EXCLUDED = new Set([
    "topoGraticule",
    "topoGraticuleLines",
    "topoGraticuleLabel",
    "topoMapBranding",
  ]);
  const sectionExcluded = (o) =>
    Object.keys(o.userData || {}).some(
      (k) => EXCLUDED.has(k) && o.userData[k] === true,
    );
  const ancestorVisible = (o) => {
    for (let n = o; n; n = n.parent) {
      if (n.visible === false) return false;
    }
    return true;
  };
  const colorHex = (m) => {
    try {
      return "#" + m?.color?.getHexString?.();
    } catch {
      return null;
    }
  };
  const colorFamily = (hex) => {
    if (!hex) return null;
    if (hex.toLowerCase() === "#37f312") return "green";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (r + g + b) / 3;
    const span = Math.max(r, g, b) - Math.min(r, g, b);
    return lum > 180 && span < 30 ? "white-gray" : null;
  };
  const aabb = (o) => {
    try {
      const g = o.geometry;
      if (!g) return null;
      if (!g.boundingBox && g.computeBoundingBox) g.computeBoundingBox();
      const box = g.boundingBox;
      if (!box || !Number.isFinite(box.min.x)) return null;
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const v = box.min.clone().set(x, y, z);
            o.localToWorld(v);
            min[0] = Math.min(min[0], v.x);
            min[1] = Math.min(min[1], v.y);
            min[2] = Math.min(min[2], v.z);
            max[0] = Math.max(max[0], v.x);
            max[1] = Math.max(max[1], v.y);
            max[2] = Math.max(max[2], v.z);
          }
        }
      }
      return { min, max, zSpan: max[2] - min[2] };
    } catch {
      return null;
    }
  };
  const segCount = (o) => {
    const g = o.geometry;
    if (!g) return null;
    if (g.attributes?.instanceStart) return g.attributes.instanceStart.count;
    if (g.attributes?.position) return Math.floor(g.attributes.position.count / 2);
    return null;
  };
  const records = [];
  scene.traverse((o) => {
    if (!isLineLike(o)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const box = aabb(o);
    const color = colorHex(m);
    records.push({
      name: o.name || null,
      constructorName: o.constructor?.name || null,
      visible: o.visible !== false,
      ancestorVisible: ancestorVisible(o),
      userDataKeys: Object.keys(o.userData || {}),
      topoGraticuleLineRole: o.userData?.topoGraticuleLineRole ?? null,
      color,
      opacity: m?.opacity ?? null,
      transparent: m?.transparent ?? null,
      depthTest: m?.depthTest ?? null,
      depthWrite: m?.depthWrite ?? null,
      clippingPlaneCount: Array.isArray(m?.clippingPlanes)
        ? m.clippingPlanes.length
        : 0,
      renderOrder: o.renderOrder ?? 0,
      worldAABB: box ? { min: box.min, max: box.max } : null,
      zSpan: box?.zSpan ?? null,
      segmentCount: segCount(o),
      sectionExcluded: sectionExcluded(o),
      colorFamily: colorFamily(color),
    });
  });
  return records;
})();
```

Capture output `probe-2b-edge-fade-state.json`:

```js
(() => {
  const manager = window.__scene.manager;
  const out = { byLayer: {} };
  const ids = manager.topoGraticuleLayerIds?.() ?? [
    "utah-forge-topo-graticule",
  ];
  for (const id of ids) {
    const layer = manager.getLayer?.(id);
    if (!layer) continue;
    const samples = [];
    layer.traverse((o) => {
      if (o.userData?.topoGraticuleLines !== true) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const s = m?.userData?.topoGraticuleEdgeFadeSettings;
      if (!s) return;
      samples.push({
        role: o.userData?.topoGraticuleLineRole ?? null,
        enabled: s.enabled,
        strength: s.strength,
        edgeFadeShape: s.edgeFadeShape,
        boundsMin: s.boundsMin,
        boundsMax: s.boundsMax,
        edgeFadeDistanceM: s.edgeFadeDistanceM,
        edgeFadeInsetM: s.edgeFadeInsetM,
        edgeFadeCornerRadiusM: s.edgeFadeCornerRadiusM,
      });
    });
    const groupUserData = {};
    layer.traverse((o) => {
      if (o.userData?.topoGraticule !== true) return;
      groupUserData.topoGraticuleEdgeAware =
        o.userData?.topoGraticuleEdgeAware;
      groupUserData.topoGraticuleInnerTrimInsideDistance =
        o.userData?.topoGraticuleInnerTrimInsideDistance;
      groupUserData.topoGraticuleEdgeLeaderLinesVisible =
        o.userData?.topoGraticuleEdgeLeaderLinesVisible;
      groupUserData.topoGraticuleInteriorSegmentCount =
        o.userData?.topoGraticuleInteriorSegmentCount;
      groupUserData.topoGraticuleDashedInteriorSegmentCount =
        o.userData?.topoGraticuleDashedInteriorSegmentCount;
      groupUserData.topoGraticuleLeaderSegmentCount =
        o.userData?.topoGraticuleLeaderSegmentCount;
      groupUserData.topoGraticuleDashedLeaderSegmentCount =
        o.userData?.topoGraticuleDashedLeaderSegmentCount;
    });
    out.byLayer[id] = { lineMaterialSamples: samples, groupUserData };
  }
  try {
    out.runtimeResolvedEdge =
      manager.topoRuntime?.resolveTerrainEdgeFadeState?.();
  } catch (e) {
    out.runtimeResolvedEdgeError = String(e);
  }
  return out;
})();
```

Use the two captures this way:

- Filter `probe-2a-line-taxonomy.json` for `colorFamily === "green"` and
  `colorFamily === "white-gray"`, then note `topoGraticuleLineRole` and
  `userDataKeys`.
- Green graticule-role records map to Branch A and require comparison against
  `probe-2b-edge-fade-state.json`.
- Green records with other `userDataKeys` map to Branch B.
- White/gray records with leader roles map to Branch C.
- White/gray records with no graticule-role tag map to Branch D.
- Confirm `sectionExcluded === true` for every graticule-role record. Any false
  value is itself a regression finding.

## Probe 2b Capture Received

Saved capture:
`docs/dev-context/Visual-Review/probe-2b-edge-fade-state.json`.

Key probe 2b findings:

- `runtimeResolvedEdge` matches every graticule line-material sample.
- Bounds are not stale or default: `boundsMin` is approximately
  `[-697853.25, -569722.5]` and `boundsMax` is approximately
  `[697853.25, 569722.5]`.
- Edge-aware clipping is enabled and configured: shape `rounded-square`,
  `fadeDistanceM: 15000`, `insetM: 0`, `cornerRadiusM: 95000`,
  `strength: 1`.
- The upstream-config subcase of Branch A is ruled out for this capture:
  bounds are realistic and `fadeDistanceM` is positive.
- Branch A's multi-crossing subcase remains possible for green graticule-role
  strays because rounded-square corners with a `95000m` radius can expose a
  two-crossing segment case.
- Branch C remains possible for white/gray graticule leader strays because
  leaders are populated: `leaderSegmentCount: 47`,
  `topoGraticuleDashedLeaderSegmentCount: 23`.
- Branch D remains possible until probe 2a identifies whether white/gray strays
  come from non-graticule line objects.

Probe 2a status:

- Received and saved at
  `docs/dev-context/Visual-Review/probe-2a-line-taxonomy.json`.

## Probe 2a Capture Received And Branch Selection

Saved capture:
`docs/dev-context/Visual-Review/probe-2a-line-taxonomy.json`.

Probe 2a has 38 line-like records. Color-family shortlist:

- Green graticule interiors:
  - `Longitude / latitude interior graticule lines`
    - role: `interior`
    - color: `#37f312`
    - render order: `4560`
    - `zSpan`: approximately `3956m`
    - `segmentCount`: `3750`
    - `sectionExcluded`: `true`
  - `Longitude / latitude half-degree interior graticule lines`
    - role: `interior-dashed`
    - color: `#37f312`
    - render order: `4560`
    - `zSpan`: approximately `3993m`
    - `segmentCount`: `3717`
    - `sectionExcluded`: `true`
- White/gray graticule leaders:
  - `Longitude / latitude edge leader lines`
    - role: `leader`
    - color: `#d4d4d4`
    - render order: `4561`
    - `zSpan`: approximately `2190m`
    - `segmentCount`: `24`
    - world AABB spans roughly `1.28Mm` X and `1.07Mm` Y
    - `sectionExcluded`: `true`
  - `Longitude / latitude half-degree edge leader lines`
    - role: `leader-dashed`
    - color: `#d4d4d4`
    - render order: `4561`
    - `zSpan`: approximately `2228m`
    - `segmentCount`: `23`
    - world AABB spans roughly `1.32Mm` X and `1.01Mm` Y
    - `sectionExcluded`: `true`
- Non-graticule white/gray records:
  - `FORGE surface facility / orientation block outline`
    - small local orientation-block outline, `zSpan: 34m`, not a match for the
      long random graticule artifacts.
  - Hidden/ancestor-hidden MT top traces and public clip helper records are not
    currently visible through the parent chain.

Branch selection:

- Green artifacts map to Branch A. Probe 2b ruled out upstream stale/default
  terrain-edge state because bounds are realistic and `fadeDistanceM` is
  positive. The remaining likely green fix target is the interior clipping path:
  `topoGraticuleVisibleSegment(...)` / the two-point edge test should be
  replaced or supplemented so rounded-square multi-crossing source segments are
  split into valid inside runs.
- White/gray long artifacts map to Branch C. The wide XY span of both leader
  objects points to wrong outer-crossing selection rather than a short elevated-Z
  leader. The likely white/gray fix target is the leader outer-crossing search:
  constrain `topoGraticuleNearestCrossing(...)` for the outer endpoint to
  candidate segments adjacent to the inner-crossing index, not a free scan over
  all candidates.
- Branch D is not supported by the visible color-family shortlist. No visible,
  large, non-graticule white/gray line object in the capture matches the reported
  long random-line artifact.

Fix guardrails from the captures:

- Keep the four graticule roles intact.
- Keep render orders `4560` for interiors and `4561` for leaders.
- Keep `sectionExcluded: true` behavior for graticule roles.
- Preserve visible white edge leaders; fix their endpoint selection rather than
  hiding them.

## Implementation Notes

Implementation pass:

- Branch A: implemented sub-sampled interior clipping in
  `src/topoMap/graticuleRuntime.ts`. Each source candidate pair is checked
  through a small fixed subdivision pass and contiguous visible sub-runs are
  merged back into single line segments. This preserves normal interior segment
  counts while allowing rounded-square multi-crossing segments near the corner
  arc to be clipped into valid inside runs.
- Branch C: threaded the preferred inner crossing's source segment index through
  the leader-generation path, then constrained the outer zero-crossing search to
  a small local window around that index. This prevents a leader from snapping
  to a distant corner/side crossing on the same long latitude/longitude source
  line.
- The current pass preserves the four graticule roles, render orders, white edge
  leader visibility contract, and graticule section-exclusion behavior.
- New runtime debug fields record the subdivision and crossing-window constants:
  `topoGraticuleEdgeClipSubdivisions` and
  `topoGraticuleEdgeCrossingWindow`.

Post-fix verification target:

- Re-capture probe 2a/2b at the failing camera after reload.
- Expected probe result: green interior/interior-dashed records remain valid
  graticule objects, but no long off-plane visual streaks appear at oblique
  views. White/gray leader records should no longer span terrain-scale XY as
  wrong-side leaders.
- Existing topo tests should pass with segment-count tolerances intact or only a
  small tolerance adjustment if debug expectations encode exact counts.

Verification update:

- `npm run build` passed after the graticule runtime changes.
- `npm run test:utah:topo` passed after updating the public-surface clipping
  assertion to match the current contract that graticule lines depth-test,
  do not write depth, and remain clipped by the authored public surface crop.
- Manual visual review and a fresh probe 2a/2b capture at the failing oblique
  camera remain the acceptance gate for closing the issue as resolved.

## Shader Near-Plane Clip For Topo Lines

Visual review after the Branch A + Branch C graticule-runtime fixes confirmed
the artifact still appears. Static code analysis identified two candidates that
remained unaddressed:

- Candidate 1 — `LineMaterial` near-plane straddle. The patched shader at
  `src/loaders/topoLineMaterial.ts` computes `topoLineDepth = max(0.0, - mix(
  start.z, end.z, 0.5))`. A segment with one endpoint in front of the camera
  (view-space `z < 0`) and one behind (`z > 0`) has midpoint depth ≈ 0; the
  `max(0, ...)` clamp gives full width and full alpha. With `LineMaterial`'s
  screen-space width expansion, the segment renders as a screen-aligned chord.
  This is the canonical Three.js `Line2`/`LineSegments2` near-plane limitation
  and is independent of any geometry-side clipping.
- Candidate 2 — leader endpoint Z anchored to elevated boundary terrain. Held
  pending visual verification of Candidate 1 alone, because re-sampling terrain
  height at `leaderEnd.xy` (which is outside the terrain footprint by design)
  may return clamped or NaN values from the height sampler and could look worse
  than the current behaviour.

Implemented fix for Candidate 1: shader-level near-plane clipping inside the
existing `enableDistanceAttenuatedLineWidth` patch in
`src/loaders/topoLineMaterial.ts`.

- Added a varying `vTopoLineNearClipVisible` to the vertex and fragment shader
  patches.
- After computing view-space `start`/`end` and world-space `startWorld`/
  `endWorld`, the vertex shader inspects view-space Z of both endpoints:
  - If both endpoints are behind a clip distance of 100m (just beyond the
    scene `CAMERA_NEAR_M` of 50m), the segment is collapsed to a degenerate
    location and `vTopoLineNearClipVisible` is set to `0.0`.
  - If exactly one endpoint is behind the clip distance, that endpoint is
    parametrically moved along the segment to the point where `view.z =
    -100m`, and `startWorld` / `endWorld` are lerped by the same parameter so
    the edge-fade computation uses the new endpoint's world coordinates.
- The fragment shader multiplies the existing `alpha` term by `clamp(
  vTopoLineNearClipVisible, 0.0, 1.0 )`, so collapsed segments contribute zero
  alpha.
- The `customProgramCacheKey` version bumped from `v5` to `v6` so previously
  compiled topo line shaders are invalidated.

Acceptance:

- White edge leaders, four-role split (`interior`, `interior-dashed`,
  `leader`, `leader-dashed`), render orders `4560`/`4561`, graticule
  section-clipping exclusion, and `CAMERA_FAR_M = 5_000_000` from commit
  `7b84fa9` are all unchanged.
- `npm run build` passed.
- `npm run test:utah:topo` passed (7 passed, 1 skipped — ImageMagick test).
- Manual visual review at the failing oblique camera is the next gate.
- If the artifact persists after this shader fix, Candidate 2 (leader Z
  anchor) is the next candidate to test, with a conservative fix that
  re-samples terrain Z only at the inner-side boundary crossing rather than
  at the outboard leader endpoint.

## What Has Been Done

- Camera far-plane clipping was fixed separately in commit `7b84fa9`
  (`Raise scene far plane for topo overview`).
- Documentation now states that camera far-plane clipping is not a visual crop;
  authored public surface crop and section tools own intentional trimming.
- Prior graticule work in the current uncommitted worktree attempted to stabilize
  depth flags, remove directional edge-gradient color blending, restore/cap
  white edge leaders as boundary ticks, and exclude topo graticule lines and
  labels from section clipping.
- A feature-cut attempt that removed visible white edge leaders was rejected by
  visual review because white edge lines are expected and the artifact remained.

## Working Hypotheses

- Edge-aware graticule rebuild may be selecting the wrong boundary-side crossing
  for leader/label attachment when the camera is oblique.
- The edge side or fade direction may be derived from a camera-dependent
  projected orientation, causing line endpoints to flip as the camera crosses
  an oblique threshold.
- Some generated leader or edge segments may be using valid XY endpoints but
  incorrect Z sampling/lift, which would explain lines rising away from the
  terrain plane.
- Interior and leader graticule roles may share material or clipping state, so
  section clipping or public clip state may be leaking onto the wrong line
  objects.
- Multiple graticule roles may remain visible at once: interior, dashed
  interior, boundary leader, and label leader. The artifact should be isolated
  by role instead of removing features.

## Next Diagnostic Guardrails

- Preserve expected white edge leaders. Do not fix the issue by deleting edge
  cues.
- Add or use debug metadata that separates graticule roles: interior,
  interior-dashed, boundary leader, label leader, public clip helper, and any
  underside grid role.
- For each role, inspect segment counts, world-space bounds, Z range, material
  color, depth flags, clipping plane count, render order, and visibility during
  the failing oblique camera angle.
- Verify whether any topo graticule or edge-label material still receives
  scene-section clipping planes.
- Temporarily isolate roles one at a time during diagnosis, but keep the final
  fix feature-preserving.
- Check whether endpoint selection uses camera-projected edge side, local edge
  side, or public clip bounds; prefer stable source-geometry side selection over
  camera-dependent snapping.

## Manual Acceptance

- White edge lines remain present, short, and attached to the correct edge-label
  side.
- No long white, black, or authored-color graticule lines float in space or
  cross the page at oblique views.
- Graticule lines stay on or near the topo terrain/reference surface and do not
  jump to new angles during camera movement.
- Section clipping does not cut topo graticule lines or edge labels unless a
  future explicit feature requests it.
- Far zoom remains free of image clipping after commit `7b84fa9`.
