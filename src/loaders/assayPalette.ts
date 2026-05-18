export interface AssayColorStop {
  id: string;
  label: string;
  color: string;
}

export interface AssayGradeBin extends AssayColorStop {
  min: number;
  max: number;
}

export const DEFAULT_ASSAY_COLOR_STOPS: AssayColorStop[] = [
  {
    id: "cu-0-2-0-3",
    label: "Cu 0.2 to 0.3%",
    color: "#d6b04a",
  },
  {
    id: "cu-0-3-0-4",
    label: "Cu 0.3 to 0.4%",
    color: "#c7773d",
  },
  {
    id: "cu-0-4-0-5",
    label: "Cu 0.4 to 0.5%",
    color: "#b5453f",
  },
  {
    id: "cu-over-0-5",
    label: "Cu over 0.5%",
    color: "#7d5aa6",
  },
];

export const CU_ASSAY_BINS: AssayGradeBin[] = [
  { ...DEFAULT_ASSAY_COLOR_STOPS[0], min: 0.2, max: 0.3 },
  { ...DEFAULT_ASSAY_COLOR_STOPS[1], min: 0.3, max: 0.4 },
  { ...DEFAULT_ASSAY_COLOR_STOPS[2], min: 0.4, max: 0.5 },
  { ...DEFAULT_ASSAY_COLOR_STOPS[3], min: 0.5, max: Infinity },
];
