import { PROJECT_BOUNDS, SCENE_ORIGIN } from "../constants";

export interface GeoBounds {
  min: { easting: number; northing: number; elevation: number };
  max: { easting: number; northing: number; elevation: number };
}

export interface GeoSceneTransform {
  sourceCrs: string;
  origin: { easting: number; northing: number; elevation: number };
  bounds: GeoBounds;
}

export interface GeoSceneTransformOptions {
  sourceCrs?: string;
  sceneOriginUtm?: unknown;
  bounds?: unknown;
  terrainMaxVertices?: number;
  terrainGridEnabled?: boolean;
}

const DEFAULT_TRANSFORM: GeoSceneTransform = {
  sourceCrs: "EPSG:26910",
  origin: {
    easting: SCENE_ORIGIN.easting,
    northing: SCENE_ORIGIN.northing,
    elevation: SCENE_ORIGIN.elevation,
  },
  bounds: {
    min: {
      easting: PROJECT_BOUNDS.min.easting,
      northing: PROJECT_BOUNDS.min.northing,
      elevation: PROJECT_BOUNDS.min.elevation,
    },
    max: {
      easting: PROJECT_BOUNDS.max.easting,
      northing: PROJECT_BOUNDS.max.northing,
      elevation: PROJECT_BOUNDS.max.elevation,
    },
  },
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function vectorLikeToOrigin(value: unknown): GeoSceneTransform["origin"] | null {
  if (Array.isArray(value) && value.length >= 3) {
    const easting = finiteNumber(value[0]);
    const northing = finiteNumber(value[1]);
    const elevation = finiteNumber(value[2]);
    if (easting !== null && northing !== null && elevation !== null) {
      return { easting, northing, elevation };
    }
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const easting = finiteNumber(record.easting ?? record.easting_m);
  const northing = finiteNumber(record.northing ?? record.northing_m);
  const elevation = finiteNumber(record.elevation ?? record.elevation_m ?? 0);
  if (easting === null || northing === null || elevation === null) return null;
  return { easting, northing, elevation };
}

function vectorLikeToBounds(value: unknown): GeoBounds | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const min = vectorLikeToOrigin(record.min);
  const max = vectorLikeToOrigin(record.max);
  if (min && max) return { min, max };
  return null;
}

export function geoTransformOptionsFromMetadata(
  metadata: Record<string, unknown> | undefined,
): GeoSceneTransformOptions | undefined {
  const candidate = metadata?.geoTransform;
  return typeof candidate === "object" && candidate !== null
    ? (candidate as GeoSceneTransformOptions)
    : undefined;
}

export function resolveGeoSceneTransform(
  options?: GeoSceneTransformOptions,
): GeoSceneTransform {
  const origin = vectorLikeToOrigin(options?.sceneOriginUtm);
  const bounds = vectorLikeToBounds(options?.bounds);
  return {
    sourceCrs:
      typeof options?.sourceCrs === "string"
        ? options.sourceCrs
        : DEFAULT_TRANSFORM.sourceCrs,
    origin: origin ?? DEFAULT_TRANSFORM.origin,
    bounds: bounds ?? DEFAULT_TRANSFORM.bounds,
  };
}

export function utmToSceneWithTransform(
  transform: GeoSceneTransform,
  easting: number,
  northing: number,
  elevation: number,
): [number, number, number] {
  return [
    easting - transform.origin.easting,
    northing - transform.origin.northing,
    elevation - transform.origin.elevation,
  ];
}

export function sceneToUtmWithTransform(
  transform: GeoSceneTransform,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  return [
    x + transform.origin.easting,
    y + transform.origin.northing,
    z + transform.origin.elevation,
  ];
}
