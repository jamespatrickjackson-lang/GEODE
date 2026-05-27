# Topo Graticule Edge Fade Audit

Status: log only / no implementation

## Intent

The Utah FORGE longitude/latitude graticule should use the topo map edge fade as its visual authority.

The intended behavior is an opposite-gradient annotation effect:

```text
defined topo map body
-> normal subtle grid color
-> topo edge fade band
-> grid line blends / inverts toward white
-> white edge line and white coordinate labels
-> undefined environment / background
```

The graticule must not read as a fixed circular overlay sitting in the middle of the topo map. Edge coordinate labels should behave like map-edge labels tied to the active topo fade boundary. If the topo edge fade is square, rounded square, or circular, the labels and edge treatment should follow that same shape.

## Failure mode to avoid

Do not leave a visible internal ring of labels or a circular label-placement model that floats over the map body.

The wrong model is:

```text
graticule labels on a fixed circle over the topo map
```

The right model is:

```text
map-reference grid that becomes edge-aware through the terrain fade band
```

## Current implementation audit

### Graticule generation

- `src/loaders/loadTopoGraticule.ts` generates the longitude/latitude grid procedurally from project CRS and terrain height sampling.
- Lines are terrain-draped using sampled height points.
- Labels are generated as text planes with `MeshBasicMaterial`.
- Label placement currently uses fixed circular inset logic derived from topo graticule metadata, with `labelInsetM = radius * 0.965`.
- This explains the current visual problem: labels can appear as a circle through the map instead of edge text tied to the active terrain fade boundary.

### Graticule styling

- `src/scene/SceneManager.ts` applies graticule style in `applyTopoGraticuleStyle()`.
- Current style support includes:
  - `graticuleLabelVisible`
  - `graticuleLabelSizeM`
  - `graticuleLiftM`
  - layer `color`
  - layer `opacity`
- The current graticule line material is a single `LineMaterial`.
- The current label materials are flat text materials.
- Current graticule styling applies one global line/label treatment, not an edge-fade-aware color transition.

### Public topo clip

- Public topo clipping is stored on the `terrain` layer style using `publicSurfaceClip*` fields.
- `SceneManager.publicSurfaceClipBox()` resolves the active clip box.
- `SceneManager.publicSurfaceClipPlanes()` creates hard clipping planes.
- `SceneManager.applyPublicSurfaceClipStyle()` applies hard clipping to public surface layers.
- `applyTopoGraticuleStyle()` also applies public clip planes to the graticule.
- Public topo clip and terrain edge fade are separate concepts and should remain separate.

### Terrain edge fade

- `src/scene/terrainMaterial.ts` owns terrain edge fade shader behavior.
- Current terrain edge fade fields include:
  - `edgeFadeDistanceM`
  - `edgeFadeShape`
  - `edgeFadeInsetM`
  - `edgeFadeCornerRadiusM`
- Supported edge fade shapes are:
  - square
  - rounded square
  - circle
- The terrain shader computes distance to the active edge fade boundary and blends terrain surface color toward the fog/background color.
- The graticule currently does not know about terrain edge fade shape, edge distance/inset, fade width, or rounded-square radius.

### Page transitions

- `src/pages/PageController.tsx` drives page navigation and calls `SceneManager.transitionEffectiveLayersForPage()`.
- The transition-aware system exists so data-layer changes follow page camera transitions instead of snapping.
- Future graticule edge-fade implementation must participate in this same transition behavior when page-local terrain/graticule styles change.
- Edge-aware graticule color, label color, and label placement should not snap between pages if the underlying terrain edge fade settings change.

## Interaction audit

### Terrain edge fade

The graticule should read terrain edge fade state as the visual authority. The future implementation should use the active terrain edge fade shape, inset, distance, and rounded-corner radius to decide where the edge band begins and how strongly graticule line/label color should move toward white.

### Public topo clip

Public topo clip remains a hard visibility boundary. It should not become the source of the edge-fade visual gradient unless the edge fade intentionally derives from the same dimensions. Clipping can still hide geometry outside the clip, but it should not define the white edge-gradient behavior by itself.

### Topo graticule line/label layer

The line layer needs edge-aware color behavior. The label system needs edge-aware placement and edge label coloring. The graticule should remain a map-reference overlay and should not become geophysical data or clipping logic.

### Page-local layer styles

Any future controls should be style/config driven so page-local overrides can control the graticule behavior. The design should not require new pages or hardcoded page-specific behavior.

### Global Settings editor controls

The editor currently exposes graticule label visibility, label size, and surface lift under the longitude/latitude grid layer. Future controls can live there, while terrain edge fade controls remain under topo surface style.

### Page transitions

Any future implementation must work with the existing page transition model. Changes in graticule edge fade awareness, white edge strength, or label positions should fade or interpolate with page transitions where possible.

### Other public context layers

Roads, hydrography, terrain, and public topo clipping already have their own visual systems. This audit does not request changes to those layers.

## Deepened findings

### Exact cause of the internal label circle

- `src/loaders/loadTopoGraticule.ts` computes a circular label target using `labelInsetM = radius * 0.965`.
- Label placement uses `localCircleMetric()` against the graticule metadata center and rotation, then chooses the best sampled point that is inside that fixed circular inset.
- Longitude labels use a north preference and latitude labels use an east preference. This scoring makes labels collect around a circular interior path rather than an active map edge.
- The placement authority is currently graticule metadata: `clipCenterScene`, `clipSizeScene`, and `clipRotationDeg`.
- The user intent requires the terrain edge fade to be the authority instead. Those are different systems today.

### Authority mismatch

- `projects/utah-forge/environment.json` currently has public topo clip settings on the `terrain` layer, including `publicSurfaceClipShape`.
- `projects/utah-forge/project.json` currently has separate procedural graticule metadata with clip center, size, rotation, latitude step, longitude step, and samples per line.
- `environment.scene.terrain` has the active topo edge fade settings: `edgeFadeDistanceM`, `edgeFadeShape`, `edgeFadeInsetM`, and `edgeFadeCornerRadiusM`.
- These three sources can describe similar-looking boundaries, but they are not the same authority.
- Future implementation must not infer edge-label placement from public clip or graticule metadata alone. The visual boundary for this feature is the terrain edge fade.

### Line and material limits

- The graticule line is one `LineSegmentsGeometry` rendered with one `LineMaterial`.
- The current material patch from `topoLineMaterial.ts` only handles distance width/alpha attenuation and terrain shade influence.
- Current graticule lines have one global color and one global opacity.
- There is no per-segment, per-vertex, or spatial edge-fade color state on the graticule today.
- Spatial line inversion to white will need either a graticule-specific shader path, generated per-vertex/segment color data, or a separate edge-band overlay line path.

### Label and material limits

- Labels are canvas-generated text textures on ground-plane meshes.
- The text fill and stroke are baked when the canvas texture is created.
- `SceneManager.applyTopoGraticuleStyle()` currently changes material-level color/opacity if available, but it does not regenerate label textures or distinguish normal map-body labels from white edge labels.
- True white edge text may require texture regeneration, a second white edge-label mesh set, or a label material route that can reliably tint the baked texture without degrading readability.
- Labels use `depthTest: false`, `depthWrite: false`, and high render order. That makes them readable, but it also means misplaced labels float above the map and are visually obvious.

### Transition risks

- `PageController` calls `SceneManager.transitionEffectiveLayersForPage()` for page navigation.
- `SceneManager.transitionEffectiveLayersForPage()` applies most target styles immediately, with special tweening for supported scalar-style layers and working-area focus.
- Graticule color, edge fade strength, and label positions would snap today if they were driven only by immediate target style application.
- Future implementation needs either a graticule-specific tween, stable derived edge state that changes only when the terrain edge changes, or a transition-safe interpolation path for label/line edge adaptation.

### Interaction constraints

- Public topo hard clipping should keep clipping visibility.
- Terrain edge fade should drive the white/inverted fade-band styling.
- The feature should not change roads, hydrography, surface elevation coloring, the surface elevation legend, working-area focus, MT/seismic products, or source terrain data.
- Future implementation should likely share or duplicate the terrain edge signed-distance math for graticule line/label placement and color evaluation, but it must remain visual-only.

## Future implementation considerations

- The graticule needs a reusable edge-distance evaluator that matches terrain edge fade behavior for square, rounded square, and circle.
- Label placement should be recalculated against the active terrain edge fade boundary, not the fixed graticule metadata circle.
- A first implementation should prefer a conservative visual model: keep interior grid subtle, make only the fade-band/edge portion white, and keep labels near the active edge.
- The implementation should expose only the minimum controls needed to tune readability; the terrain edge fade controls remain the primary shape controls.
- Test coverage should inspect runtime state and visual screenshots for at least circle and rounded-square edge fade settings.

## Implementation boundary

This audit is documentation only. It does not implement shader changes, material changes, label placement changes, editor controls, page changes, overlay changes, project config changes, terrain data processing, or geophysical product changes.

## Next valid move

Create an implementation plan/build pass for edge-fade-aware graticule lines and labels after review of this audit.
