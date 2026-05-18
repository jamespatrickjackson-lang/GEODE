import * as THREE from "three";
import { utmToScene } from "../constants";
import { getHeightSampler } from "../scene/heightSampler";
import { debugLog } from "../utils/debugLog";

const MARKER_RADIUS_M = 120;
const PIN_HEIGHT_M = 650;
const PIN_RADIUS_M = 18;
const HALO_SIZE_M = 900;
const BASE_LIFT_M = 80;
const PIN_AXIS = new THREE.Vector3(0, 1, 0);

interface NeighborFeature {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    operator?: string;
    commodity?: string;
    [k: string]: unknown;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface NeighborCollection {
  type: "FeatureCollection";
  features: NeighborFeature[];
}

function makeHaloTexture(): THREE.Texture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    2,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,0.8)");
  g.addColorStop(0.35, "rgba(255,255,255,0.28)");
  g.addColorStop(0.75, "rgba(255,255,255,0.08)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let haloTexture: THREE.Texture | null = null;

export async function loadPropertyNeighbors(url: string): Promise<THREE.Group> {
  const [res, sample] = await Promise.all([
    fetch(url).then((r) => r.json()) as Promise<NeighborCollection>,
    getHeightSampler(),
  ]);

  const group = new THREE.Group();
  group.name = "property-neighbors";

  const markerGeom = new THREE.SphereGeometry(MARKER_RADIUS_M, 24, 16);
  const markerMat = new THREE.MeshStandardMaterial({
    color: 0x2a2820,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false,
    roughness: 0.5,
    metalness: 0.04,
    toneMapped: true,
    fog: true,
  });
  const pinGeom = new THREE.CylinderGeometry(
    PIN_RADIUS_M,
    PIN_RADIUS_M,
    1,
    14,
    1,
    true,
  );
  pinGeom.computeVertexNormals();
  const pinMat = new THREE.MeshStandardMaterial({
    color: 0x2a2820,
    transparent: true,
    opacity: 0.72,
    depthTest: true,
    depthWrite: false,
    roughness: 0.55,
    metalness: 0.02,
    toneMapped: true,
    fog: true,
  });

  if (!haloTexture) haloTexture = makeHaloTexture();
  const haloMat = new THREE.SpriteMaterial({
    map: haloTexture,
    color: 0x2a2820,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    toneMapped: false,
  });

  for (const feat of res.features) {
    const [e, n] = feat.geometry.coordinates;
    const z = sample(e, n) + BASE_LIFT_M;
    const [sx, sy, sz] = utmToScene(e, n, z);
    const name = feat.properties.name;

    const pin = new THREE.Mesh(pinGeom, pinMat);
    pin.position.set(sx, sy, sz + PIN_HEIGHT_M * 0.5);
    pin.quaternion.setFromUnitVectors(PIN_AXIS, new THREE.Vector3(0, 0, 1));
    pin.scale.set(1, PIN_HEIGHT_M, 1);
    pin.renderOrder = 4;
    pin.castShadow = true;
    pin.receiveShadow = true;
    pin.userData = {
      kind: "property-neighbor-pin",
    };
    group.add(pin);

    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.position.set(sx, sy, sz + PIN_HEIGHT_M);
    marker.renderOrder = 4;
    marker.castShadow = true;
    marker.receiveShadow = true;
    marker.userData = {
      kind: "property-neighbor",
      id: feat.properties.id,
      displayName: name,
    };
    group.add(marker);

    const halo = new THREE.Sprite(haloMat);
    halo.position.set(sx, sy, sz + PIN_HEIGHT_M);
    halo.scale.set(HALO_SIZE_M, HALO_SIZE_M, 1);
    halo.renderOrder = 3;
    halo.userData = {
      kind: "property-neighbor-halo",
    };
    group.add(halo);
  }

  debugLog(`[loadPropertyNeighbors] ${res.features.length} markers`);
  return group;
}
