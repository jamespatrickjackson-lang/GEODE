export const MT_RESISTIVITY_TOOL_ID = "mt-resistivity";

export type MtResistivityProductKind =
  | "pointCloud"
  | "depthSlices"
  | "crossSections"
  | "isosurfaces"
  | "scalarVolume";

export type MtResistivityCropStatus = "full-source" | "presentation-crop";

export interface MtResistivitySourceModel {
  id: string;
  label: string;
  sourcePath: string;
  sourceEntry: string;
  sourceCrs: string;
  scalarField: "resistivity_ohm_m";
  scalarUnit: "ohm-m";
  scalarTransform: "log10";
}

export interface MtResistivitySourceCounts {
  sourceRows: number;
  positiveResistivityRows: number;
  maskedRows: number;
}

export interface MtResistivityProductContract {
  id: string;
  kind: MtResistivityProductKind;
  layerId: string;
  sourceModelId: string;
  cropStatus: MtResistivityCropStatus;
  dataPath: string;
  provenancePath?: string;
  notes?: readonly string[];
}

export interface MtResistivityToolContract {
  toolId: typeof MT_RESISTIVITY_TOOL_ID;
  role: "global-geophysics-tool";
  sourceModel: MtResistivitySourceModel;
  products: readonly MtResistivityProductContract[];
}

export function mtProductIsAuthoritative(
  product: MtResistivityProductContract,
): boolean {
  return product.cropStatus === "full-source";
}

