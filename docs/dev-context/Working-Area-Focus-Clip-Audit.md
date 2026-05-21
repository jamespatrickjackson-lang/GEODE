# Working Area Focus Clip Audit

Date: 2026-05-20

Status: architecture/spec audit plus v1 runtime/editor implementation. No page JSON was pre-enabled, no data processing occurred, and no acceptance state changed.

## Definition

The requested feature is a **Working Area Focus Clip** system.

It should turn the Utah FORGE Phase 3 working-area box into a visual site-of-interest boundary. Data inside the box remains shown with its normal layer style. Data outside the box can either be hidden or retained as context with a per-layer outside visibility slider.

This is a runtime display control, not a data crop. It must not rewrite, resample, trim, or export project data.

## Inferred Intent

The working area is the actual site of interest. The viewer should be able to clearly show what project data exists inside that box, while still allowing outside data to remain visible as lower-opacity context when useful.

The control should answer:

- What data exists inside the working area?
- What data is being visually clipped by the working-area focus?
- How much outside-context visibility should each affected layer retain?

The user-facing behavior should be:

- Enable working-area focus.
- See a list of affected data layers.
- Adjust an outside-context slider per layer.
- Set a layer's outside opacity to `0` to fully hide data outside the box.
- Preserve the working-area outline itself.

## Existing Source Boundary

The working-area source is already present in `projects/utah-forge/project.json` as layer:

- `utah-forge-phase3-working-area`

Layer type:

- `line`

Metadata source:

- `metadata.phase3WorkingArea.sceneBounds`

Scene-local bounds:

```json
{
  "min": [-8041.4, -12617.6, -6200],
  "max": [-3841.4, -8417.6, 2045.3]
}
```

Footprint metadata:

- width: `4200 m`
- height: `4200 m`
- area: `17.64 km2`
- coordinate system: scene-local meters, X east, Y north, Z up

`src/scene/layerLoaders.ts` already reads these bounds and renders the white working-area box. If metadata is missing, it falls back to the same bounds. This makes the existing layer the right bounds source for a future focus clip.

## Current Architecture Observed

GeoSee page state is project/config driven.

Relevant existing files:

- `projects/utah-forge/project.json`
- `projects/utah-forge/environment.json`
- `projects/utah-forge/pages/*.json`
- `src/pages/types.ts`
- `src/pages/effective.ts`
- `src/pages/PageController.tsx`
- `src/scene/SceneManager.ts`
- `src/editor/LayerPanel.tsx`
- `src/editor/EditorContext.tsx`
- `src/scene/layerLoaders.ts`
- `src/loaders/loadScalarVolume.ts`
- `src/loaders/loadSeismicBrowser.ts`
- `src/loaders/loadPointCloudPreview.ts`
- `src/loaders/loadTiledPointCloudPreview.ts`
- `src/loaders/loadLineStrings.ts`
- `src/loaders/loadPointMarkers.ts`
- `src/loaders/loadMeshPreview.ts`
- `src/loaders/loadTerrain.ts`

Current page mechanics:

- Page-local style deltas live in `PresentationPage.layerOverrides`.
- Page-local visibility deltas live in `PresentationPage.visibilityOverrides`.
- Effective page state is composed in `src/pages/effective.ts`.
- `SceneManager` applies effective styles and visibility to loaded layers.
- Page transitions call `transitionEffectiveLayersForPage`, which fades layer opacity and can tween some scalar style changes.
- Scene section controls are stored as a virtual style key: `utah-forge-scene-section-planes`.
- Terrain public-surface clipping is stored on the `terrain` layer style and applies to terrain, roads, streams, and lakes only.

## Existing Related Mechanisms

### Scene Section Planes

Existing system:

- style key: `utah-forge-scene-section-planes`
- fields: `sceneSectionEnabled`, `sceneSectionTargetScope`, `sceneSectionPlanes`, `sceneSectionTargetLayerIds`, `sceneSectionTargetProductIds`
- UI: `SceneSectionControls` in `LayerPanel.tsx`
- runtime: `SceneManager.applySceneSectionPlanes`
- shader support: scalar volume and seismic browser already expose scene-section uniforms
- ordinary materials use Three.js `material.clippingPlanes`

Useful for this feature:

- target layer selection pattern
- page-local virtual style pattern
- shader uniform plumbing pattern
- helper/gizmo render pattern
- transition risk precedent

Not enough by itself:

- it is plane-based, not box-based
- it hard-cuts rather than rendering inside and outside at separate opacity
- it is not keyed to the working-area layer metadata
- it does not expose per-layer outside opacity

### Public Surface Clip

Existing system:

- fields: `publicSurfaceClipEnabled`, center, size, rotation
- stored on the `terrain` layer style
- UI label: `Topo map clipping`
- runtime: `SceneManager.applyPublicSurfaceClipStyle`
- scope: terrain, roads, streams, and waterbodies

Useful for this feature:

- existing box helper rendering
- existing box-to-plane math
- existing page-local style path through `layerOverrides`

Not enough by itself:

- it is terrain/public-context only
- it is not based on the Phase 3 working-area layer
- it does not affect MT, seismic, station, or mesh products
- it does not support outside-context opacity

## Candidate Future State Model

This model should be evaluated before implementation. It should not be added until the TypeScript page schema, editor controls, and runtime application path are updated together.

```json
{
  "workingAreaFocus": {
    "enabled": true,
    "boundsSourceLayerId": "utah-forge-phase3-working-area",
    "mode": "outside-context",
    "clipTargetLayerIds": [
      "utah-forge-mt-resistivity-full-density",
      "utah-forge-mt-resistivity-volume",
      "utah-forge-phase3-seismic-browser"
    ],
    "outsideOpacityByLayerId": {
      "utah-forge-mt-resistivity-full-density": 0.15,
      "utah-forge-mt-resistivity-volume": 0.1,
      "utah-forge-phase3-seismic-browser": 0.2
    },
    "helperVisible": true
  }
}
```

Recommended storage approach:

- Use a virtual environment/page style key similar to `utah-forge-scene-section-planes`.
- Avoid attaching this directly to the line layer's normal style fields, because the working-area outline is the bounds source, not the visual target.
- A candidate virtual key would be `utah-forge-working-area-focus`.
- Add schema fields to `EditableStyle`, then use `environment.layerStyles[virtualKey]` plus page-local `layerOverrides[virtualKey]`.

Reason:

- This keeps the feature page-local.
- It matches the current page override architecture.
- It prevents global render defaults from changing.
- It keeps the working-area outline layer visible and independently styleable.

## Layer Capability Audit

| Layer / product | Current layer id | Likely v1 support | Notes |
| --- | --- | --- | --- |
| Working-area outline | `utah-forge-phase3-working-area` | bounds source, helper, not clipped | Preserve this line; do not clip it by its own boundary. |
| Terrain | `terrain` | hard clip already possible through public-surface clip; outside-opacity needs new behavior | Existing terrain clip is separate and context-only. Working-area focus should not silently reuse its current wide public-surface defaults. |
| Roads | `transport-roads` | hard clip likely possible through material clipping planes; outside-opacity likely needs split render or whole-layer fallback | Context layer; likely lower priority than data layers. |
| Streams | `hydrography-streams` | hard clip likely possible through material clipping planes; outside-opacity likely needs split render or whole-layer fallback | Context layer. |
| Lakes | `hydrography-lakes` | hard clip likely possible; outside-opacity split needs care for fill/outline | Polygon fill and outline may need separate style handling. |
| MT stations | `utah-forge-mt-stations` | point classification likely possible; outside-opacity likely needs marker-level support | Should hide or dim outside markers and labels together. Current station labels are already partial/missing. |
| MT preview point cloud | `utah-forge-mt-resistivity-preview` | hard clipping likely possible; outside-opacity should use shader/material or shared-geometry dual pass | Avoid CPU filtering or data duplication. |
| MT full-density point cloud | `utah-forge-mt-resistivity-full-density` | critical target; needs render-quality-safe shader/material approach | Full-density is the highest-risk layer. Do not make it faint, ugly, or over-filtered. Outside-context opacity should not disturb scalar ramp, distance light, or transition behavior. |
| MT volume | `utah-forge-mt-resistivity-volume` | good candidate for shader box mask | Existing scalar-volume shader already has scene-section uniforms. Add box/outside opacity as a separate composable alpha term later. |
| MT threshold surfaces | `utah-forge-mt-resistivity-threshold-surfaces` | hard clip likely possible; outside-opacity likely needs split mesh pass or shader | Existing threshold visibility is per threshold; focus clip must not break threshold toggles. |
| MT top surface | `utah-forge-mt-top-surface` | hard clip likely possible; outside-opacity likely needs split pass | Lower priority than volume/full-density/slices. |
| MT slices | `utah-forge-mt-resistivity-slices` | hard clip likely possible; outside-opacity likely needs split pass or shader | Must compose with slice visibility and scalar styling. |
| Seismic browser | `utah-forge-phase3-seismic-browser` | good candidate for shader box mask for raymarch/section products; navigation geometry needs separate handling | Existing seismic shader already has scene-section uniforms. Navigation sources/receivers/lines may need material clipping or separate opacity fallback. |
| Reference stage | `utah-forge-reference-stage` | optional context; likely whole-layer outside opacity only | Not a geophysical data target. |
| TEM panel | no confirmed app-native layer | unsupported until data/layer exists | Do not fake support. |
| Basement/top-of-granite surface | no confirmed app-native gridded layer | unsupported until data/layer exists | Do not fake support. |
| Interpreted seismic contact overlays | no confirmed app-native layer | unsupported until data/layer exists | Do not fake support. |

## Implementation Touch Map For Later

Do not implement these in this audit pass. These are likely touch points for a future bounded implementation.

### Schema and State

Likely files:

- `src/pages/types.ts`
- `src/pages/effective.ts`
- `projects/utah-forge/environment.json`
- selected page JSON files only when creating page-local defaults later

Needed work:

- Add typed `workingAreaFocus*` fields or a typed nested object.
- Decide whether nested `workingAreaFocus` is acceptable in the current shallow-merge style system.
- If nested object is used, make sure page overrides merge intentionally rather than replacing nested maps unexpectedly.
- Add virtual style key defaults if using `utah-forge-working-area-focus`.

Recommendation:

- Prefer flat fields if staying with current `EditableStyle` shallow merge.
- Prefer nested object only if effective style merge gets explicit deep merge for this feature.

### Runtime Application

Likely files:

- `src/scene/SceneManager.ts`
- `src/scene/layerLoaders.ts`
- `src/loaders/loadScalarVolume.ts`
- `src/loaders/loadSeismicBrowser.ts`
- `src/loaders/loadPointCloudPreview.ts`
- `src/loaders/loadTiledPointCloudPreview.ts`
- `src/loaders/loadLineStrings.ts`
- `src/loaders/loadPointMarkers.ts`
- `src/loaders/loadMeshPreview.ts`
- `src/loaders/loadTerrain.ts`

Needed work:

- Resolve bounds from `utah-forge-phase3-working-area` metadata or loaded object userData.
- Build a six-plane or min/max box mask from those bounds.
- Apply mask only to configured target layers.
- Preserve the working-area outline.
- Compose with scene-section clipping, fog, scalar filters, and layer opacity.
- Add a helper/outline only if the existing working-area outline is insufficient.

### Editor UI

Likely files:

- `src/editor/LayerPanel.tsx`
- `src/editor/EditorContext.tsx`
- `src/editor/EditorChrome.tsx`

Needed work:

- Add a Working Area Focus section under the existing "Working area" group.
- Show enable/disable.
- Show mode: outside-context / inside-only.
- List clip-capable visible or project layers.
- Add outside opacity slider per target layer.
- Mark unsupported layers as unsupported instead of hiding them from the user's mental model.
- Ensure edits write page-local overrides when editing a page and environment defaults only when explicitly in global settings.

### Transition Behavior

Likely files:

- `src/pages/PageController.tsx`
- `src/scene/SceneManager.ts`

Needed work:

- Treat focus state changes like page layer style changes.
- Fade outside opacity between pages.
- Avoid snapping when navigating between pages with focus disabled/enabled.
- Preserve transition snapshots for layers that need split rendering or shader-state changes.
- Verify interrupted navigation behaves from the current visual state, not stale source/target state.

## Main Architecture Risks

### Two-zone rendering is not ordinary clipping

Hard clipping can discard outside fragments. The requested outside visibility slider means the renderer needs to distinguish inside and outside regions and apply different alpha values.

For many layers this may require one of:

- shader branch with `insideBox(position)` and outside alpha multiplier
- dual render pass using shared geometry: inside pass plus outside pass
- material clipping planes for hard clip only
- whole-layer opacity fallback for unsupported layers

### Full-density point cloud is high risk

The full-density MT layer must remain visually clean. CPU-side point filtering is not acceptable for v1 because it risks performance and data mutation confusion. A future implementation should use shader/material masking or shared geometry passes.

### Nested page state may not merge safely

Current `effectiveStyle` uses shallow merge:

```text
environment.layerStyles[id] -> page.layerOverrides[id]
```

A nested object such as `workingAreaFocus.outsideOpacityByLayerId` would be replaced wholesale unless explicit merge logic is added. Flat fields or explicit deep-merge handling should be chosen deliberately.

### Scene sections and focus clipping must compose

Existing scalar-volume and seismic shaders already discard samples outside scene-section planes. Working-area focus should be a separate alpha/mask term, not a replacement.

The composition should be conceptually:

```text
final alpha = base alpha * layer opacity * scene-section mask * working-area focus alpha
```

### Public-surface clip should not become the data clip

The current topo clipper is useful reference code, but it is scoped to terrain/public context. Reusing it as the data focus system would create confusing behavior and would not satisfy MT/seismic requirements.

### UI can become noisy

The feature could clutter the existing layer panel if every layer is always listed. The panel should show a compact list of affected layers, with clear capability status and sliders only where meaningful.

## Recommended Phasing

### Phase 1: Architecture Spec

Complete this audit and decide the feature contract before code changes.

Output:

- this audit document
- explicit implementation boundary
- future file touch map

### Phase 2: Minimal Runtime Prototype

Target only the most important data layers:

- `utah-forge-mt-resistivity-full-density`
- `utah-forge-mt-resistivity-volume`
- `utah-forge-phase3-seismic-browser`
- preserve `utah-forge-phase3-working-area`

Behavior:

- page-local enable
- inside-only mode
- outside opacity per target layer
- transition-aware fade
- no data mutation

### Phase 3: Broader Layer Coverage

Extend to:

- MT preview point cloud
- MT slices
- MT threshold surfaces
- MT top surface
- stations and station labels
- public terrain/context layers
- seismic navigation geometry

### Phase 4: Editor Polish and Presets

Add:

- layer capability labels
- preset outside-opacity values
- page-local reset controls
- copy/apply to current page controls if needed
- visual smoke tests and screenshots

## Acceptance Criteria For Future Implementation

Future implementation should not be considered complete unless:

- Working-area bounds are sourced from `utah-forge-phase3-working-area` metadata or loaded userData.
- The working-area outline remains visible when focus is enabled.
- At least one MT layer and one seismic layer can be clipped or outside-dimmed.
- Outside opacity is controllable per supported layer.
- Page-local settings persist in page JSON.
- Page-to-page navigation fades focus changes without snapping.
- Scene-section clipping still works when working-area focus is enabled.
- Full-density point cloud quality is not degraded.
- Unsupported layers are visible in the UI as unsupported or fallback-only.
- No source data, processed artifacts, or loaders' input files are rewritten.
- `npm run build` passes.
- Utah FORGE smoke coverage includes a transition between focused and unfocused pages.

## Verification Needed For Future Implementation

Recommended checks:

- TypeScript/build:
  - `npm run build`
- Project validation:
  - `node tools/validate-artifact-metadata.mjs --project projects/utah-forge`
  - `node tools/report-project-artifact-coverage.mjs`
- Browser smoke:
  - page with focus disabled
  - page with focus enabled and outside opacity `0`
  - page with focus enabled and outside opacity between `0.1` and `0.3`
  - transition from unfocused to focused
  - transition from focused to unfocused
  - scene-section enabled together with working-area focus
  - full-density point cloud visible and visually acceptable

## Open Questions Before Implementation

These should be resolved before code work:

- Should outside opacity default to `0` for presentation pages or a faint value such as `0.15`?
- Should the focus system list all project layers, only visible layers, or only clip-capable layers?
- Should context layers such as terrain/roads/hydrography be part of the same focus system or remain controlled by public-surface clipping?
- Should unsupported layers be disabled rows in the focus UI or summarized in a compact "unsupported" section?
- Should focus settings be stored as flat `EditableStyle` fields or as a nested object with explicit merge behavior?

## Current Recommendation

Implement later as a new page-local virtual style system named around working-area focus, not as an extension of the terrain public-surface clip.

Use the existing working-area layer as the bounds authority. Reuse scene-section and public-surface clipping code patterns where helpful, but keep this feature distinct because the core behavior is inside-normal/outside-context rendering with per-layer controls.

The first real implementation should be narrow: full-density MT, MT volume, and seismic browser. Those layers matter most for Utah FORGE and exercise the hard parts: custom shaders, dense data, and page-transition state.

## V1 Implementation Notes

Implemented on 2026-05-20 as a page-local virtual style/control system.

Runtime/config shape:

- Virtual style key: `utah-forge-working-area-focus`
- Default state: disabled in `projects/utah-forge/environment.json`
- Bounds source: `utah-forge-phase3-working-area`
- Page-local storage: `layerOverrides["utah-forge-working-area-focus"]`
- Flat style fields:
  - `workingAreaFocusEnabled`
  - `workingAreaFocusMode`
  - `workingAreaFocusBoundsLayerId`
  - `workingAreaFocusTargetLayerIds`
  - `workingAreaFocusOutsideOpacityByLayerId`
  - `workingAreaFocusHelperVisible`

Runtime behavior:

- `SceneManager` resolves bounds from loaded working-area `userData.sceneBounds`, then falls back to the existing metadata-compatible Phase 3 bounds.
- The working-area outline remains visible and is not clipped by its own focus boundary.
- Focus changes are tweened during page transitions so outside opacity fades rather than snapping.
- `inside-only` mode preserves slider values but renders outside opacity as `0`.
- Existing public-surface clipping remains separate.

Renderer support:

- MT volume and seismic browser raymarch/section shaders receive box-focus uniforms and multiply focus alpha with existing opacity/filter/scene-section terms.
- Built-in mesh/point materials receive a best-effort `onBeforeCompile` alpha patch using world position.
- Unsupported shader materials are marked through material userData rather than silently pretending to clip.
- No source data, processed artifacts, or geophysical products are cropped or rewritten.

Editor support:

- `LayerPanel.tsx` adds a Working area focus control under the existing Working area group.
- Controls include enable, mode, helper visibility, target checklist, capability labels, and outside-opacity sliders.
- The outside-opacity map is written as a complete map to avoid shallow-merge loss.
- `EditorChrome.tsx` preserves the focus override fields during Utah FORGE page preview/navigation.

Test coverage added:

- `tests/utah-forge-smoke.spec.ts` now includes `Utah FORGE working area focus clips outside context with page-local controls`.
- The test verifies controls render, target opacity updates shader/runtime state, inside-only mode sets outside alpha to `0`, section controls do not clear focus state, page-local UI state remains distinct from Global Settings, and a programmatic unfocused-to-focused transition fades outside opacity toward `0.15`.

Known v1 limits:

- TEM, basement surface, interpreted contacts, and other missing geophysical products remain unsupported because no app-native layers exist.
- Context meshes/lines use best-effort material fallback, not guaranteed true split-zone rendering for every custom material.
- Full visual screenshot comparison was not added in this pass; coverage is runtime/control-state oriented.
