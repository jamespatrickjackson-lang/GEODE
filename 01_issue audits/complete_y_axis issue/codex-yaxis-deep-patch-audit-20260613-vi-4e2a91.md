# Deep Y-Axis Patch Audit Report

Unique ID: codex-yaxis-deep-patch-audit-20260613-vi-4e2a91
Date: 2026-06-13
Repo audited: C:\GeoSee\Side projects\GeoSee_Dev_VI
Report folder: C:\GeoSee\GeoSee_Dev\Y Axis issue
Prior report referenced: codex-yaxis-findings-20260613-planmode-8c71f2.md
Status: read-only source/patch audit plus report artifact. No repo source, page JSON, data file, staging, commit, cleanup, or purge was performed by this pass.
Visual status: static audit only. Ready for visual check after runtime browser evidence is captured.

## Deep Patch Findings

1. The VI fork still contains the high-risk Y-helper handedness path.

   - Built-in frame ids are axis-bound identities: `axis:x`, `axis:y`, `axis:z` in `src/scene/section/sceneSectionController.ts:154-158`.
   - Axis specs define Y as normal component Y with frame axes X and Z: `src/scene/section/sceneSectionController.ts:95-100`.
   - Built-in Y basis resolves as normal `north`, axis A `east`, axis B `up`: `src/scene/section/sceneSectionController.ts:1558-1582`.
   - For UTM/cardinal defaults, that gives `axisA x axisB = +X x +Z = -Y`, while the intended normal is `+Y`. The basis is left-handed.
   - `rebuildSceneSectionHelpers` still builds `new THREE.Matrix4().makeBasis(tangentA, tangentB, basisNormal)` and then `Quaternion.setFromRotationMatrix`: `src/scene/section/sceneSectionController.ts:3403-3412`.
   - A quaternion cannot represent a reflected basis. This is the strongest current fork-specific explanation for a Y helper visually lying on the Z/X-Y plane even when the resolved cut plane is correct.
   - Other reports in the shared folder describe this exact failure class in the main checkout. This audit found the unfixed pattern still present in the active VI fork.

2. The helper subparts can disagree because some inherit the bad group quaternion while others are world-space.

   - Outline, cones, and pick proxies are children of `controlGroup`, which copies `planeQuaternion`: `src/scene/section/sceneSectionController.ts:3439-3443`, `3470-3495`, `3521-3601`, `3604-3641`.
   - The main label also copies `planeQuaternion`: `src/scene/section/sceneSectionController.ts:3650-3670`.
   - Scale-axis line points are built directly from `planeCenter + tangentA/tangentB` in world space: `src/scene/section/sceneSectionController.ts:3674-3761`.
   - Text headings use `planeQuaternion` plus camera-aware planar text with `basisNormal`: `src/scene/section/sceneSectionController.ts:3763-3802`.
   - Ground trace points are also world-space and the ribbon is built with `basisNormal`: `src/scene/section/sceneSectionController.ts:3853-3886`.
   - This mixed construction can make Y outline/cone/label elements appear rotated 90 degrees from world-space traces/ticks. That matches the reported symptom that Y cut frame pieces are not on the same plane.

3. Outline/ribbon thickness is a secondary visual risk, not the main coplanarity cause.

   - `referenceOutlineWidthM` is derived from global scene `size.y` and `size.z`, not per-frame raw width/height: `src/scene/section/sceneSectionController.ts:3298-3309`.
   - The per-frame width and height are calculated later from `frame.maxAM/minAM` and `frame.maxBM/minBM`: `src/scene/section/sceneSectionController.ts:3385-3402`.
   - This can make edge thickness or visual scale look inconsistent, especially for source-derived or narrow frames. It does not by itself rotate Y into Z, so it should be audited after the handedness issue is proven/fixed.

4. Source seismic face-frame override is a real Y-sensitive path but has a guard.

   - `sceneSectionSourceFaceFrame` normalizes stale built-in active frame ids so a saved `axis:x` or `axis:z` active frame id does not override a different active axis: `src/scene/section/sceneSectionController.ts:1649-1663`.
   - It only activates when the target layers include the Utah FORGE seismic browser layer id: `src/scene/section/sceneSectionController.ts:1664-1669`.
   - It traverses visible/selected seismic objects and returns `sectionFaceFrameFromGraphBasis`: `src/scene/section/sceneSectionController.ts:1672-1695`.
   - Source frames are orthonormalized before becoming resolved frames: `src/scene/section/sceneSectionController.ts:1605-1640` and `2153-2174`.
   - `sectionFaceFrameFromGraphBasis` builds sample-plane normals with `cross(axisA, axisB)` and trace-path normals with `cross(traceDirection, up)`: `src/geophysics/seismicSectionGraphBasis.ts:518-592`.
   - The remaining risk is not obvious stale built-in frame leakage in this function. The risk is that Y can switch between a source-derived right-handed face and the built-in left-handed Y helper basis when source selection/targets change.

5. Drag/edit basis is separate from helper rendering.

   - Plane dragging asks the manager for resolved plane normals first and falls back to hard-coded axis normals: `src/scene.ts:2699-2719`.
   - Window/frame dragging asks for resolved frame/window normals first and then falls back through `sceneSectionFrameDragNormal`: `src/scene.ts:72-87`, `2711-2719`.
   - Manager readback uses `lastSceneSectionStyle` and resolves frames on demand: `src/scene/section/sceneSectionController.ts:4139-4213`.
   - This means edit/drag can still operate on the correct plane while the visible helper is wrong. It also means runtime evidence must compare rendered helper world bboxes with resolved normal/axis vectors, not just drag behavior.

6. Transition code can carry stale visual state, but settled Y geometry must be proven first.

   - Scene-section transition fields include target scope, active axis/frame id, planes, frames, target layer ids, product ids, helper, ground trace, and axes fields: `src/scene/transitions/transitionStyles.ts:400-423`.
   - Discrete signatures include target scope/layer/product ids and frame identity fields: `src/scene/transitions/transitionStyles.ts:598-610`.
   - Transition setup creates a `sceneSectionStyleTween` and uses `dual-mask` for discrete changes: `src/scene/transitions/transitionEffectiveLayersForPage.ts:1034-1059`.
   - During transition frames, `applySceneSectionPlanes(..., { transitionFrame: true })` updates masks/materials but helper rebuilding is skipped: `src/scene/transitions/layerTweenRuntime.ts:172-213` and `src/scene/section/sceneSectionController.ts:4061-4068`.
   - Helper snapshots clone the old runtime helper group: `src/scene/SceneManager.ts:1743-1762`.
   - This can explain bleed or stale-frame visuals during 1-to-2 transitions. It should not be fixed first because this fork can render settled Y helpers incorrectly before any transition.

7. Patch precedence can carry stale section state through multiple authorship layers.

   - Effective scene precedence is documented in code as base/sub-master scene, render preset patch, page `sceneOverrides`, then preview/editor patch: `src/scene/environment/applyEnvironment.ts:529-539`.
   - Page controller resolves Sub Master `envSnapshot` and then merges page `sceneOverrides`: `src/pages/PageController.tsx:1077-1103`.
   - Editor context writes scene patches either into Sub Master `envSnapshot.scene` or page `sceneOverrides`: `src/editor/EditorContext.tsx:2634-2641`.
   - Current tracked Offshore VI pages do not contain `sceneSection` or `Y issue` keys, so the saved Y issue states are not in `projects/offshore-vancouver-island/pages/*.json` in this fork.

8. Paper-cut relief is now wired outside the lab route and is a contamination risk.

   - The dev-only lab route exists in `src/App.tsx:47-60`, but runtime style application also imports paper-cut relief globally: `src/scene/styles/applyLayerStyle.ts:10`.
   - `applyStyle` calls `applyPaperCutReliefStyleToLayerGroup` for any existing layer group before ordinary fog/material styling: `src/scene/styles/applyLayerStyle.ts:22-32`.
   - `EditableStyle` now contains shallow-merge paper-cut fields: `src/pages/types.ts:357-379`.
   - LayerPanel exposes paper-cut controls for eligible layers and can write env/page overrides: `src/editor/LayerPanel.tsx:457-500`, `950-975`.
   - Eligibility excludes MT/seismic/drill/scalar-like layers and includes topobathy/topography/bathymetry/terrain/DEM/elevation-like mesh previews: `src/scene/papercut/paperCutReliefStyle.ts:140-170`.
   - When enabled, the paper-cut runtime hides source meshes and adds generated visible groups: `src/scene/papercut/meshPreviewPaperCut.ts:14-23`, `37-80`, `134-147`.
   - Section bounds skip invisible objects and include visible targeted geometry that is not marked `sceneSectionHelper`: `src/scene/section/sceneSectionController.ts:3066-3118`.
   - Therefore paper-cut cannot explain a pure Y/Z coplanar helper orientation bug, but it can affect frame extents, thickness, and bounds if a section targets eligible topo/mesh layers with paper-cut enabled.

9. Dirty generated data changes are large and unrelated to frame orientation, but they raise audit noise.

   - Working tree has 13 tracked modified files and untracked paper-cut/topography/lab/test paths.
   - `git diff --stat` reports 133 insertions and 783,098 deletions.
   - `events_m2_zoned.geojson` changed by 1 insertion and 592,714 deletions; `events_render_m3.geojson` changed by 1 insertion and 190,354 deletions.
   - The associated script change compact-writes app GeoJSON and reduces runtime feature properties: `tools/offshore/fetch-earthquakes-canada-nedb-preview.mjs` diff around `writeCompactJson` and `runtimeFeatureProperties`.
   - Experiment/source logs record a re-run at `2026-06-13T09:49:28Z` and describe compacting to 6.49 MB.
   - Treat this as unrelated dirty state to preserve, not as a Y-axis fix or source of the frame-plane defect.

10. Offshore VI still carries Utah/FORGE section constants and defaults.

   - Section layer and seismic browser layer ids come from `src/projectModules/utahForge/layerIds.ts:38-42`.
   - Default section target layers fall back to Utah FORGE MT volume/full-density ids when explicit target layers are absent: `src/scene/section/sceneSectionController.ts:855-876`.
   - Transition affected-layer ids are also Utah/FORGE-specific: `src/scene/transitions/transitionStyles.ts:425-432`.
   - This is donor-architecture contamination in the fork. It is not the immediate helper-handedness root cause, but it can make Offshore VI section behavior hard to reason about unless section targeting is made project-aware or explicitly authored.

## Potential Y-Axis Root-Cause Candidates

1. Highest: helper orientation uses a left-handed Y basis.

   The active VI fork still calls `makeBasis(tangentA, tangentB, basisNormal)` for helper groups. For built-in Y, `tangentA x tangentB` points opposite `basisNormal`. This can place visible Y helper controls on the wrong plane while clipping/data cuts remain correct.

2. High: helper subparts combine quaternion-local and world-space geometry.

   A bad Y quaternion affects outline, cones, and labels, while scale axes and ground traces can remain in the resolved world plane. That can produce the reported 90-degree disagreement between Y frame parts.

3. Medium: source-face to built-in Y transitions.

   Active Y can use a source seismic face frame only when the seismic browser layer is targeted and a selected/fallback graph basis exists. Other states fall back to built-in Y. Runtime must prove whether `Y issue 1` uses a source frame and `Y issue 2` falls back to built-in Y.

4. Medium: transition snapshot/dual-mask stale helper state.

   Transition frames skip helper rebuild and can fade cloned helper snapshots. This can explain bleed between page 1 and page 2 after static helper geometry is fixed.

5. Lower: paper-cut relief and global style patching.

   Paper-cut can mutate visible topo mesh groups and affect section bounds/thickness for targeted eligible layers, but it does not naturally rotate Y into the Z plane.

## Contamination and Inconsistency Findings

- The working tree was dirty before this report and remains dirty. This pass did not revert or clean anything.
- Tracked Offshore VI pages are only `00_overview` through `05_tools_backport_log`; no tracked page contains `sceneSection` or `Y issue` in this fork.
- The report folder is outside the active fork by explicit user request: `C:\GeoSee\GeoSee_Dev\Y Axis issue`.
- The main checkout report `YAX-claude-opus48-20260613-handedness-rootcause.md` says the main repo has or had a helper orientation fix. This audit did not inspect main source, but the active VI fork still has the old helper-basis construction.
- `src/scene/layerLoaders.ts` appears in `git status` as modified but `git diff -- src/scene/layerLoaders.ts` returned no content in this pass, suggesting line-ending or metadata noise. Preserve it as unrelated dirty state.
- Paper-cut files are untracked source/lab/test additions. They are not section-owner files, but parts of the feature are already wired into normal app runtime and editor style paths.
- `sceneSectionLayerIds`, `sceneSectionProductIds`, source-face selection, and transition affected-layer sets still depend on Utah/FORGE constants. For Offshore VI this is a project-contamination risk.

## Required Runtime Evidence Before Fixing

Capture this for settled `Y issue 1` and `Y issue 2` before touching transitions or purging data:

- `window.__pageController.getState()` including page id, target id, transition state, transition context, and last transition run.
- `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle()` manager state.
- Effective render stack: environment scene, Sub Master `envSnapshot`, render preset `scenePatch`, page `sceneOverrides`, preview/editor patch, layer styles, active render preset.
- Effective section style for `utah-forge-scene-section-planes` or the active section style layer id in this fork.
- For X/Y/Z resolved planes and frames: `frameId`, `axis`, `normal`, `axisAVector`, `axisBVector`, `center`, signed distance, min/max A/B, source kind, source product id, source section id, target layer ids, target product ids.
- For helper runtime objects grouped by `userData.sceneSectionAxis`: world bounding boxes, flat axis, group transform/quaternion, determinant of `[axisA axisB normal]`, determinant of `[axisA axisB axisA x axisB]`, and where local +Z maps after quaternion.
- For visible helper children: outline vertices, cone transforms, pick proxy transforms, scale-axis vertices, text quaternions, ground-trace/ribbon points.
- For shader/material path: scene-section uniforms, source/target mask uniforms during transition, clipping plane normals/constants, frame-clipping plane normals/constants.
- For paper-cut/topography contamination: active layer style fields, eligible topo mesh visibility, generated paper-cut child presence, section bounds before/after applying paper-cut style if the section targets topo/mesh layers.

Existing hooks are sufficient for the first runtime pass:

- `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle()` is installed by `src/scene/layerDiagnostics.ts:236-252`.
- `window.__pageController.getState()` is installed by `src/pages/PageController.tsx:2988-3019`.

## Do Not Do Yet

- Do not purge section data.
- Do not edit `projects/*/pages/**` to cure this.
- Do not add page-id, page-title, page-index, or page-pair special cases.
- Do not rewrite transitions until the settled helper orientation is fixed/proven in the VI fork.
- Do not leave diagnostic overlays active.
- Do not treat static checks as visual confirmation. Use `ready for visual check` until browser or human visual inspection confirms the screen.

## Recommended Next Action

Patch the VI fork's helper orientation in `rebuildSceneSectionHelpers` after runtime evidence confirms the settled Y helper bbox is flat in Z instead of Y. The likely durable fix is to use a right-handed orientation basis for helper-local +Z, derived from `tangentA x tangentB`, while keeping the true section normal for clipping, text facing, ground trace/ribbon normal, and push/pull semantics. Add a focused regression test for Y basis determinant/helper orientation before transition work.
