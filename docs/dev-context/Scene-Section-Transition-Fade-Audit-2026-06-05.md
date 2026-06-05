# Scene Section Transition Fade Audit - 2026-06-05

Status: implementation audit note for TRD-010.

## Request Inference

Sectioned render content should not snap when moving between pages with
different scene section states. Because section behavior is authored through
outside-opacity variables, sectioned objects should fade from the source page's
effective section mask to the target page's effective section mask on the
target page `transition.duration` and `transition.easing`. Helper/reference
visuals such as ground traces, axes, frame outlines, labels, and intersection
traces should fade in or out on the same transition clock.

## Render-Stack Trace

- `environment.scene` resolves page-visible layers and global scene section
  defaults before page overrides.
- Sub Master `envSnapshot` participates in effective page style resolution
  before runtime scene transition setup.
- Active render preset and its `scenePatch` resolve before page
  `sceneOverrides` and can change scene section style through effective layer
  style resolution.
- Layer styles on the scene-section virtual layer own section planes, section
  frames, target scope, target ids, helper visibility, and object outside
  opacity maps.
- Topo material authority remains the terrain shader and topo runtime material
  update path. Scene section transition frames must update mask uniforms only;
  they must not change texture URL/cache key, bounds, material preset, public
  clip state, material edge fade state, edge outline state, shader identity, or
  mesh geometry.
- Public topo state remains discrete during this pass: active texture URL/cache
  key, bounds, material preset, public clip, material edge fade, material edge
  outline, shader/material identity, and mesh geometry are not transition
  owners for section mask fades.
- Active asset URL/cache key remains owned by topo/satellite layer loading and
  public surface style application. Section transitions are alpha-mask
  consumers, not asset-selection owners.
- Shader/material path:
  - terrain/topo/satellite imagery uses `terrainMaterial.ts` scene-section
    uniforms;
  - seismic/scalar shader materials use scene-section and object-visibility
    uniforms;
  - built-in materials use the scene-section object-visibility shader patch.
- Mesh geometry path remains stable during tween frames. Helper geometry is
  rebuilt at start/final commit only; transition frames update material
  uniforms and helper opacity.

## Audit Findings

- `SceneSectionStyleTween` already exists as a page-transition side channel,
  but incompatible section changes previously snapped live masks to the target
  after the first target apply.
- `sceneSectionObjectVisibilityByAxis` and
  `sceneSectionObjectVisibilityByFrameId` were part of the discrete signature,
  so pure outside-opacity edits could be classified as a discrete snap instead
  of a continuous opacity tween.
- `applySceneSectionPlanes(style)` rebuilt helpers and refreshed cut-ISO
  overlays on every tween frame. That contradicted the helper-stability
  contract in `Page-Transitions-And-Section-Frames.md`.
- Terrain and built-in material shader paths had only one section mask state.
  A clean dual-mask fade needs source and target mask uniform sets plus eased
  progress.
- Hard `material.clippingPlanes` cannot fade. During active section mask
  transitions, section clipping must move through shader alpha while retaining
  public-surface clip as a hard crop.

## Locked Integration Contract

- Section masks are transition-scene channels and remain outside
  `LayerTransitionKind`.
- Compatible section-frame numeric values interpolate directly.
- Incompatible section-frame, target, or enable-state changes use
  `lerp(sourceMaskAlpha, targetMaskAlpha, easedProgress)`.
- Helper/reference visuals use `sceneSectionHelperTransitionOpacity` on the
  same page transition clock.
- Transition frames update material/shader uniforms and helper opacity only.
  Helper rebuilds and cut-ISO refreshes remain start/final-commit work.
- Public clip, terrain texture identity, bounds, material preset, edge fade,
  edge outline, shader identity, terrain geometry, lighting, sun, and camera
  path remain out of scope.
