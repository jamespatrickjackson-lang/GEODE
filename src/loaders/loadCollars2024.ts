import * as THREE from "three";
import { utmToScene } from "../constants";
import { debugLog } from "../utils/debugLog";

// 2024 Three Firs collar markers. These are the punch line of chapter 4
// per docs/woodjam/content-brief.md and decision #016 -- they MUST read as
// "the answer." Visual treatment, layered:
//   1. Satin core sphere (color from layerStyles.color, emissive matching).
//      Visible as an authored field marker without blowing out the terrain.
//   2. Soft halo sprite -- a restrained cue at distance rather than a UI glow.
//   3. Vertical "stake" line from collar elevation up 300 m. Three Firs is
//      mid-property; without a stake the camera angle on chapter 4 buries
//      the dots in terrain shading. The stake reads as "drilled here, look
//      down."

interface CollarFeature {
  type: "Feature";
  properties: { id: string; zone?: string; [k: string]: unknown };
  geometry: { type: "Point"; coordinates: [number, number, number] };
}

interface CollarCollection {
  type: "FeatureCollection";
  features: CollarFeature[];
}

const STAKE_HEIGHT_M = 300;
const STAKE_RADIUS_M = 7;
const HALO_SIZE_M = 320;
const SPHERE_RADIUS_M = 26;
const STAKE_AXIS = new THREE.Vector3(0, 1, 0);

function makeHaloTexture(): THREE.Texture {
  // Procedural radial gradient -> data URL canvas -> texture. Avoids
  // shipping a texture asset.
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.62)");
  g.addColorStop(0.26, "rgba(255,255,255,0.28)");
  g.addColorStop(0.64, "rgba(255,255,255,0.06)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let haloTexture: THREE.Texture | null = null;

export async function loadCollars2024(url: string): Promise<THREE.Group> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const data = (await res.json()) as CollarCollection;

  const group = new THREE.Group();
  group.name = "drillholes-2024-tf";

  const sphereGeom = new THREE.SphereGeometry(SPHERE_RADIUS_M, 24, 16);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x6fcbd2,
    emissive: 0x6fcbd2,
    emissiveIntensity: 0.045,
    roughness: 0.55,
    metalness: 0.08,
    toneMapped: true,
    fog: true,
  });

  const stakeGeom = new THREE.CylinderGeometry(
    STAKE_RADIUS_M,
    STAKE_RADIUS_M,
    1,
    16,
    1,
    true,
  );
  stakeGeom.computeVertexNormals();
  const stakeMat = new THREE.MeshStandardMaterial({
    color: 0x6fcbd2,
    emissive: 0x6fcbd2,
    emissiveIntensity: 0.018,
    roughness: 0.58,
    metalness: 0.05,
    transparent: true,
    opacity: 0.62,
    toneMapped: true,
    fog: true,
  });
  stakeMat.userData.forceTransparent = true;
  stakeMat.userData.preserveMaterialOpacity = true;

  if (!haloTexture) haloTexture = makeHaloTexture();
  const haloMat = new THREE.SpriteMaterial({
    map: haloTexture,
    color: 0x6fcbd2,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.36,
    toneMapped: true,
    fog: true,
  });
  haloMat.userData.forceTransparent = true;
  haloMat.userData.preserveMaterialOpacity = true;

  for (const feat of data.features) {
    const [e, n, z] = feat.geometry.coordinates;
    const [sx, sy, sz] = utmToScene(e, n, z);

    // Core sphere -- the actual collar position.
    const core = new THREE.Mesh(sphereGeom, coreMat);
    core.position.set(sx, sy, sz);
    // renderOrder 5 lifts the emissive collar above scene overlays
    // (renderOrder 2) so the bloom-bright marker is never covered by
    // a draped Vizsla figure.
    core.renderOrder = 5;
    core.userData = {
      holeId: feat.properties.id,
      zone: feat.properties.zone,
      kind: "collar-2024",
      displayName: feat.properties.id,
    };
    group.add(core);

    // Vertical stake from collar up.
    const stake = new THREE.Mesh(stakeGeom, stakeMat);
    stake.position.set(sx, sy, sz + STAKE_HEIGHT_M * 0.5);
    stake.quaternion.setFromUnitVectors(STAKE_AXIS, new THREE.Vector3(0, 0, 1));
    stake.scale.set(1, STAKE_HEIGHT_M, 1);
    stake.renderOrder = 5;
    stake.castShadow = true;
    stake.receiveShadow = true;
    stake.userData = {
      kind: "collar-2024-stake",
      displayName: feat.properties.id,
    };
    group.add(stake);

    // Halo sprite at the stake top -- visible at oblique camera angles.
    const halo = new THREE.Sprite(haloMat);
    halo.position.set(sx, sy, sz + STAKE_HEIGHT_M);
    halo.scale.set(HALO_SIZE_M, HALO_SIZE_M, 1);
    halo.renderOrder = 5;
    halo.userData = {
      kind: "collar-2024-halo",
      displayName: feat.properties.id,
    };
    group.add(halo);
  }

  debugLog(`[loadCollars2024] ${data.features.length} markers`);
  return group;
}
