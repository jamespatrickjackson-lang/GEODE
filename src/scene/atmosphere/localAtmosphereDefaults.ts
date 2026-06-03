import type { EditableStyle, ProjectLayerSpec, Vec3 } from "../../pages/types";
import type {
  AtmosphereVolumeBoundsMode,
  AtmosphereVolumeSubtype,
  LocalAtmosphereBounds,
  LocalAtmosphereVolumeMetadata,
  ResolvedLocalAtmosphereStyle,
} from "./atmosphereTypes";

export const DEFAULT_LOCAL_ATMOSPHERE_BOUNDS: LocalAtmosphereBounds = {
  mode: "box",
  center: [0, 0, 40],
  size: [120, 120, 70],
};

export const DEFAULT_LOCAL_ATMOSPHERE_STYLE = {
  atmosphereSubtype: "mist" as AtmosphereVolumeSubtype,
  color: "#dfe4e8",
  opacity: 0.28,
  atmosphereDensity: 0.45,
  atmosphereSoftness: 0.75,
  atmospherePuffCount: 72,
  atmospherePuffScaleM: 28,
  atmosphereScaleJitter: 0.55,
  atmosphereVerticalFalloff: 0.7,
  atmosphereEdgeFade: 0.85,
  atmosphereSeed: 101,
  atmosphereDriftEnabled: false,
  atmosphereDriftSpeedMps: 5,
  atmosphereDriftDirectionX: 1,
  atmosphereDriftDirectionY: 0,
  atmosphereDriftDirectionZ: 0,
  atmosphereDepthTest: true,
  atmosphereRenderOrder: 20,
  atmosphereBoundsHelperVisible: false,
} satisfies EditableStyle;

const SUBTYPES: AtmosphereVolumeSubtype[] = [
  "mist",
  "ground-fog",
  "cloud-bank",
  "steam-plume",
];

const BOUNDS_MODES: AtmosphereVolumeBoundsMode[] = ["box", "ellipsoid"];

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function positive(value: unknown, fallback: number, max = Number.POSITIVE_INFINITY): number {
  const next = finiteNumber(value, fallback);
  return clamp(next, 0.0001, max);
}

function intRange(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(clamp(finiteNumber(value, fallback), min, max));
}

function stringChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && choices.includes(value as T)
    ? (value as T)
    : fallback;
}

function metadata(spec: ProjectLayerSpec): LocalAtmosphereVolumeMetadata {
  const raw = spec.metadata?.localAtmosphereVolume;
  return raw && typeof raw === "object"
    ? (raw as LocalAtmosphereVolumeMetadata)
    : {};
}

function vecFromParts(
  x: unknown,
  y: unknown,
  z: unknown,
  fallback: Vec3,
): Vec3 {
  return [
    finiteNumber(x, fallback[0]),
    finiteNumber(y, fallback[1]),
    finiteNumber(z, fallback[2]),
  ];
}

function tupleValue(value: unknown, index: number): unknown {
  return Array.isArray(value) ? value[index] : undefined;
}

function boundsFromMetadata(spec: ProjectLayerSpec): LocalAtmosphereBounds {
  const bounds = metadata(spec).bounds ?? {};
  const fallback = DEFAULT_LOCAL_ATMOSPHERE_BOUNDS;
  const centerSource = bounds.center;
  const sizeSource = bounds.size;
  return {
    mode: stringChoice(bounds.mode, BOUNDS_MODES, fallback.mode),
    center: vecFromParts(
      tupleValue(centerSource, 0),
      tupleValue(centerSource, 1),
      tupleValue(centerSource, 2),
      fallback.center,
    ),
    size: vecFromParts(
      tupleValue(sizeSource, 0),
      tupleValue(sizeSource, 1),
      tupleValue(sizeSource, 2),
      fallback.size,
    ).map((component, index) =>
      positive(component, fallback.size[index], 1000000),
    ) as Vec3,
  };
}

function normalizedDirection(style: EditableStyle): Vec3 {
  const direction: Vec3 = [
    finiteNumber(
      style.atmosphereDriftDirectionX,
      DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereDriftDirectionX,
    ),
    finiteNumber(
      style.atmosphereDriftDirectionY,
      DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereDriftDirectionY,
    ),
    finiteNumber(
      style.atmosphereDriftDirectionZ,
      DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereDriftDirectionZ,
    ),
  ];
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (length <= 0.0001) return [1, 0, 0];
  return [direction[0] / length, direction[1] / length, direction[2] / length];
}

export function resolveLocalAtmosphereStyle(
  spec: ProjectLayerSpec,
  style: EditableStyle = {},
): ResolvedLocalAtmosphereStyle {
  const meta = metadata(spec);
  const metaBounds = boundsFromMetadata(spec);
  const bounds: LocalAtmosphereBounds = {
    mode: stringChoice(
      style.atmosphereBoundsMode,
      BOUNDS_MODES,
      metaBounds.mode,
    ),
    center: vecFromParts(
      style.atmosphereBoundsCenterX,
      style.atmosphereBoundsCenterY,
      style.atmosphereBoundsCenterZ,
      metaBounds.center,
    ),
    size: vecFromParts(
      style.atmosphereBoundsSizeX,
      style.atmosphereBoundsSizeY,
      style.atmosphereBoundsSizeZ,
      metaBounds.size,
    ).map((component, index) =>
      positive(component, metaBounds.size[index], 1000000),
    ) as Vec3,
  };
  return {
    subtype: stringChoice(
      style.atmosphereSubtype,
      SUBTYPES,
      meta.subtype ?? DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereSubtype,
    ),
    bounds,
    color:
      typeof style.color === "string"
        ? style.color
        : DEFAULT_LOCAL_ATMOSPHERE_STYLE.color,
    opacity: clamp(
      finiteNumber(style.opacity, DEFAULT_LOCAL_ATMOSPHERE_STYLE.opacity),
      0,
      1,
    ),
    density: clamp(
      finiteNumber(
        style.atmosphereDensity,
        DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereDensity,
      ),
      0,
      1,
    ),
    softness: clamp(
      finiteNumber(
        style.atmosphereSoftness,
        DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereSoftness,
      ),
      0.05,
      1,
    ),
    puffCount: intRange(
      style.atmospherePuffCount,
      DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmospherePuffCount,
      1,
      240,
    ),
    puffScaleM: positive(
      style.atmospherePuffScaleM,
      DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmospherePuffScaleM,
      100000,
    ),
    scaleJitter: clamp(
      finiteNumber(
        style.atmosphereScaleJitter,
        DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereScaleJitter,
      ),
      0,
      2,
    ),
    verticalFalloff: clamp(
      finiteNumber(
        style.atmosphereVerticalFalloff,
        DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereVerticalFalloff,
      ),
      0,
      1,
    ),
    edgeFade: clamp(
      finiteNumber(
        style.atmosphereEdgeFade,
        DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereEdgeFade,
      ),
      0,
      1,
    ),
    seed: intRange(
      style.atmosphereSeed,
      DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereSeed,
      1,
      2147483646,
    ),
    driftEnabled:
      style.atmosphereDriftEnabled ??
      DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereDriftEnabled,
    driftSpeedMps: finiteNumber(
      style.atmosphereDriftSpeedMps,
      DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereDriftSpeedMps,
    ),
    driftDirection: normalizedDirection(style),
    depthTest:
      style.atmosphereDepthTest ??
      DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereDepthTest,
    renderOrder: finiteNumber(
      style.atmosphereRenderOrder,
      DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereRenderOrder,
    ),
    boundsHelperVisible:
      style.atmosphereBoundsHelperVisible === true ||
      DEFAULT_LOCAL_ATMOSPHERE_STYLE.atmosphereBoundsHelperVisible,
  };
}

export function localAtmosphereTextureCacheKey(
  layerId: string,
  seed: number,
  softness: number,
): string {
  return `local-atmosphere:${layerId}:${seed}:${softness}`;
}

export function localAtmosphereStructuralKey(
  resolved: ResolvedLocalAtmosphereStyle,
): string {
  return JSON.stringify({
    subtype: resolved.subtype,
    bounds: resolved.bounds,
    density: resolved.density,
    softness: resolved.softness,
    puffCount: resolved.puffCount,
    puffScaleM: resolved.puffScaleM,
    scaleJitter: resolved.scaleJitter,
    verticalFalloff: resolved.verticalFalloff,
    edgeFade: resolved.edgeFade,
    seed: resolved.seed,
  });
}
