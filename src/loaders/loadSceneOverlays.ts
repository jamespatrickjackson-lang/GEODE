import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { utmToScene } from "../constants";
import { getHeightSampler, type HeightSampler } from "../scene/heightSampler";
import type { SceneOverlayDef } from "../pages/types";
import { debugLog } from "../utils/debugLog";

// Bounds-outline visual constants. Outline alpha is independent of the
// texture's per-page opacity so the frame stays readable at any opacity
// setting; only its visibility (in/out) tracks the overlay's.
const OUTLINE_COLOR = 0xc8c0a8;
const OUTLINE_LINEWIDTH = 1.2;
const OUTLINE_LIFT_M = 6; // above streams (+5m), below targets
const OUTLINE_VISIBLE_ALPHA = 0.6;

// Scene-overlay loader. Each registered overlay becomes a single
// terrain-conformal mesh textured with the source image:
//
//   1. Texture: TextureLoader, sRGB color space, max anisotropy so
//      labels stay legible at oblique angles, mipmapped.
//   2. Mesh: a regular grid spanning the overlay's bounds rectangle in
//      scene-local XY, subdivided so each edge is <= STEP_M metres
//      (200 m for district-scale ≥6 km extent, 100 m for property-scale).
//      Per-vertex z = heightSampler(easting, northing) + liftMeters --
//      the mesh follows terrain; the texture is a planar projection.
//   3. UVs from world XY relative to bounds (planar). UVs are
//      independent of vertex z, so wrinkles in the terrain don't
//      distort the image.
//   4. Material: MeshBasicMaterial. transparent + depthWrite:false +
//      polygonOffset to win the depth fight against terrain. Opacity
//      starts at 0 -- PageController fades the right ones up after
//      mount. toneMapped:true so neither the texture nor a bright
//      label catches UnrealBloomPass.
//
// Each handle exposes `setOpacity(target, durMs)` which records a
// linear tween advanced by the scene's frame loop. SceneManager owns
// the tween advance so this loader stays stateless beyond the handles.

const STEP_M_PROPERTY = 100; // ≤6 km extent
const STEP_M_DISTRICT = 200; // >6 km extent
const PROPERTY_SCALE_THRESHOLD_M = 6000;

export interface SceneOverlayHandle {
  id: string;
  def: SceneOverlayDef;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  /** Bounds-outline child line, draped on terrain. */
  outlineMesh: Line2;
  outlineMaterial: LineMaterial;
  /** Texture-mesh opacity tween. */
  tween: { from: number; to: number; t0: number; durMs: number } | null;
  /** Final texture target opacity (current if no tween in flight). */
  target: number;
  /** Outline-mesh opacity tween (independent magnitude from `tween`). */
  outlineTween: {
    from: number;
    to: number;
    t0: number;
    durMs: number;
  } | null;
  /** Final outline target opacity (0 or OUTLINE_VISIBLE_ALPHA). */
  outlineTarget: number;
}

export function pickStepMetres(
  bounds: SceneOverlayDef["bounds"],
): number {
  const widthM = Math.abs(bounds[2] - bounds[0]);
  const heightM = Math.abs(bounds[3] - bounds[1]);
  const maxExtent = Math.max(widthM, heightM);
  return maxExtent > PROPERTY_SCALE_THRESHOLD_M
    ? STEP_M_DISTRICT
    : STEP_M_PROPERTY;
}

/**
 * Build the textured-plane geometry for a scene overlay. Per-vertex
 * z is sampled from terrain so the mesh follows relief; UVs are a
 * planar projection from world XY into the bounds rect. Used both at
 * initial load and when the user repositions an overlay (the geometry
 * is rebuilt against the new bounds and swapped in via setGeometry).
 */
export function buildOverlayPlaneGeometry(
  bounds: SceneOverlayDef["bounds"],
  liftMeters: number,
  step: number,
  sample: HeightSampler,
): THREE.BufferGeometry {
  const [minE, minN, maxE, maxN] = bounds;
  const widthM = maxE - minE;
  const heightM = maxN - minN;
  const segX = Math.max(1, Math.ceil(widthM / step));
  const segY = Math.max(1, Math.ceil(heightM / step));
  const positions = new Float32Array((segX + 1) * (segY + 1) * 3);
  const uvs = new Float32Array((segX + 1) * (segY + 1) * 2);
  for (let j = 0; j <= segY; j++) {
    for (let i = 0; i <= segX; i++) {
      const u = i / segX;
      const v = j / segY;
      const e = minE + u * widthM;
      const n = minN + v * heightM;
      const z = sample(e, n) + liftMeters;
      const [sx, sy, sz] = utmToScene(e, n, z);
      const idx = (j * (segX + 1) + i) * 3;
      positions[idx] = sx;
      positions[idx + 1] = sy;
      positions[idx + 2] = sz;
      const uvIdx = (j * (segX + 1) + i) * 2;
      uvs[uvIdx] = u;
      uvs[uvIdx + 1] = v;
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < segY; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * (segX + 1) + i;
      const b = a + 1;
      const c = a + (segX + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  geom.computeBoundingBox();
  return geom;
}

/**
 * Build a closed-rectangle polyline along the bounds, draped per-vertex
 * onto terrain. Each edge is subdivided so the line follows relief
 * instead of cutting through it.
 */
export function buildBoundsOutlinePositions(
  bounds: SceneOverlayDef["bounds"],
  step: number,
  liftMeters: number,
  sample: HeightSampler,
): number[] {
  const [minE, minN, maxE, maxN] = bounds;
  const widthM = maxE - minE;
  const heightM = maxN - minN;
  const segX = Math.max(1, Math.ceil(widthM / step));
  const segY = Math.max(1, Math.ceil(heightM / step));
  const positions: number[] = [];
  const push = (e: number, n: number) => {
    const z = sample(e, n) + liftMeters;
    const [sx, sy, sz] = utmToScene(e, n, z);
    positions.push(sx, sy, sz);
  };
  // Bottom edge (minN), W -> E, including both endpoints.
  for (let i = 0; i <= segX; i++) push(minE + (i / segX) * widthM, minN);
  // Right edge (maxE), S -> N, skip the corner already pushed.
  for (let j = 1; j <= segY; j++) push(maxE, minN + (j / segY) * heightM);
  // Top edge (maxN), E -> W, skip the corner.
  for (let i = segX - 1; i >= 0; i--) push(minE + (i / segX) * widthM, maxN);
  // Left edge (minE), N -> S, skip both corners.
  for (let j = segY - 1; j >= 1; j--) push(minE, minN + (j / segY) * heightM);
  // Close back to the start corner.
  push(minE, minN);
  return positions;
}

export async function loadSingleSceneOverlay(
  id: string,
  def: SceneOverlayDef,
  resolveAssetPath: (rel: string) => string,
  maxAnisotropy: number,
): Promise<SceneOverlayHandle | null> {
  debugLog(`[loadSceneOverlays:${id}] starting; awaiting heightSampler`);
  const sample = await getHeightSampler();
  const url = resolveAssetPath(def.path);
  debugLog(
    `[loadSceneOverlays:${id}] heightSampler ready; fetching texture ${url}`,
  );
  const texture = await new THREE.TextureLoader().loadAsync(url).catch(
    (e) => {
      console.error(
        `[loadSceneOverlays:${id}] texture load failed at ${url}:`,
        e,
      );
      return null;
    },
  );
  if (!texture) return null;
  debugLog(
    `[loadSceneOverlays:${id}] texture loaded ${texture.image?.width}x${texture.image?.height}`,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  const lift = def.liftMeters ?? 8;
  const step = pickStepMetres(def.bounds);
  const geom = buildOverlayPlaneGeometry(def.bounds, lift, step, sample);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: new THREE.Color(def.tint ?? "#ffffff"),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    toneMapped: true,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(geom, material);
  mesh.name = `scene-overlay:${id}`;
  // Above terrain (0) and streams (1), but BELOW additive emissive
  // features (drill traces, collars, target rings — all renderOrder 5)
  // so their glow composites on top of the overlay rather than the
  // overlay covering them.
  mesh.renderOrder = 2;
  mesh.userData.displayName = def.label;
  mesh.userData.sceneOverlayId = id;

  // Bounds outline -- draped polyline along the rectangle perimeter.
  // Independent material so its alpha can be tweened separately from
  // the texture: the frame stays readable at any overlay opacity.
  const outlinePositions = buildBoundsOutlinePositions(
    def.bounds,
    step,
    OUTLINE_LIFT_M,
    sample,
  );
  const outlineGeom = new LineGeometry();
  outlineGeom.setPositions(outlinePositions);
  const outlineMaterial = new LineMaterial({
    color: OUTLINE_COLOR,
    linewidth: OUTLINE_LINEWIDTH,
    worldUnits: false,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  outlineMaterial.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );
  // toneMapped left at default true; outline must NOT bloom.
  const outlineMesh = new Line2(outlineGeom, outlineMaterial);
  outlineMesh.computeLineDistances();
  outlineMesh.renderOrder = 3; // paired just above the textured plane (2)
  outlineMesh.name = `scene-overlay-bounds:${id}`;
  outlineMesh.userData.sceneOverlayId = id;

  const [minE, minN, maxE, maxN] = def.bounds;
  debugLog(
    `[loadSceneOverlays:${id}] step=${step}m, bounds ` +
      `[${minE},${minN}]-[${maxE},${maxN}], outline ` +
      `${outlinePositions.length / 3} vertices`,
  );

  return {
    id,
    def,
    mesh,
    material,
    outlineMesh,
    outlineMaterial,
    tween: null,
    target: 0,
    outlineTween: null,
    outlineTarget: 0,
  };
}

/**
 * Eager-loads every overlay registered in env.sceneOverlays. Returns a
 * map keyed by overlay id. Failures (missing image, network error) are
 * logged and dropped from the map so they don't break the rest of the
 * scene.
 */
export async function loadSceneOverlays(
  registry: Record<string, SceneOverlayDef>,
  resolveAssetPath: (rel: string) => string,
  maxAnisotropy: number,
): Promise<Map<string, SceneOverlayHandle>> {
  const entries = Object.entries(registry);
  debugLog(
    `[loadSceneOverlays] called with ${entries.length} overlay(s):`,
    entries.map(([id]) => id),
  );
  if (entries.length === 0) return new Map();
  const results = await Promise.all(
    entries.map(([id, def]) =>
      loadSingleSceneOverlay(id, def, resolveAssetPath, maxAnisotropy),
    ),
  );
  const out = new Map<string, SceneOverlayHandle>();
  for (const handle of results) {
    if (handle) out.set(handle.id, handle);
  }
  return out;
}

/**
 * Advance per-handle opacity tweens (texture + outline are tracked
 * independently). Called once per frame from the scene tick loop.
 */
export function tickSceneOverlayTweens(
  handles: Iterable<SceneOverlayHandle>,
  nowMs: number,
): void {
  for (const h of handles) {
    if (h.tween) {
      const t = (nowMs - h.tween.t0) / h.tween.durMs;
      if (t >= 1) {
        h.material.opacity = h.tween.to;
        h.target = h.tween.to;
        h.tween = null;
        h.mesh.visible = h.material.opacity > 0.001;
      } else if (t > 0) {
        h.material.opacity =
          h.tween.from + (h.tween.to - h.tween.from) * t;
        h.mesh.visible = true;
      }
    }
    if (h.outlineTween) {
      const t = (nowMs - h.outlineTween.t0) / h.outlineTween.durMs;
      if (t >= 1) {
        h.outlineMaterial.opacity = h.outlineTween.to;
        h.outlineTarget = h.outlineTween.to;
        h.outlineTween = null;
        h.outlineMesh.visible = h.outlineMaterial.opacity > 0.001;
      } else if (t > 0) {
        h.outlineMaterial.opacity =
          h.outlineTween.from +
          (h.outlineTween.to - h.outlineTween.from) * t;
        h.outlineMesh.visible = true;
      }
    }
  }
}

/**
 * Apply the current tint colour to a handle's material. White
 * ("#ffffff") leaves the texture unchanged. Cheap immediate write,
 * no tween (tints feel direct, not gradual).
 */
export function setSceneOverlayTint(
  handle: SceneOverlayHandle,
  hex: string,
): void {
  handle.material.color.set(hex);
}

/**
 * Replace a handle's plane geometry with one rebuilt against a new
 * bounds rectangle. Old geometry is disposed, the mesh's transform
 * is reset to identity (drag ops set position transiently for live
 * feedback), and the outline geometry is similarly rebuilt. The
 * texture, material, opacity, render order, and userData are all
 * preserved.
 */
export function rebuildSceneOverlayGeometry(
  handle: SceneOverlayHandle,
  newBounds: SceneOverlayDef["bounds"],
  sample: HeightSampler,
): void {
  const lift = handle.def.liftMeters ?? 8;
  const step = pickStepMetres(newBounds);
  const newGeom = buildOverlayPlaneGeometry(newBounds, lift, step, sample);
  handle.mesh.geometry.dispose();
  handle.mesh.geometry = newGeom;
  handle.mesh.position.set(0, 0, 0);

  const newOutlinePositions = buildBoundsOutlinePositions(
    newBounds,
    step,
    OUTLINE_LIFT_M,
    sample,
  );
  const newOutlineGeom = new LineGeometry();
  newOutlineGeom.setPositions(newOutlinePositions);
  handle.outlineMesh.geometry.dispose();
  handle.outlineMesh.geometry = newOutlineGeom;
  handle.outlineMesh.computeLineDistances();
  handle.outlineMesh.position.set(0, 0, 0);

  // Mutate the def in place so subsequent applies see the new bounds.
  handle.def.bounds = newBounds;
}

/**
 * Tear down a handle's GPU resources. Called by SceneManager when
 * the user removes an overlay from the env registry.
 */
export function disposeSceneOverlay(handle: SceneOverlayHandle): void {
  handle.mesh.geometry.dispose();
  handle.outlineMesh.geometry.dispose();
  handle.material.map?.dispose();
  handle.material.dispose();
  handle.outlineMaterial.dispose();
}

/**
 * Schedule a fade for a handle. The texture mesh tweens to `to` (the
 * per-page opacity); the outline mesh tweens to OUTLINE_VISIBLE_ALPHA
 * if `to > 0`, else 0 -- so the frame appears whenever the overlay is
 * "on this page" but its alpha is independent of the texture's.
 *
 * Idempotent on both axes: if both targets are already current and no
 * tween is in flight, this is a no-op.
 */
export function fadeSceneOverlayTo(
  handle: SceneOverlayHandle,
  to: number,
  nowMs: number,
  durMs: number,
): void {
  debugLog(
    `[fadeSceneOverlayTo:${handle.id}] target=${handle.target} -> ${to}, ` +
      `current opacity=${handle.material.opacity.toFixed(3)}, ` +
      `tween=${handle.tween ? "in-flight" : "null"}`,
  );
  // Texture
  if (handle.target !== to || handle.tween) {
    const from = handle.material.opacity;
    if (to > 0 || from > 0) handle.mesh.visible = true;
    handle.tween = { from, to, t0: nowMs, durMs };
    handle.target = to;
  }
  // Outline -- driven by visibility, not by `to` magnitude.
  const outlineTo = to > 0 ? OUTLINE_VISIBLE_ALPHA : 0;
  if (handle.outlineTarget !== outlineTo || handle.outlineTween) {
    const oFrom = handle.outlineMaterial.opacity;
    if (outlineTo > 0 || oFrom > 0) handle.outlineMesh.visible = true;
    handle.outlineTween = { from: oFrom, to: outlineTo, t0: nowMs, durMs };
    handle.outlineTarget = outlineTo;
  }
}
