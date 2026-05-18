import * as THREE from "three";
import { utmToScene } from "../constants";
import { debugLog } from "../utils/debugLog";

const TUBE_AXIS = new THREE.Vector3(0, 1, 0);
const DEFAULT_RADIUS_M = 18;
const DEFAULT_ENDPOINT_RADIUS_M = 30;
const RENDER_ORDER = 6.45;

interface HyperspectralFeature {
  type: "Feature";
  properties: {
    id: string;
    displayName: string;
    holeId: string;
    scannedStartDepthM: number;
    scannedEndDepthM: number;
    spectralCsvCount?: number;
    [k: string]: unknown;
  };
  geometry: {
    type: "LineString";
    coordinates: Array<[number, number, number]>;
  } | null;
}

interface HyperspectralCollection {
  type: "FeatureCollection";
  features: HyperspectralFeature[];
}

export async function loadHyperspectralCoverage(
  url: string,
): Promise<THREE.Group> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const data = (await res.json()) as HyperspectralCollection;

  const group = new THREE.Group();
  group.name = "hyperspectral-coverage-2024";
  group.userData.displayName = "2024 Hyperspectral coverage";

  const tubeGeom = new THREE.CylinderGeometry(1, 1, 1, 32, 4, true);
  tubeGeom.computeVertexNormals();
  const endpointGeom = new THREE.SphereGeometry(1, 28, 18);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xb26cff,
    emissive: 0x4d2e78,
    emissiveIntensity: 0.022,
    transparent: true,
    opacity: 0.72,
    depthTest: false,
    depthWrite: false,
    roughness: 0.36,
    metalness: 0.14,
    toneMapped: true,
    fog: true,
  });
  baseMaterial.userData.forceTransparent = true;

  let count = 0;
  for (const feat of data.features) {
    if (!feat.geometry || feat.geometry.type !== "LineString") continue;
    const coords = feat.geometry.coordinates;
    if (coords.length < 2) continue;
    const [sx0, sy0, sz0] = utmToScene(coords[0][0], coords[0][1], coords[0][2]);
    const [sx1, sy1, sz1] = utmToScene(coords[1][0], coords[1][1], coords[1][2]);
    const start = new THREE.Vector3(sx0, sy0, sz0);
    const end = new THREE.Vector3(sx1, sy1, sz1);
    const axis = end.clone().sub(start);
    const length = axis.length();
    if (length < 0.01) continue;
    const displayName = feat.properties.displayName;

    const tube = new THREE.Mesh(tubeGeom, baseMaterial.clone());
    tube.position.copy(start).add(end).multiplyScalar(0.5);
    tube.quaternion.setFromUnitVectors(TUBE_AXIS, axis.normalize());
    tube.scale.set(DEFAULT_RADIUS_M, length, DEFAULT_RADIUS_M);
    tube.renderOrder = RENDER_ORDER;
    tube.userData = {
      hyperspectralCoverage: true,
      hyperspectralPart: "tube",
      displayName,
      holeId: feat.properties.holeId,
      segmentLength: length,
      defaultRadiusM: DEFAULT_RADIUS_M,
      scannedStartDepthM: feat.properties.scannedStartDepthM,
      scannedEndDepthM: feat.properties.scannedEndDepthM,
      spectralCsvCount: feat.properties.spectralCsvCount,
    };
    group.add(tube);

    for (const [index, point] of [start, end].entries()) {
      const endpoint = new THREE.Mesh(endpointGeom, baseMaterial.clone());
      endpoint.position.copy(point);
      endpoint.scale.setScalar(DEFAULT_ENDPOINT_RADIUS_M);
      endpoint.renderOrder = RENDER_ORDER + 0.05;
      endpoint.userData = {
        hyperspectralCoverage: true,
        hyperspectralPart: "endpoint",
        displayName:
          index === 0
            ? `${feat.properties.holeId} spectral scan starts`
            : `${feat.properties.holeId} spectral scan ends`,
        holeId: feat.properties.holeId,
        defaultRadiusM: DEFAULT_ENDPOINT_RADIUS_M,
      };
      group.add(endpoint);
    }
    count++;
  }

  debugLog(`[loadHyperspectralCoverage] ${count} scanned intervals`);
  return group;
}
