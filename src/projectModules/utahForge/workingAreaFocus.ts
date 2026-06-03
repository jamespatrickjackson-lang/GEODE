// Utah FORGE working-area focus defaults.
//
// SceneManager and LayerPanel both consume these defaults when a page
// doesn't override the working-area focus explicitly. The bounds are
// project-local Three.js coordinates (scene-local meters); they describe
// the Phase 3 working area at Utah FORGE. The target layer IDs decide
// which layers get the focus dim outside the working area.
//
// The render-order constant (WORKING_AREA_FOCUS_RENDER_ORDER) stays in
// SceneManager — it's a global z-order, not project-specific.

import * as THREE from "three";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "./layerIds";

export const WORKING_AREA_FOCUS_DEFAULT_OUTSIDE_OPACITY = 0.15;

export const WORKING_AREA_FOCUS_DEFAULT_BOUNDS = {
  min: new THREE.Vector3(-8041.4, -12617.6, -6200),
  max: new THREE.Vector3(-3841.4, -8417.6, 1800),
} as const;

export const WORKING_AREA_FOCUS_DEFAULT_TARGET_LAYER_IDS = [
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
] as const;
