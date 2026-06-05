# Dark Light Scene Transition Audit

Status: audit-only context note. No implementation plan or source changes.

Recorded on 2026-06-05.

## User Inference

The requested refinement is a page-transition behavior change for scene mood
handoffs, especially dark-mode to light-mode pages. During page navigation,
the effective background and fog colors should move over the target page's
`transition.duration` and `transition.easing` instead of snapping. Fields that
can be interpolated should interpolate between the resolved source and target
values. Fields that cannot be interpolated safely should use an explicit
crossfade, fade in/out, or controlled discrete handoff instead of an unmanaged
instant switch.

This is a runtime transition issue, not a page fixture repair. The fix target
must stay page-agnostic and must preserve DEC-095 authoring-target scoping:
Global Settings, Sub Master `envSnapshot`, page `sceneOverrides`, render
preset `scenePatch`, and archived authoring preview all remain source inputs
to effective state, not special runtime branches.

## Render-Stack Trace Evidence

Required trace command:

```powershell
npm run inspect:effective -- --render-stack
```

Trace target:

- Project: `projects/utah-forge`
- Page: `12_mt_volume_overview` / `MT Volume Overview`
- Active render preset: `user-3` from `environment.renderPreset`
- Post stack: `RenderPass -> SSAOPass -> BokehPass -> UnrealBloomPass -> TiltShiftPass -> AfterimagePass -> LensGradePass -> SMAAPass -> OutputPass`
- Cinematic transition policies: `13` policies on `main-camera/cinematic-post`
- Effective `scene.background`: `#383838`, from active render preset `scenePatch`
- Effective `scene.fog.enabled`: `true`, from active render preset `scenePatch`
- Effective `scene.fog.density`: `0.0000037267080745341615`, from active render preset `scenePatch`
- Topo material authority winner: `environment.scene.terrain`
- Material preset: `image:naip-2024-aerial`
- Texture URL/cache key: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=684f5a7e42719aa9`
- Bounds: `[229069.2,4094688,598806,4414308]`
- Public clip: enabled box, center `[21000,21000,2000]`, size `[1599600,1399600,50000]`
- Edge fade: `rounded-square`, distance `90000m`, inset `40000m`, corner radius `140000m`
- Edge outline: disabled
- Shader/material: `terrainMaterial/topo-image`
- Geometry/LOD: runtime terrain mesh, 8192 LOD

The trace proves the inspected page's background and fog are effective scene
state produced by the normal merge stack, not a separate viewer theme.

## Effective Dark-Light Page Examples

Active page order currently contains dark-to-light pairs:

- Page 1 `12_mt_volume_overview` -> page 2 `156_page`
- Page 88 `144_page` -> page 89 `152_page`

Effective merge for page 1 `12_mt_volume_overview`:

- `scene.background`: `#383838`, active render preset
- `scene.lightMode`: `false`, active render preset
- `scene.lightModeBackground`: `#d4d4d4`, environment
- `scene.fog.color`: `#e82626`, active render preset
- `scene.fog.lightModeColor`: `#b5b5b5`, active render preset
- `scene.fog.density`: `0.0000037267080745341615`, active render preset

Effective merge for page 2 `156_page`:

- Same active preset background/fog values as page 1
- `scene.lightMode`: `true`, page `sceneOverrides`
- Runtime branch in `applyEnvironment` therefore resolves renderer background
  to `lightModeBackground` and fog tint to `fog.lightModeColor`

Effective merge for page 89 `152_page`:

- `scene.lightMode`: `true`, page `sceneOverrides`
- `scene.lightModeBackground`: `#ebebeb`, page `sceneOverrides`
- `scene.fog.color`: `#e5e1e1`, page `sceneOverrides`
- `scene.fog.lightModeColor`: `#bfbfbf`, page `sceneOverrides`
- `scene.fog.density`: `0.000042`, page `sceneOverrides`

These examples confirm the snap can happen even when page transition duration is
`3000ms`. The transition system receives a duration, but the background/fog
world-state owners do not currently consume it.

## Current Render Path

1. `PageController.goto(...)` resolves source and target via
   `resolvePresentationState(...)`, including environment, Sub Master
   `envSnapshot`, active render preset `scenePatch`, and page `sceneOverrides`.
2. `PageController` starts layer transitions through
   `SceneManager.transitionEffectiveLayersForPage(...)`.
3. `PageController` starts cinematic post blending through
   `SceneManager.beginCinematicSceneTransition(...)`.
4. `SceneManager.frameUpdate(...)` calls `updateCinematicPostFrame(...)`, which
   calls `blendCinematicSceneForTransition(...)` and then
   `applyCinematicPostProcessing(...)`.
5. `SceneManager.finalizePageTransitionCommit(...)` clears the cinematic
   transition and calls `applyEnvironment(targetEnvironment)` and
   `applyPageScene(targetPage)`.
6. `applyEnvironment(...)` chooses a single `lightMode` branch, then directly
   sets `renderer.setClearColor(...)`, `scene.background`, `scene.fog`, and
   topo runtime fog/light-mode parameters.

Key source evidence:

- `src/pages/PageController.tsx`: page navigation starts layer and cinematic
  post transitions, then finalizes through `finalizePageTransitionCommit(...)`.
- `src/scene/SceneManager.ts`: final commit calls `applyEnvironment(...)` once
  at the end of the page transition.
- `src/scene/environment/applyEnvironment.ts`: background and fog use the
  resolved `lightMode` branch and directly replace renderer clear color,
  scene background, `THREE.FogExp2`, and topo fog uniforms.
- `src/scene/transitions/cinematicSceneTransitions.ts`: the blend helper starts
  from the target scene and currently overrides only known post-processing
  fields.

## Root Cause

Background and fog are world/environment scene channels, but the active
transition consumer for scene fields is named and shaped as
`main-camera/cinematic-post`. That consumer interpolates post-processing fields
only. It does not write renderer clear color, `scene.background`,
`scene.fog.color`, fog density, topo material fog uniforms, or light-mode
terrain ramp state per frame.

The visible snap is therefore expected from current code: source background/fog
remain in place during the transition, then target background/fog are applied
in one `applyEnvironment(...)` call during final commit.

There is also a secondary mismatch risk. `blendCinematicSceneForTransition(...)`
initializes the intermediate scene as `{ ...targetScene }`; fields not
explicitly blended, including `lightMode`, `background`, and `fog`, read as
target values inside post-processing from the start of the transition. The
default lens-grade tint derives from fog color, so post tint can lead the actual
renderer background/fog handoff.

## Transition Contract Deviations And Gaps

- `Transition-Continuity-Contract.md` says compatible visible channels should
  receive one assignment and interpolate compatible channel values. Background
  color, fog color, and fog density are compatible scene channels but are not
  represented in the accepted transition execution layer.
- `Transition-Decision-Log.md` TRD-007 and TRD-008 make policy entity/channel
  driven. A future fix should add an environment-scene channel owner rather
  than a page-id, page-index, Utah FORGE, or light-mode special case.
- `Page-Transitions-And-Section-Frames.md` defines `LayerTransitionKind` for
  layer entities. Background/fog should not be forced into that layer enum
  unless a new decision explicitly expands the layer transition scope.
- `docs/rendering/cinematic-render-presets.md` and `docs/schemas/page.json.md`
  state that numeric cinematic post fields blend through
  `main-camera/cinematic-post`. They do not currently promise background/fog
  transition blending, so the user request is an extension of transition policy,
  not a contradiction in those docs.
- `tests/tools/page-cinematics-scene-authoring-source.test.mjs` covers separate
  dark/light background and fog fields, and covers cinematic transition policy
  existence for post fields. It does not currently test background/fog
  interpolation.

## Adjacent Snap Risks Found

- `applyEnvironment(...)` tears down and recreates scene lights, then applies
  lighting color/intensity, sun direction, visible sun visual, terrain shadow
  settings, fog, topo environment, graticule styles, branding, and post
  processing. Calling the full function every transition frame would likely
  rebuild too much state.
- `topoMap/surfaceRuntime.ts` applies light-mode terrain ramp constants when
  `lightMode` is true. Dark-to-light pages may therefore snap terrain ramp
  colors at the same final-commit boundary as background/fog.
- Fog affects several owners: Three.js scene fog, layer material fog flags and
  density, terrain shader `uFogColor`/`uFogFar`, topo runtime fog parameters,
  and lens-grade tint fallback. A robust transition needs one resolved
  intermediate scene color/density fed to the relevant owners.
- Boolean/discrete fields such as `fog.enabled`, `lightMode`, tone-mapping
  mode, cast-shadow flags, texture/preset identity, and helper visibility need
  explicit handoff policy. They should not be accidentally interpolated by
  shallow object blending.

## Implementation Context To Preserve Later

- Effective state must continue resolving through
  `PageController.resolvePresentationState(...)`.
- Page-scoped light/dark changes must keep writing through DEC-095:
  Global Settings -> `environment.scene`; Sub Master -> `envSnapshot.scene`;
  normal page/child -> `sceneOverrides`.
- Render preset and page override precedence must stay:
  environment/Sub Master scene -> render preset `scenePatch` -> page
  `sceneOverrides` -> preview patch.
- Topo material authority must not change texture URL/cache key, bounds,
  public clip, material edge fade, edge outline, shader/material, or geometry.
- Future verification should include the page-agnostic transition source guard
  and a focused human visual check; browser automation should remain limited to
  short checks unless explicitly requested.

## Approved V1 Scope

The approved implementation scope is background/fog transition smoothing only.
The runtime should blend renderer background, scene fog color, scene fog
density, topo fog uniforms, layer fog density, and fog-driven post tint over
the existing page transition duration/easing.

Terrain light-mode ramps, lighting colors/intensities, visible sun state, full
scene mood transitions, material preset identity, texture URL/cache key, bounds,
public clip, edge fade, edge outline, shader choice, and geometry remain
follow-up work unless a later decision explicitly expands the transition
owner.

## Implementation Status

This note began as audit-only context. The approved follow-up scope is the V1
background/fog transition owner described above and recorded in TRD-009.
