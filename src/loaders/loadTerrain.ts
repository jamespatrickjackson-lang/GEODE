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
const DEFAULT_TERRAIN_MAX_VERTICES = Number.POSITIVE_INFINITY;

interface TerrainGridHandle {
  material: LineMaterial;
  line: LineSegments2;
  update(params?: TerrainMaterialParams): void;
  updateCameraVisibility(camera: THREE.Camera): void;
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

  let currentSpacing = -1;
  let enabledBySettings = true;
  let opacityBySettings = 0.72;
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
    line.visible = visible && opacity > 0.001;
    material.color.set(params.gridColor ?? "#bababa");
    material.opacity = opacity;
    material.linewidth = clampRange(params.gridLineWidthM ?? 2.75, 0.25, 8);
    material.needsUpdate = true;
  };

  const updateCameraVisibility = (camera: THREE.Camera) => {
    if (!enabledBySettings || opacityBySettings <= 0.001) {
      line.visible = false;
      return;
    }
    const [minX, minY, maxX, maxY] = bbox;
    const utmX = camera.position.x + transform.origin.easting;
    const utmY = camera.position.y + transform.origin.northing;
    if (utmX < minX || utmX > maxX || utmY < minY || utmY > maxY) {
      line.visible = false;
      return;
    }
    const surfaceSceneZ = sample(utmX, utmY) - transform.origin.elevation;
    line.visible = camera.position.z < surfaceSceneZ - 2;
  };
  update();

  return { material, line, update, updateCameraVisibility };
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
): Promise<THREE.Mesh> {
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
  const elev = rasters[0] as Float32Array | Int16Array | Uint16Array;
  const maxVertices =
    typeof options?.terrainMaxVertices === "number" &&
    Number.isFinite(options.terrainMaxVertices) &&
    options.terrainMaxVertices > 4
      ? options.terrainMaxVertices
      : DEFAULT_TERRAIN_MAX_VERTICES;
  const renderStep = Math.max(
    1,
    Math.ceil(Math.sqrt((width * height) / maxVertices)),
  );
  const renderWidth = Math.max(2, Math.ceil((width - 1) / renderStep) + 1);
  const renderHeight = Math.max(2, Math.ceil((height - 1) / renderStep) + 1);

  // Plane in the XY plane (Z-up scene). One vertex per raster pixel center.
  // PlaneGeometry has (widthSegments+1) * (heightSegments+1) vertices, so
  // segments = pixels - 1 to match counts.
  const planeWidth = bbox[2] - bbox[0];
  const planeHeight = bbox[3] - bbox[1];
  const geom = new THREE.PlaneGeometry(
    planeWidth,
    planeHeight,
    renderWidth - 1,
    renderHeight - 1,
  );

  // Apply elevation per vertex. PlaneGeometry vertex order: row 0 is the
  // top (+Y, i.e. max northing). Same as raster row 0.
  const positions = geom.attributes.position;
  let minSeen = Infinity;
  let maxSeen = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    const renderX = i % renderWidth;
    const renderY = Math.floor(i / renderWidth);
    const sourceX = Math.min(
      width - 1,
      Math.round((renderX / (renderWidth - 1)) * (width - 1)),
    );
    const sourceY = Math.min(
      height - 1,
      Math.round((renderY / (renderHeight - 1)) * (height - 1)),
    );
    const raw = elev[sourceY * width + sourceX];
    const isNoData = nodata !== null && raw === nodata;
    const z = isNoData ? 0 : raw;
    if (!isNoData) {
      if (z < minSeen) minSeen = z;
      if (z > maxSeen) maxSeen = z;
    }
    // Subtract origin elevation to keep mesh local; PlaneGeometry XY is
    // already centered on (0,0) in plane-local space, so we'll translate
    // the whole mesh below.
    positions.setZ(i, z - transform.origin.elevation);
  }
  geom.computeVertexNormals();

  // Translate the plane so its center sits at the bbox center in scene coords.
  // bbox center in UTM:
  const cxUtm = (bbox[0] + bbox[2]) / 2;
  const cyUtm = (bbox[1] + bbox[3]) / 2;
  const [cxScene, cyScene] = utmToSceneWithTransform(
    transform,
    cxUtm,
    cyUtm,
    transform.origin.elevation,
  );

  // Stylized custom shader: elevation-band ramp + lambertian hillshade +
  // distance haze. Sun direction is updated by SceneManager.applyEnvironment
  // to match the Sky shader's sun position so highlights agree across the
  // scene. The handle is parked on mesh.userData so SceneManager can find
  // it without piercing the mesh's material type.
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
  const mesh = new THREE.Mesh(geom, terrainHandle.material);
  mesh.name = "terrain";
  mesh.position.set(cxScene, cyScene, 0);
  // Terrain participates in NO shadow-map work -- neither casts nor
  // receives. The hillshade in the terrain shader (lambertian against
  // the sun direction, with the per-pixel facet normals + ambient floor
  // from the previous fix) handles all terrain depth and form. Shadow
  // maps at 40km scale produce aliasing as chunky tessellated blocks
  // regardless of resolution, and added no value over the hillshade.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.terrainHandle = terrainHandle;
  mesh.userData.terrainBaseZ = mesh.position.z;

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
      `render ${renderWidth}x${renderHeight}, ` +
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
    const safe = (v: number) =>
      nodata !== null && v === nodata ? fallback : v;
    const v00 = safe(elev[y0 * width + x0]);
    const v10 = safe(elev[y0 * width + x1]);
    const v01 = safe(elev[y1 * width + x0]);
    const v11 = safe(elev[y1 * width + x1]);
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
    mesh.add(gridHandle.line);
    mesh.userData.terrainGridHandle = gridHandle;
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

  return mesh;
}
