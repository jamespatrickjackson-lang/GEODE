import * as THREE from "three";
import { PROJECT_BOUNDS, utmToScene } from "../constants";
import { getHeightSampler, setOverlayMask } from "../scene/heightSampler";
import type { TargetSlotId } from "../scene/terrainMaterial";

// Stub target outlines for chapter 4 (decision pending re: digitizing
// the real polygons from Vizsla 40K profile PDFs). They render as a
// fill-only terrain mask: no separate outline geometry. A tiny label anchor
// object sits at the target centre so labels stay attached to the filled zone.

interface TargetSpec {
  slot: TargetSlotId;
  // Display label surfaced by the hover-tooltip raycaster.
  displayName: string;
  centerUtm: [number, number];
  // Half-axes in metres (stub ellipse shape).
  halfAxes: [number, number];
  rotationDeg?: number;
  color: number;
}

const MASK_RES = 1024; // per-target rasterization resolution
// Pixel padding around the polygon's bounding box so feathered edges
// don't clip at the texture boundary.
const MASK_PADDING_M = 200;
const LABEL_RAISE_M = 8;

function rasterizeFeatheredEllipseMask(spec: TargetSpec): {
  texture: THREE.Texture;
  boundsMin: [number, number];
  boundsMax: [number, number];
} {
  // Bounding box in UTM with padding.
  const semiMaxAxis = Math.max(spec.halfAxes[0], spec.halfAxes[1]);
  const minUtmX = spec.centerUtm[0] - semiMaxAxis - MASK_PADDING_M;
  const maxUtmX = spec.centerUtm[0] + semiMaxAxis + MASK_PADDING_M;
  const minUtmY = spec.centerUtm[1] - semiMaxAxis - MASK_PADDING_M;
  const maxUtmY = spec.centerUtm[1] + semiMaxAxis + MASK_PADDING_M;

  // Convert to scene-local XY (sceneOrigin subtracted). The shader
  // samples vWorldPos.xy directly into these bounds.
  const [minSx, minSy] = utmToScene(minUtmX, minUtmY, 0);
  const [maxSx, maxSy] = utmToScene(maxUtmX, maxUtmY, 0);

  const c = document.createElement("canvas");
  c.width = MASK_RES;
  c.height = MASK_RES;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("loadTargets: failed to get 2d context");
  ctx.clearRect(0, 0, MASK_RES, MASK_RES);

  // Map UTM ellipse to canvas: convert center + axes to canvas pixels.
  const sceneToCanvasX = (sx: number) =>
    ((sx - minSx) / (maxSx - minSx)) * MASK_RES;
  const sceneToCanvasY = (sy: number) =>
    (1 - (sy - minSy) / (maxSy - minSy)) * MASK_RES;
  const [cxScene, cyScene] = utmToScene(
    spec.centerUtm[0],
    spec.centerUtm[1],
    0,
  );
  const cxPx = sceneToCanvasX(cxScene);
  const cyPx = sceneToCanvasY(cyScene);

  // Solid flat fill. No gradient, no feathering. Pixels inside the
  // ellipse get alpha=1; outside alpha=0. The terrain shader does a
  // straight mix() at the layer's opacity, so this reads as a flat
  // translucent zone marker (a la a coloured plastic film over a map),
  // not a glow halo.
  ctx.save();
  ctx.translate(cxPx, cyPx);
  ctx.rotate(THREE.MathUtils.degToRad(spec.rotationDeg ?? 0));
  const pxPerM = MASK_RES / (maxSx - minSx);
  ctx.scale(spec.halfAxes[0] * pxPerM, spec.halfAxes[1] * pxPerM);
  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  return {
    texture: tex,
    boundsMin: [minSx, minSy],
    boundsMax: [maxSx, maxSy],
  };
}

async function buildTargetGroup(spec: TargetSpec): Promise<THREE.Group> {
  const sample = await getHeightSampler();
  const group = new THREE.Group();

  // ---- Fill: rasterize the ellipse mask and publish it to the terrain
  // shader. Terrain pixels inside the mask get mixed with the layer color.
  const maskInfo = rasterizeFeatheredEllipseMask(spec);
  setOverlayMask(spec.slot, maskInfo);

  const [centerSx, centerSy, centerSz] = utmToScene(
    spec.centerUtm[0],
    spec.centerUtm[1],
    sample(spec.centerUtm[0], spec.centerUtm[1]) + LABEL_RAISE_M,
  );

  const labelAnchor = new THREE.Object3D();
  labelAnchor.name = `${spec.slot}-label-anchor`;
  labelAnchor.position.set(centerSx, centerSy, centerSz);
  labelAnchor.userData.displayName = spec.displayName;
  labelAnchor.userData.labelAnchor = true;
  group.add(labelAnchor);

  return group;
}

const _PROJECT_BOUNDS_CHECK = PROJECT_BOUNDS; // referenced for clarity
void _PROJECT_BOUNDS_CHECK;

const THREE_FIRS_SPEC: TargetSpec = {
  slot: "target-three-firs",
  displayName: "Three Firs target (draft placeholder)",
  // Anchored to the 2024 Three Firs collar centroid from
  // data/drillholes_2024_tf.geojson. The previous stub was ~520 m southeast
  // of the borehole reference and made the map infill/label read as drifted.
  centerUtm: [608463, 5787608],
  halfAxes: [350, 250],
  rotationDeg: 25,
  color: 0xff5a8a,
};

const GREAT_PLAINS_SPEC: TargetSpec = {
  slot: "target-great-plains",
  displayName: "Great Plains target (draft placeholder)",
  centerUtm: [613600, 5787800],
  halfAxes: [1000, 900],
  rotationDeg: -10,
  color: 0x9a6cff,
};

export async function loadThreeFirsTarget(): Promise<THREE.Group> {
  const g = await buildTargetGroup(THREE_FIRS_SPEC);
  g.name = "three-firs-target";
  return g;
}

export async function loadGreatPlainsTarget(): Promise<THREE.Group> {
  const g = await buildTargetGroup(GREAT_PLAINS_SPEC);
  g.name = "great-plains-target";
  return g;
}
