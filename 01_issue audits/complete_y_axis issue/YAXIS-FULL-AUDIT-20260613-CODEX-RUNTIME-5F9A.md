# Full Y-Axis Section Runtime Audit - YAXIS-FULL-20260613-CODEX-RUNTIME-5F9A

Date: 2026-06-13  
Repo audited: `C:\GeoSee\GeoSee_Dev`  
Drive snapshot checked: `https://drive.google.com/drive/folders/1fqqD7GJaWwgtNOKyFDhcI8reTJzN7BZJ`  
Scope: audit only. No source, test, page, project-order, or runtime fixes were made as part of this report.

## Executive Summary

The current local runtime shows two separate things that must not be collapsed into one diagnosis:

1. The built-in Y section basis is still semantically left-handed in the base axis definitions. X and Z are right-handed. Y is the only built-in axis where `axisA x axisB` points opposite the section normal.
2. The current local source also contains a helper-orientation patch that makes rendered helper controls use a proper right-handed basis. In the live local runtime, settled page 180 and settled page 181 both reported Y helper control transforms with determinant `+1`. That means the specific settled helper transform in the current local browser was not still using the raw left-handed Y basis.
3. The transition from saved page 180 (`Y issue 1`) to saved page 181 (`Y issue 2`) is not a simple "move Y from source to target" transition. It changes section-wide semantics while also moving Y:
   - active axis changes `y -> x`
   - active frame changes `axis:y -> axis:x`
   - window active axis changes `y -> x`
   - target scope changes `selected-targets -> all-visible`
   - target layer ids change from MT + seismic to MT-only
   - active planes change from Y-only to X/Y/Z
4. The transition partition currently classifies `axis:y` as a moving frame and `axis:x` plus `axis:z` as dissolve frames. Because there are already dissolve frames, the existing non-frame semantic-change fallback does not dissolve all frames. This is a credible, observed source of "page 1 bleeds into page 2" behavior.
5. During transition frames, `applySceneSectionPlanes(..., { transitionFrame: true })` updates data clipping and shader/material state but does not rebuild live helper geometry. The helper visuals are driven by transition snapshots and fade state, while the data clipping/masks use interpolated section state. In live readback, the interpolated Y data plane moved, but the visible helper group's Y controls stayed at the source position until settled rebuild. That is a direct explanation for a transition where helpers and cuts appear to disagree.
6. The Drive snapshot and local repo are not equivalent audit inputs. The Drive root contains a full repo-like snapshot with `src`, `projects`, `docs`, `dist`, `.git`, and pages 180/181. The Drive `Y Axis issue` folder listed empty through the connector, while the local repo has many untracked audit files. Treat Drive snapshot drift as an audit variable, not as a copy of the local dirty tree.

Bottom line: the Y handedness issue is real at the base-logic level, but the current local browser shows the helper-orientation patch is active for settled helpers. The transition problem is still real and is more likely explained by mixed source/target semantics, moving-frame partition rules, helper snapshot behavior, and page/state contamination than by only the raw Y basis.

## Problem Being Audited

The reported user-visible problem has three parts:

- On a saved page called `Y issue 1`, the Y-axis section and its cut frames appear narrowed or rotated about 90 deg from the expected plane. The user expects the Y section frame to lie in the same plane as the Y section cut.
- On a saved page called `Y issue 2`, the Z axis is yellow, Y is blue, X is red, and two axes appear to share the same plane. The user believes Y and Z should not appear coplanar.
- Switching between the pages appears to bleed page 1 into page 2. The transition does not preserve the expected source and target section behavior.

This audit intentionally treats the symptom broadly. The root cause could be base axis math, frame construction, ribbon/edge thickness, cones/handles, helper orientation, clipping-plane math, shader uniforms, section target scope, editor writes, stale compatibility state, transition partitioning, page contamination, local patches, or Drive/local drift.

## Evidence Scope

### Local Static Inspection

Non-mutating commands were used to inspect:

- `git status --short`
- `git diff --name-status`
- `git diff --numstat`
- `git diff -- src/scene/section/sceneSectionController.ts`
- `git diff -- src/scene/transitions/transitionEffectiveLayersForPage.ts src/scene/transitions/transitionStyles.ts src/scene/transitions/layerTweenRuntime.ts src/scene/SceneManager.ts`
- `git diff -- src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx src/editor/layerControls/seismic/SeismicCapabilityLayerContainers.tsx`
- targeted `rg`/`Select-String` searches for `sceneSection`, `sourceFace`, `sourceBasis`, `makeBasis`, `Quaternion`, `linkedLayerStylePatches`, `sceneOverrides`, `envSnapshot`, `legacy`, and `compat`
- source reads of section runtime, transition runtime, effective page normalization, page types, editor containers, and project/page JSON

### Local Runtime Inspection

A local dev server was already running on `127.0.0.1:5173`. Browser plugin controls were not exposed in this session, so Playwright was used as fallback. The readback inspected:

- `window.__pageController.getState`
- `window.__scene.manager`
- settled page 180
- page 180 -> 181 during transition at early and late samples
- settled page 181
- section style, resolved frame entries, plane normals, frame bases, helper group transforms, transition tween state, mask state, helper snapshot state, layer target resolution, and render-stack state

### Drive Snapshot Inspection

The provided Drive snapshot root was listed through the Google Drive connector:

- root folder includes `.git`, `src`, `projects`, `docs`, `dist`, `node_modules`, `Y Axis issue`, `package.json`, and other repo-like folders/files
- Drive `Y Axis issue` folder listed empty
- Drive `projects/utah-forge/pages` contains `180_page.json` and `181_page.json`
- Drive `projects/utah-forge/project.json`, `environment.json`, and overlays are present
- Drive `src/scene/section/sceneSectionController.ts` exists and was modified at snapshot time

This was a folder/content-presence audit. It was not a full content-hash comparison between Drive files and the local dirty tree.

## Current Dirty Tree And Patch Inventory

The local tree is heavily dirty. This matters because current runtime behavior may come from local source patches, untracked source files, untracked pages, and edited docs/tests that are not part of a clean baseline.

### Section Runtime

- Modified: `src/scene/section/sceneSectionController.ts`
- The dirty section runtime contains a helper orientation patch that avoids directly feeding raw Y tangent basis plus normal into helper quaternions.
- The local source comments identify the raw Y basis as left-handed and state that the previous helper orientation could put the Y helper in a plane coincident with Z.

### Transition Runtime

- Modified:
  - `src/scene/transitions/transitionEffectiveLayersForPage.ts`
  - `src/scene/transitions/transitionStyles.ts`
  - `src/scene/transitions/layerTweenRuntime.ts`
  - `src/scene/SceneManager.ts`
- Untracked:
  - `src/scene/transitions/sceneSectionFrameSignature.ts`
- These files implement or consume frame partitioning, scene-section tween style, dual-mask dissolve/move state, and transition-frame application.

### Editor And Persistence

- Modified:
  - `src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx`
  - `src/editor/layerControls/seismic/SeismicCapabilityLayerContainers.tsx`
  - `src/pages/dynamicCameraPose.ts`
- Editor paths can write several redundant section fields at once:
  - `sceneSectionActiveAxis`
  - `sceneSectionActiveFrameId`
  - `sceneSectionPlanes`
  - `sceneSectionFrames`
  - `sceneSectionFrameByAxis`
  - legacy `sceneSectionWindowActiveAxis`
  - legacy `sceneSectionWindowByAxis`
  - target scope/layers/products via linked layer patches

### Docs And Tests

- Modified docs:
  - `docs/03-decisions.md`
  - `docs/dev-context/Page-Transitions-And-Section-Frames.md`
  - `docs/dev-context/Transition-Runtime-Operating-Spec.md`
- Modified/untracked tests include:
  - `tests/tools/scene-section-transition-behavior-source.test.mjs`
  - `tests/tools/scene-section-frame-orientation-source.test.mjs`
  - `tests/tools/scene-section-frame-partition-source.test.mjs`
  - `tests/tools/dynamic-camera-orbit-radius-clamp-source.test.mjs`

The docs/tests are useful evidence of intended behavior, but they are also part of the dirty patch set and must not be treated as external confirmation.

### Page-State Contamination

- Modified bulk Utah page JSON set:
  - many existing pages including 100, 101, 104, 109, 110, 115, 118, 119, 121, 122, 123, 138, 149, 156, 166, 171, 172, 173, 174, 21, 40-45, 47, 49, 99
- Untracked pages:
  - `177_page.json`
  - `178_page.json`
  - `179_page.json`
  - `180_page.json`
  - `181_page.json`
- Untracked overlays:
  - `178_overlay.json`
  - `179_overlay.json`
  - `181_overlay.json`
- Modified:
  - `projects/utah-forge/project.json`

The saved issue pages are valuable reproduction evidence, but they are untracked local state. They must not be treated as a clean fixture or as the fix target.

### Project Order Changes

`project.json` moves/adds pages so that:

- `177_page`, `178_page`, `179_page`, `180_page`, and `181_page` are near the end of page order
- `47_seismic_footprint_velocity_support` is moved near the new saved pages
- current page order length is 112
- `180_page` is index 110
- `181_page` is index 111

This means transition behavior between 180 and 181 is currently reachable through local page order, but page order itself is also dirty evidence.

### Unrelated Or Secondary Work

Potentially unrelated dirty work exists in dynamic camera, docs, tests, and bulk page edits. It can still affect diagnosis by changing camera perception, page order, or expected runtime behavior.

## All-Section Base Logic

### Built-In Axis Specifications

The base axis definitions are in `src/scene/section/sceneSectionController.ts` under `SCENE_SECTION_AXIS_SPECS`.

| Axis | Normal | Frame A | Frame B | `A x B` | Dot With Normal | Handedness |
| --- | --- | --- | --- | --- | --- | --- |
| X | +X | +Y | +Z | +X | +1 | right-handed |
| Y | +Y | +X | +Z | -Y | -1 | left-handed |
| Z | +Z | +X | +Y | +Z | +1 | right-handed |

Equivalent runtime basis from `sceneSectionBasisVectors`:

| Axis | Runtime normal | Runtime axisA | Runtime axisB | Determinant |
| --- | --- | --- | --- | --- |
| X | east | north | up | +1 |
| Y | north | east | up | -1 |
| Z | up | east | north | +1 |

The Y basis is the only built-in base axis where `normal`, `axisA`, and `axisB` are not a proper right-handed basis when interpreted as a 3D orientation frame.

### Consumers That Require A Proper Basis

These consumers need special handling when using Y:

- helper/control quaternion construction using `Matrix4.makeBasis`
- helper outline local coordinate frame
- cone/handle/control geometry orientation
- label orientation if it follows helper/control group quaternion
- any future code assuming `axisA`, `axisB`, and `normal` can be used directly as a rotation matrix

The current local `rebuildSceneSectionHelpers` code handles this by computing the orientation third column from `axisA x axisB`, then making the helper quaternion from a proper basis. That flips the helper normal for the left-handed Y case, producing a proper rotation rather than feeding a reflection into `makeBasis`.

### Consumers That Only Need Plane Normal And Bounds

These consumers can tolerate the semantic Y basis if they do not use it as a rotation matrix:

- clipping plane normal/distance
- frame min/max along A/B
- scalar/seismic shader section uniforms where normal is explicit
- source/target material clipping if it uses explicit plane normals
- position interpolation along normal or along frame axes

These paths may still show Y-specific bugs if they silently derive normal from `axisA x axisB` instead of using the explicit semantic normal.

## State Creation And Normalization

### Persisted Contract

`src/pages/types.ts` defines the persisted section fields. Relevant fields include:

- `sceneSectionEnabled`
- `sceneSectionMode`
- `sceneSectionTargetScope`
- `sceneSectionActiveAxis`
- `sceneSectionPlanes`
- `sceneSectionWindowEnabled`
- `sceneSectionWindowActiveAxis`
- `sceneSectionWindowByAxis`
- `sceneSectionFrameEnabled`
- `sceneSectionActiveFrameId`
- `sceneSectionFrames`
- `sceneSectionFrameByAxis`
- `sceneSectionTargetLayerIds`
- `sceneSectionTargetProductIds`
- helper/legend/visibility settings

Important inconsistency: `sceneSectionWindowActiveAxis` is typed as `"x" | "y"`, while `sceneSectionWindowByAxis` has X/Y/Z-shaped storage. This is a legacy X/Y-only window model living beside newer X/Y/Z frame state.

### Effective Style Normalization

`normalizeEffectiveSceneSectionStyle()` cleans up one known stale built-in state:

- if `sceneSectionActiveFrameId` is a built-in id like `axis:x`
- and `sceneSectionActiveAxis` is a different axis
- it rewrites the active frame id to match the active axis

It also normalizes explicit built-in frame entries by syncing their axis and plane from `sceneSectionPlanes`.

Open risk: normalization does not fully reconcile every redundant section-wide field:

- `sceneSectionWindowActiveAxis`
- `sceneSectionWindowByAxis`
- `sceneSectionFrameByAxis`
- `sceneSectionFrames`
- `sceneSectionTargetScope`
- `sceneSectionTargetLayerIds`
- `sceneSectionTargetProductIds`
- source-face basis fallback versus built-in basis fallback

Therefore a page/env/preset/editor path can still produce a style where active axis, active frame id, window active axis, frame axis, target ids, and built-in frame ids are only partly synchronized.

### Bypass Risk

The audited paths generally use effective style for runtime application. However, transition setup and editor paths manipulate raw style objects, layer patches, or page/env-derived structures before normalization. Any path that stores or compares raw style can preserve contamination long enough to influence:

- frame partition signatures
- discrete transition classification
- target layer/product resolution
- active axis selection
- helper snapshot contents

## Editor And Patch Contamination

### SceneSectionPlanesContainer Writes

`SceneSectionPlanesContainer.tsx` has a broad `setFrameEntryPatch` write path. For built-in frames it can write:

- `sceneSectionActiveAxis`
- `sceneSectionPlanes`
- `sceneSectionFrameByAxis`
- `sceneSectionActiveFrameId`
- legacy X/Y window state for built-in X/Y

The "Set active" action writes active axis and active frame id, but does not necessarily rewrite window active axis, window geometry, target scope, or target ids. That can leave valid-looking state where the active frame and legacy window axis disagree.

### EditorContext Writes

`EditorContext.tsx` section plane commit handlers write active axis/frame, built-in `sceneSectionFrames`, and `sceneSectionPlanes`. Window commit handlers also write active axis/frame and `sceneSectionFrameByAxis`, but legacy window write support is only for X/Y.

Risk: Z has no equivalent legacy window active-axis path, while X/Y can carry stale window geometry forward.

### Seismic Capability Preset Paths

`SeismicCapabilityLayerContainers.tsx` contains preset/linked-layer patch behavior that can force scene-section state. The seismic depth-window patch can set:

- `sceneSectionEnabled: true`
- `sceneSectionWindowEnabled: true`
- `sceneSectionActiveAxis: "y"`
- `sceneSectionActiveFrameId: "axis:y"` or a current Y frame
- `sceneSectionTargetScope: "selected-targets"`
- `sceneSectionTargetLayerIds` including the seismic browser layer
- `sceneSectionTargetProductIds` including the active seismic product

But that patch does not necessarily update:

- `sceneSectionWindowActiveAxis`
- the Y frame geometry
- all built-in frame entries
- all legacy window fields

This can create a page that appears to be a Y section but inherits stale X/Y window values, target state, or built-in frame geometry from previous operations.

### Can A Patch Leave Section State Out Of Sync?

Yes. Based on the audited editor/preset paths, a patch can plausibly leave these fields out of sync:

- active axis
- active frame id
- window active axis
- frame axis
- built-in frame id
- target scope
- target layer ids
- target product ids
- legacy window bounds
- frame-by-axis bounds

This does not prove editor contamination is the primary bug, but it is a credible contributor and should be verified before deleting all section data.

## Runtime Resolution And Rendering

### Resolution Flow

Runtime section state flows through these key paths:

1. effective page/env/layer style
2. `normalizeEffectiveSceneSectionStyle`
3. `sceneSectionResolvedFrameEntries`
4. `resolveSceneSectionFrames`
5. `resolveSceneSectionPlanes`
6. `sceneSectionFrameClippingPlanes`
7. `applySceneSectionPlanes`
8. helper rebuild or transition-frame apply

### Data Clipping

Data clipping uses resolved planes and frame clipping planes:

- active clipping planes
- frame clipping planes
- layer targets
- product targets
- target scope
- scalar and seismic shader/material uniforms

In transition frames, this path is active. Live readback showed interpolated Y plane/frame data advancing during the 180 -> 181 transition.

### Helper Visuals

Helper visuals include:

- outline/ribbon/frame helpers
- cones/handles
- labels
- ground trace
- Section ISO cut overlays

In non-transition frames, helper visuals are rebuilt by `rebuildSceneSectionHelpers`. In transition frames, `applySceneSectionPlanes` is called with `transitionFrame: true`, and helper rebuild is intentionally skipped. The transition system uses snapshots and helper opacity instead.

Observed live:

- settled page 180: helper group child count 2 (`Y Section frame push/pull controls`, `Y Section`)
- transition 180 -> 181: helper group child count 6 (X/Y/Z controls and section labels), with helper snapshot active
- settled page 181: helper group child count 6 after rebuild

### Why Helper Visuals Can Disagree With Data Clipping

During the transition:

- the data clipping path used interpolated Y state
- helper rebuild was skipped
- the helper group still contained controls at source or snapshot positions
- opacity and snapshot state controlled visibility

Concrete live readback:

- early transition Y data frame center: `[-54644.717, 11451.524, 11225.758]`
- late transition Y data frame center: `[-54644.717, 13979.383, 44905.303]`
- late transition visible Y controls still reported source-like position: `[-54644.717, 10492.84, -1547.125]`

This is not just theoretical. In the current local runtime, the transition has a period where helper visuals and section data state are not the same object at the same position.

## Saved Page State: 180 And 181

### Page 180: `Y issue 1`

Local page 180 state:

- id: `180_page`
- title: `Y issue 1`
- `sceneSectionEnabled: true`
- `sceneSectionActiveAxis: "y"`
- `sceneSectionActiveFrameId: "axis:y"`
- `sceneSectionWindowActiveAxis: "y"`
- `sceneSectionTargetScope: "selected-targets"`
- target layers:
  - MT resistivity volume
  - MT slices
  - seismic browser layer
- target product:
  - `gdr-1141-forge3d-ani-psdm-stack-unenh`
- active planes:
  - X disabled
  - Y enabled at about `10492.8397`
  - Z disabled
- frame entries:
  - X exists but inactive, cardinal/latlon-like basis
  - Y exists and active, UTM basis
  - Z exists but inactive, UTM basis
- legacy `sceneSectionWindowByAxis` exists for X/Y only

Settled live readback for page 180:

- Y plane normal: `[0, 1, 0]`
- Y axisA: `[1, 0, 0]`
- Y axisB: `[0, 0, 1]`
- `axisA x axisB`: `[0, -1, 0]`
- dot with normal: `-1`
- Y semantic basis is left-handed
- visible Y helper control transform determinant: `+1`
- visible helper local X: `[1, 0, 0]`
- visible helper local Y: `[0, 0, 1]`
- visible helper local Z: `[0, -1, 0]`

Interpretation: the semantic frame is left-handed, but the current helper control orientation is a proper transform. In this local runtime, settled page 180 did not show the helper control transform as a raw reflected Y basis.

### Page 181: `Y issue 2`

Local page 181 state:

- id: `181_page`
- title: `Y issue 2`
- `sceneSectionEnabled: true`
- `sceneSectionActiveAxis: "x"`
- `sceneSectionActiveFrameId: "axis:x"`
- `sceneSectionWindowActiveAxis: "x"`
- target scope inherited/effective as `all-visible`
- local page lacks explicit target layer/product fields, so effective state inherits environment defaults for some display fields
- active planes:
  - X enabled
  - Y enabled at about `14232.0884`
  - Z enabled
- frame entries:
  - X enabled
  - Y enabled
  - Z enabled

Settled live readback for page 181:

- Y plane normal: `[0, 1, 0]`
- Y axisA: `[1, 0, 0]`
- Y axisB: `[0, 0, 1]`
- dot with normal: `-1`
- visible Y helper control transform determinant: `+1`
- visible Y helper position: `[-54644.717, 14232.088, 48272.183]`

Interpretation: page 181 has all three axes visible and active. Y still has left-handed semantic basis but current helper transform is corrected at settled state.

## Transition 180 -> 181

### Effective Section-Wide Changes

The transition is not frame-only. Section-wide semantics change:

| Field | Page 180 | Page 181 |
| --- | --- | --- |
| active axis | y | x |
| active frame id | axis:y | axis:x |
| window active axis | y | x |
| target scope | selected-targets | all-visible |
| target layer ids | MT volume, MT slices, seismic browser | MT volume, MT slices or all-visible resolved set |
| target product ids | seismic product | inherited/empty under all-visible resolution |
| active planes | Y only | X, Y, Z |

### Frame Partition

The frame partition for page 180 -> 181 classifies:

- moving frames: `axis:y`
- dissolve frames: `axis:x`, `axis:z`

This happens because Y exists in both pages with the same geometry identity but different position/bounds, while X/Z are enabled/added/changed in the target.

### Important Policy Interaction

`transitionEffectiveLayersForPage.ts` has a fallback that dissolves all active frames when non-frame section semantics change and no frames are otherwise dissolving. In this case, X/Z are already dissolve frames, so Y is allowed to continue as a moving frame even though section-wide semantics changed.

That creates a mixed transition:

- Y is moving from source to target
- X/Z are dissolving in/out
- active axis is already target-shaped as X
- target scope is already target-shaped as all-visible
- layer/product target semantics are already target-shaped
- helper geometry is snapshot-driven and not rebuilt every tick

This is the highest-confidence contamination mechanism for the reported "1 bleeds into 2" transition symptom.

### Live Runtime Transition Readback

At early transition sample:

- transition active
- source page: 180
- target page: 181
- progress about `0.256`
- style active axis: X
- active frame id: `axis:x`
- target scope: `all-visible`
- active planes: X/Y/Z
- moving frame ids: `axis:y`
- dissolve frame ids: `axis:x`, `axis:z`
- helper snapshot active
- helper rebuild time: `0`
- helper group child count: `6`

At late transition sample:

- progress about `0.932`
- Y data plane/frame continued to interpolate
- helper snapshot still active
- helper opacity was ramping
- visible helper controls still included source-like Y control position

This means the transition carries a moving Y data state while helper visuals and section-wide semantics are not strictly source-preserved or target-preserved as a whole.

## Render Stack Trace

The visual runtime guardrail requires a render-stack trace. Static and runtime readback for pages 180 and 181 showed:

### Environment And Render Preset

- active render preset id: `null`
- selector source: none
- project render presets: none
- page `envSnapshot`: not present
- scene patch: empty `{}` for render preset authority
- page scene overrides include terrain/fog/background state but no render preset id

### Terrain/Texture/Material

- material preset: `image:naip-2024-aerial`
- shader/material path: `terrainMaterial/topo-image`
- active texture URL:
  - `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=684f5a7e42719aa9`
- cache key:
  - `v=684f5a7e42719aa9`
- texture bounds:
  - `[229069.2, 4094688, 598806, 4414308]`

### Public Surface Clip

- public clip enabled: `true`
- center: `[21000, 21000, 2000]`
- size: `[1599600, 1399600, 50000]`
- rotation: `0`
- shape: `box`

### Material Edge Fade And Outline

- edge fade shape: `rounded-square`
- edge fade distance: `90000`
- edge fade inset: `40000`
- edge fade corner radius: `140000`
- edge outline enabled: `false`

### Mesh Geometry

- geometry source: runtime terrain mesh
- project bounds min: `[-167484.78, -136733.4, -122114]`
- project bounds max: `[167484.78, 136733.4, 3449.131]`
- LOD/texture family: `8192`

Assessment: terrain texture/material/clip state is not the primary candidate for the Y helper/cut-plane issue. It can influence visual perception but does not explain the Y left-handed basis or the transition section-state mismatch.

## Section Runtime Path Classification

### Uses Plane Normal

- clipping plane construction
- scalar material clipping uniforms
- seismic material clipping uniforms
- section frame clipping planes
- signed distance calculations

Risk: if any of these derive normal from `axisA x axisB`, Y flips. If they use explicit semantic normal, Y is stable.

### Uses Tangent Basis

- frame bounds along A/B
- source face basis
- frame outline and helper local axes
- helper label/controls positioning

Risk: tangent basis is fine for a plane coordinate system, but not automatically fine as a rotation matrix unless handedness is repaired.

### Uses Quaternion / Matrix Basis

- helper control groups
- helper outlines/cones/labels
- potentially labels or child geometries that assume a right-handed parent transform

Highest Y-specific risk lives here.

### Uses Frame Id / Active Axis

- active helper display
- editor active-frame writes
- normalization
- transition discrete signatures
- page state comparisons

Risk: active axis and active frame id can be normalized in one direction while window active axis, target scope, and legacy window state remain stale.

### Uses Source Face Basis

- seismic source-face section frame
- selected seismic fence/slice basis fallback
- fallback visible source basis

Risk: source-face fallback is right-handed/normalized, while built-in Y fallback is left-handed. A page can therefore behave differently depending on whether it resolves through source-face basis or built-in basis.

### Uses Legacy Window State

- legacy X/Y window state and active window axis
- window commit paths

Risk: X/Y legacy state has no equivalent Z semantics, so the three axes are not backed by symmetrical persisted state.

## Drive Snapshot Findings

Drive folder checked:

`https://drive.google.com/drive/folders/1fqqD7GJaWwgtNOKyFDhcI8reTJzN7BZJ`

Connector listing showed:

- root is a full repo-like snapshot
- `Y Axis issue` folder exists but listed empty
- `projects/utah-forge/pages` contains:
  - `180_page.json`
  - `181_page.json`
  - `177_page.json`
  - `178_page.json`
  - `179_page.json`
  - many modified existing pages
- `projects/utah-forge/project.json` and `environment.json` exist
- `src/scene/section/sceneSectionController.ts` exists and was modified at snapshot time

Audit implication:

- Other agents reviewing Drive may not see the local untracked Markdown reports in `C:\GeoSee\GeoSee_Dev\Y Axis issue`.
- Other agents reviewing Drive do have access to the issue pages and source tree.
- Local runtime evidence may include local dirty patches that need content comparison against Drive before assuming both environments match.
- If other agents cannot run the program, they should treat the Drive snapshot as a static code/page snapshot and the local report as runtime evidence from one dirty checkout.

## Contamination And Inconsistency Candidates

### High-Relevance Candidates

- raw Y built-in basis is left-handed
- helper orientation patch exists locally and may or may not exist in the exact code bundle other agents inspect
- transition 180 -> 181 mixes moving Y with dissolving X/Z and section-wide semantic changes
- helper visuals are snapshot/fade driven during transition while data clipping uses interpolated state
- target scope changes `selected-targets -> all-visible`
- target layer/product semantics change while Y is moving
- active axis changes from Y to X while Y is the only moving frame

### Medium-Relevance Candidates

- active axis and active frame id can be normalized without fully normalizing legacy window axis
- source-face fallback basis differs from built-in fallback basis
- seismic depth-window patch can force Y active without updating all legacy frame/window fields
- linked layer style patches can write to scene-section layer from outside the section editor
- page 181 lacks local target ids and resolves all-visible behavior differently at runtime
- legacy X/Y window state has no Z equivalent

### Diagnosis Noise

- untracked saved pages 177-181
- untracked overlays
- bulk page JSON edits
- `project.json` page-order movement
- docs/tests asserting intended behavior that are themselves dirty
- helper-orientation patch present locally but not yet visually confirmed by the user
- Drive snapshot versus local dirty tree drift
- camera/dynamic pose patch may change visual interpretation
- cached browser assets may show old code if the app is not rebuilt/refreshed against the current dirty source

## Ranked Findings And Next Checks

### High Confidence: Built-In Y Basis Is Left-Handed

Evidence:

- X determinant: `+1`
- Y determinant: `-1`
- Z determinant: `+1`
- live resolved Y frame reports `axisA x axisB` opposite the semantic normal

Affected axes:

- Y only as a built-in basis problem

Possible symptom:

- any helper/control/cone/label path using raw `axisA`, `axisB`, `normal` as a rotation can rotate, mirror, or appear coplanar with another helper plane

Recommended verification:

- keep a source test that documents X/Y/Z determinants
- assert that every `Matrix4.makeBasis` helper basis is proper/right-handed
- visually confirm the current helper-orientation patch in a clean browser load

### High Confidence: Current Local Helper Orientation Patch Is Active For Settled Pages

Evidence:

- source patch computes orientation normal from `tangentA x tangentB`
- local source test passes
- live settled page 180 and page 181 Y helper transforms report determinant `+1`

Affected axes:

- Y primarily; all axes pass through helper orientation code

Possible symptom:

- if an agent looks only at the raw Y basis, they may conclude the settled helper is still wrong even though current local runtime has a helper patch active
- if the user/browser sees old behavior, cache or Drive/local code drift becomes likely

Recommended verification:

- compare the loaded browser bundle/source map or rebuild state against the local dirty `sceneSectionController.ts`
- compare Drive `sceneSectionController.ts` content with local source if agents diagnose from Drive

### High Confidence: 180 -> 181 Transition Mixes Moving Frame And Section-Wide Semantic Changes

Evidence:

- moving frame ids: `axis:y`
- dissolve frame ids: `axis:x`, `axis:z`
- active axis changes `y -> x`
- active frame changes `axis:y -> axis:x`
- target scope changes `selected-targets -> all-visible`
- target ids change
- fallback "non-frame semantic change dissolves all" does not trigger because X/Z already dissolve

Affected axes:

- all axes in the transition
- Y is especially affected because it moves while active semantics target X

Possible symptom:

- page 1 appears to bleed into page 2
- Y cut position moves while helper visuals and target scope already behave like page 2
- X/Z helpers or cuts appear to fade in while Y still carries source semantics

Recommended verification:

- create a synthetic source test where Y moves, X/Z add/remove, active axis changes, target scope changes, and target ids change
- decide whether this should force all frames to dissolve or preserve separate source/target section-wide mask contexts

### High Confidence: Transition Helper Visuals And Data Clipping Can Disagree

Evidence:

- `applySceneSectionPlanes` is called with `transitionFrame: true`
- helper rebuild is skipped during transition
- live readback showed Y data frame center moving while helper controls stayed source-positioned until settled
- helper snapshot active during transition

Affected axes:

- all axes during transitions
- Y most visible in this repro because it is the moving frame

Possible symptom:

- section cut and helper frame do not line up mid-transition
- source frame appears to remain while target planes/cuts are already active
- user perceives bleed or wrong plane even if settled state is corrected

Recommended verification:

- add runtime debug readback or a screenshot overlay that plots data plane center and helper control center during transition
- keep this diagnostic default-off and remove/disable it after use

### Medium Confidence: Editor/Preset Writes Can Contaminate Section State

Evidence:

- `setFrameEntryPatch` writes many but not all redundant fields
- "Set active" can update active axis/frame without legacy window axis
- seismic depth-window patch forces Y active and selected target ids
- linked layer patches can write scene-section state from outside the section editor

Affected axes:

- X/Y via legacy window paths
- Y via seismic preset forcing
- Z via lack of legacy window symmetry

Possible symptom:

- active axis, active frame id, window active axis, frame axis, target ids, and built-in frame id disagree
- page looks like it is on one axis while clipping/helpers resolve from another

Recommended verification:

- source test for active axis/frame/window normalization across `axis:x`, `axis:y`, `axis:z`
- source test proving linked seismic presets cannot leave section active axis/frame/window inconsistent

### Medium Confidence: Page 181 Target Scope Changes Runtime Target Resolution

Evidence:

- page 181 effective style uses `all-visible`
- live transition readback resolved layer targets as a broad visible set, not just authored target ids
- product targets were empty under all-visible resolution

Affected axes:

- all active planes and frames on page 181

Possible symptom:

- section cuts apply to a different object/product set after transition than source page
- source selected-targets semantics and target all-visible semantics overlap in transition

Recommended verification:

- trace `layerTargets` and `productTargets` in source and target mask contexts separately during transition
- do not fix by editing page target ids; fix policy/normalization if behavior is wrong

### Medium Confidence: Source-Face Fallback Can Hide Or Expose The Y Basis Issue

Evidence:

- source-face basis is normalized/right-handed
- built-in Y basis is left-handed
- runtime can choose source face frame for seismic browser target cases

Affected axes:

- Y when switching between seismic source-face basis and built-in basis
- all axes if source-face resolution is inconsistent across pages

Possible symptom:

- Y appears correct for one target/source combination but wrong when fallback changes

Recommended verification:

- inspect whether page 180 and 181 resolve Y through source-face frame or built-in fallback under their effective target scopes
- add a source test that verifies source-face fallback and built-in fallback produce intentionally documented orientations

### Low Confidence: Terrain/Render Preset Is Primary

Evidence:

- render preset was null
- terrain material/texture/public clip consistent across pages
- no terrain/material state explains the Y determinant or transition partition

Affected axes:

- none directly

Possible symptom:

- camera/terrain can affect perception but should not create Y/Z coplanar helper math

Recommended verification:

- no behavioral fix should target terrain/material unless a separate visual trace shows terrain-specific clipping is involved

## Source Guards To Add Later

Do not implement these as part of this audit. They are recommended guardrails before further fixes:

1. A source test that asserts X/Y/Z built-in bases and determinant/handedness are documented and intentionally handled.
2. A source test that every helper quaternion basis passed to `Matrix4.makeBasis` is proper/right-handed.
3. A source test for active axis/frame/window normalization across `axis:x`, `axis:y`, and `axis:z`.
4. A synthetic transition fixture where:
   - Y exists on both pages and should move
   - X/Z are added or removed
   - target scope changes
   - target layer ids change
   - expected behavior is explicit: either all frames dissolve due to section-wide semantic change, or source/target mask contexts preserve their own section-wide semantics
5. A source test proving linked seismic presets cannot leave scene-section active axis/frame id/window axis inconsistent.
6. A runtime-only debug readback, default off, that records data plane centers and helper group centers during scene-section transitions.

## What Not To Do Yet

- Do not purge section data until source/runtime causes above are resolved or disproven.
- Do not fix by editing `projects/*/pages/**`.
- Do not fix by manually changing `project.json` page order.
- Do not assume page 180/181 are clean fixtures.
- Do not assume Drive snapshot and local runtime are identical.
- Do not assume the raw Y handedness issue fully explains the current transition bleed.
- Do not leave any debug overlay active by default.

## Current Best Explanation

The issue is likely a combination of two layers:

1. A real base-logic asymmetry: built-in Y is left-handed while X/Z are right-handed. Any helper path that consumes raw Y as a rotation can render the Y helper in a wrong or misleading orientation. A local patch appears to correct this for settled helper controls, but the underlying semantic basis remains left-handed and must stay guarded.
2. A transition-policy problem: page 180 -> 181 changes section-wide semantics while allowing Y to move and X/Z to dissolve. During this transition, data clipping moves through interpolated state while helper visuals are snapshot/fade driven and not rebuilt every tick. That can produce exactly the kind of bleed and plane mismatch the user is reporting, even if settled helpers are now corrected.

If the user still sees the settled Y frame on the wrong plane in the current browser, the next audit target is not page JSON first. It is loaded-code drift: cached bundle, stale dev server, Drive snapshot versus local dirty tree mismatch, or a different helper/overlay path drawing a second Y-related visual that the runtime readback did not classify as the section helper group.

## Explicit All-Issues Inventory Addendum - 20260613

This addendum makes every inconsistency, bug candidate, contamination source, and verification gap explicit so follow-on agents do not have to infer them from the longer audit narrative. These are not all proven root causes. They are the full set of issues found or plausible enough to keep in the diagnosis set.

### Confirmed Base-Logic Issues

| Issue | Classification | Evidence | Why It Matters |
| --- | --- | --- | --- |
| Built-in Y basis is left-handed while X/Z are right-handed | confirmed base-logic asymmetry | determinant table: X `+1`, Y `-1`, Z `+1` | any consumer that treats Y `axisA`, `axisB`, and normal as a rotation basis can mirror or rotate helper visuals |
| Y semantic normal differs from `axisA x axisB` | confirmed math inconsistency | Y `axisA x axisB = -normal` | clipping paths that use explicit normal may disagree with helper paths that derive normal from tangents |
| Axis behavior is not symmetrical across X/Y/Z | confirmed design inconsistency | X/Z proper, Y improper; legacy window axis is X/Y only | bugs can hide on X/Z tests and appear only on Y or when Z enters newer frame paths |

### Confirmed Runtime Behavior Issues

| Issue | Classification | Evidence | Why It Matters |
| --- | --- | --- | --- |
| Transition 180 -> 181 changes section-wide semantics while Y moves | confirmed transition-policy problem | active axis `y -> x`, frame `axis:y -> axis:x`, target scope `selected-targets -> all-visible`, Y classified moving | explains bleed where Y carries source motion while target semantics are already active |
| X/Z dissolve while Y moves in the same section transition | confirmed mixed transition behavior | partition reports moving `axis:y`, dissolve `axis:x`, `axis:z` | all-section semantics are not preserved as one coherent source or target context |
| Helper visuals and data clipping can diverge during transition | confirmed runtime divergence | data Y center interpolates while visible Y controls remain source-positioned until settled rebuild | explains section cut and helper frame not lining up mid-transition |
| Helper rebuild is skipped during transition frames | confirmed runtime behavior | `applySceneSectionPlanes(... transitionFrame: true)` reports helper rebuild `0` | transition correctness depends on snapshots and masks, not live helper geometry |
| Target scope resolution changes object/product targets | confirmed runtime behavior | page 181 resolves `all-visible`, broader layer target set, empty product targets | data clipping may apply to a different set of objects in target than source |

### Confirmed State-Model Inconsistencies

| Issue | Classification | Evidence | Why It Matters |
| --- | --- | --- | --- |
| `sceneSectionWindowActiveAxis` is X/Y typed while frame state is X/Y/Z | confirmed persisted contract inconsistency | `src/pages/types.ts` window active axis lacks Z | Z can never be represented symmetrically through legacy window active-axis state |
| Active axis, active frame id, window active axis, and frame-by-axis can diverge | confirmed model risk | multiple redundant persisted fields, partial normalization | page can look active on one axis while resolving frame/window from another |
| Normalization only fixes some stale built-in frame ids | confirmed normalization gap | `normalizeEffectiveSceneSectionStyle()` handles active built-in frame id and some frame entries | stale target scope, window axis, target ids, and frame-by-axis state can survive |
| Legacy X/Y window state coexists with newer X/Y/Z frame state | confirmed compatibility risk | `sceneSectionWindowByAxis` exists beside `sceneSectionFrameByAxis` and `sceneSectionFrames` | old X/Y state can contaminate newer frame rendering or editor writes |

### Confirmed Editor And Patch Risks

| Issue | Classification | Evidence | Why It Matters |
| --- | --- | --- | --- |
| Built-in frame editor writes update many but not all related fields | confirmed editor-write risk | `setFrameEntryPatch` writes planes/frameByAxis/active fields and some legacy X/Y state | partial writes can create internally inconsistent section state |
| "Set active" writes active axis/frame but not every related field | confirmed editor-write risk | active action does not fully rewrite target scope/window/legacy state | active axis can change while old window or target state remains |
| Seismic depth-window patch forces Y active | confirmed preset contamination risk | seismic preset writes `sceneSectionActiveAxis: "y"` and Y active frame/targets | presets can create Y section state outside the section editor |
| Linked layer style patches can write scene-section state indirectly | confirmed patch contamination risk | `linkedLayerStylePatches` are committed to target layer styles | another layer's preset can mutate scene-section behavior without an obvious section edit |

### Confirmed Dirty-Tree And Snapshot Contamination

| Issue | Classification | Evidence | Why It Matters |
| --- | --- | --- | --- |
| Local repo contains many dirty source/runtime/docs/test/page files | confirmed contamination source | `git status --short` showed broad dirty set | current runtime is not a clean baseline |
| Pages 177-181 are untracked local state | confirmed page-state contamination | untracked page files exist locally and Drive pages include 180/181 | reproduction pages are evidence, not stable fixtures |
| Bulk Utah page JSON edits exist | confirmed page-state contamination | many tracked Utah page JSON files modified | unrelated page edits can alter comparisons, transitions, and authoring assumptions |
| `project.json` page order is dirty | confirmed navigation/transition contamination | page order changed to place 180/181 near the end | observed transition route depends on dirty project ordering |
| Untracked overlays exist | confirmed page-state contamination | overlays for 178/179/181 are untracked | overlays can confuse visual diagnosis if they draw section-adjacent content |
| Drive `Y Axis issue` folder listed empty while local folder has reports | confirmed Drive/local drift | Drive connector listed no files under Drive Y folder | other agents may not see the same audit docs unless given local report text |
| Drive snapshot is a full repo-like copy, not just the issue docs | confirmed snapshot variable | Drive root includes `.git`, `src`, `projects`, `docs`, `dist`, pages | agents may inspect a different state from local runtime unless hashes/content are compared |

### Confirmed Verification Gaps

| Gap | Classification | Evidence | Why It Matters |
| --- | --- | --- | --- |
| No human visual acceptance in this audit | explicit verification gap | runtime readback was automated, not user-confirmed visual acceptance | report should say ready for visual check, not visually fixed |
| No full Drive/local content hash comparison | explicit verification gap | Drive was folder-listed and scoped, not byte-compared to local source | Drive snapshot may have different source code than local runtime |
| No clean-tree reproduction | explicit verification gap | local tree is dirty and untracked pages drive the repro | bug classification may change on clean main |
| No browser cache/bundle provenance check | explicit verification gap | runtime readback used existing dev server | if user sees old settled Y behavior, loaded-code drift is still plausible |
| No page-data purge performed | explicit scope constraint | audit-only request | report does not prove purge is or is not needed, only that it should not be first response |

### Plausible But Not Yet Proven Bug Candidates

| Candidate | Classification | Evidence | Why It Remains In Scope |
| --- | --- | --- | --- |
| A second visual path draws Y-related geometry outside the helper group | possible bug | runtime helper group looked corrected, but user still reports wrong visual | another overlay, ISO cut, cone/ribbon path, or stale helper could be visible |
| Source-face fallback and built-in fallback behave differently for Y | possible bug | source-face basis is normalized/right-handed, built-in Y basis is left-handed | page target scope can change which basis path resolves |
| Section ISO cut overlays may carry source/target mismatch | possible bug | Section ISO is part of scene-section transition contract | if overlays use different mask semantics, they can look like bleed |
| Ribbon/edge thickness or cones may still consume raw Y basis somewhere | possible bug | helper root is patched, but every child/path must be checked | child geometry could still encode assumptions about local axes |
| Dynamic camera pose changes may affect perceived plane/coplanarity | possible perception bug | `src/pages/dynamicCameraPose.ts` is dirty | camera changes can make separate planes appear aligned or narrow |
| Terrain/material state may affect perception, not root math | low-confidence candidate | render stack was traced and looked consistent | keep as context, not primary diagnosis |

### Items That Should Not Be Treated As Fixes

- Editing page 180 or 181 section state.
- Editing `project.json` page order.
- Purging section data before source/runtime causes are resolved or disproven.
- Treating source tests in the dirty tree as external proof.
- Treating the helper-orientation patch as fully visually confirmed.
- Treating Drive snapshot and local dirty runtime as the same state.
- Treating terrain/material state as the primary root without new evidence.

## Verification Already Run

Static/source checks:

- `node tests/tools/scene-section-frame-orientation-source.test.mjs`
- `node tests/tools/scene-section-frame-partition-source.test.mjs`
- `node tests/tools/scene-section-transition-behavior-source.test.mjs`
- `node tests/tools/seismic-section-graph-basis.test.mjs`
- `node tests/tools/scene-section-legend-contract-source.test.mjs`
- `node tests/tools/seismic-editor-containers-source.test.mjs`
- `npm run check:pages`

Result: all listed checks passed in the local dirty tree.

Runtime checks:

- Playwright readback against existing `127.0.0.1:5173` dev server
- settled page 180
- transition page 180 -> 181
- settled page 181
- render-stack trace for pages 180/181

Result: runtime readback confirms the mixed transition semantics and helper/data divergence during transition. It also confirms settled Y helper controls are proper transforms in the current local runtime. This is not the same as human visual approval; final visual confirmation remains outstanding.
