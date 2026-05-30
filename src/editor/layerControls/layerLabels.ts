import type { ProjectLayerSpec } from "../../pages/types";
import { CASE_STUDY_B_CONTROL_LAYER_IDS } from "../../projectModules/caseStudyB/layerIds";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import { topoMapLayerLabel } from "../../topoMap/settings";

export function layerHasRenderableControl(layer: ProjectLayerSpec): boolean {
  if ((layer as { disabled?: boolean }).disabled !== true) return true;
  return CASE_STUDY_B_CONTROL_LAYER_IDS.has(layer.id);
}

function layerIsPlaceholder(layer: ProjectLayerSpec): boolean {
  const metadata = layer.metadata as Record<string, unknown>;
  if (metadata.placeholder === true) return true;
  const text = [
    layer.label,
    metadata.sourceOrigin,
    metadata.sourceFile,
    metadata.notes,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return text.includes("placeholder") || text.includes("synthetic");
}

function stripForgeTerms(label: string): string {
  return label
    .replace(/\bUtah\s+FORGE\s+Phase\s*3\b/gi, "")
    .replace(/\bUtah\s+FORGE\b/gi, "")
    .replace(/\bFORGE[-\s]*/gi, "")
    .replace(/\bUtah\b/gi, "")
    .replace(/\bPhase\s*3\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function editorLayerLabel(layer: ProjectLayerSpec): string {
  const topoLabel = topoMapLayerLabel(layer);
  if (topoLabel) return topoLabel;
  const mtLabels: Record<string, string> = {
    [UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID]: "Phase 3 working area",
    [UTAH_FORGE_MT_STATIONS_LAYER_ID]: "GDR 1255 Station Locations",
    [UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID]:
      "3D MT resistivity full-density model",
    [UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID]: "3D MT top surface",
    [UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID]:
      "3D MT top-contact surface",
    [UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID]: "3D MT resistivity preview",
    [UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID]: "2D MT resistivity slices",
    [UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID]: "3D MT resistivity volume",
    [UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID]: "MT thresholds",
  };
  const label =
    layer.id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID
      ? "Seismic browser"
      : (mtLabels[layer.id] ?? stripForgeTerms(layer.label.trim()));
  if (!layerIsPlaceholder(layer) || /\(placeholder\)$/i.test(label)) {
    return label;
  }
  return `${label} (placeholder)`;
}

export function editorLayerTypeLabel(layer: ProjectLayerSpec): string {
  return layer.type === "pointcloud" ? "point cloud" : layer.type;
}
