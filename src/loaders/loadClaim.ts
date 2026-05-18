import * as THREE from "three";
import { PROJECT_BOUNDS, utmToScene } from "../constants";
import { setOverlayMask } from "../scene/heightSampler";
import { debugLog } from "../utils/debugLog";

// Vizsla Copper Corp consolidated mineral tenure boundary. Source data
// is one (Multi)Polygon dissolved from all active tenures owned by
// owner #284856 within the project bbox, prepared by
// prep/fetch_claim.py.
//
// Render approach -- shader-projected fill (NOT outline geometry):
//
//   1. Rasterize the dissolved polygon into a single canvas texture
//      covering the full project bounds in scene-local XY. Inside the
//      polygon -> alpha=1, outside -> alpha=0.
//   2. Publish the mask through the overlay-mask broker under slot
//      "claim". loadTerrain.ts subscribes and pipes the texture into
//      the terrain shader's claim-slot uniforms.
//   3. SceneManager.applyLakesToTerrain forwards this layer's effective
//      color + opacity into the same uniforms, so the env style (color
//      / opacity) and visibility flags drive the in-shader composite.
//
// Identical projection pattern to lakes -- the layer registry entry
// exists only as a marker so the editor's Layers panel can drive
// color/visibility/opacity. No 3D geometry is added to the group.

const MASK_RES = 2048;

interface Feature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
}
interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

export async function loadClaim(url: string): Promise<THREE.Group> {
  const res = (await fetch(url).then((r) => r.json())) as FeatureCollection;

  const group = new THREE.Group();
  group.name = "claim-boundary";

  // Mask covers the full project bounds in scene-local XY (sceneOrigin
  // already subtracted). The terrain shader maps vWorldPos.xy directly
  // into this UV. Same convention as the lake mask.
  const [minSx, minSy] = utmToScene(
    PROJECT_BOUNDS.min.easting,
    PROJECT_BOUNDS.min.northing,
    0,
  );
  const [maxSx, maxSy] = utmToScene(
    PROJECT_BOUNDS.max.easting,
    PROJECT_BOUNDS.max.northing,
    0,
  );

  const c = document.createElement("canvas");
  c.width = MASK_RES;
  c.height = MASK_RES;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("loadClaim: failed to get 2d canvas context");
  ctx.clearRect(0, 0, MASK_RES, MASK_RES);
  ctx.fillStyle = "rgba(255,255,255,1)";

  const sceneToCanvasX = (sx: number) =>
    ((sx - minSx) / (maxSx - minSx)) * MASK_RES;
  // Flip Y -- canvas y=0 is top; we want texture v=1 (top after default
  // flipY upload) to align with scene +Y (north).
  const sceneToCanvasY = (sy: number) =>
    (1 - (sy - minSy) / (maxSy - minSy)) * MASK_RES;

  const drawRing = (ring: Array<[number, number, number?]>) => {
    if (ring.length < 3) return;
    for (let i = 0; i < ring.length; i++) {
      const [e, n] = ring[i];
      const [sx, sy] = utmToScene(e, n, 0);
      const cx = sceneToCanvasX(sx);
      const cy = sceneToCanvasY(sy);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.closePath();
  };

  const drawPolygon = (polygon: Array<Array<[number, number, number?]>>) => {
    if (!polygon[0] || polygon[0].length < 3) return;
    ctx.beginPath();
    drawRing(polygon[0]);
    // Inner rings (holes) -- evenodd fill rule punches them out below.
    for (let h = 1; h < polygon.length; h++) {
      drawRing(polygon[h]);
    }
    ctx.fill("evenodd");
  };

  let polyCount = 0;
  for (const feat of res.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      drawPolygon(g.coordinates as Array<Array<[number, number, number?]>>);
      polyCount++;
    } else if (g.type === "MultiPolygon") {
      for (const p of g.coordinates as Array<
        Array<Array<[number, number, number?]>>
      >) {
        drawPolygon(p);
        polyCount++;
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace; // mask, not color data
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  setOverlayMask("claim", {
    texture: tex,
    boundsMin: [minSx, minSy],
    boundsMax: [maxSx, maxSy],
  });

  debugLog(
    `[loadClaim] ${res.features.length} feature(s) -> ${polyCount} polygons rasterized into ${MASK_RES}^2 mask`,
  );
  return group;
}
