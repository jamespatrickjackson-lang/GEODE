# YAXIS-AUDIT-20260613-8C7F - Y Axis Section Runtime Audit

Status: audit findings, audit plan, and recommendations. No runtime/source fix was made by this agent.

Scope:
- Reproduction pages: `projects/utah-forge/pages/180_page.json` (`Y issue 1`) and `projects/utah-forge/pages/181_page.json` (`Y issue 2`).
- Runtime surfaces reviewed: scene-section page state, effective-style normalization, editor write paths, section frame basis construction, helper outline/cone/ribbon construction, source-face basis selection, transition frame partitioning, and transition mask application.
- Working tree note: the checkout was already dirty before this audit, including uncommitted section/transition changes and untracked pages 177-181. Findings below describe the current working tree, not a clean `main` baseline.
- Visual status: no browser visual inspection was completed in this pass. Treat this as `ready for visual check`, not visually confirmed.

## Executive Findings

1. The saved page data is not the primary corruption source.
   - `Y issue 1` has only `axis:y` enabled. `axis:x` and `axis:z` are disabled.
   - `Y issue 2` has `axis:x`, `axis:y`, and `axis:z` enabled.
   - This supports diagnosing runtime basis/orientation and transition ownership before any section data purge.

2. The strongest Y-specific root cause is the built-in Y frame basis handedness.
   - X default basis: normal `+X`, axisA `+Y`, axisB `+Z`, determinant `+1`.
   - Y default basis: normal `+Y`, axisA `+X`, axisB `+Z`, determinant `-1`.
   - Z default basis: normal `+Z`, axisA `+X`, axisB `+Y`, determinant `+1`.
   - `Matrix4.makeBasis(tangentA, tangentB, normal)` followed by `Quaternion.setFromRotationMatrix` cannot represent the Y basis because it is a reflection, not a proper rotation. That can place the visible Y helper group on the X-Y plane, coincident with Z and 90 degrees from the real Y cut.

3. The actual cut plane and the visible helper frame are separate enough for the symptom to look contradictory.
   - Shader/clipping code uses resolved plane normals and frame planes.
   - The visible helper group uses a quaternion derived from tangent vectors.
   - Result: the data cut can be correct while the frame outline, cones, labels, axes, and ground trace render on the wrong plane.

4. The current working tree already contains an uncommitted DEC-165-style source fix for helper orientation.
   - Current code derives `orientationNormal = tangentA x tangentB` before `makeBasis`.
   - Narrow source tests pass.
   - This is not enough to claim the user-visible problem is gone; a fresh browser run must prove the app is loading this code and that `Y issue 1` / `Y issue 2` settle correctly.

5. A separate transition ownership gap remains likely for the 180 -> 181 page pair.
   - Effective page 180 target semantics: `selected-targets`, layer targets include MT volume, MT slices, and seismic browser, product target `gdr-1141-forge3d-ani-psdm-stack-unenh`.
   - Effective page 181 target semantics: inherited `all-visible`, layer targets from the environment resolve to MT volume and MT slices.
   - Current partition for 180 -> 181: `movingFrameIds = ["axis:y"]`, `dissolveFrameIds = ["axis:x", "axis:z"]`.
   - Non-frame semantic diffs also exist: target scope, target layer ids, active axis, active frame id, and window active axis.
   - Current code only dissolves all moving frames on a non-frame discrete change when there are no per-frame dissolves. In this real pair there are X/Z dissolves, so Y continues as a moving frame even though section target semantics changed.
   - The mask construction starts from an interpolated style based on `toStyle`, then only copies plane/frame/window/object-visibility state for dissolve frames. It does not copy source `sceneSectionTargetScope`, `sceneSectionTargetLayerIds`, `sceneSectionTargetProductIds`, `sceneSectionActiveAxis`, or `sceneSectionActiveFrameId` into the source mask context. That can make the source side of the dual mask use target semantics too early.

6. Source-face basis selection is a second Y-sensitive seam.
   - `sceneSectionSourceFaceFrame()` only applies to the active frame/axis and only when the seismic browser layer is targeted and has a selected section graph basis.
   - Page 180 is active Y and selected-targets with seismic targeted, so Y can use a source-derived seismic basis.
   - Page 181 is active X and all-visible, so Y is not the active source-face frame and can fall back to the built-in Y basis.
   - That means Y can switch between a right-handed source face and the left-handed default Y basis across the exact saved pages unless runtime state is carefully preserved.

## Saved Page Evidence

### `projects/utah-forge/pages/180_page.json` - `Y issue 1`

Key section state:

```json
{
  "sceneSectionEnabled": true,
  "sceneSectionActiveAxis": "y",
  "sceneSectionActiveFrameId": "axis:y",
  "sceneSectionPlanes": {
    "x": { "enabled": false, "positionM": -53897.008556379355, "invert": false },
    "y": { "enabled": true, "positionM": 10492.839725544189, "invert": false },
    "z": { "enabled": false, "positionM": 45914.29125976474, "invert": false }
  },
  "sceneSectionTargetScope": "selected-targets",
  "sceneSectionTargetLayerIds": [
    "utah-forge-mt-resistivity-volume",
    "utah-forge-mt-resistivity-slices",
    "utah-forge-phase3-seismic-browser"
  ],
  "sceneSectionTargetProductIds": [
    "gdr-1141-forge3d-ani-psdm-stack-unenh"
  ]
}
```

Interpretation:
- Page data says this is a Y-only section page.
- It should visually produce a vertical X-Z section plane, not an X-Y plane.
- If the visible helper is flat in Z, the helper orientation is wrong even if the actual cut is correct.

### `projects/utah-forge/pages/181_page.json` - `Y issue 2`

Key section state:

```json
{
  "sceneSectionEnabled": true,
  "sceneSectionActiveAxis": "x",
  "sceneSectionActiveFrameId": "axis:x",
  "sceneSectionPlanes": {
    "x": { "enabled": true, "positionM": -53897.008556379355, "invert": false },
    "y": { "enabled": true, "positionM": 14232.088418787964, "invert": false },
    "z": { "enabled": true, "positionM": 45914.29125976474, "invert": false }
  }
}
```

Effective inherited target state:

```json
{
  "sceneSectionTargetScope": "all-visible",
  "sceneSectionTargetLayerIds": [
    "utah-forge-mt-resistivity-volume",
    "utah-forge-mt-resistivity-slices"
  ],
  "sceneSectionTargetProductIds": [
    "gdr-1141-forge3d-ani-psdm-stack-unenh"
  ]
}
```

Interpretation:
- The visible X, Y, and Z helpers should be three mutually perpendicular planes.
- Expected flat dimensions:
  - X frame: thin along X, wide in Y/Z.
  - Y frame: thin along Y, wide in X/Z.
  - Z frame: thin along Z, wide in X/Y.
- If Y and Z both appear on the same X-Y plane, Y helper orientation is wrong.

## Static Render-Stack Trace

This is a static trace from page/environment JSON, not a live browser trace.

Common to both saved pages:
- `environment.scene`: resolved from `projects/utah-forge/environment.json`, with page-local `sceneOverrides` for light mode, background, fog, and terrain.
- Sub Master `envSnapshot`: absent on both pages.
- Render preset: no page `renderPreset` or `renderPresetId` override found. Effective preset falls back to environment/project defaults.
- Page `sceneOverrides`: `lightMode`, `background`, `lightModeBackground`, `fog`, `terrain`.
- Terrain material preset: `image:naip-2024-aerial`.
- Active topo texture URL/cache key:
  - 4096: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_4096.webp?v=71d894cdd3c0c64b`
  - 8192: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=684f5a7e42719aa9`
- Topo texture bounds: `[229069.2, 4094688, 598806, 4414308]`.
- Public clip state: no page-local public clip fields found in the static trace.
- Material edge fade state: `edgeFadeDistanceM = 90000`, `edgeFadeShape = rounded-square`, `edgeFadeInsetM = 40000`, `edgeFadeCornerRadiusM = 140000`, `orthoPhotoEdgeFadeDistanceM = 25000`.
- Edge outline state: `edgeOutlineEnabled = false`.
- Section helper materials/geometries:
  - Frame outline: local outline geometry under `rebuildSceneSectionHelpers()`.
  - Push/pull and frame handles: `THREE.ConeGeometry` visual cones, plus invisible `THREE.BoxGeometry` pick proxies.
  - Dashed ground trace: world-space ribbon mesh from `buildSceneSectionDashedTraceRibbonGeometry()`.
  - Labels and scale axes: planar text/line helpers using the frame quaternion.
- Shader/material sectioning:
  - Terrain and shader materials receive `setSceneSectionUniforms(...)`.
  - Built-in materials use `sceneSectionObjectVisibilityShader`.

## Axis Construction Review

Default axis specs in `src/scene/section/sceneSectionController.ts`:

| Axis | Normal | axisA | axisB | Raw determinant | Expected visual plane | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| X | +X | +Y | +Z | +1 | Y-Z, thin X | Low |
| Y | +Y | +X | +Z | -1 | X-Z, thin Y | High |
| Z | +Z | +X | +Y | +1 | X-Y, thin Z | Low |

The Y basis is the only built-in axis where `axisA x axisB = -normal`.

Consequences:
- `Matrix4.makeBasis(axisA, axisB, normal)` is valid for X/Z and invalid for Y.
- Y helper orientation must use a proper third column derived from `axisA x axisB`, while the real plane normal must still be used for clipping and camera-facing text decisions.
- Changing `sceneSectionBasisVectors()` itself to make Y right-handed would flip Y's authored B extent convention and reinterpret existing saved pages. That is a risky migration. The safer permanent repair is to make every quaternion construction require a proper basis without changing authored extents.

## Ribbon, Edge Thickness, and Cone Review

Ribbon/trace path:
- `buildSceneSectionDashedTraceRibbonGeometry(points, widthM, planeNormal)` builds a world-space ribbon by crossing segment direction with `planeNormal`.
- It can make the trace look thicker or thinner, but it does not explain a 90-degree plane rotation by itself.

Cone path:
- The visible push/pull/frame handles are real `THREE.ConeGeometry`.
- The `BoxGeometry` is an invisible pick proxy with opacity `0`.
- If handles look like cubes or flat blocks, the likely cause is material/lighting rebuild or group orientation, not a geometry swap.

Frame outline and labels:
- These are the highest-risk visuals because they sit in a local helper group oriented by `planeQuaternion`.
- A bad Y quaternion moves all child visuals together: outline, cones, labels, scale axes, and possibly ground trace labels.

## Transition Ownership Review

Current intended contract:
- Section masks are transition-scene channels, not ordinary layer transitions.
- Numeric frame geometry should move by stable frame id.
- Added/removed or identity-changed frames should dissolve.
- Active-to-inactive/unrelated target pages must not carry source section helpers.

Current working-tree implementation:
- `sceneSectionFramePartition()` returns per-frame `movingFrameIds` and `dissolveFrameIds`.
- For 180 -> 181, it returns:

```json
{
  "movingFrameIds": ["axis:y"],
  "dissolveFrameIds": ["axis:x", "axis:z"]
}
```

Important gap:
- The same 180 -> 181 transition also changes non-frame section semantics:

```json
{
  "sceneSectionTargetScope": {
    "from": "selected-targets",
    "to": "all-visible"
  },
  "sceneSectionTargetLayerIds": {
    "from": [
      "utah-forge-mt-resistivity-volume",
      "utah-forge-mt-resistivity-slices",
      "utah-forge-phase3-seismic-browser"
    ],
    "to": [
      "utah-forge-mt-resistivity-volume",
      "utah-forge-mt-resistivity-slices"
    ]
  },
  "sceneSectionActiveAxis": {
    "from": "y",
    "to": "x"
  },
  "sceneSectionActiveFrameId": {
    "from": "axis:y",
    "to": "axis:x"
  }
}
```

Risk:
- A section-wide semantic change should not be silently treated as a pure Y frame move just because X/Z also dissolve.
- Current mask source/target style construction appears to copy only frame-local state for dissolve ids. Non-frame source semantics can be lost in the source side of the dual mask.
- That is a credible explanation for "1 bleeds into 2" or a transition where page 1 state appears inside page 2.

## Recommendations

1. Do not purge section data yet.
   - The saved pages are useful reproductions.
   - The Y symptom has a strong runtime explanation.
   - Purging saved section data would not fix a helper quaternion reflection or target-scope transition ownership bug.

2. Confirm the DEC-165 helper-orientation repair in a live browser.
   - Start a fresh dev server on a free port.
   - Hard refresh or restart the browser tab so stale bundles are not used.
   - Load `Y issue 1` and `Y issue 2`.
   - Inspect settled helper bounding boxes:
     - `axis:x` thin along X.
     - `axis:y` thin along Y.
     - `axis:z` thin along Z.
   - Only then mark the Y helper-plane issue visually resolved.

3. Add a default-off runtime frame debug dump before further fixes.
   - No overlay should be active by default.
   - Suggested debug shape:

```ts
type SceneSectionFrameDebug = {
  frameId: string;
  axis: "x" | "y" | "z";
  activeFrame: boolean;
  sourceFaceFrameUsed: boolean;
  normal: [number, number, number];
  axisA: [number, number, number];
  axisB: [number, number, number];
  rawDeterminant: number;
  orientationNormal: [number, number, number];
  helperBoundingBoxSize: [number, number, number];
  helperThinAxis: "x" | "y" | "z" | "none";
};
```

4. Fix or prove the non-frame transition semantic gap.
   - Add a pure synthetic fixture modeled on 180 -> 181, but not tied to live page ids.
   - It must cover a moving Y frame plus added X/Z frames plus target-scope/target-layer changes.
   - The test should fail if the source mask context loses source `targetScope`, source target layer ids, source active axis, or source active frame id.
   - Implementation options:
     - Add a `nonFrameDiscreteChanged` classifier and dissolve all active frames whenever target scope/layer/product/active-source-face semantics change, even if some frames also add/remove.
     - Or preserve source/target non-frame fields in the mask context while still moving compatible frame geometry.
   - The second option is smoother but harder. The first option is safer.

5. Add a browser geometry check after the debug dump exists.
   - Use Playwright or the in-app browser to navigate directly to pages 180 and 181.
   - Evaluate the scene-section runtime group and return per-frame world bounding boxes.
   - Assert the thin-axis contract instead of comparing screenshots:
     - `axis:y` must not have the same thin axis as `axis:z`.
     - `axis:y` must be thin along Y after settling.
   - Then run a transition check 180 -> 181 and 181 -> 180:
     - Mid-transition: no fully opaque source-only Y helper should persist on the target.
     - End-transition: helper snapshot gone, live helpers match target page only.

6. Keep the fix page-agnostic.
   - Do not branch on page 180, page 181, titles, page order, or Utah FORGE page filenames.
   - Any fix belongs in:
     - `src/scene/section/sceneSectionController.ts`
     - `src/scene/transitions/sceneSectionFrameSignature.ts`
     - `src/scene/transitions/transitionEffectiveLayersForPage.ts`
     - relevant source guards under `tests/tools/`
     - durable docs/decision entries if behavior changes

## Verification Already Run

Commands run from `C:\GeoSee\GeoSee_Dev`:

```powershell
node --test tests/tools/scene-section-frame-orientation-source.test.mjs tests/tools/scene-section-frame-partition-source.test.mjs tests/tools/scene-section-transition-behavior-source.test.mjs
```

Result:
- 23 tests passed.

```powershell
node -e "await import('./tests/tools/transition-page-agnostic-source.test.mjs')"
```

Result:
- 3 tests passed.

```powershell
node --test tests/tools/seismic-section-graph-basis.test.mjs
```

Result:
- 9 tests passed.

These are source guards only. They do not replace browser visual inspection.

## Proposed Next-Agent Audit Checklist

- [ ] Capture live runtime render-stack for `Y issue 1` and `Y issue 2`: environment scene, env snapshot/sub-master state, render preset, page scene overrides, section layer style, topo material authority, active texture URL/cache key, shader/material, mesh geometry, public clip, material edge fade, edge outline.
- [ ] Dump settled frame debug for both pages and confirm `axis:y` is thin along Y, not Z.
- [ ] Dump source-face basis use for `axis:y` on page 180 and page 181.
- [ ] Navigate 180 -> 181 and capture mid-transition `getTransitionDebugState()`.
- [ ] Prove whether source mask context preserves source target semantics during the dual-mask.
- [ ] If it does not, add the synthetic failing test before modifying runtime code.
- [ ] Implement the smallest page-agnostic repair.
- [ ] Run source guards, TypeScript, workspace check, then browser geometry check.
- [ ] Report final status as `ready for visual check` unless a human or live browser visual inspection confirms the screen.

## Deep Patch, Contamination, And All-Section Base Logic Audit - YAXIS-DEEP-20260613

Status: report-only addendum. No runtime/source fix was made in this pass. Visual status remains `ready for visual check`; this addendum is static code and repository evidence only.

Evidence commands run for this addendum:

- `git status --short`
- `git diff --name-status`
- `git diff --numstat`
- `git diff -- src/scene/section/sceneSectionController.ts`
- `git diff -- src/scene/transitions/transitionEffectiveLayersForPage.ts src/scene/transitions/transitionStyles.ts src/scene/transitions/layerTweenRuntime.ts src/scene/SceneManager.ts`
- `git diff -- src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx src/editor/layerControls/seismic/SeismicCapabilityLayerContainers.tsx`
- `rg -n "sceneSection|axis:y|axis:x|axis:z|sourceFace|sourceBasis|makeBasis|Quaternion|linkedLayerStylePatches|sceneOverrides|envSnapshot|legacy|compat" src docs tests projects/utah-forge/pages/180_page.json projects/utah-forge/pages/181_page.json`
- `node -e` determinant/cross-product probe for the built-in X/Y/Z bases.
- Google Drive folder listing for `Geovox > APP_Snapshot > GeoSee_Dev`: `https://drive.google.com/drive/folders/1fqqD7GJaWwgtNOKyFDhcI8reTJzN7BZJ`

### Current Patch Inventory

The checkout is not clean. The dirty tree is large enough that any follow-up diagnosis must separate app logic under review, saved-page evidence, and unrelated/editor-generated churn.

Section runtime patch family:

- `src/scene/section/sceneSectionController.ts` is modified by roughly `205` additions and `5` deletions.
- The patch changes `currentSceneSectionStyle` so a discrete section tween no longer returns raw `toStyle` before completion.
- The patch adds `dissolveFrameAxis`, `withDissolveFrameStateFromStyle`, `holdMovingFrameInvertFromSource`, and `sceneSectionTweenStyle`.
- The patch changes helper orientation in `rebuildSceneSectionHelpers` by deriving `orientationNormal = tangentA x tangentB` before `Matrix4.makeBasis`.
- This file is the highest-risk and highest-value audit target because it owns base axis definitions, resolved frames, resolved planes, helper geometry, material application, and transition mask contexts.

Transition runtime patch family:

- `src/scene/SceneManager.ts` is modified to expose `sceneSectionTweenStyle`.
- `src/scene/transitions/layerTweenRuntime.ts` now uses `sceneSectionTweenStyle` during section tween ticks.
- `src/scene/transitions/transitionEffectiveLayersForPage.ts` now calls `sceneSectionFramePartition`, stores `movingFrameIds` and `dissolveFrameIds`, and selects `dual-mask` only when at least one dissolve frame exists.
- `src/scene/transitions/transitionStyles.ts` imports/re-exports frame partition logic and removes the older in-file signature implementation.
- `src/scene/transitions/sceneSectionFrameSignature.ts` is untracked. It is part of the current behavior under test but is not yet committed or proven integrated by visual QA.

Editor/persistence patch family:

- `git diff` for `src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx` and `src/editor/layerControls/seismic/SeismicCapabilityLayerContainers.tsx` is empty in this checkout.
- These files are not part of the current dirty patch set, but they remain important contamination surfaces because they create and persist scene-section state.
- The current editor code writes built-in frame edits through `sceneSectionFrames`, `sceneSectionPlanes`, `sceneSectionFrameByAxis`, and for X/Y also legacy `sceneSectionWindowByAxis`.
- Seismic capability presets can write linked style patches to the scene-section layer through `linkedLayerStylePatches`.

Docs/tests patch family:

- `docs/03-decisions.md`, `docs/dev-context/Page-Transitions-And-Section-Frames.md`, and `docs/dev-context/Transition-Runtime-Operating-Spec.md` are modified.
- `tests/tools/scene-section-transition-behavior-source.test.mjs` is modified.
- Untracked tests exist for dynamic camera radius, section frame orientation, and section frame partition.
- Risk: docs/tests can assert intended behavior before the running app has been visually confirmed. They should be treated as claims and guards, not proof that the visible Y problem is gone.

Page-state contamination family:

- Many existing Utah FORGE page JSON files are modified.
- `projects/utah-forge/project.json` is modified, including page-order movement and added saved pages.
- Untracked pages `177_page.json` through `181_page.json` exist.
- Untracked overlays exist for `178_page`, `179_page`, and `181_page`.
- The saved Y pages are useful evidence, but they are also authoring state. They must not become the behavior fixture for app-level tests or fixes.

Unrelated dirty work:

- `src/pages/dynamicCameraPose.ts` is modified and appears unrelated to section axis logic. It adds a dynamic orbit radius clamp.
- This should not be folded into any Y-section diagnosis unless runtime evidence shows camera pose is hiding or exaggerating the section symptom.

Drive snapshot notes:

- The Drive snapshot folder contains a full repo-like tree: `.git`, `src`, `docs`, `projects`, `tests`, `tools`, `node_modules`, `dist`, `dist-tsbuild`, `.tmp.driveupload`, and `Y Axis issue`.
- The presence of build output, dependencies, `.git`, and `.tmp.driveupload` means Drive is a snapshot/reference location, not a clean source-of-truth checkout by itself.
- Any Drive comparison should target exact files and revision intent, not recursively trust the whole folder as a clean baseline.

### All-Section Base Logic

The section axis model is centralized in `SCENE_SECTION_AXIS_SPECS` and `sceneSectionBasisVectors` in `src/scene/section/sceneSectionController.ts`.

Built-in axis definitions:

| Axis | Plane normal | Frame axis A | Frame axis B | Position coordinate | A coordinate | B coordinate |
| --- | --- | --- | --- | --- | --- | --- |
| X | `+X` | `+Y` | `+Z` | `x` | `y` | `z` |
| Y | `+Y` | `+X` | `+Z` | `y` | `x` | `z` |
| Z | `+Z` | `+X` | `+Y` | `z` | `x` | `y` |

Cross-product and handedness check:

| Axis | `axisA x axisB` | Dot with normal | Handedness of `(axisA, axisB, normal)` |
| --- | --- | --- | --- |
| X | `+X` | `+1` | right-handed |
| Y | `-Y` | `-1` | left-handed |
| Z | `+Z` | `+1` | right-handed |

This is a base-logic inconsistency across all built-in sections. It does not mean all Y behavior is wrong, but it means any consumer that treats `(axisA, axisB, normal)` as a proper rotation will behave differently for Y than for X/Z.

Consumers that need a right-handed/proper basis:

- `rebuildSceneSectionHelpers` creates `planeBasis = new THREE.Matrix4().makeBasis(tangentA, tangentB, normal-like-column)` and then `planeQuaternion = new THREE.Quaternion().setFromRotationMatrix(planeBasis)`.
- That path orients the visible helper group, including outline, handles/cones, scale axes, labels, and some plane-facing text.
- A left-handed matrix is a reflection, not a rotation. `Quaternion.setFromRotationMatrix` cannot represent it faithfully. This is the cleanest all-section explanation for why Y helper visuals can differ from X/Z while clipping remains correct.
- Current dirty code attempts to fix only this consumer by using `orientationNormal = tangentA x tangentB`. This is logically plausible, but it is not visually verified.

Consumers that only need normals, vectors, or bounds and do not inherently need a right-handed rotation:

- `sceneSectionClippingPlanes` uses resolved plane normals and signed distances.
- `sceneSectionFrameClippingPlanes` creates clipping planes from `axisAVector`, `axisBVector`, and min/max bounds.
- `applySceneSectionMaterial` passes planes/frames to built-in material clipping or to shader uniforms.
- Scalar/seismic shader materials consume arrays such as `uSceneSectionNormals`, `uSceneSectionFrameAxisA`, `uSceneSectionFrameAxisB`, and `uSceneSectionFrameBounds`.
- Section ISO cut overlays sample active planes and frame bounds. These may be sensitive to signs and axes, but they do not need a quaternion unless a specific helper/label/render path introduces one.

Important implication:

- The Y symptom can be split-brain: data clipping can be correct while helper visuals are wrong.
- Any visual audit must separately inspect clipped terrain/data, frame outline, cone handles, labels, scale axes, ground trace, and Section ISO overlay geometry.

### State Creation And Normalization

Persisted section fields in `src/pages/types.ts` include:

- Global section state: `sceneSectionEnabled`, `sceneSectionMode`, `sceneSectionTargetScope`, `sceneSectionActiveAxis`, `sceneSectionActiveFrameId`.
- Plane state: `sceneSectionPlanes.x/y/z`.
- Legacy window state: `sceneSectionWindowEnabled`, `sceneSectionWindowActiveAxis`, `sceneSectionWindowByAxis.x/y/z`.
- Frame state: `sceneSectionFrameEnabled`, `sceneSectionFrames`, `sceneSectionFrameByAxis.x/y/z`.
- Visibility/targets: `sceneSectionObjectVisibilityByAxis`, `sceneSectionObjectVisibilityByFrameId`, `sceneSectionTargetLayerIds`, `sceneSectionTargetProductIds`.
- Helper/legend state: `sceneSectionGroundTraceVisible`, `sceneSectionAxesVisible`, `sceneSectionAxisIntervalM`, `sceneSectionAxisTextScale`, `sceneSectionHelperVisible`, `sceneSectionLegendVisible`.

Normalization currently happens in `normalizeEffectiveSceneSectionStyle`:

- If `sceneSectionActiveAxis` is valid and `sceneSectionActiveFrameId` is a mismatched built-in id, it rewrites active frame id to the active axis, e.g. active axis `y` plus `axis:x` becomes `axis:y`.
- For built-in entries inside `sceneSectionFrames`, it normalizes `entry.axis` from the id (`axis:x`, `axis:y`, `axis:z`) and overlays the matching `sceneSectionPlanes[axis]` plane state onto the entry.
- This is the right type of guard for stale built-in id leakage, but it is only effective where effective-style normalization is actually invoked.

Potential bypass or contamination seams:

- Editor live preview calls `sceneHandle.manager.applyStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, merged)` directly from `SceneSectionPlanesContainer`. If `applyStyle` does not normalize this style before runtime application, a transient live preview can see raw merged state that persisted/effective page load later normalizes.
- Transition setup depends on the from/to styles it receives. If either side is raw page/env/preset style rather than normalized effective style, DEC-164 partitioning can compare stale or mismatched built-in ids.
- Linked seismic preset patches can write scene-section fields without passing through the frame-entry editor helper. These patches need either to write a complete consistent style or rely on downstream normalization.
- `sceneSectionWindowActiveAxis` is only `x` or `y`, while `sceneSectionFrameByAxis` supports `z`. Any transition or patch that uses window state as a proxy for active frame state can diverge for Z or when switching between Y and Z.

### Editor And Patch Contamination

`SceneSectionPlanesContainer.tsx` is the main editor writer for section frames.

Observed write behavior:

- `commit` merges a partial patch into `liveStyleRef.current`, applies live scene edits via `sceneHandle.manager.applyStyle`, and persists the patch either to environment layer style or page layer override.
- `commitFrameEntries` writes serialized `sceneSectionFrames`.
- `setFrameEntryPatch` starts from normalized UI entries, patches one entry, then persists:
  - `sceneSectionFrames`
  - `sceneSectionActiveFrameId`
  - `sceneSectionFrameEnabled: true`
  - `sceneSectionActiveAxis`
  - for built-ins, `sceneSectionPlanes[nextAxis]`
  - for built-ins, `sceneSectionFrameByAxis[nextAxis]`
  - for X/Y built-ins with frame changes, legacy `sceneSectionWindowEnabled`, `sceneSectionWindowActiveAxis`, and `sceneSectionWindowByAxis[nextAxis]`

Potential inconsistency:

- The built-in check is `currentEntry.builtIn && id === builtInFrameId(nextAxis)`.
- If a built-in entry somehow has id `axis:y` but is patched with `axis: x`, then it is no longer treated as built-in for `x`; it follows the custom/non-built-in branch and still writes `sceneSectionActiveFrameId: "axis:y"` plus `sceneSectionActiveAxis: "x"`.
- The UI likely does not expose arbitrary built-in id reassignment, but data import, stale page JSON, linked patches, or custom automation could create this mismatch. This is exactly the family of contamination that `normalizeEffectiveSceneSectionStyle` is intended to correct.

Legacy window contamination:

- X/Y built-ins mirror frame bounds into legacy `sceneSectionWindowByAxis`.
- Z has no equivalent legacy active window axis in the type (`sceneSectionWindowActiveAxis?: "x" | "y"`), even though `sceneSectionWindowByAxis` allows `z`.
- This asymmetry can mislead code that reads legacy window state to infer active frame semantics.
- For all-section logic, window state should be treated as compatibility input only, never as the canonical section identity.

Seismic capability preset contamination:

- `SeismicCapabilityLayerContainers.tsx` applies `linkedLayerStylePatches` by calling `commitLayerStyle(targetLayerId, patch)`.
- The seismic depth-window path has explicit Y-section behavior:
  - `sceneSectionActiveAxis: "y"`
  - `sceneSectionActiveFrameId` preserved only if the current active axis is already `y`; otherwise it falls back to `"axis:y"`
  - `sceneSectionTargetScope: "selected-targets"`
  - target layer/product lists are merged from current state.
- This is valid product behavior if the preset means "turn on a Y seismic section", but it is also a cross-layer patch path that can flip the scene-section layer outside the normal frame editor.
- If this patch fires near a page transition or while stale live style is cached, it can alter active axis, target scope, and product targeting without touching all corresponding per-axis frame/window fields.

Editor diff note:

- There is no current local diff in the two editor files reviewed. These are not newly dirty in this checkout, but their existing behavior remains a plausible source of authored-state contamination.

### Runtime Resolution And Rendering

Runtime state flow:

1. `sceneSectionResolvedFrameEntries(style)` creates one built-in entry for each X/Y/Z axis, merges `sceneSectionFrameByAxis` plus any explicit `sceneSectionFrames` entry, and then appends valid custom entries.
2. `resolveSceneSectionFrames(style, bounds)` decides which frames are enabled and resolves ranges, basis vectors, labels, axis visibility, ground trace visibility, and source-face substitution.
3. `resolveSceneSectionPlanes(style, bounds)` resolves all planes, using the matching resolved frame basis when available.
4. `sceneSectionActivePlanes(style)` filters enabled planes.
5. `sceneSectionFrameClippingPlanes(frame)` creates four bounds planes from `axisAVector` and `axisBVector`.
6. `applySceneSectionPlanes(style, options)` traverses scene layers, calculates object visibility, applies materials/uniforms, and rebuilds helpers only when not in a transition frame.
7. `rebuildSceneSectionHelpers(...)` builds the visible helper objects, including outline, handles/cones, labels, scale axes, frame traces, and ground trace.

Data clipping path:

- Plane clipping uses `ResolvedSceneSectionPlane.normal` and signed distance.
- Frame clipping uses `ResolvedSceneSectionFrame.axisAVector`, `axisBVector`, and bounds.
- Built-in and shader materials receive the planes and frames through `applySceneSectionMaterial`.
- Terrain and seismic/scalar shader materials are routed through `setSceneSectionUniforms` and object-visibility uniforms.
- These paths can work even if helper quaternion orientation is wrong.

Helper visual path:

- The helper group uses `tangentA`, `tangentB`, and a quaternion from `Matrix4.makeBasis`.
- Current dirty code changes only the orientation basis's third column to `tangentA x tangentB`, preserving `basisNormal` for other uses.
- Cone handles are still `THREE.ConeGeometry`. A flat/cube-looking handle during transition is more likely a material/rebuild/lighting/shader state issue than a geometry type swap.
- Dashed trace ribbons compute width from `direction x planeNormal`; ribbon thickness can look wrong if plane normal or path points are stale, but it does not by itself explain Y/Z coplanarity.

Source-face substitution:

- `sceneSectionSourceFaceFrame` applies only when the entry is the active frame/axis and the seismic browser layer is targeted.
- It prefers `seismicSectionSelectedForFace` and falls back to visible matching products.
- `sceneSectionOrthonormalSourceBasis` normalizes source-face vectors with `axisB = normal x axisA`, producing a proper source basis.
- Therefore a Y frame can be proper/right-handed when source-face driven, but left-handed when it falls back to the built-in axis basis.
- A transition or page switch that changes active axis, target scope, seismic product targeting, or selected source face can switch the Y frame between source-derived and built-in basis families.

Section ISO overlay path:

- Section ISO overlays use active planes, section bounds, frame bounds, and helper ownership.
- If the data cut is correct but ISO helper lines/bands do not align with the visible frame, the fault can sit in helper orientation or overlay rebuild timing rather than the base clipping plane.
- If ISO bands themselves are wrong while ordinary shader clipping is right, audit the ISO overlay builder separately from `rebuildSceneSectionHelpers`.

### Transition And Bleed Risk

DEC-164 patch intent:

- `sceneSectionFramePartition` compares frame ids and geometry identity.
- Frames enabled on both pages with same geometry identity move/interpolate.
- Added, removed, disabled, or geometry-changed frames dissolve.
- Numeric plane position and crop bounds intentionally do not change identity.
- `invert` is excluded from geometry identity, and `holdMovingFrameInvertFromSource` holds the source kept-side until commit for moving frames.

Risk in mixed frame plus section-wide semantic changes:

- For pages 180 to 181, prior audit evidence found `axis:y` classified as moving and `axis:x`/`axis:z` classified as dissolving.
- That pair also changes section-wide semantics: target scope, target layer ids, target product ids, active axis, active frame id, and window active axis.
- Current transition setup only forces all moving frames to dissolve for a non-frame discrete change when there are no dissolve frames. If X/Z already dissolve, Y can still move.
- `sceneSectionMaskTransitionForTween` starts from interpolated target-shaped style and only replaces dissolve-frame slots from source/target. It does not preserve source-vs-target target scope, target layer ids, target product ids, active axis, active frame id, or window active axis for the source mask context.
- Resulting risk: the source side of a dual mask may evaluate with target-side section-wide semantics while a surviving Y frame still moves. This is a credible bleed mechanism independent of the helper handedness issue.

Transition consumers to audit before any fix:

- `transitionEffectiveLayersForPage.ts`: determines whether scene-section transition is active, whether dual-mask is used, and which frames move/dissolve.
- `layerTweenRuntime.ts`: applies `sceneSectionTweenStyle` during ticks and supplies mask transitions.
- `sceneSectionMaskTransitionForTween`: constructs source/target style contexts.
- `applySceneSectionPlanes`: resolves source and target mask contexts and applies per-material transition visibility.

Needed synthetic fixture:

- Source page: Y enabled, active Y, selected targets include seismic/product.
- Target page: X/Y/Z enabled, active X or Z, target scope changes to all-visible or different selected target set.
- Expected behavior must be specified explicitly:
  - Either any section-wide semantic change dissolves all active frames, including Y.
  - Or source and target mask contexts must preserve their own target scope, layer ids, product ids, active axis/frame id, and window active axis while only compatible geometry moves.

### Contamination And Inconsistency Candidates

These are not all root causes, but each can mislead diagnosis or preserve the symptom:

- Untracked saved pages `177_page.json` through `181_page.json`; pages 180/181 are evidence, not app-behavior fixtures.
- Bulk page JSON edits across many Utah FORGE pages; these can obscure whether an issue is runtime logic or authoring churn.
- `project.json` page-order changes; switching order can alter adjacent transition pairs and create a different observed bleed path.
- Untracked overlays for `178_page`, `179_page`, and `181_page`; overlay state may affect visual comparison.
- Dirty docs/tests that assert DEC-164/DEC-165 behavior before visual confirmation.
- Helper orientation patch present locally but not visually confirmed in the running app.
- Source-face basis fallback differs from built-in fallback; Y can shift between right-handed source-face basis and left-handed built-in basis depending on active axis and target selection.
- Legacy X/Y window state has no equivalent active-window model for Z; window state can drift from frame identity.
- Active axis and active frame id can be inconsistent in raw style and only corrected if normalization runs.
- Built-in frame id, entry axis, `sceneSectionPlanes[axis]`, and `sceneSectionFrameByAxis[axis]` are redundant representations; any one stale branch can contaminate the resolved result.
- Drive snapshot includes generated/build/dependency folders and `.tmp.driveupload`; it is useful for reference, but not a clean baseline unless exact files are compared.
- Current editor files have no local diff, so any issue there is existing logic or authored-state behavior, not a new local patch.

### Ranked Findings And Next Checks

| Rank | Finding | Evidence | Affected axes | Possible symptom | Recommended verification |
| --- | --- | --- | --- | --- | --- |
| High | Built-in Y basis is left-handed while X/Z are right-handed. | `sceneSectionBasisVectors`; determinant probe: X `+1`, Y `-1`, Z `+1`. | Primarily Y; all consumers that assume rotation. | Y helper outline/cones/labels/ground trace can render 90 degrees off or coplanar with Z while data clipping is correct. | Add a source guard requiring helper quaternion bases to be proper/right-handed for X/Y/Z; visually inspect pages 180/181 after loading current build. |
| High | Mixed frame transition can preserve target-wide semantics too early. | DEC-164 patch copies only dissolve-frame slots from source/target style; section-wide target scope/layer/product/active fields stay target-shaped. | All axes; observed on Y surviving while X/Z dissolve. | Page 1 section state can bleed into page 2, or source mask can evaluate with target target-scope. | Add synthetic 180-to-181-style transition fixture with moving Y, added X/Z, changed target scope/layers/products, and explicit expected behavior. |
| High | Raw style can carry inconsistent active axis and built-in frame id until effective normalization runs. | `normalizeEffectiveSceneSectionStyle` fixes mismatches, which implies mismatches are possible inputs. | X/Y/Z. | Active frame id points to one axis while active axis, source face, and editor controls use another. | Add source guard for normalized effective style and check all runtime/transition entry points use normalized styles. |
| Medium | Seismic capability presets can force Y section state through linked patches outside the frame editor. | `seismicDepthWindowSceneSectionPatch` writes active Y, selected targets, target layer/product lists; `linkedLayerStylePatches` can write arbitrary layer styles. | Primarily Y, but can affect all section state through target lists and visibility. | A preset or linked patch can change active axis/targets without updating every frame/window compatibility field. | Add source guard that preset-produced scene-section patches leave active axis/frame/window axis consistent. |
| Medium | Legacy X/Y window state remains compatibility input and can diverge from canonical frame state. | Types and editor writer support X/Y window active axis; Z frame state has no equivalent active window axis. | X/Y directly; Z by omission. | Window active axis can imply stale X/Y state during transitions or editor reads. | Source guard that runtime uses frame state as canonical and treats window state only as fallback. |
| Medium | Dirty page JSON and project order can alter observed transition pair. | `git status` and `git diff --numstat` show widespread page edits and `project.json` page-order changes. | All axes in the deck. | Visual switching may diagnose a different authored pair than expected. | For app behavior tests, use synthetic in-memory fixtures; for visual QA, record exact page ids and page-order positions. |
| Low | Dynamic camera radius patch can change perceived section visibility. | `src/pages/dynamicCameraPose.ts` dirty but not section-specific. | All axes visually. | Camera framing could make a correct section appear compressed or hidden. | Keep out of Y fix unless visual evidence shows camera pose changes between issue pages are the actual symptom. |
| Low | Drive snapshot is not a clean baseline by default. | Drive listing includes `.git`, `node_modules`, `dist`, `.tmp.driveupload`, source, docs, tests, and projects. | N/A. | Agents may compare against generated or transient files. | Compare exact source/docs/page files only; do not broad-diff generated folders. |

### Source Guards To Recommend

Do not implement these in this report-only pass. Recommended next source guards:

1. Assert X/Y/Z built-in bases and handedness are explicitly documented. The test should fail if a basis used as a rotation is left-handed without an explicit conversion to a proper orientation basis.
2. Assert every helper `Matrix4.makeBasis` path receives a right-handed basis for X/Y/Z and for source-face frames.
3. Assert active axis/frame normalization across `axis:x`, `axis:y`, and `axis:z`, including mismatched raw inputs.
4. Add a synthetic transition fixture where Y exists on both pages and should move, X/Z are added or removed, target scope and target layers change, and expected behavior is explicit.
5. Assert linked seismic preset patches cannot leave `sceneSectionActiveAxis`, `sceneSectionActiveFrameId`, `sceneSectionWindowActiveAxis`, `sceneSectionFrames[].axis`, `sceneSectionPlanes`, and `sceneSectionFrameByAxis` inconsistent.

### Recommended Next Implementation Sequence

1. Do not purge section data yet. First add the source guards above so the current architecture's failure modes become repeatable.
2. Decide the transition policy for section-wide semantic changes. The implementation must choose one rule:
   - dissolve all active frames when target scope/layer/product/active-axis semantics change, or
   - preserve source and target section-wide semantics independently inside mask contexts while compatible frame geometry moves.
3. Normalize section style at every runtime entry point that can receive raw style: live editor apply, transition setup, page/effective apply, and linked preset apply.
4. Keep the helper-orientation correction isolated from transition logic. It addresses visual helper handedness, not source/target mask bleed.
5. After source guards pass, run browser visual QA on pages 180 and 181 and record: active axis, active frame id, target scope, target layer ids, product ids, resolved basis vectors, helper quaternion handedness, clipping plane normals, material uniforms, and whether X/Y/Z are visually orthogonal.
