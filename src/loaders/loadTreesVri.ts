import * as THREE from "three";
import { PROJECT_BOUNDS, utmToScene } from "../constants";
import { getHeightSampler, setOverlayMask } from "../scene/heightSampler";
import { registerDrapedCaptureFidelity } from "./drapedCaptureFidelity";
import { debugLog } from "../utils/debugLog";

// BC VRI forest cover. This layer is intentionally rendered as a map
// overlay, not as 3D tree symbols: the prep script clips real VRI stand
// polygons to Woodjam, dissolves them into a single forest-cover body, then
// this loader rasterizes that body into a terrain-shader mask. The edge is
// drawn into the same mask channel as the fill so forest reads as one element.

const MASK_RES = 4096;

interface Feature {
  type: "Feature";
  properties: Record<string, unknown> | null;
  geometry: { type: string; coordinates: unknown } | null;
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  sceneToCanvasX: (sx: number) => number,
  sceneToCanvasY: (sy: number) => number,
  ring: Array<[number, number, number?]>,
): void {
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
}

function tracePolygon(
  ctx: CanvasRenderingContext2D,
  sceneToCanvasX: (sx: number) => number,
  sceneToCanvasY: (sy: number) => number,
  polygon: Array<Array<[number, number, number?]>>,
): void {
  if (!polygon[0] || polygon[0].length < 3) return;
  drawRing(ctx, sceneToCanvasX, sceneToCanvasY, polygon[0]);
  for (let h = 1; h < polygon.length; h++) {
    drawRing(ctx, sceneToCanvasX, sceneToCanvasY, polygon[h]);
  }
}

function buildForestWallMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uWallHeight: { value: 0 },
      uColor:      { value: new THREE.Color("#4fa563") },
      uSunDir:     { value: new THREE.Vector3(0.6, -0.4, 0.7).normalize() },
      uAmbient:    { value: 0.45 },
      uFogEnabled: { value: 0 },
      uFogColor:   { value: new THREE.Color("#0e1318") },
      uFogNear:    { value: 8000 },
      uFogFar:     { value: 18000 },
    },
    vertexShader: /* glsl */ `
      attribute float aOffset;
      attribute vec3  aNormal;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      uniform float uWallHeight;
      void main() {
        vNormal = aNormal;
        vec3 p = position + vec3(0.0, 0.0, aOffset * uWallHeight);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      uniform vec3  uColor;
      uniform vec3  uSunDir;
      uniform float uAmbient;
      uniform float uFogEnabled;
      uniform vec3  uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      void main() {
        vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        float ndl = clamp(dot(N, normalize(uSunDir)), 0.0, 1.0);
        float lit = mix(uAmbient, 1.0, sqrt(ndl));
        vec3 color = uColor * lit;
        float depth = length(vWorldPos.xy);
        float fogF  = clamp((depth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0)
                    * clamp(uFogEnabled, 0.0, 1.0);
        color = mix(color, uFogColor, fogF);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

export async function loadTreesVri(url: string): Promise<THREE.Group> {
  const [resJson, sample] = await Promise.all([
    fetch(url).then((r) => r.json()),
    getHeightSampler(),
  ]);
  const res = resJson as FeatureCollection;

  const group = new THREE.Group();
  group.name = "trees-vri";
  group.userData.displayName = "VRI forest-cover boundaries";

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
  if (!ctx) throw new Error("loadTreesVri: failed to get 2d canvas context");
  ctx.clearRect(0, 0, MASK_RES, MASK_RES);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 1.2;

  const sceneToCanvasX = (sx: number) =>
    ((sx - minSx) / (maxSx - minSx)) * MASK_RES;
  const sceneToCanvasY = (sy: number) =>
    (1 - (sy - minSy) / (maxSy - minSy)) * MASK_RES;

  let polygonCount = 0;

  // Channel contract for the terrain shader:
  //   red = dissolved forest body. The smooth edge is stroked back into
  //   the same channel so there are no separate internal stand outlines.
  ctx.fillStyle = "rgb(255,0,0)";
  for (const feat of res.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      ctx.beginPath();
      tracePolygon(
        ctx,
        sceneToCanvasX,
        sceneToCanvasY,
        g.coordinates as Array<Array<[number, number, number?]>>,
      );
      ctx.fill("evenodd");
      polygonCount++;
    } else if (g.type === "MultiPolygon") {
      for (const p of g.coordinates as Array<
        Array<Array<[number, number, number?]>>
      >) {
        ctx.beginPath();
        tracePolygon(ctx, sceneToCanvasX, sceneToCanvasY, p);
        ctx.fill("evenodd");
        polygonCount++;
      }
    }
  }

  ctx.strokeStyle = "rgb(255,0,0)";
  for (const feat of res.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      ctx.beginPath();
      tracePolygon(
        ctx,
        sceneToCanvasX,
        sceneToCanvasY,
        g.coordinates as Array<Array<[number, number, number?]>>,
      );
      ctx.stroke();
    } else if (g.type === "MultiPolygon") {
      for (const p of g.coordinates as Array<
        Array<Array<[number, number, number?]>>
      >) {
        ctx.beginPath();
        tracePolygon(ctx, sceneToCanvasX, sceneToCanvasY, p);
        ctx.stroke();
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  setOverlayMask("trees-vri", {
    texture: tex,
    boundsMin: [minSx, minSy],
    boundsMax: [maxSx, maxSy],
  });

  // Yield to the event loop so the frame renders before the synchronous
  // wall geometry build begins (prevents the browser from appearing frozen).
  await Promise.resolve();

  // Wall geometry: extruded quads along every polygon outline.
  // Base vertices sit at terrain height; top vertices are offset upward by
  // uWallHeight at draw time (reactive uniform — no rebuild needed).
  const LIFT_M = 0.5; // small base lift prevents z-fighting with terrain mesh
  const positions: number[] = [];
  const aOffsets: number[] = [];  // 0 = base, 1 = top
  const aNormals: number[] = [];  // outward XY wall normal
  const wallIndices: number[] = [];

  function addWallRing(ring: Array<[number, number, number?]>): void {
    for (let i = 0; i < ring.length - 1; i++) {
      const [e0, n0] = ring[i];
      const [e1, n1] = ring[i + 1];
      const z0 = sample(e0, n0) + LIFT_M;
      const z1 = sample(e1, n1) + LIFT_M;
      const [sx0, sy0, sz0] = utmToScene(e0, n0, z0);
      const [sx1, sy1, sz1] = utmToScene(e1, n1, z1);
      const ex = sx1 - sx0;
      const ey = sy1 - sy0;
      const len = Math.sqrt(ex * ex + ey * ey) || 1;
      const nx = -ey / len;
      const ny = ex / len;
      const base = positions.length / 3;
      // b0, b1, t0, t1
      positions.push(sx0, sy0, sz0,  sx1, sy1, sz1,
                     sx0, sy0, sz0,  sx1, sy1, sz1);
      aOffsets.push(0, 0, 1, 1);
      aNormals.push(nx, ny, 0,  nx, ny, 0,  nx, ny, 0,  nx, ny, 0);
      wallIndices.push(base, base + 1, base + 2,
                       base + 1, base + 3, base + 2);
    }
  }

  for (const feat of res.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      const poly = g.coordinates as Array<Array<[number, number, number?]>>;
      for (const ring of poly) addWallRing(ring);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates as Array<Array<Array<[number, number, number?]>>>) {
        for (const ring of poly) addWallRing(ring);
      }
    }
  }

  if (positions.length > 0) {
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    wallGeo.setAttribute("aOffset",  new THREE.Float32BufferAttribute(aOffsets, 1));
    wallGeo.setAttribute("aNormal",  new THREE.Float32BufferAttribute(aNormals, 3));
    wallGeo.setIndex(wallIndices);
    const wallMat = buildForestWallMaterial();
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.userData.forestWall = true;
    group.add(wallMesh);
    group.userData.wallMaterial = wallMat;
  }

  debugLog(
    `[loadTreesVri] ${res.features.length} dissolved forest feature(s) -> ${polygonCount} polygon body part(s) rasterized`,
  );
  registerDrapedCaptureFidelity(group, tex);
  return group;
}
