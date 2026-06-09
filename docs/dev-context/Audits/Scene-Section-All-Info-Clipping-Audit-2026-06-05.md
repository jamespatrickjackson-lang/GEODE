# Scene Section All-Info Clipping Audit - 2026-06-05

## Status

Audit/log only. No source implementation, reducer behavior, project data, tests, or plan steps are changed by this note.

## Inference

Scene section planes should section all visible scene information in the editor render, including topo map surface content and satellite/orthophoto imagery. In practical runtime terms, the terrain surface shader path must respect scene section planes because satellite imagery is sampled inside the terrain/topo material rather than rendered as a separate ordinary mesh.

This request changes the current authoring expectation from "topo context can opt into clipping" toward "scene section planes and section-frame crops clip visible targeted topo context by default."

## Required Render Stack Trace

Command:

```powershell
npm run inspect:effective -- --render-stack
```

Observed effective page:

- Project: `projects/utah-forge`
- Page: `12_mt_volume_overview` / `MT Volume Overview`
- Active render preset: `user-3`
- Terrain material authority: `environment.scene.terrain`
- Effective material preset: `image:naip-2024-aerial`
- Effective texture URL: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=684f5a7e42719aa9`
- Active asset cache key: `v=684f5a7e42719aa9`
- Bounds: `[229069.2,4094688,598806,4414308]`
- Public clip: enabled, shape `box`, center `[21000,21000,2000]`, size `[1599600,1399600,50000]`
- Material edge fade: `rounded-square`, distance `90000`, corner radius `140000`
- Edge outline: disabled
- Shader/material: `terrainMaterial/topo-image`
- Mesh geometry: runtime terrain mesh, LOD `8192`
- Fog: enabled, density `0.0000037267080745341615`
- Background: `#383838`
- Render stack: `RenderPass -> SSAOPass -> BokehPass -> UnrealBloomPass -> TiltShiftPass -> AfterimagePass -> LensGradePass -> SMAAPass -> OutputPass`

Layer style trace:

- `terrain`: opacity `1`, affected by fog, topo material authority selected.
- Site boundary / working area styles are not fog affected.

No authority conflict was reported for the terrain/topo material.

## Current Documentation And Decision State

- `DEC-071` excluded topo graticule lines and labels from scene-section clipping.
- `DEC-077` superseded the original hard bypass by adding an opt-in `EditableStyle.topoSectionable` flag.
- `DEC-097` resolves this audit's product decision: scene section planes and section frames clip targeted topo context by default, including terrain/topomap pixels, satellite/orthophoto imagery, graticule, labels, legends, and branding.
- `docs/dev-context/Page-Transitions-And-Section-Frames.md` now carries the DEC-097 all-visible targeted topo clipping contract.
- `src/pages/types.ts` now keeps `EditableStyle.topoSectionable?: boolean` only as deprecated compatibility state.

Decision resolved before implementation:

DEC-097 supersedes the DEC-077 default bypass posture while preserving the existing target-scope behavior: `all-visible` clips all visible content, and `selected-targets` clips only selected layers/products.

## Runtime Path Trace

Scene-section application currently flows through:

1. A layer style enables scene section behavior through `sceneSectionEnabled` and section plane/frame fields.
2. `SceneManager.applyStyle(...)` routes updated style state to the scene-section controller.
3. `applySceneSectionPlanes(style)` computes active planes, clipping planes, layer/product targets, frames, frame clipping planes, and object visibility.
4. The controller traverses scene layers and calls `applySceneSectionMaterial(...)` for target materials.
5. Ordinary materials receive combined `material.clippingPlanes`.
6. Selected custom shader paths, such as seismic and scalar-volume shaders, receive explicit scene-section uniforms through `setSceneSectionUniforms(...)`.
7. Topo graticule/branding materials previously had a `topoSectionable` bypass gate; DEC-097 removes that gate for targeted section clipping.

Terrain/topo surface tracing:

- `src/scene/terrainMaterial.ts` creates a custom `THREE.ShaderMaterial` marked with `material.userData.terrainMaterial = true`.
- Satellite/orthophoto imagery is sampled in the terrain shader through uniforms such as `uOrthoPhotoMap`, `uOrthoPhotoEnabled`, `uOrthoPhotoBoundsMin`, `uOrthoPhotoBoundsMax`, and `uOrthoPhotoOpacity`.
- Public surface clipping is implemented manually in the terrain fragment shader through `uPublicClipEnabled`, `uPublicClipShape`, `uPublicClipCenter`, and `uPublicClipHalfSize`.
- The terrain shader does not include Three clipping chunks such as `clipping_planes_pars_vertex`, `clipping_planes_vertex`, `clipping_planes_pars_fragment`, or `clipping_planes_fragment`.
- The terrain shader does not consume the existing scene-section uniform pack from `setSceneSectionUniforms(...)`.

## Root-Cause Findings

1. Policy gap: current docs and source model make topo-context clipping opt-in, while the requested behavior is section-all visible scene content.
2. Shader gap: the terrain/topo surface material is a custom shader that does not support Three built-in clipping planes and does not implement scene-section clipping uniforms.
3. Satellite coupling: satellite/orthophoto imagery is not an independent render object. It is sampled inside the terrain shader, so sectioning satellite imagery requires sectioning the terrain shader path.
4. Context-object gap: topo graticule, labels, legends, and branding previously depended on `topoSectionable`. DEC-097 makes targeted section clipping the default policy for those objects.

## Risks To Preserve

- Public clip must remain composed with scene section clipping, not replaced.
- The effective texture URL, texture cache key, bounds, material preset, edge fade, edge outline, and terrain geometry should not change as a side effect of sectioning.
- Terrain edge fade, orthophoto edge behavior, underside/grid rendering, and fog/post behavior must remain stable when section planes are active.
- Scene-section frame outside-opacity behavior may need shader-side support if terrain must fade outside section frames rather than hard-discard.
- Topo graticule and branding behavior must be decided explicitly because prior decisions treated them as reference context.

## Test Gaps

Current coverage is strong around MT/seismic scene-section behavior, page transitions, and source inspection, but there is no focused guard that proves:

- terrain/topo shader code consumes scene-section planes;
- satellite/orthophoto imagery clips with the terrain surface;
- public surface clip and scene section clipping compose correctly;
- topo graticule/branding defaults match DEC-097;
- section planes preserve texture URL/cache key, bounds, material preset, public clip state, edge fade, edge outline, and geometry.

## Audit-Only Implementation Direction

The implementation direction locked after this audit is:

- add DEC-097 for scene-section planes and frames clipping targeted topo context by default;
- add source tests that fail against the current terrain shader path;
- extend the terrain/topo shader path to consume scene-section data through the existing section uniform contract while preserving public clip uniforms;
- remove topo-context bypass rules now that graticule, labels, legends, and branding are in the default clipping scope.

## Follow-Up Status

The audit hold was released after DEC-097 was approved. Runtime implementation proceeds from this log and the approved plan.
