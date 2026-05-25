import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import {
  MT_RESISTIVITY_TOOL_ID,
  type MtResistivityToolContract,
} from "./toolContract";

const MT_RESISTIVITY_MODEL_SOURCE =
  "projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/electrical_resistivity/mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip";

export const UTAH_FORGE_MT_RESISTIVITY_CONTRACT = {
  toolId: MT_RESISTIVITY_TOOL_ID,
  role: "global-geophysics-tool",
  sourceModel: {
    id: "utah-forge-mt-model-17-cell-centers",
    label: "Utah FORGE Phase 3 MT model 17 cell centers",
    sourcePath: MT_RESISTIVITY_MODEL_SOURCE,
    sourceEntry: "FRG200614_mdl17_cellcenter.dat",
    sourceCrs: "EPSG:26912",
    scalarField: "resistivity_ohm_m",
    scalarUnit: "ohm-m",
    scalarTransform: "log10",
  },
  products: [
    {
      id: "utah-forge-mt-full-density-point-cloud",
      kind: "pointCloud",
      layerId: UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
      sourceModelId: "utah-forge-mt-model-17-cell-centers",
      cropStatus: "full-source",
      dataPath:
        "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/full_density/manifest.json",
      provenancePath:
        "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/full_density/provenance.json",
    },
    {
      id: "utah-forge-mt-depth-slices",
      kind: "depthSlices",
      layerId: UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
      sourceModelId: "utah-forge-mt-model-17-cell-centers",
      cropStatus: "full-source",
      dataPath:
        "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/slices/resistivity_slices_mesh_preview.json",
      provenancePath:
        "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/slices/provenance.json",
    },
    {
      id: "utah-forge-mt-cross-sections",
      kind: "crossSections",
      layerId: UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
      sourceModelId: "utah-forge-mt-model-17-cell-centers",
      cropStatus: "full-source",
      dataPath:
        "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/slices/resistivity_slices_mesh_preview.json",
      provenancePath:
        "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/slices/provenance.json",
    },
    {
      id: "utah-forge-mt-threshold-isosurfaces",
      kind: "isosurfaces",
      layerId: UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
      sourceModelId: "utah-forge-mt-model-17-cell-centers",
      cropStatus: "presentation-crop",
      dataPath:
        "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/threshold_surfaces/mt_threshold_surfaces_mesh_preview.json",
      notes: [
        "Current browser isosurfaces are fixed threshold meshes derived from the source-model scalar volume.",
        "They are presentation-cropped around the FORGE-focused volume until the full-extent isosurface product is promoted.",
      ],
    },
    {
      id: "utah-forge-mt-scalar-volume",
      kind: "scalarVolume",
      layerId: UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
      sourceModelId: "utah-forge-mt-model-17-cell-centers",
      cropStatus: "full-source",
      dataPath:
        "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/mt_volume_manifest.json",
    },
  ],
} as const satisfies MtResistivityToolContract;

