// Utah FORGE crossfade / graticule metadata for SceneManager dispatchers.
//
// SceneManager's discrete-crossfade picker (shouldDiscreteCrossfade) and
// topo-graticule edge dispatcher consume these tables. The dispatch logic
// stays in SceneManager; only the project-specific data tables live here so
// they go away with the project.

import type { EditableStyle } from "../../pages/types";
import {
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_TOPO_GRATICULE_LAYER_ID,
} from "./layerIds";

export const UTAH_FORGE_DISCRETE_CROSSFADE_LAYER_IDS = new Set([
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_TOPO_GRATICULE_LAYER_ID,
]);

export const UTAH_FORGE_GRATICULE_EDGE_STYLE_FIELDS = [
  "graticuleEdgeFadeAware",
  "graticuleEdgeFadeStrength",
  "graticuleEdgeLineColor",
  "graticuleEdgeLineWidth",
  "graticuleEdgeLabelColor",
  "graticuleEdgeLabelVisible",
  "graticuleEdgeLabelOffsetM",
  "graticuleEdgeLabelGapM",
] as const satisfies readonly (keyof EditableStyle)[];
