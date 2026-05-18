import * as THREE from "three";
import { debugLog } from "../utils/debugLog";

interface TiledPointCloudTile {
  id: string;
  file: string;
  scalarFile?: string;
  pointCount: number;
  sceneBounds?: {
    min: [number, number, number];
    max: [number, number, number];
  } | null;
}

interface TiledPointCloudManifest {
  schema: string;
  label?: string;
  source?: Record<string, unknown>;
  sourceBounds?: Record<string, unknown>;
  sceneBounds?: {
    min: [number, number, number];
    max: [number, number, number];
  };
  scenePlacement?: Record<string, unknown>;
  attributes?: {
    scalar?: {
      name?: string;
      unit?: string;
      min?: number;
      max?: number;
      displayMin?: number;
      displayMax?: number;
      colorStops?: Array<{
        value: number;
        color: string;
      }>;
    };
  };
  tiles: TiledPointCloudTile[];
}

const LOW_COLOR = new THREE.Color("#2cc9ff");
const MID_COLOR = new THREE.Color("#69f0b4");
const HIGH_COLOR = new THREE.Color("#f8dd6d");

function heightColor(t: number): THREE.Color {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const color = new THREE.Color();
  if (clamped < 0.5) {
    color.lerpColors(LOW_COLOR, MID_COLOR, clamped / 0.5);
  } else {
    color.lerpColors(MID_COLOR, HIGH_COLOR, (clamped - 0.5) / 0.5);
  }
  return color;
}

function colorBuffer(positions: Float32Array, minZ: number, maxZ: number): Float32Array {
  const colors = new Float32Array(positions.length);
  const zRange = Math.max(1, maxZ - minZ);
  const scratch = new THREE.Color();
  for (let i = 0; i < positions.length; i += 3) {
    scratch.copy(heightColor((positions[i + 2] - minZ) / zRange));
    colors[i] = scratch.r;
    colors[i + 1] = scratch.g;
    colors[i + 2] = scratch.b;
  }
  return colors;
}

function safeColor(value: string | undefined, fallback: string): THREE.Color {
  const color = new THREE.Color();
  try {
    color.set(value ?? fallback);
  } catch {
    color.set(fallback);
  }
  return color;
}

function scalarColor(
  value: number,
  displayMin: number,
  displayMax: number,
  stops: Array<{ value: number; color: string }> | undefined,
): THREE.Color {
  const fallbackStops = [
    { value: displayMin, color: "#2cc9ff" },
    { value: displayMin + (displayMax - displayMin) * 0.5, color: "#f8dd6d" },
    { value: displayMax, color: "#ff637a" },
  ];
  const resolvedStops = (stops?.length ? stops : fallbackStops)
    .filter((stop) => Number.isFinite(stop.value))
    .sort((a, b) => a.value - b.value);

  if (resolvedStops.length === 0) return heightColor(0.5);
  if (value <= resolvedStops[0].value) {
    return safeColor(resolvedStops[0].color, "#2cc9ff");
  }
  const last = resolvedStops[resolvedStops.length - 1];
  if (value >= last.value) {
    return safeColor(last.color, "#ff637a");
  }

  for (let index = 1; index < resolvedStops.length; index += 1) {
    const high = resolvedStops[index];
    const low = resolvedStops[index - 1];
    if (value > high.value) continue;
    const range = Math.max(0.000001, high.value - low.value);
    const t = THREE.MathUtils.clamp((value - low.value) / range, 0, 1);
    const color = new THREE.Color();
    color.lerpColors(
      safeColor(low.color, "#2cc9ff"),
      safeColor(high.color, "#ff637a"),
      t,
    );
    return color;
  }

  return safeColor(last.color, "#ff637a");
}

function scalarColorBuffer(
  scalarValues: Float32Array,
  displayMin: number,
  displayMax: number,
  stops: Array<{ value: number; color: string }> | undefined,
): Float32Array {
  const colors = new Float32Array(scalarValues.length * 3);
  const scratch = new THREE.Color();
  for (let i = 0; i < scalarValues.length; i += 1) {
    scratch.copy(
      scalarColor(
        Number.isFinite(scalarValues[i]) ? scalarValues[i] : displayMin,
        displayMin,
        displayMax,
        stops,
      ),
    );
    const offset = i * 3;
    colors[offset] = scratch.r;
    colors[offset + 1] = scratch.g;
    colors[offset + 2] = scratch.b;
  }
  return colors;
}

export async function loadTiledPointCloudPreview(url: string): Promise<THREE.Group> {
  const manifestResponse = await fetch(url);
  if (!manifestResponse.ok) {
    throw new Error(
      `Failed to fetch tiled point-cloud manifest ${url}: ${manifestResponse.status}`,
    );
  }

  const manifest = (await manifestResponse.json()) as TiledPointCloudManifest;
  if (
    manifest.schema !== "geosee.tiled-pointcloud-preview.v1" ||
    !Array.isArray(manifest.tiles)
  ) {
    throw new Error(`Invalid tiled point-cloud manifest: ${url}`);
  }

  const group = new THREE.Group();
  group.name = manifest.label ?? "Tiled point-cloud preview";
  group.userData = {
    displayName: manifest.label ?? "Tiled point-cloud preview",
    source: manifest.source,
    sourceBounds: manifest.sourceBounds,
    sceneBounds: manifest.sceneBounds,
    scenePlacement: manifest.scenePlacement,
    attributes: manifest.attributes,
    tiledPointCloudPreview: true,
  };

  const minZ = manifest.sceneBounds?.min?.[2] ?? 0;
  const maxZ = manifest.sceneBounds?.max?.[2] ?? minZ + 1;
  const scalar = manifest.attributes?.scalar;
  const scalarDisplayMin =
    typeof scalar?.displayMin === "number" && Number.isFinite(scalar.displayMin)
      ? scalar.displayMin
      : typeof scalar?.min === "number" && Number.isFinite(scalar.min)
        ? scalar.min
        : 0;
  const rawScalarDisplayMax =
    typeof scalar?.displayMax === "number" && Number.isFinite(scalar.displayMax)
      ? scalar.displayMax
      : typeof scalar?.max === "number" && Number.isFinite(scalar.max)
        ? scalar.max
        : scalarDisplayMin + 1;
  const scalarDisplayMax = Math.max(
    rawScalarDisplayMax,
    scalarDisplayMin + 0.000001,
  );
  const baseMaterial = new THREE.PointsMaterial({
    size: 2.1,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });

  const baseUrl = manifestResponse.url || new URL(url, window.location.href).toString();
  const tileObjects = await Promise.all(
    manifest.tiles.map(async (tile) => {
      const tileUrl = new URL(tile.file, baseUrl).toString();
      const tileResponse = await fetch(tileUrl);
      if (!tileResponse.ok) {
        throw new Error(`Failed to fetch point-cloud tile ${tile.file}: ${tileResponse.status}`);
      }
      const buffer = await tileResponse.arrayBuffer();
      if (buffer.byteLength % 12 !== 0) {
        throw new Error(`Invalid point-cloud tile byte length for ${tile.file}`);
      }
      const positions = new Float32Array(buffer);
      let scalarValues: Float32Array | null = null;
      if (tile.scalarFile) {
        const scalarUrl = new URL(tile.scalarFile, baseUrl).toString();
        const scalarResponse = await fetch(scalarUrl);
        if (!scalarResponse.ok) {
          throw new Error(
            `Failed to fetch point-cloud scalar tile ${tile.scalarFile}: ${scalarResponse.status}`,
          );
        }
        const scalarBuffer = await scalarResponse.arrayBuffer();
        if (scalarBuffer.byteLength % 4 !== 0) {
          throw new Error(
            `Invalid point-cloud scalar byte length for ${tile.scalarFile}`,
          );
        }
        scalarValues = new Float32Array(scalarBuffer);
        if (scalarValues.length !== positions.length / 3) {
          throw new Error(
            `Scalar count mismatch for ${tile.scalarFile}: expected ${
              positions.length / 3
            }, got ${scalarValues.length}`,
          );
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(
          scalarValues
            ? scalarColorBuffer(
                scalarValues,
                scalarDisplayMin,
                scalarDisplayMax,
                scalar?.colorStops,
              )
            : colorBuffer(positions, minZ, maxZ),
          3,
        ),
      );
      if (scalarValues) {
        geometry.userData.scalarValues = scalarValues;
        geometry.userData.scalar = {
          ...(scalar ?? {}),
          displayMin: scalarDisplayMin,
          displayMax: scalarDisplayMax,
        };
        geometry.userData.scalarColorMode = "scalar";
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const points = new THREE.Points(geometry, baseMaterial.clone());
      points.name = tile.id;
      points.renderOrder = 12.15;
      points.userData = {
        displayName: manifest.label ?? "Tiled point-cloud preview",
        tileId: tile.id,
        pointCount: tile.pointCount,
        sceneBounds: tile.sceneBounds,
        colorMode: scalarValues ? "scalar" : "height",
        tiledPointCloudTile: true,
      };
      return points;
    }),
  );

  for (const tile of tileObjects) group.add(tile);
  debugLog(
    `[loadTiledPointCloudPreview] ${tileObjects.length} tiles, ${manifest.tiles.reduce(
      (sum, tile) => sum + tile.pointCount,
      0,
    )} points from ${url}`,
  );
  return group;
}
