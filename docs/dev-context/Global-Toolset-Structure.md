# Global Toolset Structure

Status: active architecture note

## Current Rule

GeoSee tools are product-level capabilities. Projects are instances that provide
data inputs, provenance, visibility, page overrides, and authored diffs from the
tool defaults.

A project should not own copied tool implementation, expanded preset defaults, or
project-specific branches for behavior that belongs to a reusable GeoSee tool.
When a project needs distinct behavior, prefer explicit metadata, source data, or
authored settings diffs over project slug checks.

## First Implemented Pattern

The public topo map is the first cleaned global toolset pattern.

Current topo map structure:

- `src/topoMap/`: global defaults, settings resolution, presets, edge fade,
  editor/runtime helpers, and compatibility fallback behavior.
- `src/editor/topoMap/`: topo map editor UI for the global tool.
- `src/editor/topoMap/TopoMapPanel.tsx`: Topo Settings, Extents, Topo
  Environment, longitude/latitude grid, and title-block authoring.
- `src/editor/layerControls/atmosphere/AtmosphereVolumeControls.tsx`: reusable
  `atmosphere-volume` cloud/mist style controls used by Topo Environment.
- `src/scene/atmosphere/`: local atmosphere runtime for generated-canvas sprite
  puffs, bounds helpers, drift, and debug state.
- `geoSeeTool` layer metadata: identifies topo surface, graticule, and reference
  layers without relying on Utah FORGE layer IDs.
- `projects/utah-forge/*`: topo data inputs, provenance, visibility choices,
  authored terrain/style diffs, and page-local overrides only.

Legacy IDs such as `terrain` and `utah-forge-topo-graticule` remain readable for
backward compatibility, but metadata-authored topo projects must not depend on
those IDs.

Topo Environment is part of the public topo tool. It groups:

- Scene atmosphere: scene background/light-mode background and global fog color
  defaults.
- Clouds: `atmosphere-volume` environmental layers with add, duplicate,
  delete, selection, default/page visibility, style overrides, optional
  on-screen bounds handles, and generated-canvas sprite puffs.
- Sun: source light toggle, visible sky image/orb toggle, source marker,
  azimuth/elevation/camera lock, orb color/opacity/size/distance, edge softness,
  halo, terrain relief, and projected-map shadow controls.
- Scene fog: scene fog density/reach and scene fog colors.

Topo Extents groups public map footprint, satellite opacity, material edge
fade/outline, public surface clip, map/layer fog participation, map fog
density/reach, and terrain fog gradient.

Clouds are project layers, not terrain shader fields. The project manifest owns
stable identity, provenance, and immutable/default placement metadata. Mutable
appearance, puffs, bounds, drift, depth, and render-order fields live in
`environment.layerStyles` and page `layerOverrides`.

## Second Tool Alignment In Progress

MT resistivity is now being aligned to the same global-tool structure, with Utah
FORGE as the first instance rather than the owner of the behavior.

Current MT resistivity structure:

- `src/mtResistivity/`: global product definitions, slice product metadata, and
  the Utah FORGE instance contract.
- `tools/audit-mt-resistivity.mjs`: full-source fidelity gate for the current
  Utah FORGE MT products.
- `projects/utah-forge/data/geosee_processed/.../electrical_resistivity/`:
  render-ready products and provenance derived from the authoritative MT
  cell-center source model.

MT product roles are `pointCloud`, `depthSlices`, `crossSections`,
`isosurfaces`, and `scalarVolume`. Products must record whether they are
full-source or explicitly presentation-cropped. The 90,000-point MT preview is
QA/support context only and must not become computational input for slices,
sections, isosurfaces, or scalar volumes.

Current isosurface products are generated offline with mask-aware Marching
Cubes from the scalar-volume products. Utah FORGE carries both
`mt-isosurface-full-extent` and `mt-isosurface-forge-focused` in one render
artifact; editor/runtime state chooses the active product without changing the
legacy threshold-surface layer id.

Threshold surfaces use a dedicated solid-surface material path, not the generic
transparent mesh-preview material. Generated Marching Cubes meshes weld shared
vertices and record conservative smoothing metadata so runtime-computed normals
read as continuous surfaces. Diagnostic wireframe remains an editor option, but
standalone product pages should default to solid, depth-stable shells.

MT presentation pages should isolate active products. Topo, site outlines,
labels, and demo boreholes may remain as passive orientation context, but active
MT, seismic, slices, volumes, and isosurfaces should not be co-rendered on one
page unless a future page is explicitly scoped as a comparison view.

MT surface boundaries are now authorable visualization entities under the
legacy `3D MT threshold surfaces` layer. The nested editor surface is named
`Surface boundaries`, while runtime compatibility keeps the existing layer id.
Boundary opacity is owned by the boundary system: effective opacity is master
opacity multiplied by per-boundary opacity, with generic layer opacity hidden
where it would compete.

Page transitions must be product-aware for MT and seismic tools. A layer can
remain visible while the wrong sub-product is hidden, so transition state must
preserve render-entity identity such as selected scalar-volume product, section
ISO overlay, threshold boundary id, seismic product id, and scene-section
window state. Product-owned shader opacity must be multiplied by transition
opacity rather than replaced by a generic layer fade.

## Current Editor Structure Checkpoint

The editor sidebar is being aligned to the same global-tool rule. Top-level
editor sections should represent real tool or workflow boundaries, not padding
workarounds or nested historical containers.

Current top-level peer sections include:

- `Pages`: Global Settings selection, page selection, right-grip ordering,
  page-level actions, Sub Master hierarchy actions, and global/page selection
  state. Current footer layout is add / duplicate / reset above `M` / `C` /
  trash.
- `Cinematics`: global render preset, per-page render presets, environment,
  lighting, camera, terrain-grid, client UI, editor chrome variables, and page
  camera dynamics controls.
- `Sections`: Utah FORGE spatial-section workflow container for
  scene section planes, the Phase 3 working-area boundary, and working-area
  focus cropping.
- `Topo`: the topo tool editor, including topo surface settings, Extents, Topo
  Environment, longitude/latitude grid, title block, and topo reference layers.
- project data sections and card tools.

Container styling should come from shared editor tokens in `src/editor/styles.ts`.
Do not reintroduce local light-gray global-settings containers, nested fake
hierarchy, or one-off padding to imply tree structure.

## Forward Alignment

Other toolsets should be aligned to this structure over time when they are
touched for real work. Likely candidates after topo and MT include seismic
analysis, working-area focus, scene section planes, and future project-specific
data tools.

Alignment should be incremental:

- define the global tool contract first;
- move defaults, presets, runtime behavior, and editor behavior into a global
  module;
- keep project files as instances containing data, provenance, and authored
  diffs;
- preserve compatibility through tested adapters rather than broad migrations;
- add fast resolver/unit tests before browser regression coverage.

Do not broaden this note into a mandate to rewrite all tools at once.
