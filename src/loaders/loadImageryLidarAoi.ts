import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { utmToScene } from "../constants";
import { getHeightSampler } from "../scene/heightSampler";
import { debugLog } from "../utils/debugLog";
import { enableDistanceAttenuatedLineWidth } from "./topoLineMaterial";

const GRID_STEPS = 36;
const EDGE_STEPS = 120;
const LIFT_M = 34;
const CORNER_RADIUS_M = 95;
const RENDER_ORDER_FILL = 4.8;
const RENDER_ORDER_OUTLINE = 6.05;

interface ImageryAoiFeature {
  type: "Feature";
  properties: {
    id: string;
    displayName: string;
    [k: string]: unknown;
  };
  geometry: {
    type: "Polygon";
    coordinates: Array<Array<[number, number, number?]>>;
  } | null;
}

interface ImageryAoiCollection {
  type: "FeatureCollection";
  features: ImageryAoiFeature[];
}

function boundsFromRing(ring: Array<[number, number, number?]>) {
  let minE = Number.POSITIVE_INFINITY;
  let maxE = Number.NEGATIVE_INFINITY;
  let minN = Number.POSITIVE_INFINITY;
  let maxN = Number.NEGATIVE_INFINITY;
  for (const [e, n] of ring) {
    minE = Math.min(minE, e);
    maxE = Math.max(maxE, e);
    minN = Math.min(minN, n);
    maxN = Math.max(maxN, n);
  }
  return { minE, maxE, minN, maxN };
}

function pushTerrainPoint(
  out: number[],
  sample: (easting: number, northing: number) => number,
  easting: number,
  northing: number,
  lift = LIFT_M,
) {
  const z = sample(easting, northing) + lift;
  const [sx, sy, sz] = utmToScene(easting, northing, z);
  out.push(sx, sy, sz);
}

function makeFillGeometry(
  bounds: ReturnType<typeof boundsFromRing>,
  sample: (easting: number, northing: number) => number,
) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const { minE, maxE, minN, maxN } = bounds;
  for (let y = 0; y < GRID_STEPS; y++) {
    const v0 = y / GRID_STEPS;
    const v1 = (y + 1) / GRID_STEPS;
    const n0 = minN + (maxN - minN) * v0;
    const n1 = minN + (maxN - minN) * v1;
    for (let x = 0; x < GRID_STEPS; x++) {
      const u0 = x / GRID_STEPS;
      const u1 = (x + 1) / GRID_STEPS;
      const e0 = minE + (maxE - minE) * u0;
      const e1 = minE + (maxE - minE) * u1;

      pushTerrainPoint(positions, sample, e0, n0);
      pushTerrainPoint(positions, sample, e1, n0);
      pushTerrainPoint(positions, sample, e1, n1);
      pushTerrainPoint(positions, sample, e0, n0);
      pushTerrainPoint(positions, sample, e1, n1);
      pushTerrainPoint(positions, sample, e0, n1);

      uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

function makeOutlineGeometry(
  bounds: ReturnType<typeof boundsFromRing>,
  sample: (easting: number, northing: number) => number,
) {
  const { minE, maxE, minN, maxN } = bounds;
  const corners = [
    [minE, minN],
    [maxE, minN],
    [maxE, maxN],
    [minE, maxN],
    [minE, minN],
  ] as const;
  const positions: number[] = [];
  for (let edge = 0; edge < corners.length - 1; edge++) {
    const [e0, n0] = corners[edge];
    const [e1, n1] = corners[edge + 1];
    let prev: [number, number] | null = null;
    for (let i = 0; i <= EDGE_STEPS; i++) {
      const t = i / EDGE_STEPS;
      const e = e0 + (e1 - e0) * t;
      const n = n0 + (n1 - n0) * t;
      if (prev) {
        pushTerrainPoint(positions, sample, prev[0], prev[1], LIFT_M + 10);
        pushTerrainPoint(positions, sample, e, n, LIFT_M + 10);
      }
      prev = [e, n];
    }
  }
  const geom = new LineSegmentsGeometry();
  geom.setPositions(positions);
  return geom;
}

export async function loadImageryLidarAoi(url: string): Promise<THREE.Group> {
  const [res, sample] = await Promise.all([
    fetch(url).then((r) => r.json()) as Promise<ImageryAoiCollection>,
    getHeightSampler(),
  ]);

  const group = new THREE.Group();
  group.name = "imagery-lidar-aoi-2024";
  group.userData.displayName = "2024 LiDAR acquisition footprint";

  const feature = res.features.find(
    (feat) => feat.geometry?.type === "Polygon",
  );
  const ring = feature?.geometry?.coordinates[0];
  if (!feature || !ring || ring.length < 4) return group;

  const displayName = feature.properties.displayName;
  const bounds = boundsFromRing(ring);

  const fill = new THREE.Mesh(
    makeFillGeometry(bounds, sample),
    new THREE.MeshStandardMaterial({
      color: 0x6cc7ff,
      transparent: true,
      opacity: 0.1,
      depthTest: true,
      depthWrite: false,
      roughness: 0.72,
      metalness: 0.02,
      toneMapped: true,
      fog: true,
    }),
  );
  fill.renderOrder = RENDER_ORDER_FILL;
  fill.userData = {
    imageryLidarAoi: true,
    imageryLidarPart: "fill",
    displayName,
  };
  (fill.material as THREE.Material).userData.forceTransparent = true;
  (fill.material as THREE.Material).userData.lakeFillMaterial = true;
  group.add(fill);

  const outlineMaterial = new LineMaterial({
    color: 0x6cc7ff,
    linewidth: 3,
    worldUnits: false,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false,
  });
  outlineMaterial.fog = true;
  outlineMaterial.userData.lakeOutlineMaterial = true;
  enableDistanceAttenuatedLineWidth(outlineMaterial);
  outlineMaterial.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );
  const outline = new LineSegments2(makeOutlineGeometry(bounds, sample), outlineMaterial);
  outline.computeLineDistances();
  outline.renderOrder = RENDER_ORDER_OUTLINE;
  outline.userData = {
    imageryLidarAoi: true,
    imageryLidarPart: "outline",
    displayName,
  };
  group.add(outline);

  const cornerGeom = new THREE.SphereGeometry(1, 18, 10);
  const cornerMat = new THREE.MeshStandardMaterial({
    color: 0x6cc7ff,
    emissive: 0x21455c,
    emissiveIntensity: 0.03,
    transparent: true,
    opacity: 0.9,
    depthTest: true,
    depthWrite: false,
    roughness: 0.58,
    metalness: 0.04,
    toneMapped: true,
    fog: true,
  });
  cornerMat.userData.forceTransparent = true;
  for (const [index, [e, n]] of [
    [bounds.minE, bounds.minN],
    [bounds.maxE, bounds.minN],
    [bounds.maxE, bounds.maxN],
    [bounds.minE, bounds.maxN],
  ].entries()) {
    const z = sample(e, n) + LIFT_M + 24;
    const [sx, sy, sz] = utmToScene(e, n, z);
    const marker = new THREE.Mesh(cornerGeom, cornerMat.clone());
    marker.position.set(sx, sy, sz);
    marker.scale.setScalar(CORNER_RADIUS_M);
    marker.renderOrder = RENDER_ORDER_OUTLINE + 0.05;
    marker.userData = {
      imageryLidarAoi: true,
      imageryLidarPart: "corner",
      displayName: `${displayName} corner ${index + 1}`,
      defaultRadiusM: CORNER_RADIUS_M,
    };
    group.add(marker);
  }

  debugLog("[loadImageryLidarAoi] 1 reported approximate AOI footprint");
  return group;
}
