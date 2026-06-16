# Y-Axis All Section Logic Audit
Unique ID: codex-yaxis-section-logic-audit-20260613-vi-0f6b83
Date: 2026-06-13
Audited repo: C:\GeoSee\Side projects\GeoSee_Dev_VI
Report folder: C:\GeoSee\GeoSee_Dev\Y Axis issue
Prior reports referenced:
- codex-yaxis-findings-20260613-planmode-8c71f2.md
- codex-yaxis-deep-patch-audit-20260613-vi-4e2a91.md
Status: read-only source audit; no repo source, page JSON, data, staging, commit, cleanup, or purge was performed.
Visual status: static audit only; ready for visual check after runtime numeric evidence is captured.

## Executive Findings

1. The main Y-section defect is still present in the active VI fork. Built-in Y resolves as `normal = +Y`, `axisAVector = +X`, `axisBVector = +Z`. That is left-handed because `axisA x axisB = -Y`, not `+Y`. The renderer then feeds `tangentA`, `tangentB`, and `basisNormal` directly into `Matrix4.makeBasis(...)` for helper orientation. A reflection basis cannot be converted to a stable quaternion as if it were a proper rotation, so outlines, labels, cones, and handles can appear rotated/copied onto the wrong plane even when clipping math uses the expected dot-product vectors.

2. Shader/material clipping is less likely to be the first owner of the visible helper-plane problem. `setSceneSectionUniforms` and `sceneSectionObjectVisibilityShader.ts` use plane normals, frame axis vectors, bounds, and dot products directly. The left-handed Y basis can still matter for frame bounds and soft object visibility, but the strongest static evidence is helper orientation, not shader clipping.

3. Runtime and editor UI merge built-in frame state in different orders. Runtime `sceneSectionResolvedFrameEntries` resolves built-in frames as legacy `sceneSectionFrameByAxis[axis]` first, then explicit `sceneSectionFrames[].frame`. `SceneSectionPlanesContainer` and `SceneSectionLegend` show/edit explicit frame first, then legacy frame. That can make the UI report one frame while the runtime draws another.

4. Offshore VI scene-section authoring is still Forge-gated. The sidebar `SceneSectionPlanesContainer`, active layer logic, target defaults, object targets, transition affected-layer list, and commit handlers use Utah Forge IDs and `projectSlug === "utah-forge"` checks. Offshore VI may execute runtime section code if styles exist, but the section authoring highway is not generalized.

5. The tracked Offshore VI page JSONs still do not contain `Y issue`, `sceneSection`, `axis:y`, `axis:z`, `source:seismic`, `sectionIso`, `sceneOverrides`, `layerOverrides`, or render-preset section state. The visible `Y issue 1` and `Y issue 2` states are likely in live editor/browser state, an untracked artifact, or another location.

6. Transitions are a carrier, not the primary fix target. Scene-section transitions use interpolated numeric channels, dual masks for discrete changes, and helper snapshots. During transition frames, helper rebuilding is intentionally skipped. A bad settled helper basis can therefore bleed through transitions or snapshots, but transition code should remain on hold until the static Y helper basis is numerically proven.

7. Current tests do not cover section basis, helper handedness, Y/Z non-coplanarity, source-face frame overrides, or transition section masks. The only matching test file in this pass was `tests/offshore/paper-cut-relief.spec.ts`, which is unrelated to section frame logic.

## Section Logic Map

### Data model

File: `src/pages/types.ts`

Section-related style fields live on `EditableStyle`:
- `sceneSectionEnabled`, `sceneSectionMode`, `sceneSectionTargetScope`
- `sceneSectionActiveAxis`, `sceneSectionActiveFrameId`
- `sceneSectionPlanes`
- `sceneSectionWindowEnabled`, `sceneSectionWindowActiveAxis`, `sceneSectionWindowByAxis`
- `sceneSectionFrameEnabled`, `sceneSectionFrames`, `sceneSectionFrameByAxis`
- `sceneSectionFaceChannels`
- `sceneSectionObjectVisibilityByAxis`, `sceneSectionObjectVisibilityByFrameId`
- `sceneSectionGroundTraceVisible`, `sceneSectionAxesVisible`, `sceneSectionAxisIntervalM`, `sceneSectionAxisTextScale`
- `sceneSectionTargetLayerIds`, `sceneSectionTargetProductIds`
- `sceneSectionHelperVisible`, `sceneSectionLegendVisible`

Supporting model types are `SceneSectionPlaneState`, `SceneSectionWindowState`, `SceneSectionFrameEntry`, `SceneSectionFrameState`, `SceneSectionFaceChannelState`, and `SceneSectionObjectVisibilityState`.

Scene helper visual sizing lives separately under `SceneProperties.sectionVisuals`, also in `src/pages/types.ts`. It controls outline width scale/min/max, arrow span/min/max/radius/gap, axis tick length, and ground trace width. This means helper thickness can be changed by scene-level patches without modifying `sceneSectionFrames`.

### Effective style and patch precedence

File: `src/pages/effective.ts`

`effectiveStyle(environment, page, layerId)` merges:
1. `environment.layerStyles[layerId]`
2. render-preset/public-context layer patches
3. contour preset patches
4. `page.layerOverrides[layerId]`
5. `normalizeMtBoundaryVisibilityStyle`
6. `normalizeEffectiveSceneSectionStyle`

`normalizeEffectiveSceneSectionStyle` guards stale built-in active frame IDs. If `sceneSectionActiveAxis` is `y` and active frame is `axis:x` or `axis:z`, it normalizes `sceneSectionActiveFrameId` to `axis:y`. It also normalizes built-in `sceneSectionFrames[]` entry axes and planes from legacy `sceneSectionPlanes`.

Scene properties have a separate precedence path in `src/scene/environment/applyEnvironment.ts` and `src/scene/transitions/cinematicSceneTransitions.ts`:
1. authored environment scene
2. render preset `scenePatch`
3. page `sceneOverrides`
4. editor preview patch for live authoring

This separation matters because `sectionVisuals` can change ribbon/outline/cone/trace geometry independently from the section plane/frame state.

### Editor and authoring flow

Files:
- `src/editor/EditorContext.tsx`
- `src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx`
- `src/ui/SceneSectionLegend.tsx`
- `src/editor/layerControls/seismic/SeismicCapabilityLayerContainers.tsx`
- `src/editor/LayerPanelGroups.tsx`
- `src/editor/EditorRoot.tsx`

Important paths:

1. `EditorContext` registers scene-handle commit callbacks for drag commits. Both `setSceneSectionPlaneCommitHandler` and `setSceneSectionWindowCommitHandler` write to hard-coded `UTAH_FORGE_SCENE_SECTION_LAYER_ID`, update `sceneSectionFrames`, and also write legacy built-in fields (`sceneSectionPlanes`, `sceneSectionFrameByAxis`, `sceneSectionWindowByAxis`).

2. `SceneSectionPlanesContainer` is the main sidebar control. It normalizes built-in entries from `sceneSectionFrames`, `sceneSectionPlanes`, and `sceneSectionFrameByAxis`, commits live via `sceneHandle.manager.applyStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, merged)`, and writes either environment layer style or page layer overrides.

3. `SceneSectionLegend` provides quick in-viewport controls. It also writes built-in entries and can add seismic source targeting when face channels or seismic slice state is active.

4. `SeismicCapabilityLayerContainers` has a seismic depth-window section patch. It preserves the current active frame only when the active axis is already Y; otherwise it resets to `axis:y`, which is a useful guard against stale X/Z active frame state.

5. `LayerPanelGroups` only mounts `SceneSectionPlanesContainer` when `state.projectSlug === "utah-forge"` and the section is `sectionsCropping`. `EditorRoot` also treats the scene-section virtual layer as active only for the Utah Forge project. This is a porting gap for Offshore VI.

### Runtime section resolution

File: `src/scene/section/sceneSectionController.ts`

The runtime sequence is:
1. resolve section target product IDs and layer IDs
2. list or derive object targets
3. resolve built-in/custom frame entries
4. resolve source-face frame overrides where applicable
5. resolve frame basis, frame bounds, and active planes
6. apply shader uniforms/clipping/material patches to every layer object
7. rebuild helper geometry unless this is a transition frame
8. update Section ISO overlays unless this is a transition frame

Key owners:
- `sceneSectionProductIds`
- `sceneSectionLayerIds`
- `listSceneSectionObjectTargets`
- `sceneSectionResolvedFrameEntries`
- `sceneSectionSourceFaceFrame`
- `sceneSectionOrthonormalSourceBasis`
- `sceneSectionBasisVectors`
- `resolveSceneSectionFrames`
- `resolveSceneSectionPlanes`
- `sceneSectionClippingPlanes`
- `sceneSectionFrameClippingPlanes`
- `setSceneSectionUniforms`
- `applySceneSectionMaterial`
- `rebuildSceneSectionHelpers`
- `applySceneSectionPlanes`

### Built-in basis logic

File: `src/scene/section/sceneSectionController.ts`

`SCENE_SECTION_AXIS_SPECS` declares:
- X: normal X, frame A Y, frame B Z
- Y: normal Y, frame A X, frame B Z
- Z: normal Z, frame A X, frame B Y

`sceneSectionBasisVectors` returns:
- X: `{ normal: east, axisA: north, axisB: up }` -> `axisA x axisB = +X` OK
- Y: `{ normal: north, axisA: east, axisB: up }` -> `axisA x axisB = -Y` WRONG-HANDED
- Z: `{ normal: up, axisA: east, axisB: north }` -> `axisA x axisB = +Z` OK

This is the highest-confidence static root cause for the Y helper orientation. It matches the reported symptom that Y and Z can appear coplanar/rotated wrong: the Y helper basis is not a valid right-handed rotation basis when passed to Three.js quaternion extraction.

### Source seismic face frame path

Files:
- `src/geophysics/seismicSectionGraphBasis.ts`
- `src/scene/section/sceneSectionController.ts`

`sectionFaceFrameFromGraphBasis` derives source frames from seismic graph basis:
- sample-plane: `axisAVector = horizontalFootprintAxes.u`, `axisBVector = horizontalFootprintAxes.v`, `normal = axisA x axisB`
- trace-path curtain: `axisAVector = last - first`, `axisBVector = up`, `normal = axisA x axisB`

`sceneSectionOrthonormalSourceBasis` projects/normalizes source axis A against the normal and reconstructs axis B as `normal x axisA`. It also flips axis A if needed to preserve source axis B direction. This path tries to enforce an orthonormal source basis and is not the same as the built-in Y basis bug. It is still high-risk because source-face frames can override position, min/max A/B, center, normal, axis A, and axis B for the active source frame.

`sceneSectionSourceFaceFrame` only activates if the style targets `UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID`, finds a selected seismic face or visible product target, and matches active frame/axis rules. It also normalizes stale built-in active frame IDs to the active axis before selection.

### Material and shader flow

Files:
- `src/scene/section/sceneSectionController.ts`
- `src/scene/shaders/sceneSectionObjectVisibilityShader.ts`

`applySceneSectionPlanes` traverses every loaded layer object and computes `SceneSectionObjectVisibility` for each object. It then applies:
- hard clipping planes for fully clipped section planes
- frame clipping planes for hard frame masks
- shader-based alpha for soft/outside opacity and dual-mask transitions
- terrain and seismic shader uniforms via `setSceneSectionUniforms`
- built-in material shader patching via `applySceneSectionObjectVisibilityBuiltInMaterial`

The shader uniforms carry:
- source and target plane normals and signed distances
- source and target frame axis A/B and bounds
- source and target outside opacity values
- transition enabled/progress

The shader alpha test uses `dot(position, normal) - signedDistance` for planes, and `dot(position, axisA/axisB)` against frame bounds. It does not build a quaternion from the basis, so it is less likely than helper rendering to produce the 90-degree/copanar helper symptom by itself.

### Helper geometry flow

File: `src/scene/section/sceneSectionController.ts`

`rebuildSceneSectionHelpers` creates:
- frame outlines
- push/pull handles
- min/max A and min/max B cone handles
- labels
- scale axes and tick labels
- ground traces
- intersection traces
- runtime pickables

Critical path:
- `tangentA = frame.axisAVector` or `plane.axisAVector`
- `tangentB = frame.axisBVector` or `plane.axisBVector`
- `basisNormal = plane.normal`
- `planeBasis = new THREE.Matrix4().makeBasis(tangentA, tangentB, basisNormal)`
- `planeQuaternion = new THREE.Quaternion().setFromRotationMatrix(planeBasis)`

For X and Z, the basis is right-handed. For Y, it is left-handed. That makes `setFromRotationMatrix` consume a reflection as if it were a rotation. All child helpers placed in the local XY plane and rotated by this quaternion can therefore be rotated/mirrored off their intended Y plane.

Outline geometry itself is built in local XY with A/B width and height. The outline/ribbon width uses `referenceOutlineWidthM`, which is derived from the whole scene section bounds and `sectionVisuals`. That can affect apparent thickness, but it does not explain Y/Z coplanarity unless combined with the wrong helper quaternion.

Ground traces are world-space points generated from `tangentA`, sampled surface Z, and `basisNormal` for ribbon width. These can also inherit the wrong handedness or normal direction visually, especially for Y, but the first failure remains the basis orientation.

### Drag and edit flow

File: `src/scene.ts`

Drag picking uses helper pick proxies from `manager.listSceneSectionPlanePickables()`. Drag start prefers runtime-resolved normals:
- `manager.getSceneSectionPlaneNormal(axis, frameId)` for plane push/pull
- `manager.getSceneSectionWindowNormal(axis, kind, frameId)` for frame handles

If the runtime lookup fails, it falls back to hard-coded axes:
- plane X/Y/Z -> world X/Y/Z
- A handles -> world Y for X, world X otherwise
- B handles -> world Z except Z-axis frame fallback returns world Y

Because the normal getter path is primary, drag is probably not the root owner when runtime frames resolve. But the fallback can disagree with rendered custom/source frames and should be covered by runtime evidence.

### Section ISO overlays

Files:
- `src/scene/isoOverlays/volumeCutIsoOverlays.ts`
- `src/scene/isoOverlays/sectionIsoOverlay.ts`

Section ISO overlays are driven from `this.sceneSectionActivePlanes(this.lastSceneSectionStyle)` and `resolveSceneSectionFrames(this.lastSceneSectionStyle, sectionBounds)`. MT and seismic overlays build helper meshes from the active section planes/frames, mark them as `sceneSectionHelper`, and set `skipSceneSectionClipping` so the overlay does not clip itself. These overlays depend on the same resolved frame basis and bounds. They should be inspected after the primary helper basis is corrected/proven, but they are not the first suspected owner of Y helper coplanarity.

### Transition flow

Files:
- `src/scene/transitions/transitionStyles.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/transitions/layerTweenRuntime.ts`

Scene-section transition fields include all section state fields. Discrete signatures include enabled state, target scope/layers/products, window/frame state, axis datum/alignment, headings, ground trace visibility, and frame enablement.

`transitionEffectiveLayersForPage.ts` creates derived entities for:
- scene-section helpers
- scene-section frames
- scene-section ground traces
- scene-section axes
- section ISO lines
- section ISO bands

When section style changes, a `sceneSectionStyleTween` may be created. Discrete changes use `maskMode: "dual-mask"`; non-discrete numeric changes use interpolation. During transition ticks, `layerTweenRuntime.ts` calls `applySceneSectionPlanes(style, { transitionFrame: true, maskTransition })`. In `applySceneSectionPlanes`, `transitionFrame` skips helper rebuild and ISO overlay updates. Helper snapshots can fade existing helper geometry.

This explains why a bad settled Y helper can bleed across page transitions: the helper snapshot and transition frame path preserve or fade the existing helper geometry. It does not prove transitions caused the Y plane bug.

### Diagnostics

Available runtime hooks found:
- `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle()` from `src/scene/layerDiagnostics.ts`
- `window.__pageController.getState()` from `src/pages/PageController.tsx`
- `SceneManager.getSceneSectionHelperDebugState()` exposes helper snapshot/ground-trace transition state
- `lastSceneSectionApplyDebug` on the manager records section apply timing and counts

These are enough to build a first-pass runtime numeric dump without adding a persistent overlay.

## High-Risk Bugs And Inconsistencies

### 1. Left-handed Y helper basis - highest risk

Evidence:
- `sceneSectionBasisVectors("y")` returns `normal = north`, `axisA = east`, `axisB = up`.
- `east x up = -north`, not `+north`.
- `rebuildSceneSectionHelpers` uses `makeBasis(tangentA, tangentB, basisNormal)` and then `setFromRotationMatrix`.

Expected durable fix shape later:
- Introduce one shared helper to resolve a right-handed display basis for any plane/frame: keep A/B bounds semantics intact, but ensure the display basis passed to `makeBasis` satisfies `displayA x displayB = displayNormal`.
- Add tests for X/Y/Z built-ins proving handedness, normal identity, frame bounds semantics, and helper quaternion basis.
- Do not patch just the Y page or reorder saved page data.

### 2. Runtime/editor built-in frame merge-order mismatch - high risk

Evidence:
- Runtime built-in frame merge: `{ ...sceneSectionFrameByAxis[axis], ...explicitEntry.frame }`.
- `SceneSectionPlanesContainer` and `SceneSectionLegend` built-in frame merge: `{ ...explicitEntry.frame, ...sceneSectionFrameByAxis[axis] }`.
- Transition discrete signature matches runtime order, not UI order.

Risk:
- The UI can show/edit one frame while runtime resolves another.
- Page transitions can compare signatures using one order while sidebar state appears as another.
- Legacy and explicit frame state can contaminate each other after repeated edits.

### 3. Runtime/editor target default mismatch - medium-high risk

Evidence:
- Runtime `sceneSectionLayerIds` default selected-targets fallback is MT volume plus full density.
- UI default target layer set includes MT volume, MT slices, and MT full density.

Risk:
- With no explicit `sceneSectionTargetLayerIds`, UI expectations and runtime target set can differ.
- This is not the Y helper handedness owner, but it can make object visibility and Section ISO behavior appear inconsistent.

### 4. Offshore VI controls are still Utah Forge gated - medium-high risk

Evidence:
- `LayerPanelGroups` only renders scene-section controls when `state.projectSlug === "utah-forge"`.
- `SceneSectionPlanesContainer` and `EditorContext` write hard-coded `UTAH_FORGE_SCENE_SECTION_LAYER_ID`.
- Object target lists and transition affected layer IDs are Forge-specific.

Risk:
- Offshore VI section states may be coming from donor/FORGE assumptions, manual saved state, or live browser memory rather than a clean VI-specific authoring model.
- Fixes should stay runtime-generic, but the authoring layer needs a later fork-porting audit before final app integration.

### 5. Source seismic face override can replace built-in frame basis - medium risk

Evidence:
- `sceneSectionSourceFaceFrame` can override normal, center, signed distance, min/max A/B, and basis vectors.
- Source basis is tied to `UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID` and selected/visible product data.
- `sceneSectionOrthonormalSourceBasis` reconstructs a right-handed source basis, but only after source data is selected.

Risk:
- If the Y issue pages actually target seismic source faces, the active source frame may be a separate owner from the built-in Y basis.
- Runtime numeric dumps must identify whether the bad visible frame is `axis:y`, `axis:z`, or `source:seismic:*`.

### 6. Paper-cut style hook is a contamination path, not first Y owner - medium risk

Evidence:
- Dirty patch imports `applyPaperCutReliefStyleToLayerGroup` into `src/scene/styles/applyLayerStyle.ts` and runs it globally for every eligible group before normal layer style traversal.
- Dirty patch adds `PaperCutReliefControls` to `LayerPanel` and `EditableStyle` paper-cut fields.
- Full dirty diff includes 783,098 deleted generated earthquake-data lines.

Risk:
- If scene sections target topography/bathymetry/terrain mesh groups, paper-cut-generated mesh replacement can change bounds, helper reference width, and object visibility results.
- It does not explain the built-in Y helper handedness by itself, but it is real audit noise and should remain isolated from the Y fix.

### 7. Transition helper snapshot can preserve bad helper geometry - medium risk

Evidence:
- Discrete section transitions can clone live helper runtime into a `scene-section-helper-transition-snapshot`.
- Transition ticks call `applySceneSectionPlanes(..., { transitionFrame: true })`, which skips helper rebuild.

Risk:
- The user-observed bleed from page 1 to page 2 can be a symptom of a bad settled helper basis carried by snapshots/transition frames.
- Do not rewrite transitions until the settled Y helper basis is numerically correct.

### 8. No focused test coverage - high process risk

Evidence:
- `rg` found no tests for `sceneSection`, `SceneSection`, `axis:y`, `source:seismic`, or section helper handedness under `tests`.
- Only `tests/offshore/paper-cut-relief.spec.ts` matched nearby dirty work.

Risk:
- Regressions in X/Y/Z basis math, UI/runtime normalization, and source-face overrides can recur.

## Required Runtime Evidence Before Fixing

Use the existing diagnostics hooks and capture this for both `Y issue 1` and `Y issue 2` before source edits:

1. Page and routing state
- `window.__pageController.getState().currentPageId`
- target page ID and transition status
- active render preset ID
- current environment/project slug

2. Effective scene stack
- environment `scene`
- Sub Master/envSnapshot result for the page
- active render preset `scenePatch`
- page `sceneOverrides`
- final merged `sectionVisuals`

3. Effective layer style stack for the scene-section virtual layer
- environment layer style
- render-preset/public-context/contour patches if any
- page `layerOverrides`
- final `effectiveStyle`
- normalized active axis and active frame ID

4. Per-frame numeric dump for X/Y/Z and any source frames
- frame ID and label
- axis
- enabled flags
- `normal`
- `axisAVector`
- `axisBVector`
- `cross(axisA, axisB)`
- dot/cross handedness against `normal`
- `center`
- `signedDistanceM`
- `positionM`
- `minAM`, `maxAM`, `minBM`, `maxBM`
- axis alignment and datum

5. Helper runtime dump
- runtime group visibility
- helper object count
- per helper control group: name, position, quaternion, matrix basis vectors, determinant if available
- outline vertices in world coordinates
- cone handle transforms and `sceneSectionPlaneHandleKind`
- label transforms
- ground trace points and width

6. Material/shader dump for targeted objects
- material type and `userData` section flags
- active clipping plane count
- `uSceneSectionNormals`, `uSceneSectionPositions`, `uSceneSectionInvert`
- `uSceneSectionFrameAxisA`, `uSceneSectionFrameAxisB`, `uSceneSectionFrameBounds`
- object visibility `outsideOpacityByAxis` and `outsideOpacityByFrameId`
- source/target uniforms if transition is active

7. Target and contamination dump
- `sceneSectionTargetLayerIds`
- `sceneSectionTargetProductIds`
- resolved runtime layer target set
- resolved runtime product target set
- object target list from `listSceneSectionObjectTargets()`
- whether paper-cut fields are present/enabled on any targeted layer
- whether target groups include generated paper-cut meshes or helper-marked objects

## Recommended Fix Order Later

1. Add a tiny pure-basis test or diagnostic helper that asserts all built-in bases are right-handed: `axisA x axisB` must align with `normal` for X/Y/Z.
2. Fix the Y display/helper basis in runtime-generic code, not in page JSON. The likely code owner is `sceneSectionBasisVectors` or a shared basis-normalization helper used before `makeBasis`.
3. Add tests for helper basis/quaternion construction, including Y.
4. Align runtime/UI merge order for built-in frames. Pick one precedence contract and update runtime, sidebar, legend, and transition signature to match.
5. Add a runtime numeric dump command or dev-only diagnostic function for section frames. Keep it default off and do not leave overlays active.
6. Only after static Y geometry is proven, re-test transitions and helper snapshots for page-to-page bleed.
7. Separately port/genericize scene-section authoring for Offshore VI if the fork is supposed to own section controls outside Utah Forge.

## Do Not Do Yet

- Do not purge section data.
- Do not rewrite transitions as the first fix.
- Do not patch specific page IDs, page titles, or page order.
- Do not fix by editing tracked page JSON until runtime numeric evidence proves a page-data defect.
- Do not blend paper-cut/topography changes into the Y fix.
- Do not leave diagnostic overlays active.
- Do not inspect or edit `C:\GeoSee\GeoSee_Dev` source for this fork unless explicitly requested; only this report artifact was written there.

## Verification Performed For This Report

- Read-only source audit in `C:\GeoSee\Side projects\GeoSee_Dev_VI`.
- Confirmed tracked Offshore VI pages do not contain `Y issue`, `sceneSection`, `axis:y`, `axis:z`, `source:seismic`, `sectionIso`, `sceneOverrides`, `layerOverrides`, or render-preset section state.
- Confirmed no focused section tests under `tests`.
- Checked `git status --short --branch`; worktree was already dirty with unrelated changes and was not cleaned.
- No browser/runtime visual inspection was performed in this pass.

## Appendix: Explicit Adjacent Issues And Audit Noise

Added: 2026-06-13 after follow-up request to include adjacent, unrelated, and contamination findings explicitly.

1. Dirty worktree is an active audit constraint. The repo already contains modified source, docs, project JSON, generated data, and untracked lab/topography files. This is not proof of the Y defect, but it means any later Y fix must stage narrowly and avoid cleanup/revert.

2. Huge generated data diffs are unrelated but risky. Current `git diff --stat` showed `783,098` deleted lines, primarily in Offshore VI earthquake GeoJSON outputs. This can obscure review and should not be bundled with a Y-axis runtime fix.

3. `src/scene/layerLoaders.ts` appears in `git status` but showed no visible diff in the source audit. Treat it as possible line-ending/metadata churn and verify before any future commit.

4. Paper-cut relief is adjacent runtime contamination. The dirty patch adds a dev lab route, editable style fields, LayerPanel controls, and a global `applyStyle` call that can mutate eligible topography/bathymetry/terrain groups. If scene sections target those groups, bounds and helper reference widths can change outside the lab.

5. Paper-cut relief is not the first Y root cause. It can contaminate bounds and geometry for eligible mesh groups, but it does not explain the built-in Y handedness issue by itself.

6. Offshore VI project provenance changed adjacent to this audit. `projects/offshore-vancouver-island/project.json` adds `sourceBacked: false` to an earthquake catalogue zone source entry. This is unrelated to section geometry but relevant audit noise around data provenance.

7. Tracked Offshore VI pages do not contain the reported Y issue page state. No tracked page JSON contains `Y issue`, `sceneSection`, `axis:y`, `axis:z`, `source:seismic`, `sectionIso`, `sceneOverrides`, or `layerOverrides`. Runtime/browser/editor state is still required before fixing.

8. Section authoring is still Utah Forge specific. The sidebar controls, active virtual layer logic, commit handlers, target defaults, transition affected layer IDs, and object target labels use Forge IDs or `projectSlug === "utah-forge"`. This is an Offshore VI fork inconsistency even if the runtime section math is shared.

9. UI and runtime disagree on built-in frame merge precedence. Runtime gives explicit `sceneSectionFrames[].frame` precedence over legacy `sceneSectionFrameByAxis`; sidebar/legend display legacy values over explicit values. This can create stale-state or apparent-control bugs adjacent to the Y issue.

10. UI and runtime target defaults are inconsistent. The UI default set includes MT volume, MT slices, and MT full density; runtime default selected-targets fallback includes MT volume and full density only. This can produce mismatched visibility/ISO behavior when explicit target arrays are missing.

11. Transition code can preserve bad geometry. Dual-mask and helper snapshot paths can carry settled helper mistakes across pages, but they should not be rewritten until the static Y helper basis is proven correct.

12. Source seismic face frames are a separate high-risk path. Source face basis overrides can replace built-in frame basis with selected seismic graph-basis data. Runtime evidence must identify whether the bad frame is `axis:y`, `axis:z`, or `source:seismic:*`.

13. No focused section tests exist in the current test tree. There are no tests for X/Y/Z basis handedness, helper quaternion construction, UI/runtime merge order, source-face frame math, Y/Z non-coplanarity, or section transition masks.

14. Report-folder boundary risk remains. Reports are intentionally written under `C:\GeoSee\GeoSee_Dev\Y Axis issue`, but source inspection/editing for this task stayed in `C:\GeoSee\Side projects\GeoSee_Dev_VI`. Do not infer permission to edit main `C:\GeoSee\GeoSee_Dev` source from the report path.
