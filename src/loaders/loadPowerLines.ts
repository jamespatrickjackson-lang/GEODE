import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { utmToScene } from "../constants";
import { getHeightSampler } from "../scene/heightSampler";
import { debugLog } from "../utils/debugLog";
import { enableDistanceAttenuatedLineWidth } from "./topoLineMaterial";

// BC Transmission Lines, draped over terrain as a dashed infrastructure
// reference layer. Dash/gap are in scene meters after computeLineDistances().
const POWER_LINE_RAISE_M = 10;
const POWER_LINE_WIDTH_PX = 4;
const POWER_LINE_DASH_M = 220;
const POWER_LINE_GAP_M = 110;

interface Feature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
}
interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

export async function loadPowerLines(url: string): Promise<THREE.Group> {
  const [res, sample] = await Promise.all([
    fetch(url).then((r) => r.json()) as Promise<FeatureCollection>,
    getHeightSampler(),
  ]);

  const group = new THREE.Group();
  group.name = "power-lines";
  group.userData.displayName = "Power lines";

  const material = new LineMaterial({
    color: 0xff0000,
    linewidth: POWER_LINE_WIDTH_PX,
    worldUnits: false,
    transparent: true,
    opacity: 0.4,
    depthTest: true,
    depthWrite: false,
    dashed: true,
    dashSize: POWER_LINE_DASH_M,
    gapSize: POWER_LINE_GAP_M,
  });
  // Power lines are a topo-detail reference layer, not an overlay. Let scene
  // fog occlude them with distance so they stay grounded to the terrain.
  material.fog = true;
  enableDistanceAttenuatedLineWidth(material);
  material.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );
  group.userData.traceMaterial = material;

  const allSegments: number[] = [];
  let polylineCount = 0;

  const consumeLine = (coords: Array<[number, number, number?]>) => {
    if (coords.length < 2) return;
    polylineCount++;
    let prev: [number, number, number] | null = null;
    for (const [e, n] of coords) {
      const z = sample(e, n) + POWER_LINE_RAISE_M;
      const [sx, sy, sz] = utmToScene(e, n, z);
      if (prev) {
        allSegments.push(prev[0], prev[1], prev[2], sx, sy, sz);
      }
      prev = [sx, sy, sz];
    }
  };

  for (const feat of res.features) {
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

  if (allSegments.length > 0) {
    const segGeom = new LineSegmentsGeometry();
    segGeom.setPositions(allSegments);
    const segs = new LineSegments2(segGeom, material);
    segs.computeLineDistances();
    segs.renderOrder = 3;
    segs.userData.displayName = "Power lines";
    group.add(segs);
  }

  debugLog(
    `[loadPowerLines] ${res.features.length} features -> ${polylineCount} polylines, ${
      allSegments.length / 6
    } segments`,
  );
  return group;
}
