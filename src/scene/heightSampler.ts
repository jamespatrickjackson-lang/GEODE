import type * as THREE from "three";

// Broker module for cross-loader handoffs that don't fit cleanly into
// the layer-registry pattern:
//   - HeightSampler: terrain GeoTIFF -> bilinear height query. Used by
//     hydrography stream draping + ring outline draping for targets.
//   - OverlayMask slots: rasterized polygon masks passed to the terrain
//     shader so layers like lakes and target glow-fills are PAINTED ONTO
//     terrain pixels rather than rendered as their own meshes (avoids
//     z-fighting, vertex-normal lighting, and the "crumpled tinfoil"
//     look). Each slot is keyed by string id (e.g. "lake",
//     "target-three-firs", "target-great-plains") so multiple
//     overlays can coexist independently.

export type HeightSampler = (utmX: number, utmY: number) => number;

export interface OverlayMaskInfo {
  texture: THREE.Texture;
  boundsMin: [number, number];
  boundsMax: [number, number];
}

// ---- HeightSampler --------------------------------------------------------

let currentSampler: HeightSampler | null = null;
let samplerWaiters: Array<(s: HeightSampler) => void> = [];

export function setHeightSampler(s: HeightSampler): void {
  currentSampler = s;
  const drained = samplerWaiters;
  samplerWaiters = [];
  for (const resolve of drained) resolve(s);
}

export function getHeightSampler(): Promise<HeightSampler> {
  if (currentSampler) return Promise.resolve(currentSampler);
  return new Promise<HeightSampler>((resolve) => samplerWaiters.push(resolve));
}

// ---- Overlay masks -------------------------------------------------------

const overlayMasks = new Map<string, OverlayMaskInfo>();
const overlayListeners: Array<
  (slot: string, info: OverlayMaskInfo) => void
> = [];

export function setOverlayMask(slot: string, info: OverlayMaskInfo): void {
  overlayMasks.set(slot, info);
  for (const cb of overlayListeners) cb(slot, info);
}

export function peekOverlayMask(slot: string): OverlayMaskInfo | null {
  return overlayMasks.get(slot) ?? null;
}

export function subscribeOverlayMask(
  cb: (slot: string, info: OverlayMaskInfo) => void,
): () => void {
  overlayListeners.push(cb);
  return () => {
    const i = overlayListeners.indexOf(cb);
    if (i >= 0) overlayListeners.splice(i, 1);
  };
}

// Backwards-compat shims for the existing lake-only API. loadHydrography
// still calls setLakeMask; loadTerrain still uses peekLakeMask /
// subscribeLakeMask. Internally these now route through the generic
// overlay-mask broker with slot id "lake".

export interface LakeMaskInfo extends OverlayMaskInfo {}

export function setLakeMask(info: LakeMaskInfo): void {
  setOverlayMask("lake", info);
}

export function peekLakeMask(): LakeMaskInfo | null {
  return peekOverlayMask("lake");
}

export function subscribeLakeMask(
  cb: (m: LakeMaskInfo) => void,
): () => void {
  return subscribeOverlayMask((slot, info) => {
    if (slot === "lake") cb(info);
  });
}
