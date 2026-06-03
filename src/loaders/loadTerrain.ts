import * as THREE from "three";
import { fromArrayBuffer } from "geotiff";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import {
  buildTerrainMaterial,
  type TerrainMaterialParams,
} from "../scene/terrainMaterial";
import {
  peekOverlayMask,
  setHeightSampler,
  subscribeOverlayMask,
  type HeightSampler,
} from "../scene/heightSampler";
import type { TargetSlotId } from "../scene/terrainMaterial";
import { debugLog } from "../utils/debugLog";
import {
  resolveGeoSceneTransform,
  utmToSceneWithTransform,
  type GeoSceneTransform,
  type GeoSceneTransformOptions,
} from "./geoTransform";

const TARGET_SLOTS: TargetSlotId[] = [
  "target-three-firs",
  "target-great-plains",
];
const GRID_UNDERSIDE_OFFSET_M = 8;
const GRID_SAMPLE_STEP_M = 250;
const DEFAULT_TERRAIN_MAX_VERTICES = 900_000;
const TERRAIN_TILE_COLUMNS = 8;
const TERRAIN_TILE_ROWS = 8;
const TERRAIN_LOD_CAMERA_EPSILON_M = 5_000;

interface TerrainGridHandle {
  material: LineMaterial;
  line: LineSegments2;
  update(params?: TerrainMaterialParams): void;
  updateCameraVisibility(camera: THREE.Camera): void;
}

type TerrainLodTierName = "coarse" | "standard" | "source";

interface TerrainLodDebugState {
  activeTileCount: number;
  activeVertexEstimate: number;
  lodTierCounts: Record<TerrainLodTierName, number>;
  lastUpdateReason: string;
}

interface TerrainLodHandle {
  updateCameraLod(camera: THREE.Camera): void;
  debugState: TerrainLodDebugState;
}

interface TerrainTileRecord {
  sourceX0: number;
  sourceX1: number;
  sourceY0: number;
  sourceY1: number;
  center: THREE.Vector3;
  tier: TerrainLodTierName;
}

function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function firstGridLine(min: number, spacing: number): number {
  return Math.ceil(min / spacing) * spacing;
}

function buildGridPositions(
  bbox: number[],
  sample: HeightSampler,
  terrainOffset: THREE.Vector3,
  spacing: number,
  transform: GeoSceneTransform,
): number[] {
  const [minX, minY, maxX, maxY] = bbox;
  const positions: number[] = [];
  const step = clampRange(Math.min(spacing / 4, GRID_SAMPLE_STEP_M), 80, 350);

  const pushPoint = (utmX: number, utmY: number): [number, number, number] => {
    const z = sample(utmX, utmY) - GRID_UNDERSIDE_OFFSET_M;
    const [sx, sy, sz] = utmToSceneWithTransform(transform, utmX, utmY, z);
    return [sx - terrainOffset.x, sy - terrainOffset.y, sz - terrainOffset.z];
  };

  for (let e = firstGridLine(minX, spacing); e <= maxX; e += spacing) {
    let prev: [number, number, number] | null = null;
    for (let n = minY; n <= maxY + 0.001; n += step) {
      const point = pushPoint(e, Math.min(n, maxY));
      if (prev) positions.push(prev[0], prev[1], prev[2], ...point);
      prev = point;
    }
  }

  for (let n = firstGridLine(minY, spacing); n <= maxY; n += spacing) {
    let prev: [number, number, number] | null = null;
    for (let e = minX; e <= maxX + 0.001; e += step) {
      const point = pushPoint(Math.min(e, maxX), n);
      if (prev) positions.push(prev[0], prev[1], prev[2], ...point);
      prev = point;
    }
  }

  return positions;
}

function buildTerrainGridHandle(
  bbox: number[],
  sample: HeightSampler,
  terrainOffset: THREE.Vector3,
  transform: GeoSceneTransform,
): TerrainGridHandle {
  const showBelowTerrainM = 20;
  const hideAboveTerrainM = 20;
  const material = new LineMaterial({
    color: 0xbababa,
    linewidth: 2.75,
    worldUnits: false,
    transparent: true,
    opacity: 0.72,
    depthTest: true,
    depthWrite: false,
  });
  material.fog = true;
  material.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );
  material.userData.terrainGridMaterial = true;
  material.userData.ignoreLayerStyle = true;

  const geom = new LineSegmentsGeometry();
  const line = new LineSegments2(geom, material);
  line.name = "terrain-underside-grid";
  line.renderOrder = -1;
  line.userData.terrainUndersideGrid = true;
  line.userData.ignoreLayerStyle = true;
  line.userData.terrainUndersideGridVisibleByCamera = false;
  line.userData.terrainUndersideGridShowBelowTerrainM = showBelowTerrainM;
  line.userData.terrainUndersideGridHideAboveTerrainM = hideAboveTerrainM;

  let currentSpacing = -1;
  let enabledBySettings = true;
  let opacityBySettings = 0.72;
  let visibleByCamera = false;
  const rebuild = (spacing: number) => {
    const next = buildGridPositions(
      bbox,
      sample,
      terrainOffset,
      spacing,
      transform,
    );
    const nextGeom = new LineSegmentsGeometry();
    nextGeom.setPositions(next);
    line.geometry.dispose();
    line.geometry = nextGeom;
    line.computeLineDistances();
  };

  const update = (params: TerrainMaterialParams = {}) => {
    const visible = params.gridEnabled ?? true;
    const opacity = clampRange(params.gridOpacity ?? 0.68, 0, 1);
    const spacing = clampRange(params.gridSpacingM ?? 600, 250, 4000);
    if (Math.abs(spacing - currentSpacing) > 0.001) {
      currentSpacing = spacing;
      rebuild(spacing);
    }
    enabledBySettings = visible;
    opacityBySettings = opacity;
    line.visible = visible && opacity > 0.001 && visibleByCamera;
    material.color.set(params.gridColor ?? "#bababa");
    material.opacity = opacity;
    material.linewidth = clampRange(params.gridLineWidthM ?? 2.75, 0.25, 8);
    line.userData.terrainUndersideGridEnabledBySettings = enabledBySettings;
    line.userData.terrainUndersideGridOpacity = opacityBySettings;
    line.userData.terrainUndersideGridSpacingM = spacing;
    line.userData.terrainUndersideGridLineWidthPx = material.linewidth;
    material.needsUpdate = true;
  };

  const updateCameraVisibility = (camera: THREE.Camera) => {
    if (!enabledBySettings || opacityBySettings <= 0.001) {
      visibleByCamera = false;
      line.visible = false;
      line.userData.terrainUndersideGridVisibleByCamera = visibleByCamera;
      line.userData.terrainUndersideGridHiddenReason = "settings";
      return;
    }
    const [minX, minY, maxX, maxY] = bbox;
    const utmX = camera.position.x + transform.origin.easting;
    const utmY = camera.position.y + transform.origin.northing;
    if (utmX < minX || utmX > maxX || utmY < minY || utmY > maxY) {
      visibleByCamera = false;
      line.visible = false;
      line.userData.terrainUndersideGridVisibleByCamera = visibleByCamera;
      line.userData.terrainUndersideGridHiddenReason = "outside-bounds";
      return;
    }
    const surfaceSceneZ = sample(utmX, utmY) - transform.origin.elevation;
    const cameraOffsetFromSurfaceM = camera.position.z - surfaceSceneZ;
    if (!visibleByCamera && cameraOffsetFromSurfaceM < -showBelowTerrainM) {
      visibleByCamera = true;
    } else if (
      visibleByCamera &&
      cameraOffsetFromSurfaceM > hideAboveTerrainM
    ) {
      visibleByCamera = false;
    }
    line.visible = visibleByCamera;
    line.userData.terrainUndersideGridVisibleByCamera = visibleByCamera;
    line.userData.terrainUndersideGridHiddenReason = visibleByCamera
      ? null
      : "camera-side";
    line.userData.terrainUndersideGridCameraOffsetFromSurfaceM =
      cameraOffsetFromSurfaceM;
    line.userData.terrainUndersideGridSurfaceSceneZ = surfaceSceneZ;
  };
  update();

  return { material, line, update, updateCameraVisibility };
}

function terrainLodSteps(
  width: number,
  height: number,
  maxVertices: number,
): Record<TerrainLodTierName, number> {
  const sourceStep = Math.max(
    1,
    Math.ceil(Math.sqrt((width * height) / Math.max(4, maxVertices))),
  );
  return {
    source: sourceStep,
    standard: Math.max(sourceStep * 2, 2),
    coarse: Math.max(sourceStep * 4, 4),
  };
}

function terrainIndexRange(maxIndex: number, start: number, end: number, step: number): number[] {
  const values: number[] = [];
  const safeStart = clampRange(Math.round(start), 0, maxIndex);
  const safeEnd = clampRange(Math.round(end), safeStart, maxIndex);
  for (let value = safeStart; value < safeEnd; value += step) {
    values.push(value);
  }
  if (values.length === 0 || values[values.length - 1] !== safeEnd) {
    values.push(safeEnd);
  }
  return values;
}

function isTerrainNoData(raw: number, nodata: number | null): boolean {
  return !Number.isFinite(raw) || (nodata !== null && raw === nodata);
}

function fillTerrainNoData(
  elev: Float32Array | Int16Array | Uint16Array,
  width: number,
  height: number,
  nodata: number | null,
  fallbackElevation: number,
): Float32Array {
  const filled = new Float32Array(elev.length);
  for (let i = 0; i < elev.length; i += 1) {
    const raw = elev[i];
    filled[i] = isTerrainNoData(raw, nodata) ? NaN : raw;
  }

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;
    let last = NaN;
    for (let x = 0; x < width; x += 1) {
      const index = rowOffset + x;
      const value = filled[index];
      if (Number.isFinite(value)) {
        last = value;
      } else if (Number.isFinite(last)) {
        filled[index] = last;
      }
    }
    last = NaN;
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = rowOffset + x;
      const value = filled[index];
      if (Number.isFinite(value)) {
        last = value;
      } else if (Number.isFinite(last)) {
        filled[index] = last;
      }
    }
  }

  for (let x = 0; x < width; x += 1) {
    let last = NaN;
    for (let y = 0; y < height; y += 1) {
      const index = y * width + x;
      const value = filled[index];
      if (Number.isFinite(value)) {
        last = value;
      } else if (Number.isFinite(last)) {
        filled[index] = last;
      }
    }
    last = NaN;
    for (let y = height - 1; y >= 0; y -= 1) {
      const index = y * width + x;
      const value = filled[index];
      if (Number.isFinite(value)) {
        last = value;
      } else if (Number.isFinite(last)) {
        filled[index] = last;
      }
    }
  }

  for (let i = 0; i < filled.length; i += 1) {
    if (!Number.isFinite(filled[i])) filled[i] = fallbackElevation;
  }

  return filled;
}

function terrainTileVertexEstimate(tile: TerrainTileRecord, step: number): number {
  const xCount = terrainIndexRange(tile.sourceX1, tile.sourceX0, tile.sourceX1, step).length;
  const yCount = terrainIndexRange(tile.sourceY1, tile.sourceY0, tile.sourceY1, step).length;
  return xCount * yCount;
}

function terrainLodTierVertexEstimate(
  tiles: TerrainTileRecord[],
  step: number,
): number {
  return tiles.reduce(
    (sum, tile) => sum + terrainTileVertexEstimate(tile, step),
    0,
  );
}

function selectUniformTerrainLodTier({
  terrainCentroid,
  cameraPosition,
  tiles,
  lodSteps,
  maxVertices,
}: {
  terrainCentroid: THREE.Vector3;
  cameraPosition: THREE.Vector3;
  tiles: TerrainTileRecord[];
  lodSteps: Record<TerrainLodTierName, number>;
  maxVertices: number;
}): TerrainLodTierName {
  const distance = terrainCentroid.distanceTo(cameraPosition);
  const tiers: TerrainLodTierName[] = ["source", "standard", "coarse"];
  let tierIndex = distance < 65_000 ? 0 : distance < 150_000 ? 1 : 2;
  while (
    tierIndex < tiers.length - 1 &&
    terrainLodTierVertexEstimate(tiles, lodSteps[tiers[tierIndex]]) >
      maxVertices
  ) {
    tierIndex += 1;
  }
  return tiers[tierIndex];
}

function buildTerrainTileGeometry(params: {
  tile: TerrainTileRecord;
  step: number;
  width: number;
  height: number;
  bbox: number[];
  elev: Float32Array;
  transform: GeoSceneTransform;
  terrainOffset: THREE.Vector3;
}): THREE.BufferGeometry {
  const {
    tile,
    step,
    width,
    height,
    bbox,
    elev,
    transform,
    terrainOffset,
  } = params;
  const xRange = bbox[2] - bbox[0];
  const yRange = bbox[3] - bbox[1];
  const xs = terrainIndexRange(width - 1, tile.sourceX0, tile.sourceX1, step);
  const ys = terrainIndexRange(height - 1, tile.sourceY0, tile.sourceY1, step);
  const positions = new Float32Array(xs.length * ys.length * 3);
  let offset = 0;
  for (const sourceY of ys) {
    for (const sourceX of xs) {
      const utmX = bbox[0] + (sourceX / Math.max(1, width - 1)) * xRange;
      const utmY = bbox[3] - (sourceY / Math.max(1, height - 1)) * yRange;
      const z = elev[sourceY * width + sourceX];
      const [sx, sy, sz] = utmToSceneWithTransform(transform, utmX, utmY, z);
      positions[offset++] = sx - terrainOffset.x;
      positions[offset++] = sy - terrainOffset.y;
      positions[offset++] = sz - terrainOffset.z;
    }
  }

  const indices = new Uint32Array(
    Math.max(0, xs.length - 1) * Math.max(0, ys.length - 1) * 6,
  );
  let indexOffset = 0;
  for (let y = 0; y < ys.length - 1; y += 1) {
    for (let x = 0; x < xs.length - 1; x += 1) {
      const a = y * xs.length + x;
      const b = a + 1;
      const c = a + xs.length;
      const d = c + 1;
      indices[indexOffset++] = a;
      indices[indexOffset++] = c;
      indices[indexOffset++] = b;
      indices[indexOffset++] = b;
      indices[indexOffset++] = c;
      indices[indexOffset++] = d;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Loads terrain_woodjam.tif (clipped, reprojected to EPSG:26910 by the
// prep/fetch_terrain.py script) and builds a displaced PlaneGeometry mesh.
//
// Convention: GeoTIFF rasters are read top-down -- row 0 is the northernmost
// row (max northing). PlaneGeometry vertices, with widthSegments W and
// heightSegments H, are laid out from top-left (-w/2, +h/2) to bottom-right
// (+w/2, -h/2) in row-major order, which matches the raster row order.

export async function loadTerrain(
  url: string,
  options?: GeoSceneTransformOptions,
): Promise<THREE.Group> {
  const transform = resolveGeoSceneTransform(options);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Terrain request failed ${response.status} ${response.statusText}`,
    );
  }
  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox(); // [minX, minY, maxX, maxY] in georef CRS
  const nodata = image.getGDALNoData();

  const rasters = await image.readRasters();
  const sourceElev = rasters[0] as Float32Array | Int16Array | Uint16Array;
  const maxVertices =
    typeof options?.terrainMaxVertices === "number" &&
    Number.isFinite(options.terrainMaxVertices) &&
    options.terrainMaxVertices > 4
      ? options.terrainMaxVertices
      : DEFAULT_TERRAIN_MAX_VERTICES;

  const planeWidth = bbox[2] - bbox[0];
  const planeHeight = bbox[3] - bbox[1];
  let minSeen = Infinity;
  let maxSeen = -Infinity;
  for (let i = 0; i < sourceElev.length; i += 1) {
    const raw = sourceElev[i];
    if (isTerrainNoData(raw, nodata)) continue;
    if (raw < minSeen) minSeen = raw;
    if (raw > maxSeen) maxSeen = raw;
  }
  if (!Number.isFinite(minSeen)) {
    minSeen = transform.origin.elevation;
    maxSeen = transform.origin.elevation;
  }
  const elev = fillTerrainNoData(
    sourceElev,
    width,
    height,
    nodata,
    transform.origin.elevation,
  );

  const cxUtm = (bbox[0] + bbox[2]) / 2;
  const cyUtm = (bbox[1] + bbox[3]) / 2;
  const [cxScene, cyScene] = utmToSceneWithTransform(
    transform,
    cxUtm,
    cyUtm,
    transform.origin.elevation,
  );
  const terrainOffset = new THREE.Vector3(cxScene, cyScene, 0);

  const terrainHandle = buildTerrainMaterial({
    elevationOffsetM: transform.origin.elevation,
  });
  const [minSceneX, minSceneY] = utmToSceneWithTransform(
    transform,
    bbox[0],
    bbox[1],
    transform.origin.elevation,
  );
  const [maxSceneX, maxSceneY] = utmToSceneWithTransform(
    transform,
    bbox[2],
    bbox[3],
    transform.origin.elevation,
  );
  terrainHandle.setTerrainBounds(
    [Math.min(minSceneX, maxSceneX), Math.min(minSceneY, maxSceneY)],
    [Math.max(minSceneX, maxSceneX), Math.max(minSceneY, maxSceneY)],
  );

  const root = new THREE.Group();
  root.name = "terrain";
  root.position.set(cxScene, cyScene, 0);
  root.userData.terrainHandle = terrainHandle;
  root.userData.terrainUtmBounds = bbox;
  root.userData.terrainBaseZ = root.position.z;
  root.userData.publicSurfaceBaseZ = root.position.z;

  const lodSteps = terrainLodSteps(width, height, maxVertices);
  const terrainCentroid = new THREE.Vector3(cxScene, cyScene, 0);
  const terrainMesh = new THREE.Mesh(new THREE.BufferGeometry(), terrainHandle.material);
  terrainMesh.name = "terrain-surface";
  terrainMesh.castShadow = false;
  terrainMesh.receiveShadow = true;
  terrainMesh.userData.terrainHandle = terrainHandle;
  terrainMesh.userData.terrainUtmBounds = bbox;
  terrainMesh.userData.terrainBaseZ = terrainMesh.position.z;
  root.add(terrainMesh);

  const fullTerrainTile: TerrainTileRecord = {
    sourceX0: 0,
    sourceX1: width - 1,
    sourceY0: 0,
    sourceY1: height - 1,
    center: terrainCentroid,
    tier: "coarse",
  };
  const tiles: TerrainTileRecord[] = [];
  const rebuildTerrain = (tier: TerrainLodTierName) => {
    const nextGeometry = buildTerrainTileGeometry({
      tile: fullTerrainTile,
      step: lodSteps[tier],
      width,
      height,
      bbox,
      elev,
      transform,
      terrainOffset,
    });
    terrainMesh.geometry.dispose();
    terrainMesh.geometry = nextGeometry;
    fullTerrainTile.tier = tier;
    for (const tile of tiles) {
      tile.tier = tier;
    }
    terrainMesh.userData.terrainLodTier = tier;
    terrainMesh.userData.terrainVertexEstimate =
      nextGeometry.getAttribute("position").count;
  };

  for (let row = 0; row < TERRAIN_TILE_ROWS; row += 1) {
    for (let column = 0; column < TERRAIN_TILE_COLUMNS; column += 1) {
      const sourceX0 = Math.floor((column * (width - 1)) / TERRAIN_TILE_COLUMNS);
      const sourceX1 = Math.floor(
        ((column + 1) * (width - 1)) / TERRAIN_TILE_COLUMNS,
      );
      const sourceY0 = Math.floor((row * (height - 1)) / TERRAIN_TILE_ROWS);
      const sourceY1 = Math.floor(((row + 1) * (height - 1)) / TERRAIN_TILE_ROWS);
      const centerUtmX =
        bbox[0] +
        (((sourceX0 + sourceX1) * 0.5) / Math.max(1, width - 1)) * planeWidth;
      const centerUtmY =
        bbox[3] -
        (((sourceY0 + sourceY1) * 0.5) / Math.max(1, height - 1)) * planeHeight;
      const [centerSceneX, centerSceneY] = utmToSceneWithTransform(
        transform,
        centerUtmX,
        centerUtmY,
        transform.origin.elevation,
      );
      const tile: TerrainTileRecord = {
        sourceX0,
        sourceX1,
        sourceY0,
        sourceY1,
        center: new THREE.Vector3(centerSceneX, centerSceneY, 0),
        tier: "coarse",
      };
      tiles.push(tile);
    }
  }
  rebuildTerrain("coarse");

  const terrainLodDebugState: TerrainLodDebugState = {
    activeTileCount: tiles.length,
    activeVertexEstimate:
      terrainMesh.geometry.getAttribute("position")?.count ?? 0,
    lodTierCounts: { coarse: tiles.length, standard: 0, source: 0 },
    lastUpdateReason: "initial-coarse",
  };
  const updateDebugState = (reason: string) => {
    terrainLodDebugState.activeTileCount = tiles.length;
    terrainLodDebugState.activeVertexEstimate = 0;
    terrainLodDebugState.lodTierCounts = { coarse: 0, standard: 0, source: 0 };
    for (const tile of tiles) {
      terrainLodDebugState.lodTierCounts[tile.tier] += 1;
    }
    terrainLodDebugState.activeVertexEstimate =
      terrainMesh.geometry.getAttribute("position")?.count ?? 0;
    terrainLodDebugState.lastUpdateReason = reason;
    root.userData.terrainLodDebugState = { ...terrainLodDebugState };
  };
  let lastCameraPosition: THREE.Vector3 | null = null;
  const terrainLodHandle: TerrainLodHandle = {
    debugState: terrainLodDebugState,
    updateCameraLod(camera: THREE.Camera) {
      if (
        lastCameraPosition &&
        lastCameraPosition.distanceTo(camera.position) < TERRAIN_LOD_CAMERA_EPSILON_M
      ) {
        return;
      }
      lastCameraPosition = camera.position.clone();
      const tier = selectUniformTerrainLodTier({
        terrainCentroid,
        cameraPosition: camera.position,
        tiles,
        lodSteps,
        maxVertices,
      });
      const changed = fullTerrainTile.tier !== tier;
      if (changed) {
        rebuildTerrain(tier);
      }
      updateDebugState(changed ? "camera-lod-change" : "camera-lod-stable");
    },
  };
  root.userData.terrainLodHandle = terrainLodHandle;
  root.userData.terrainLodDebugState = { ...terrainLodDebugState };

  // Sanity check: warn if the GeoTIFF bbox does not match the project bounds.
  const expectedWidth =
    transform.bounds.max.easting - transform.bounds.min.easting;
  const expectedHeight =
    transform.bounds.max.northing - transform.bounds.min.northing;
  const widthMismatch = Math.abs(planeWidth - expectedWidth) > 100;
  const heightMismatch = Math.abs(planeHeight - expectedHeight) > 100;
  if (widthMismatch || heightMismatch) {
    console.warn(
      `[loadTerrain] bbox ${planeWidth}x${planeHeight}m does not match ` +
        `project bounds ${expectedWidth}x${expectedHeight}m`,
    );
  }
  debugLog(
    `[loadTerrain] ${width}x${height} px, bbox UTM [${bbox.join(", ")}], ` +
      `tiles ${TERRAIN_TILE_COLUMNS}x${TERRAIN_TILE_ROWS}, ` +
      `lod steps coarse=${lodSteps.coarse} standard=${lodSteps.standard} source=${lodSteps.source}, ` +
      `elev ${minSeen.toFixed(1)}-${maxSeen.toFixed(1)} m ` +
      `(project bounds ${transform.bounds.min.elevation}-${transform.bounds.max.elevation})`,
  );

  // Publish a bilinearly-interpolated heightmap sampler. Hydrography
  // loaders (and any future "drape onto terrain" loader) await this via
  // getHeightSampler() and use it to set per-vertex z.
  const xRange = bbox[2] - bbox[0];
  const yRange = bbox[3] - bbox[1];
  const fallback = transform.origin.elevation;
  const sampler: HeightSampler = (utmX, utmY) => {
    if (utmX < bbox[0] || utmX > bbox[2] || utmY < bbox[1] || utmY > bbox[3]) {
      return fallback;
    }
    const fx = ((utmX - bbox[0]) / xRange) * (width - 1);
    // Raster row 0 is northernmost (max Y).
    const fy = ((bbox[3] - utmY) / yRange) * (height - 1);
    const x0 = Math.max(0, Math.min(width - 1, Math.floor(fx)));
    const x1 = Math.max(0, Math.min(width - 1, x0 + 1));
    const y0 = Math.max(0, Math.min(height - 1, Math.floor(fy)));
    const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
    const tx = fx - x0;
    const ty = fy - y0;
    const v00 = elev[y0 * width + x0];
    const v10 = elev[y0 * width + x1];
    const v01 = elev[y1 * width + x0];
    const v11 = elev[y1 * width + x1];
    return (
      v00 * (1 - tx) * (1 - ty) +
      v10 * tx * (1 - ty) +
      v01 * (1 - tx) * ty +
      v11 * tx * ty
    );
  };
  setHeightSampler(sampler);

  if (options?.terrainGridEnabled !== false) {
    const gridHandle = buildTerrainGridHandle(
      bbox,
      sampler,
      new THREE.Vector3(cxScene, cyScene, 0),
      transform,
    );
    root.add(gridHandle.line);
    root.userData.terrainGridHandle = gridHandle;
  }

  // If lake / target masks were already published before terrain
  // finished loading, plug them in immediately. Otherwise listen.
  const lakeExisting = peekOverlayMask("lake");
  if (lakeExisting) {
    terrainHandle.setLakeMask(
      lakeExisting.texture,
      lakeExisting.boundsMin,
      lakeExisting.boundsMax,
    );
  }
  for (const slot of TARGET_SLOTS) {
    const existing = peekOverlayMask(slot);
    if (existing) {
      terrainHandle.setTargetMask(
        slot,
        existing.texture,
        existing.boundsMin,
        existing.boundsMax,
      );
    }
  }
  const claimExisting = peekOverlayMask("claim");
  if (claimExisting) {
    terrainHandle.setClaimMask(
      claimExisting.texture,
      claimExisting.boundsMin,
      claimExisting.boundsMax,
    );
  }
  const geologyExisting = peekOverlayMask("geology");
  if (geologyExisting) {
    terrainHandle.setGeologyMask(
      geologyExisting.texture,
      geologyExisting.boundsMin,
      geologyExisting.boundsMax,
    );
  }
  const forestExisting = peekOverlayMask("trees-vri");
  if (forestExisting) {
    terrainHandle.setForestMask(
      forestExisting.texture,
      forestExisting.boundsMin,
      forestExisting.boundsMax,
    );
  }
  subscribeOverlayMask((slot, info) => {
    if (slot === "lake") {
      terrainHandle.setLakeMask(info.texture, info.boundsMin, info.boundsMax);
    } else if (slot === "target-three-firs" || slot === "target-great-plains") {
      terrainHandle.setTargetMask(
        slot,
        info.texture,
        info.boundsMin,
        info.boundsMax,
      );
    } else if (slot === "claim") {
      terrainHandle.setClaimMask(info.texture, info.boundsMin, info.boundsMax);
    } else if (slot === "geology") {
      terrainHandle.setGeologyMask(
        info.texture,
        info.boundsMin,
        info.boundsMax,
      );
    } else if (slot === "trees-vri") {
      terrainHandle.setForestMask(info.texture, info.boundsMin, info.boundsMax);
    }
  });

  return root;
}
