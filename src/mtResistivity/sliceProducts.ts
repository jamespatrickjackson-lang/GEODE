export type MtResistivitySliceKind = "horizontal-slice" | "vertical-section";

export interface MtResistivitySliceProduct {
  id: string;
  label: string;
  kind: MtResistivitySliceKind;
  elevationM?: number;
  sectionAzimuthDeg?: number;
  sourceWindowM?: number;
  sectionLine?: {
    orientation: "east-west" | "north-south";
    fixedX?: number;
    fixedY?: number;
    xMin?: number;
    xMax?: number;
    yMin?: number;
    yMax?: number;
  };
}

export const MT_RESISTIVITY_SLICE_PRODUCTS = [
  {
    id: "horizontal_elev_1500m",
    label: "+1500 m horizontal",
    kind: "horizontal-slice",
    elevationM: 1500,
    sourceWindowM: 180,
  },
  {
    id: "horizontal_elev_0m",
    label: "0 m horizontal",
    kind: "horizontal-slice",
    elevationM: 0,
    sourceWindowM: 450,
  },
  {
    id: "horizontal_elev_minus2500m",
    label: "-2500 m horizontal",
    kind: "horizontal-slice",
    elevationM: -2500,
    sourceWindowM: 850,
  },
  {
    id: "horizontal_elev_minus5000m",
    label: "-5000 m horizontal",
    kind: "horizontal-slice",
    elevationM: -5000,
    sourceWindowM: 1300,
  },
  {
    id: "horizontal_elev_minus10000m",
    label: "-10000 m horizontal",
    kind: "horizontal-slice",
    elevationM: -10000,
    sourceWindowM: 2600,
  },
  {
    id: "horizontal_elev_minus25000m",
    label: "-25000 m horizontal",
    kind: "horizontal-slice",
    elevationM: -25000,
    sourceWindowM: 6500,
  },
  {
    id: "vertical_ew_station_centroid",
    label: "E-W centroid section",
    kind: "vertical-section",
    sectionAzimuthDeg: 90,
    sourceWindowM: 4500,
    sectionLine: {
      orientation: "east-west",
      fixedY: -6738.565,
      xMin: -139570.65,
      xMax: 139570.65,
    },
  },
  {
    id: "vertical_ns_station_centroid",
    label: "N-S centroid section",
    kind: "vertical-section",
    sectionAzimuthDeg: 0,
    sourceWindowM: 4500,
    sectionLine: {
      orientation: "north-south",
      fixedX: -4282.363,
      yMin: -113944.5,
      yMax: 113944.5,
    },
  },
] as const satisfies readonly MtResistivitySliceProduct[];

export type MtResistivitySliceId =
  (typeof MT_RESISTIVITY_SLICE_PRODUCTS)[number]["id"];

export const DEFAULT_MT_RESISTIVITY_SLICE_ID: MtResistivitySliceId =
  "horizontal_elev_1500m";

export function mtResistivitySliceById(
  id: string | undefined,
): MtResistivitySliceProduct | undefined {
  return MT_RESISTIVITY_SLICE_PRODUCTS.find((product) => product.id === id);
}
