import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { getHeightSampler, setLakeMask } from "../scene/heightSampler";
import { debugLog } from "../utils/debugLog";
import {
  resolveGeoSceneTransform,
  utmToSceneWithTransform,
  type GeoSceneTransform,
  type GeoSceneTransformOptions,
} from "./geoTransform";
import {
  enableDistanceAttenuatedLineWidth,
  setTerrainShadowInfluence,
} from "./topoLineMaterial";

// BC Freshwater Atlas streams + lakes loaders.
//
// Both loaders await the terrain heightmap sampler (loadTerrain publishes
// it via setHeightSampler once its GeoTIFF is decoded) and use it to
// drape every vertex onto the terrain surface:
//
//   - Streams: every LineString vertex gets z = sample(x, y) + 2 m.
//     All ~9k features collapsed into a single LineSegments2 -- 1 draw
//     call total.
//
//   - Lakes: each polygon's edges are subdivided to 50 m segments before
//     triangulation, ShapeGeometry generates a triangle mesh for the
//     polygon (with holes), then each vertex's z is set by sampling the
//     terrain at that vertex's world XY position. Result: lake mesh
//     conforms to the terrain surface rather than sitting flat at one
//     constant elevation.

// Streams stay as Line2 in 3D space (per-vertex draped onto terrain).
const STREAM_RAISE_M = 115;
// Streams/rivers are map-reference ink. Keep them above translucent anomaly
// and target fills while lake masking still hides stream segments inside lakes.
const STREAM_RENDER_ORDER = 4.1;
const STREAM_LAKE_OCCLUSION_SEGMENT_M = 120;
const STREAM_TERRAIN_SHADE_SAMPLE_M = 90;
const STREAM_TERRAIN_SHADE_INFLUENCE = 0.09;
const LAKE_OUTLINE_RAISE_M = 85;
const LAKE_FILL_RAISE_M = 4;
const LAKE_OUTLINE_SEGMENT_M = 80;
// Lakes render as terrain shader paint + stable outlines. The old draped fill
// mesh shimmered against the terrain triangles during camera movement.
const LAKE_MASK_RES = 2048;

interface LakeMaskBundle {
  texture: THREE.Texture;
  boundsMin: [number, number];
  boundsMax: [number, number];
  containsUtm(easting: number, northing: number): boolean;
  featureCount: number;
  polygonCount: number;
  source: FeatureCollection;
}

interface Feature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
}
interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

function streamRenderScore(properties: Record<string, unknown>): {
  lengthKm: number | null;
  hasName: boolean;
} {
  const rawLength = properties.LengthKM;
  const lengthKm =
    typeof rawLength === "number" && Number.isFinite(rawLength)
      ? rawLength
      : typeof rawLength === "string"
        ? Number.parseFloat(rawLength)
        : Number.NaN;
  const name = properties.GNIS_Name;
  return {
    lengthKm: Number.isFinite(lengthKm) ? lengthKm : null,
    hasName: typeof name === "string" && name.trim().length > 0,
  };
}

function shouldRenderStreamFeature(feature: Feature, useRegionalFilter: boolean): boolean {
  if (!useRegionalFilter) return true;
  const score = streamRenderScore(feature.properties);
  if (score.lengthKm === null) return true;
  // Regional NHD contains thousands of short tributary strokes. Keep named
  // local washes and longer drainage paths, but suppress the tiny hairline
  // fragments that read as blue noise at presentation scale.
  return score.lengthKm >= 14 || (score.hasName && score.lengthKm >= 6);
}

const lakeMaskCache = new Map<string, Promise<LakeMaskBundle>>();
const streamShadeSunDir = sunDirectionFromAngles(218, 38);

function sunDirectionFromAngles(
  azimuthDeg: number,
  elevationDeg: number,
): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const elev = THREE.MathUtils.degToRad(elevationDeg);
  const cosE = Math.cos(elev);
  return new THREE.Vector3(
    Math.sin(az) * cosE,
    Math.cos(az) * cosE,
    Math.sin(elev),
  ).normalize();
}

function terrainShadeAt(
  easting: number,
  northing: number,
  sample: (easting: number, northing: number) => number,
): number {
  const d = STREAM_TERRAIN_SHADE_SAMPLE_M;
  const dzdx = (sample(easting + d, northing) - sample(easting - d, northing)) /
    (2 * d);
  const dzdy = (sample(easting, northing + d) - sample(easting, northing - d)) /
    (2 * d);
  const normal = new THREE.Vector3(-dzdx, -dzdy, 1).normalize();
  const lambert = Math.max(0, normal.dot(streamShadeSunDir));
  // Shadow only: keep stream hue intact while letting shaded valleys
  // slightly mute the ink so drainage reads as part of the relief.
  return THREE.MathUtils.clamp(0.62 + Math.sqrt(lambert) * 0.38, 0.62, 1);
}

function buildLakeMask(
  res: FeatureCollection,
  transform: GeoSceneTransform,
): LakeMaskBundle {
  // Mask covers the full project bounds in scene-local XY (sceneOrigin
  // already subtracted). The terrain shader maps vWorldPos.xy directly
  // into this UV; streams use the same mask to split line segments that
  // would otherwise draw across lake-painted terrain.
  const [minSx, minSy] = utmToSceneWithTransform(
    transform,
    transform.bounds.min.easting,
    transform.bounds.min.northing,
    0,
  );
  const [maxSx, maxSy] = utmToSceneWithTransform(
    transform,
    transform.bounds.max.easting,
    transform.bounds.max.northing,
    0,
  );

  const c = document.createElement("canvas");
  c.width = LAKE_MASK_RES;
  c.height = LAKE_MASK_RES;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("loadLakes: failed to get 2d canvas context");
  ctx.imageSmoothingEnabled = false;
  // Transparent background -> alpha=0 outside any polygon.
  ctx.clearRect(0, 0, LAKE_MASK_RES, LAKE_MASK_RES);
  ctx.fillStyle = "rgba(255,255,255,1)";

  const sceneToCanvasX = (sx: number) =>
    ((sx - minSx) / (maxSx - minSx)) * LAKE_MASK_RES;
  // Flip Y -- canvas y=0 is top, we want texture v=1 (top) to read
  // canvas top after Three.js's default flipY texture upload.
  const sceneToCanvasY = (sy: number) =>
    (1 - (sy - minSy) / (maxSy - minSy)) * LAKE_MASK_RES;

  let polyCount = 0;

  const drawRing = (ring: Array<[number, number, number?]>) => {
    if (ring.length < 3) return;
    for (let i = 0; i < ring.length; i++) {
      const [e, n] = ring[i];
      const [sx, sy] = utmToSceneWithTransform(transform, e, n, 0);
      const cx = sceneToCanvasX(sx);
      const cy = sceneToCanvasY(sy);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.closePath();
  };

  const drawPolygon = (
    polygon: Array<Array<[number, number, number?]>>,
  ) => {
    if (!polygon[0] || polygon[0].length < 3) return;
    ctx.beginPath();
    drawRing(polygon[0]);
    // Holes: same path, evenodd fill rule punches them out below.
    for (let h = 1; h < polygon.length; h++) {
      drawRing(polygon[h]);
    }
    ctx.fill("evenodd");
    polyCount++;
  };

  for (const feat of res.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      drawPolygon(
        g.coordinates as Array<Array<[number, number, number?]>>,
      );
    } else if (g.type === "MultiPolygon") {
      for (const p of g.coordinates as Array<
        Array<Array<[number, number, number?]>>
      >) {
        drawPolygon(p);
      }
    }
  }

  const maskImage = ctx.getImageData(0, 0, LAKE_MASK_RES, LAKE_MASK_RES);
  const maskPixels = maskImage.data;
  for (let i = 0; i < maskPixels.length; i += 4) {
    const inside = maskPixels[i + 3] > 127 ? 255 : 0;
    maskPixels[i] = inside;
    maskPixels[i + 1] = inside;
    maskPixels[i + 2] = inside;
    maskPixels[i + 3] = inside;
  }
  ctx.putImageData(maskImage, 0, 0);
  const containsUtm = (easting: number, northing: number) => {
    const [sx, sy] = utmToSceneWithTransform(
      transform,
      easting,
      northing,
      0,
    );
    const cx = Math.floor(sceneToCanvasX(sx));
    const cy = Math.floor(sceneToCanvasY(sy));
    if (cx < 0 || cx >= LAKE_MASK_RES || cy < 0 || cy >= LAKE_MASK_RES) {
      return false;
    }
    return maskPixels[(cy * LAKE_MASK_RES + cx) * 4 + 3] > 0;
  };

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace; // mask, not color data
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  return {
    texture: tex,
    boundsMin: [minSx, minSy],
    boundsMax: [maxSx, maxSy],
    containsUtm,
    featureCount: res.features.length,
    polygonCount: polyCount,
    source: res,
  };
}

function lakeMaskCacheKey(url: string, transform: GeoSceneTransform): string {
  const { origin, bounds } = transform;
  return [
    url,
    transform.sourceCrs,
    origin.easting,
    origin.northing,
    origin.elevation,
    bounds.min.easting,
    bounds.min.northing,
    bounds.max.easting,
    bounds.max.northing,
  ].join("|");
}

function loadLakeMaskBundle(
  url: string,
  transform: GeoSceneTransform,
): Promise<LakeMaskBundle> {
  const key = lakeMaskCacheKey(url, transform);
  const cached = lakeMaskCache.get(key);
  if (cached) return cached;
  const next = fetch(url)
    .then((r) => r.json() as Promise<FeatureCollection>)
    .then((res) => buildLakeMask(res, transform));
  lakeMaskCache.set(key, next);
  return next;
}

function pushDrapedSegment(
  positions: number[],
  a: [number, number, number?],
  b: [number, number, number?],
  sample: (easting: number, northing: number) => number,
  transform: GeoSceneTransform,
): void {
  const [e0, n0] = a;
  const [e1, n1] = b;
  const dist = Math.hypot(e1 - e0, n1 - n0);
  const steps = Math.max(1, Math.ceil(dist / LAKE_OUTLINE_SEGMENT_M));
  let prev: [number, number, number] | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const e = e0 + (e1 - e0) * t;
    const n = n0 + (n1 - n0) * t;
    const [sx, sy, sz] = utmToSceneWithTransform(
      transform,
      e,
      n,
      sample(e, n) + LAKE_OUTLINE_RAISE_M,
    );
    const cur: [number, number, number] = [sx, sy, sz];
    if (prev) positions.push(prev[0], prev[1], prev[2], cur[0], cur[1], cur[2]);
    prev = cur;
  }
}

function addLakeOutlineRing(
  positions: number[],
  ring: Array<[number, number, number?]>,
  sample: (easting: number, northing: number) => number,
  transform: GeoSceneTransform,
): void {
  if (ring.length < 3) return;
  const first = ring[0];
  const last = ring[ring.length - 1];
  const isClosed = first[0] === last[0] && first[1] === last[1];
  const count = isClosed ? ring.length - 1 : ring.length;
  for (let i = 0; i < count; i++) {
    pushDrapedSegment(
      positions,
      ring[i],
      ring[(i + 1) % ring.length],
      sample,
      transform,
    );
  }
}

function buildLakeOutlinePositions(
  res: FeatureCollection,
  sample: (easting: number, northing: number) => number,
  transform: GeoSceneTransform,
): number[] {
  const positions: number[] = [];
  const addPolygon = (polygon: Array<Array<[number, number, number?]>>) => {
    for (const ring of polygon) {
      addLakeOutlineRing(positions, ring, sample, transform);
    }
  };
  for (const feat of res.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      addPolygon(g.coordinates as Array<Array<[number, number, number?]>>);
    } else if (g.type === "MultiPolygon") {
      for (const p of g.coordinates as Array<
        Array<Array<[number, number, number?]>>
      >) {
        addPolygon(p);
      }
    }
  }
  return positions;
}

function normalizeLakeRing(
  ring: Array<[number, number, number?]>,
): Array<[number, number, number?]> {
  if (ring.length < 3) return [];
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1];
  return closed ? ring.slice(0, -1) : ring.slice();
}

function projectLakeRing(
  ring: Array<[number, number, number?]>,
  sample: (easting: number, northing: number) => number,
  transform: GeoSceneTransform,
): { points: THREE.Vector2[]; positions: THREE.Vector3[] } {
  const points: THREE.Vector2[] = [];
  const positions: THREE.Vector3[] = [];
  for (const [e, n] of ring) {
    const [sx, sy, sz] = utmToSceneWithTransform(
      transform,
      e,
      n,
      sample(e, n) + LAKE_FILL_RAISE_M,
    );
    points.push(new THREE.Vector2(sx, sy));
    positions.push(new THREE.Vector3(sx, sy, sz));
  }
  return { points, positions };
}

function addLakeFillPolygon(
  positions: number[],
  polygon: Array<Array<[number, number, number?]>>,
  sample: (easting: number, northing: number) => number,
  transform: GeoSceneTransform,
): void {
  const outerRing = normalizeLakeRing(polygon[0] ?? []);
  if (outerRing.length < 3) return;
  const outer = projectLakeRing(outerRing, sample, transform);
  const holes = polygon
    .slice(1)
    .map(normalizeLakeRing)
    .filter((ring) => ring.length >= 3)
    .map((ring) => projectLakeRing(ring, sample, transform));
  const faces = THREE.ShapeUtils.triangulateShape(
    outer.points,
    holes.map((hole) => hole.points),
  );
  const vertices = [
    ...outer.positions,
    ...holes.flatMap((hole) => hole.positions),
  ];
  for (const face of faces) {
    for (const idx of face) {
      const p = vertices[idx];
      if (p) positions.push(p.x, p.y, p.z);
    }
  }
}

function buildLakeFillPositions(
  res: FeatureCollection,
  sample: (easting: number, northing: number) => number,
  transform: GeoSceneTransform,
): number[] {
  const positions: number[] = [];
  for (const feat of res.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      addLakeFillPolygon(
        positions,
        g.coordinates as Array<Array<[number, number, number?]>>,
        sample,
        transform,
      );
    } else if (g.type === "MultiPolygon") {
      for (const polygon of g.coordinates as Array<
        Array<Array<[number, number, number?]>>
      >) {
        addLakeFillPolygon(positions, polygon, sample, transform);
      }
    }
  }
  return positions;
}

function pushStreamSegmentWithLakeOcclusion(
  visibleSegments: number[],
  visibleColors: number[],
  lakeCoveredSegments: number[],
  lakeCoveredColors: number[],
  a: [number, number],
  b: [number, number],
  sample: (easting: number, northing: number) => number,
  lakeMask: LakeMaskBundle | null,
  transform: GeoSceneTransform,
): number {
  const [e0, n0] = a;
  const [e1, n1] = b;
  const dist = Math.hypot(e1 - e0, n1 - n0);
  const steps = Math.max(
    1,
    Math.ceil(dist / STREAM_LAKE_OCCLUSION_SEGMENT_M),
  );
  let coveredCount = 0;
  let prev: {
    e: number;
    n: number;
    sx: number;
    sy: number;
    sz: number;
    shade: number;
  } | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const e = e0 + (e1 - e0) * t;
    const n = n0 + (n1 - n0) * t;
    const z = sample(e, n) + STREAM_RAISE_M;
    const shade = terrainShadeAt(e, n, sample);
    const [sx, sy, sz] = utmToSceneWithTransform(transform, e, n, z);
    if (prev) {
      const covered = lakeMask?.containsUtm(
        (prev.e + e) * 0.5,
        (prev.n + n) * 0.5,
      ) === true;
      const target = covered ? lakeCoveredSegments : visibleSegments;
      const targetColors = covered ? lakeCoveredColors : visibleColors;
      if (covered) coveredCount++;
      target.push(prev.sx, prev.sy, prev.sz, sx, sy, sz);
      targetColors.push(
        prev.shade,
        prev.shade,
        prev.shade,
        shade,
        shade,
        shade,
      );
    }
    prev = { e, n, sx, sy, sz, shade };
  }
  return coveredCount;
}

export async function loadStreams(
  url: string,
  lakeUrl?: string,
  options?: GeoSceneTransformOptions,
): Promise<THREE.Group> {
  const transform = resolveGeoSceneTransform(options);
  const lakeMaskPromise = lakeUrl
    ? loadLakeMaskBundle(lakeUrl, transform).catch((err) => {
        console.warn("[loadStreams] lake occlusion mask failed:", err);
        return null;
      })
    : Promise.resolve(null);
  const [res, sample, lakeMask] = await Promise.all([
    fetch(url).then((r) => r.json()) as Promise<FeatureCollection>,
    getHeightSampler(),
    lakeMaskPromise,
  ]);

  const group = new THREE.Group();
  group.name = "hydrography-streams";

  const material = new LineMaterial({
    color: 0x3a5060,
    linewidth: 2.0,
    worldUnits: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
    depthWrite: false,
  });
  // Match terrain atmosphere. Without this, wide stream lines ignore fog and
  // stay equally visible at the far edge of the camera view.
  material.fog = true;
  enableDistanceAttenuatedLineWidth(material, {
    near: 50000,
    far: 450000,
    minScale: 0.85,
    minAlpha: 0.55,
  });
  setTerrainShadowInfluence(material, STREAM_TERRAIN_SHADE_INFLUENCE);
  material.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );
  group.userData.traceMaterial = material;

  const visibleSegments: number[] = [];
  const visibleColors: number[] = [];
  const lakeCoveredSegments: number[] = [];
  const lakeCoveredColors: number[] = [];
  const useRegionalFilter =
    res.features.length > 250 &&
    res.features.some(
      (feature) =>
        typeof feature.properties.LengthKM === "number" ||
        typeof feature.properties.LengthKM === "string",
    );
  let polylineCount = 0;
  let lakeCoveredCount = 0;

  const consumeLine = (coords: Array<[number, number, number?]>) => {
    if (coords.length < 2) return;
    polylineCount++;
    let prev: [number, number] | null = null;
    for (const [e, n] of coords) {
      if (prev) {
        lakeCoveredCount += pushStreamSegmentWithLakeOcclusion(
          visibleSegments,
          visibleColors,
          lakeCoveredSegments,
          lakeCoveredColors,
          prev,
          [e, n],
          sample,
          lakeMask,
          transform,
        );
      }
      prev = [e, n];
    }
  };

  for (const feat of res.features) {
    if (!shouldRenderStreamFeature(feat, useRegionalFilter)) continue;
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === "LineString") {
      consumeLine(g.coordinates as Array<[number, number, number?]>);
    } else if (g.type === "MultiLineString") {
      for (const c of g.coordinates as Array<
        Array<[number, number, number?]>
      >) {
        consumeLine(c);
      }
    }
  }

  const addSegments = (
    positions: number[],
    colors: number[],
    hiddenByLakes: boolean,
  ) => {
    if (positions.length === 0) return;
    const segGeom = new LineSegmentsGeometry();
    segGeom.setPositions(positions);
    segGeom.setColors(colors);
    const segs = new LineSegments2(segGeom, material);
    segs.computeLineDistances();
    segs.renderOrder = STREAM_RENDER_ORDER;
    segs.userData.hiddenByLakes = hiddenByLakes;
    segs.visible = !hiddenByLakes;
    group.add(segs);
  };

  addSegments(visibleSegments, visibleColors, false);
  addSegments(lakeCoveredSegments, lakeCoveredColors, true);

  debugLog(
    `[loadStreams] ${res.features.length} features -> ${polylineCount} polylines, ${
      (visibleSegments.length + lakeCoveredSegments.length) / 6
    } segments (${lakeCoveredCount} lake-covered)`,
  );
  return group;
}

export async function loadLakes(
  url: string,
  options?: GeoSceneTransformOptions,
): Promise<THREE.Group> {
  const transform = resolveGeoSceneTransform(options);
  const [mask, sample] = await Promise.all([
    loadLakeMaskBundle(url, transform),
    getHeightSampler(),
  ]);

  // The mask published below paints water into the terrain shader and drives
  // stream occlusion. We keep only outlines as geometry to avoid fill shimmer.
  const group = new THREE.Group();
  group.name = "hydrography-lakes";

  const renderDrapedLakeFill = false;
  const fillPositions = renderDrapedLakeFill
    ? buildLakeFillPositions(mask.source, sample, transform)
    : [];
  if (renderDrapedLakeFill && fillPositions.length > 0) {
    const fillGeometry = new THREE.BufferGeometry();
    fillGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(fillPositions, 3),
    );
    fillGeometry.computeBoundingSphere();
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0x3f3b3b,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    fillMaterial.fog = true;
    fillMaterial.userData.lakeFillMaterial = true;
    fillMaterial.userData.forceTransparent = true;

    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.name = "lake-infill";
    fill.renderOrder = 1.05;
    fill.userData.displayName = "Lakes";
    group.add(fill);
  }

  const outlinePositions = buildLakeOutlinePositions(
    mask.source,
    sample,
    transform,
  );
  if (outlinePositions.length > 0) {
    const outlineGeometry = new LineSegmentsGeometry();
    outlineGeometry.setPositions(outlinePositions);
    const outlineMaterial = new LineMaterial({
      color: 0x111111,
      linewidth: 1.8,
      worldUnits: false,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    });
    outlineMaterial.fog = true;
    enableDistanceAttenuatedLineWidth(outlineMaterial);
    outlineMaterial.resolution.set(
      window.innerWidth || 1920,
      window.innerHeight || 1080,
    );
    outlineMaterial.userData.lakeOutlineMaterial = true;

    const outline = new LineSegments2(outlineGeometry, outlineMaterial);
    outline.computeLineDistances();
    outline.renderOrder = 1.2;
    outline.userData.displayName = "Lakes";
    group.userData.traceMaterial = outlineMaterial;
    group.add(outline);
  }

  setLakeMask({
    texture: mask.texture,
    boundsMin: mask.boundsMin,
    boundsMax: mask.boundsMax,
  });

  debugLog(
    `[loadLakes] ${mask.featureCount} features -> ${mask.polygonCount} polygons rasterized into ${LAKE_MASK_RES}^2 mask, ${fillPositions.length / 9} fill triangles, ${outlinePositions.length / 6} outline segments`,
  );
  return group;
}
