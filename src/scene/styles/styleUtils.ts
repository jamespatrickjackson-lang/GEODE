import * as THREE from "three";
import type { EditableStyle } from "../../pages/types";

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function clampRange(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function styleColor(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: string,
): THREE.Color {
  const color = new THREE.Color();
  const value = style[key];
  try {
    color.set(typeof value === "string" ? value : fallback);
  } catch {
    color.set(fallback);
  }
  return color;
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
