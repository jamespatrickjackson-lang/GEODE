import type { EditableStyle } from "../pages/types";

export const LIGHT_MODE_TERRAIN_RAMP_LOW = "#4a4a4a";
export const LIGHT_MODE_TERRAIN_RAMP_MID = "#888888";
export const LIGHT_MODE_TERRAIN_RAMP_HIGH = "#cccccc";
export const TOPO_GRATICULE_MINOR_SCALE = 0.8;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function styleNumber(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = style[key];
  return typeof value === "number" && Number.isFinite(value)
    ? clampRange(value, min, max)
    : fallback;
}

export function styleAffectedByFog(style: EditableStyle): boolean {
  return style.affectedByFog !== false;
}

export function styleFogDensity(
  style: EditableStyle,
  fallback: number,
): number {
  return typeof style.fogDensity === "number" &&
    Number.isFinite(style.fogDensity)
    ? clampRange(style.fogDensity, 0.000001, 0.002)
    : fallback;
}

export function assetUrl(path: string, resolveAssetPath: (rel: string) => string): string {
  const trimmed = path.trim();
  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return resolveAssetPath(trimmed);
}
