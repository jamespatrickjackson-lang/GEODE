// Canonical layer ID constants for the Utah FORGE project.
//
// Project-specific layer IDs live with the project so that removing the
// project removes its IDs — core files (SceneManager, LayerPanel,
// EditorChrome, EditorRoot, scene) import from here instead of declaring
// their own copies.
//
// Values must stay byte-identical to the strings used in project.json layer
// specs. Do not edit a value here without also updating the corresponding
// layer in projects/utah-forge/project.json (and vice versa).

export const UTAH_FORGE_MT_STATIONS_LAYER_ID = "utah-forge-mt-stations";

export const UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID =
  "utah-forge-mt-resistivity-full-density";

export const UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID =
  "utah-forge-mt-resistivity-volume";

export const UTAH_FORGE_MT_RESISTIVITY_POINT_CLOUD_LEGEND_LAYER_IDS = [
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
] as const;

export const UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID =
  "utah-forge-mt-resistivity-threshold-surfaces";

export const UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID = "utah-forge-mt-top-surface";

export const UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID =
  "utah-forge-mt-top-contact-surface";

export const UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID =
  "utah-forge-mt-resistivity-slices";

export const UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID =
  "utah-forge-mt-resistivity-preview";

export const UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID =
  "utah-forge-phase3-seismic-browser";

export const UTAH_FORGE_SCENE_SECTION_LAYER_ID =
  "utah-forge-scene-section-planes";

export const UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID =
  "utah-forge-phase3-working-area";

export const UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID =
  "utah-forge-phase3-demo-boreholes";

export const UTAH_FORGE_SITE_BOUNDARY_LAYER_ID = "utah-forge-site-boundary";

export const UTAH_FORGE_TOPO_GRATICULE_LAYER_ID = "utah-forge-topo-graticule";

export const UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID =
  "utah-forge-working-area-focus";
