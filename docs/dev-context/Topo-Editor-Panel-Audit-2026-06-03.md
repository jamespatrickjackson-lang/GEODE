# Topo Editor Panel Audit - 2026-06-03

## Scope

Reviewed `src/editor/topoMap/TopoMapPanel.tsx`, the Topo panel routing in
`src/editor/LayerPanelGroups.tsx`, scene merge behavior in `src/pages/effective.ts`,
and the cinematic preset filter in `src/editor/EditorContext.tsx`.

This pass reorganized controls only where the backing field and authoring route
were already present. Raster data, generated textures, terrain GeoTIFFs, page
fixtures, and camera far-plane behavior were not changed.

## Structure After Cleanup

- Topo Settings
  - Visibility / opacity / transform
  - Height map
  - Material source
  - Satellite image
  - Image adjustment
  - Image sun response
  - Outside image fill
  - Elevation ramp
  - Terrain shading
  - Mesh grid and underside
  - Map footprint / clipping
  - Material edge opacity fade
  - Material edge outline
  - Public surface clip
  - Provenance
- Topo Environment
  - Scene atmosphere
  - Clouds
  - Sun
    - Light source
    - Sky image
    - Terrain relief
    - Projected shadows
  - Fog
    - Scene fog
    - Map fog
- Longitude / latitude grid
- Title block

## Field Inventory

### Scene Atmosphere

- `scene.lightMode`
- `scene.background`
- `scene.lightModeBackground`
- `scene.fog.enabled`
- `scene.fog.color`
- `scene.fog.lightModeColor`
- `scene.fog.density`
- `scene.terrain.fogGradientCurve`
- layer `affectedByFog`
- layer `fogDensity`

### Sun, Lighting, And Shadows

- `scene.sun.azimuth`
- `scene.sun.elevation`
- `scene.sun.lockToCamera`
- `scene.sun.lightEnabled`
- `scene.sun.orbVisible`
- `scene.sun.orbColor`
- `scene.sun.orbOpacity`
- `scene.sun.orbSizeM`
- `scene.sun.orbDistanceM`
- `scene.sun.orbEdgeSoftness`
- `scene.sun.orbHaloColor`
- `scene.sun.orbHaloOpacity`
- `scene.sun.orbHaloScale`
- `scene.sun.sourceMarkerVisible`
- `scene.sun.sourceMarkerOpacity`
- `scene.lighting.directional.color`
- `scene.lighting.directional.intensity`
- `scene.terrain.hillshadeIntensity`
- `scene.terrain.shadowSharpness`
- `scene.terrain.facetStrength`
- `scene.terrain.shadowTint`
- `scene.terrain.projectedMapShadowsEnabled`
- `scene.terrain.projectedMapShadowOpacity`
- `scene.terrain.projectedMapShadowSoftness`
- `scene.terrain.projectedMapShadowBias`

### Height Map And Material

- height-map source path, CRS, footprint, elevation range, and vertex budget are
  read from terrain-layer metadata.
- `scene.terrain.verticalExaggeration`
- `scene.terrain.materialPreset`
- `scene.terrain.rampLow`
- `scene.terrain.rampMid`
- `scene.terrain.rampHigh`
- `scene.terrain.elevLowM`
- `scene.terrain.elevHighM`
- `scene.terrain.rockHueVariance`
- `scene.terrain.gridEnabled`
- `scene.terrain.gridColor`
- `scene.terrain.gridOpacity`
- `scene.terrain.gridSpacingM`
- `scene.terrain.gridLineWidthM`
- `scene.terrain.undersideOpacity`

### Satellite Image

- `scene.terrain.orthoPhotoTextureBudget`
- `scene.terrain.orthoPhotoOpacity`
- `scene.terrain.orthoPhotoBrightness`
- `scene.terrain.orthoPhotoContrast`
- `scene.terrain.orthoPhotoSaturation`
- `scene.terrain.orthoPhotoHillshadeBlend`
- `scene.terrain.orthoPhotoShadowStrength`
- `scene.terrain.orthoPhotoShadowFloor`
- `scene.terrain.orthoPhotoShadowTint`
- `scene.terrain.orthoPhotoOutsideFillEnabled`
- `scene.terrain.orthoPhotoOutsideColor`
- `scene.terrain.orthoPhotoOutsideOpacity`

Source-owned satellite fields remain read-only through the material picker:

- `scene.terrain.topoImageMaterialSources`
- `scene.terrain.orthoPhotoPath`
- `scene.terrain.orthoPhotoTexture4096Path`
- `scene.terrain.orthoPhotoTexture8192Path`
- `scene.terrain.orthoPhotoBounds`

### Map Footprint And Edges

- layer `publicSurfaceClipEnabled`
- layer `publicSurfaceClipShape`
- layer `publicSurfaceClipCenterX`
- layer `publicSurfaceClipCenterY`
- layer `publicSurfaceClipCenterZ`
- layer `publicSurfaceClipSizeX`
- layer `publicSurfaceClipSizeY`
- layer `publicSurfaceClipSizeZ`
- layer `publicSurfaceClipRotationZDeg`
- `scene.terrain.edgeFadeDistanceM`
- `scene.terrain.edgeFadeShape`
- `scene.terrain.edgeFadeInsetM`
- `scene.terrain.edgeFadeCornerRadiusM`
- `scene.terrain.edgeOutlineEnabled`
- `scene.terrain.edgeOutlineOffsetM`
- `scene.terrain.edgeOutlineThicknessM`
- `scene.terrain.edgeOutlineColor`
- `scene.terrain.edgeOutlineOpacity`
- `scene.terrain.edgeTopShine`
- `scene.terrain.edgeCornerShine`
- `scene.terrain.edgeBottomShine`

### Clouds, Graticule, And Title Block

- Cloud controls use `AtmosphereVolumeControls` and the existing atmosphere layer
  style override path for appearance, puffs, bounds, falloff, drift, and render
  controls.
- Graticule controls remain layer-style based: grid visibility, line color,
  opacity, width, spacing, axis labels, edge labels, leaders, and leader color
  blend.
- Title block controls remain stored under `scene.terrain.topoMapBranding`:
  visibility, logo asset paths, text content, layout, anchor, offsets, rotation,
  lift, logo sizing, typography, text/background/outline opacity and color.

## Conflict Fixes

- `scene.terrain.hillshadeIntensity` now has one editor slider under
  `Sun > Terrain relief`; the duplicate Height map slider was removed.
- Satellite controls are split by role: source, image adjustment, image sun
  response, and outside image fill.
- Dark/default background, dark/default fog, light background, and light fog are
  explicit Topo Environment controls.
- Material edge opacity fade, material edge outline, and public surface clip are
  sibling Topo sections rather than hidden under `Map footprint / clipping`.
- Terrain grid and underside shader fields are exposed directly in Topo Settings.
- `lightModeBackground` is included in the cinematic render-preset sync filter,
  so active user preset edits do not drop light-mode background changes.

## Page And Transition Routing

- Global Settings target: Topo scene edits call `setEnvScene`.
- Page target: Topo scene edits merge into `page.sceneOverrides` through
  `setPageField(page.id, { sceneOverrides })`.
- Live page preview applies only after the selected page has landed; persisted
  page edits still dispatch during transitions.
- Layer-style controls keep the existing page override gate for layer styles and
  visibility.
- Runtime page resolution applies base environment/sub-master scene first, then
  page `sceneOverrides`.
- Cinematic post fields have a transition channel through
  `beginCinematicSceneTransition`, `blendCinematicSceneForTransition`, and
  `updateCinematicPostFrame(nowMs)` before composer render.

## Remaining Notes

- `orthoPhotoBounds` is still the satellite coverage area, not the visible map
  footprint.
- Public surface clip is the authored visible map edge.
- `topoImageMaterialSources` and texture paths should stay source-owned unless a
  dedicated material-source editor is requested.
- Projected map shadows remain opt-in because large regional terrain can alias
  shadow maps; analytical sun relief remains the stable default.
