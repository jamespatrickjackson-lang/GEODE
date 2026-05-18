import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { getHeightSampler } from "../scene/heightSampler";
import { debugLog } from "../utils/debugLog";
import {
  resolveGeoSceneTransform,
  utmToSceneWithTransform,
  type GeoSceneTransformOptions,
} from "./geoTransform";
import { enableDistanceAttenuatedLineWidth } from "./topoLineMaterial";

// BC Digital Road Atlas road centerlines, draped over terrain.
// Kept as one LineSegments2 draw call for performance; the editor's
// standard layer style controls color/opacity after load.
const ROAD_RAISE_M = 120;
const ROAD_LINE_WIDTH_PX = 1.7;
const ROAD_DRAPE_SEGMENT_M = 500;
// Roads are a reference layer, so they should read above translucent
// project overlays like the Megaton anomaly and target fills.
const ROAD_RENDER_ORDER = 4.2;

interface Feature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
}
interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

export async function loadRoads(
  url: string,
  options?: GeoSceneTransformOptions,
): Promise<THREE.Group> {
  const transform = resolveGeoSceneTransform(options);
  const [res, sample] = await Promise.all([
    fetch(url).then((r) => r.json()) as Promise<FeatureCollection>,
    getHeightSampler(),
  ]);

  const group = new THREE.Group();
  group.name = "transport-roads";
  group.userData.displayName = "Road access";

  const material = new LineMaterial({
    color: 0xf2dec1,
    linewidth: ROAD_LINE_WIDTH_PX,
    worldUnits: false,
    transparent: true,
    opacity: 0.82,
    depthTest: false,
    depthWrite: false,
  });
  // LineMaterial is ShaderMaterial-based and defaults fog off. Topo
  // details should dissolve into the same distance haze as terrain so
  // far roads do not read like flat screen-space ink.
  material.fog = true;
  enableDistanceAttenuatedLineWidth(material, {
    near: 50000,
    far: 450000,
    minScale: 0.9,
    minAlpha: 0.7,
  });
  material.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );
  group.userData.traceMaterial = material;

  const allSegments: number[] = [];
  let polylineCount = 0;

  const pushDrapedRoadSegment = (
    a: [number, number, number?],
    b: [number, number, number?],
  ) => {
    const [e0, n0] = a;
    const [e1, n1] = b;
    const dist = Math.hypot(e1 - e0, n1 - n0);
    const steps = Math.max(1, Math.ceil(dist / ROAD_DRAPE_SEGMENT_M));
    let prev: [number, number, number] | null = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const e = e0 + (e1 - e0) * t;
      const n = n0 + (n1 - n0) * t;
      const z = sample(e, n) + ROAD_RAISE_M;
      const [sx, sy, sz] = utmToSceneWithTransform(transform, e, n, z);
      if (prev) allSegments.push(prev[0], prev[1], prev[2], sx, sy, sz);
      prev = [sx, sy, sz];
    }
  };

  const consumeLine = (coords: Array<[number, number, number?]>) => {
    if (coords.length < 2) return;
    polylineCount++;
    let prev: [number, number, number?] | null = null;
    for (const point of coords) {
      if (prev) pushDrapedRoadSegment(prev, point);
      prev = point;
    }
  };

  for (const feat of res.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === "LineString") {
      consumeLine(
        g.coordinates as Array<[number, number, number?]>,
      );
    } else if (g.type === "MultiLineString") {
      for (const c of g.coordinates as Array<
        Array<[number, number, number?]>
      >) {
        consumeLine(c);
      }
    }
  }

  if (allSegments.length > 0) {
    const segGeom = new LineSegmentsGeometry();
    segGeom.setPositions(allSegments);
    const segs = new LineSegments2(segGeom, material);
    segs.computeLineDistances();
    segs.renderOrder = ROAD_RENDER_ORDER;
    segs.userData.displayName = "Road access";
    group.add(segs);
  }

  debugLog(
    `[loadRoads] ${res.features.length} features -> ${polylineCount} polylines, ${
      allSegments.length / 6
    } segments`,
  );
  return group;
}
