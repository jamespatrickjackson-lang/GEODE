import * as THREE from "three";

export const DEFAULT_SURFACE_GRADIENT_LOW_COLOR = "#2cc9ff";
export const DEFAULT_SURFACE_GRADIENT_MID_COLOR = "#69f0b4";
export const DEFAULT_SURFACE_GRADIENT_HIGH_COLOR = "#f8dd6d";
export const DEFAULT_SCALAR_LOW_COLOR = "#2cc9ff";
export const DEFAULT_SCALAR_MID_COLOR = "#f8dd6d";
export const DEFAULT_SCALAR_HIGH_COLOR = "#ff637a";
export const DEFAULT_SEISMIC_LOW_COLOR = "#2456c9";
export const DEFAULT_SEISMIC_MID_COLOR = "#f4f7ff";
export const DEFAULT_SEISMIC_HIGH_COLOR = "#d9362f";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function clampRange(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function surfaceGradientColorAt(
  t: number,
  midpoint: number,
  contrast: number,
  lowColor: THREE.Color,
  midColor: THREE.Color,
  highColor: THREE.Color,
  target: THREE.Color,
): THREE.Color {
  const shaped = clamp01((clamp01(t) - 0.5) * contrast + 0.5);
  if (shaped < midpoint) {
    const localT = midpoint > 0 ? shaped / midpoint : 0;
    target.lerpColors(lowColor, midColor, clamp01(localT));
  } else {
    const highRange = Math.max(0.0001, 1 - midpoint);
    target.lerpColors(
      midColor,
      highColor,
      clamp01((shaped - midpoint) / highRange),
    );
  }
  return target;
}

export function scalarColorAt(
  value: number,
  displayMin: number,
  displayMax: number,
  midpoint: number,
  contrast: number,
  lowColor: THREE.Color,
  midColor: THREE.Color,
  highColor: THREE.Color,
  target: THREE.Color,
): THREE.Color {
  const range = Math.max(0.000001, displayMax - displayMin);
  return surfaceGradientColorAt(
    (value - displayMin) / range,
    midpoint,
    contrast,
    lowColor,
    midColor,
    highColor,
    target,
  );
}

export function seismicColorAt(
  value: number,
  displayMin: number,
  displayMax: number,
  colormap: string,
  amplitudeGamma: number,
  target: THREE.Color,
): THREE.Color {
  const rawT = clamp01(
    (value - displayMin) / Math.max(0.000001, displayMax - displayMin),
  );
  const gamma = clampRange(amplitudeGamma, 0.35, 2.5);
  const signed = (rawT - 0.5) * 2;
  const t =
    signed === 0
      ? 0.5
      : clamp01(
          0.5 + Math.sign(signed) * Math.pow(Math.abs(signed), gamma) * 0.5,
        );
  if (colormap === "grayscale") {
    return target.setRGB(t, t, t);
  }
  if (colormap === "velocity") {
    if (t < 0.33) {
      return target.lerpColors(
        new THREE.Color("#173b9a"),
        new THREE.Color("#33b6d7"),
        t / 0.33,
      );
    }
    if (t < 0.66) {
      return target.lerpColors(
        new THREE.Color("#33b6d7"),
        new THREE.Color("#f4df63"),
        (t - 0.33) / 0.33,
      );
    }
    return target.lerpColors(
      new THREE.Color("#f4df63"),
      new THREE.Color("#d34b2d"),
      (t - 0.66) / 0.34,
    );
  }
  if (t < 0.5) {
    return target.lerpColors(
      new THREE.Color(DEFAULT_SEISMIC_LOW_COLOR),
      new THREE.Color(DEFAULT_SEISMIC_MID_COLOR),
      t / 0.5,
    );
  }
  return target.lerpColors(
    new THREE.Color(DEFAULT_SEISMIC_MID_COLOR),
    new THREE.Color(DEFAULT_SEISMIC_HIGH_COLOR),
    (t - 0.5) / 0.5,
  );
}

export function seismicBackgroundAlphaAt(
  value: number,
  displayMin: number,
  displayMax: number,
  removeBackground: boolean,
  amplitudeGamma: number,
  backgroundCutoff: number,
): number {
  if (!removeBackground) return 1;
  const rawT = clamp01(
    (value - displayMin) / Math.max(0.000001, displayMax - displayMin),
  );
  const gamma = clampRange(amplitudeGamma, 0.35, 2.5);
  const signed = (rawT - 0.5) * 2;
  const t =
    signed === 0
      ? 0.5
      : clamp01(
          0.5 + Math.sign(signed) * Math.pow(Math.abs(signed), gamma) * 0.5,
        );
  const contrast = Math.abs(t - 0.5) * 2;
  const cutoff = clampRange(backgroundCutoff, 0, 0.45);
  return THREE.MathUtils.smoothstep(
    contrast,
    cutoff,
    Math.min(0.96, Math.max(0.62, cutoff + 0.22)),
  );
}

export function scalarDefaultRange(geometry: THREE.BufferGeometry): {
  min: number;
  max: number;
} {
  const scalar = geometry.userData.scalar as
    | { displayMin?: number; displayMax?: number; min?: number; max?: number }
    | undefined;
  const min =
    typeof scalar?.displayMin === "number" && Number.isFinite(scalar.displayMin)
      ? scalar.displayMin
      : typeof scalar?.min === "number" && Number.isFinite(scalar.min)
        ? scalar.min
        : 0;
  const max =
    typeof scalar?.displayMax === "number" && Number.isFinite(scalar.displayMax)
      ? scalar.displayMax
      : typeof scalar?.max === "number" && Number.isFinite(scalar.max)
        ? scalar.max
        : min + 1;
  return max > min ? { min, max } : { min, max: min + 1 };
}

export function scalarSourceRange(geometry: THREE.BufferGeometry): {
  min: number;
  max: number;
} {
  const scalar = geometry.userData.scalar as
    | { min?: number; max?: number; displayMin?: number; displayMax?: number }
    | undefined;
  const min =
    typeof scalar?.min === "number" && Number.isFinite(scalar.min)
      ? scalar.min
      : typeof scalar?.displayMin === "number" &&
          Number.isFinite(scalar.displayMin)
        ? scalar.displayMin
        : 0;
  const max =
    typeof scalar?.max === "number" && Number.isFinite(scalar.max)
      ? scalar.max
      : typeof scalar?.displayMax === "number" &&
          Number.isFinite(scalar.displayMax)
        ? scalar.displayMax
        : min + 1;
  return max > min ? { min, max } : { min, max: min + 1 };
}
