import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import {
  resolveGeoSceneTransform,
  utmToSceneWithTransform,
  type GeoSceneTransformOptions,
} from "./geoTransform";
import { getHeightSampler, type HeightSampler } from "../scene/heightSampler";
import type { ProjectLayerSpec } from "../pages/types";

type NaipTile = {
  id: string;
  label: string;
  bounds: [number, number, number, number];
  color?: string;
};

const DEFAULT_LINE_WIDTH_PX = 7;
const DEFAULT_LIFT_M = 700;
const DEFAULT_LABEL_SIZE_M = 13000;
const DEFAULT_EDGE_SAMPLES = 64;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tileBounds(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const minX = finiteNumber(value[0]);
  const minY = finiteNumber(value[1]);
  const maxX = finiteNumber(value[2]);
  const maxY = finiteNumber(value[3]);
  if (minX === null || minY === null || maxX === null || maxY === null) {
    return null;
  }
  return [minX, minY, maxX, maxY];
}

function metadataRecord(spec: ProjectLayerSpec): Record<string, unknown> {
  return spec.metadata && typeof spec.metadata === "object"
    ? (spec.metadata as Record<string, unknown>)
    : {};
}

function metadataTiles(spec: ProjectLayerSpec): NaipTile[] {
  const metadata = metadataRecord(spec);
  const rawTiles = Array.isArray(metadata.naipTiles) ? metadata.naipTiles : [];
  return rawTiles.flatMap((raw, index): NaipTile[] => {
    if (!raw || typeof raw !== "object") return [];
    const record = raw as Record<string, unknown>;
    const bounds = tileBounds(record.bounds);
    if (!bounds) return [];
    const id =
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : `naip-tile-${index + 1}`;
    const label =
      typeof record.label === "string" && record.label.trim()
        ? record.label.trim()
        : id;
    const color =
      typeof record.color === "string" && record.color.trim()
        ? record.color.trim()
        : undefined;
    return [{ id, label, bounds, color }];
  });
}

function metadataNumber(
  metadata: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = finiteNumber(metadata[key]);
  return value === null ? fallback : value;
}

function appendEdge(
  positions: number[],
  from: [number, number],
  to: [number, number],
  samples: number,
  liftM: number,
  sampleHeight: HeightSampler,
  transform: ReturnType<typeof resolveGeoSceneTransform>,
) {
  let previous: [number, number, number] | null = null;
  for (let i = 0; i <= samples; i += 1) {
    const t = i / Math.max(1, samples);
    const easting = from[0] + (to[0] - from[0]) * t;
    const northing = from[1] + (to[1] - from[1]) * t;
    const elevation = sampleHeight(easting, northing) + liftM;
    const point = utmToSceneWithTransform(
      transform,
      easting,
      northing,
      elevation,
    );
    if (previous) positions.push(...previous, ...point);
    previous = point;
  }
}

function tileOutlinePositions(
  tile: NaipTile,
  samples: number,
  liftM: number,
  sampleHeight: HeightSampler,
  transform: ReturnType<typeof resolveGeoSceneTransform>,
): number[] {
  const [minX, minY, maxX, maxY] = tile.bounds;
  const positions: number[] = [];
  appendEdge(
    positions,
    [minX, minY],
    [maxX, minY],
    samples,
    liftM,
    sampleHeight,
    transform,
  );
  appendEdge(
    positions,
    [maxX, minY],
    [maxX, maxY],
    samples,
    liftM,
    sampleHeight,
    transform,
  );
  appendEdge(
    positions,
    [maxX, maxY],
    [minX, maxY],
    samples,
    liftM,
    sampleHeight,
    transform,
  );
  appendEdge(
    positions,
    [minX, maxY],
    [minX, minY],
    samples,
    liftM,
    sampleHeight,
    transform,
  );
  return positions;
}

function labelTexture(label: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "800 76px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createLabelPlaneAt(
  tile: NaipTile,
  color: string,
  labelSizeM: number,
  liftM: number,
  sampleHeight: HeightSampler,
  transform: ReturnType<typeof resolveGeoSceneTransform>,
  easting: number,
  northing: number,
  placement: string,
): THREE.Mesh {
  const elevation = sampleHeight(easting, northing) + liftM + 30;
  const [x, y, z] = utmToSceneWithTransform(
    transform,
    easting,
    northing,
    elevation,
  );
  const texture = labelTexture(tile.label, color);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  material.userData.preserveMaterialColor = true;
  material.toneMapped = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.name = `${tile.label} ${placement} map label`;
  mesh.position.set(x, y, z);
  mesh.scale.set(labelSizeM * 4, labelSizeM, 1);
  mesh.renderOrder = 7002;
  mesh.userData.displayName = tile.label;
  mesh.userData.naipTileDiagnosticLabel = true;
  return mesh;
}

function createLabelPlanes(
  tile: NaipTile,
  color: string,
  labelSizeM: number,
  liftM: number,
  sampleHeight: HeightSampler,
  transform: ReturnType<typeof resolveGeoSceneTransform>,
): THREE.Mesh[] {
  const [minX, minY, maxX, maxY] = tile.bounds;
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const positions: Array<[number, number, string]> = [
    [centerX, centerY, "center"],
    [centerX, minY, "south edge"],
    [maxX, centerY, "east edge"],
    [centerX, maxY, "north edge"],
    [minX, centerY, "west edge"],
  ];
  return positions.map(([easting, northing, placement]) =>
    createLabelPlaneAt(
      tile,
      color,
      labelSizeM,
      liftM,
      sampleHeight,
      transform,
      easting,
      northing,
      placement,
    ),
  );
}

function createTileOutline(
  tile: NaipTile,
  color: string,
  lineWidthPx: number,
  liftM: number,
  edgeSamples: number,
  sampleHeight: HeightSampler,
  transform: ReturnType<typeof resolveGeoSceneTransform>,
): Line2 {
  const geometry = new LineGeometry();
  geometry.setPositions(
    tileOutlinePositions(tile, edgeSamples, liftM, sampleHeight, transform),
  );
  const material = new LineMaterial({
    color: new THREE.Color(color).getHex(),
    linewidth: lineWidthPx,
    transparent: true,
    opacity: 0.98,
    depthTest: false,
    depthWrite: false,
  });
  material.userData.preserveMaterialColor = true;
  material.resolution.set(
    typeof window === "undefined" ? 1920 : window.innerWidth,
    typeof window === "undefined" ? 1080 : window.innerHeight,
  );
  const line = new Line2(geometry, material);
  line.name = `${tile.label} outline`;
  line.computeLineDistances();
  line.renderOrder = 7001;
  line.userData.displayName = tile.label;
  line.userData.naipTileDiagnosticOutline = true;
  return line;
}

export async function loadNaipTileDiagnostics(
  spec: ProjectLayerSpec,
  transformOptions?: GeoSceneTransformOptions,
): Promise<THREE.Group> {
  const metadata = metadataRecord(spec);
  const tiles = metadataTiles(spec);
  const transform = resolveGeoSceneTransform(transformOptions);
  const sampleHeight = await getHeightSampler();
  const liftM = metadataNumber(metadata, "diagnosticLiftM", DEFAULT_LIFT_M);
  const labelSizeM = metadataNumber(
    metadata,
    "diagnosticLabelSizeM",
    DEFAULT_LABEL_SIZE_M,
  );
  const lineWidthPx = metadataNumber(
    metadata,
    "diagnosticLineWidthPx",
    DEFAULT_LINE_WIDTH_PX,
  );
  const edgeSamples = Math.max(
    4,
    Math.round(
      metadataNumber(metadata, "diagnosticEdgeSamples", DEFAULT_EDGE_SAMPLES),
    ),
  );
  const group = new THREE.Group();
  group.name = spec.label || "NAIP 2024 tile diagnostics";
  group.userData.displayName = group.name;
  group.userData.naipTileDiagnostics = true;

  for (const tile of tiles) {
    const color = tile.color ?? "#ff4d4d";
    group.add(
      createTileOutline(
        tile,
        color,
        lineWidthPx,
        liftM,
        edgeSamples,
        sampleHeight,
        transform,
      ),
    );
    for (const label of createLabelPlanes(
      tile,
      color,
      labelSizeM,
      liftM,
      sampleHeight,
      transform,
    )) {
      group.add(label);
    }
  }

  return group;
}
