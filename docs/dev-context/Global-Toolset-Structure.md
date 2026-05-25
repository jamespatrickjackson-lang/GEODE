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
- `geoSeeTool` layer metadata: identifies topo surface, graticule, and reference
  layers without relying on Utah FORGE layer IDs.
- `projects/utah-forge/*`: topo data inputs, provenance, visibility choices,
  authored terrain/style diffs, and page-local overrides only.

Legacy IDs such as `terrain` and `utah-forge-topo-graticule` remain readable for
backward compatibility, but metadata-authored topo projects must not depend on
those IDs.

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

## Current Editor Structure Checkpoint

The editor sidebar is being aligned to the same global-tool rule. Top-level
editor sections should represent real tool or workflow boundaries, not padding
workarounds or nested historical containers.

Current top-level peer sections include:

- `Page Manager`: page selection, ordering, page-level actions, and global/page
  selection state.
- `Visual Studio`: global render preset, environment, lighting, camera, and
  terrain-grid controls.
- `UI`: global client-facing chrome controls such as logo and GUI style.
- `Public Topo Map`: the topo tool editor, including topo surface settings,
  longitude/latitude grid, title block, and topo reference layers.
- project data sections and overlay tools.

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
