// Canonical Case Study B project constants.
//
// Project-specific identifiers live with the project so that removing the
// project removes its IDs — core files (SceneManager, LayerPanel,
// audience module) import from here instead of declaring their own copies.
//
// Values must stay byte-identical to the strings used in project.json layer
// specs and to the mesh names set in loadDemoQuarry.ts. Do not edit a value
// here without also updating the corresponding layer/mesh.

export const CASE_STUDY_B_SLUG = "case-study-b";

export const CASE_STUDY_B_DEMO_SHELL_LAYER_ID = "case-study-b-demo-shell";

// The "control" layer IDs are the demo shell + every demo-public layer that
// LayerPanel needs to treat as renderable even when its disabled flag is
// set. (loadDemoQuarry assembles all of these under the single shell mesh,
// so they have no own scene object — the panel still has to surface them.)
export const CASE_STUDY_B_CONTROL_LAYER_IDS = new Set<string>([
  CASE_STUDY_B_DEMO_SHELL_LAYER_ID,
  "quarry-imagery-base",
  "quarry-lidar-surface",
  "bench-conformance-overlay",
  "haul-route-equipment-demo",
  "stockpile-volume-zones",
  "quarry-drill-traces",
  "quarry-ore-grade-heatmap",
  "slope-stability-anomaly",
  "erosion-runoff-planning",
  "restoration-preview",
  "public-viewshed-overlay",
]);
