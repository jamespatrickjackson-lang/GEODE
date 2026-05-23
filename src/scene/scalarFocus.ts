export interface ScalarPositionAccessor {
  count: number;
  getX(index: number): number;
  getY(index: number): number;
  getZ(index: number): number;
}

export interface ScalarFocusWindow {
  trimMin: number;
  blendMin: number;
  blendMax: number;
  trimMax: number;
  supportValues?: Float32Array | null;
  noiseThreshold?: number;
}

const SCALAR_LATERAL_SUPPORT_XY_BIN_M = 2500;
const SCALAR_LATERAL_SUPPORT_Z_BIN_M = 1200;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function supportCellKey(ix: number, iy: number, iz: number): number {
  return (ix + 32768) * 4294967296 + (iy + 32768) * 65536 + iz + 32768;
}

export function deterministicScalarSample(index: number): number {
  let value = Math.imul(index + 1, 2654435761) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 2246822519) >>> 0;
  value ^= value >>> 13;
  return (value >>> 0) / 4294967295;
}

export function scalarValueIsVisible(
  values: Float32Array | number[],
  index: number,
  trimMin: number,
  blendMin: number,
  blendMax: number,
  trimMax: number,
): boolean {
  const value = values[index];
  if (!Number.isFinite(value)) return false;
  if (value < trimMin || value > trimMax) return false;
  if (value >= blendMin && value <= blendMax) return true;

  let weight = 0;
  if (value < blendMin) {
    const span = Math.max(0.000001, blendMin - trimMin);
    weight = (value - trimMin) / span;
  } else {
    const span = Math.max(0.000001, trimMax - blendMax);
    weight = (trimMax - value) / span;
  }

  if (weight >= 1) return true;
  if (weight <= 0) return false;
  return deterministicScalarSample(index) <= weight;
}

export function scalarVisibilityWeight(
  values: Float32Array | number[],
  index: number,
  trimMin: number,
  blendMin: number,
  blendMax: number,
  trimMax: number,
): number {
  const value = values[index];
  if (!Number.isFinite(value)) return 0;
  if (value < trimMin || value > trimMax) return 0;
  if (value >= blendMin && value <= blendMax) return 1;
  if (value < blendMin) {
    return clamp01((value - trimMin) / Math.max(0.000001, blendMin - trimMin));
  }
  return clamp01((trimMax - value) / Math.max(0.000001, trimMax - blendMax));
}

export function scalarLateralSupportValues(
  position: ScalarPositionAccessor,
): Float32Array {
  const occupied = new Set<number>();
  const cells = new Int32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const ix = Math.floor(position.getX(i) / SCALAR_LATERAL_SUPPORT_XY_BIN_M);
    const iy = Math.floor(position.getY(i) / SCALAR_LATERAL_SUPPORT_XY_BIN_M);
    const iz = Math.floor(position.getZ(i) / SCALAR_LATERAL_SUPPORT_Z_BIN_M);
    cells[i * 3] = ix;
    cells[i * 3 + 1] = iy;
    cells[i * 3 + 2] = iz;
    occupied.add(supportCellKey(ix, iy, iz));
  }

  const values = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 1) {
    const ix = cells[i * 3];
    const iy = cells[i * 3 + 1];
    const iz = cells[i * 3 + 2];
    let neighborCount = 0;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        if (occupied.has(supportCellKey(ix + dx, iy + dy, iz))) {
          neighborCount += 1;
        }
      }
    }
    values[i] = neighborCount / 8;
  }
  return values;
}

export function scalarInclusionVisibleCount(
  values: Float32Array | number[],
  window: ScalarFocusWindow,
): number {
  const supportValues = window.supportValues ?? null;
  const noiseThreshold =
    typeof window.noiseThreshold === "number" &&
    Number.isFinite(window.noiseThreshold)
      ? window.noiseThreshold
      : 0;
  let count = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (
      scalarValueIsVisible(
        values,
        i,
        window.trimMin,
        window.blendMin,
        window.blendMax,
        window.trimMax,
      ) &&
      (!supportValues || supportValues[i] >= noiseThreshold)
    ) {
      count += 1;
    }
  }
  return count;
}
