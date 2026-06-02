export interface BackgroundEntry {
  id: string;
  label: string;
  /** CSS background value for the BackgroundStressOverlay. */
  cssBackground: string;
  /** Representative RGB used by the contrast rule. */
  representativeRgb: { r: number; g: number; b: number };
}

export const BUNDLED_BACKGROUNDS: readonly BackgroundEntry[] = [
  {
    id: "plain_dark",
    label: "Plain dark",
    cssBackground: "#0d0e12",
    representativeRgb: { r: 13, g: 14, b: 18 },
  },
  {
    id: "plain_light",
    label: "Plain light",
    cssBackground: "#f4f0e8",
    representativeRgb: { r: 244, g: 240, b: 232 },
  },
  {
    id: "noise_low_contrast",
    label: "Noise (low contrast)",
    cssBackground:
      "repeating-conic-gradient(rgba(140,140,140,1) 0deg 45deg, rgba(132,132,132,1) 45deg 90deg)",
    representativeRgb: { r: 136, g: 136, b: 136 },
  },
  {
    id: "terrain_capture",
    label: "Terrain capture",
    cssBackground:
      "linear-gradient(180deg, #3a4a3a 0%, #7a6b4a 50%, #4a3e2e 100%)",
    representativeRgb: { r: 110, g: 100, b: 75 },
  },
];

export function backgroundById(id: string | null): BackgroundEntry | undefined {
  if (!id) return undefined;
  return BUNDLED_BACKGROUNDS.find((b) => b.id === id);
}
