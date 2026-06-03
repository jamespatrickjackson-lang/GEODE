import * as THREE from "three";
import type { SceneProperties } from "../../pages/types";
import { disposeObjectTree } from "../disposeObjectTree";
import { clampRange } from "../styles/styleUtils";

type SceneSun = NonNullable<SceneProperties["sun"]>;

interface ResolvedSunVisualOptions {
  orbVisible: boolean;
  orbColor: string;
  orbOpacity: number;
  orbSizeM: number;
  orbDistanceM: number;
  orbEdgeSoftness: number;
  orbHaloColor: string;
  orbHaloOpacity: number;
  orbHaloScale: number;
  orbRenderOrder: number;
  sourceMarkerVisible: boolean;
  sourceMarkerOpacity: number;
}

export interface EnvironmentSunVisualRuntime {
  group: THREE.Group;
  halo: THREE.Sprite;
  orb: THREE.Sprite;
  marker: THREE.Sprite;
  cacheKey: string;
  options: ResolvedSunVisualOptions;
}

const SUN_VISUAL_NAME = "__environment_sun_visual__";
const DEFAULT_ORB_COLOR = "#fff0b8";
const DEFAULT_HALO_COLOR = "#ffd58a";

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function resolveSunVisualOptions(sun: SceneSun): ResolvedSunVisualOptions {
  const orbOpacity = clampRange(numberOrDefault(sun.orbOpacity, 0.9), 0, 1);
  const markerOpacity = clampRange(
    numberOrDefault(sun.sourceMarkerOpacity, 0.72),
    0,
    1,
  );
  return {
    orbVisible: sun.orbVisible === true,
    orbColor: sun.orbColor ?? DEFAULT_ORB_COLOR,
    orbOpacity,
    orbSizeM: clampRange(numberOrDefault(sun.orbSizeM, 70000), 1000, 600000),
    orbDistanceM: clampRange(
      numberOrDefault(sun.orbDistanceM, 900000),
      10000,
      5000000,
    ),
    orbEdgeSoftness: clampRange(
      numberOrDefault(sun.orbEdgeSoftness, 0.55),
      0,
      1,
    ),
    orbHaloColor: sun.orbHaloColor ?? DEFAULT_HALO_COLOR,
    orbHaloOpacity: clampRange(numberOrDefault(sun.orbHaloOpacity, 0.28), 0, 1),
    orbHaloScale: clampRange(numberOrDefault(sun.orbHaloScale, 2.7), 1, 8),
    orbRenderOrder: Math.round(
      clampRange(numberOrDefault(sun.orbRenderOrder, 3300), -10000, 10000),
    ),
    sourceMarkerVisible: sun.sourceMarkerVisible === true,
    sourceMarkerOpacity: markerOpacity,
  };
}

function textureKey(options: ResolvedSunVisualOptions): string {
  return [
    "environment-sun",
    options.orbEdgeSoftness.toFixed(3),
    options.orbHaloScale.toFixed(3),
  ].join(":");
}

function makeCanvasTexture(
  role: "orb" | "halo" | "marker",
  edgeSoftness: number,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create sun visual canvas context.");
  const center = size / 2;
  ctx.clearRect(0, 0, size, size);

  if (role === "marker") {
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(center, center, 68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(center - 96, center);
    ctx.lineTo(center - 34, center);
    ctx.moveTo(center + 34, center);
    ctx.lineTo(center + 96, center);
    ctx.moveTo(center, center - 96);
    ctx.lineTo(center, center - 34);
    ctx.moveTo(center, center + 34);
    ctx.lineTo(center, center + 96);
    ctx.stroke();
  } else {
    const gradient = ctx.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center,
    );
    if (role === "orb") {
      const core = clampRange(0.16 + (1 - edgeSoftness) * 0.38, 0.16, 0.72);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(core, "rgba(255,255,255,1)");
      gradient.addColorStop(
        clampRange(core + edgeSoftness * 0.52, core, 0.96),
        "rgba(255,255,255,0.28)",
      );
      gradient.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      gradient.addColorStop(0, "rgba(255,255,255,0.48)");
      gradient.addColorStop(0.22, "rgba(255,255,255,0.24)");
      gradient.addColorStop(0.72, "rgba(255,255,255,0.06)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `generated-${role}-sun-texture`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeSpriteMaterial(
  map: THREE.Texture,
  color: string,
  opacity: number,
): THREE.SpriteMaterial {
  const material = new THREE.SpriteMaterial({
    map,
    color: new THREE.Color(color),
    opacity,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  (material as THREE.SpriteMaterial & { fog?: boolean }).fog = false;
  material.userData.ignoreLayerFog = true;
  return material;
}

function createRuntime(
  options: ResolvedSunVisualOptions,
): EnvironmentSunVisualRuntime {
  const key = textureKey(options);
  const orbTexture = makeCanvasTexture("orb", options.orbEdgeSoftness);
  const haloTexture = makeCanvasTexture("halo", options.orbEdgeSoftness);
  const markerTexture = makeCanvasTexture("marker", options.orbEdgeSoftness);
  const group = new THREE.Group();
  group.name = SUN_VISUAL_NAME;
  const halo = new THREE.Sprite(
    makeSpriteMaterial(haloTexture, options.orbHaloColor, options.orbHaloOpacity),
  );
  halo.name = `${SUN_VISUAL_NAME}_halo`;
  const orb = new THREE.Sprite(
    makeSpriteMaterial(orbTexture, options.orbColor, options.orbOpacity),
  );
  orb.name = `${SUN_VISUAL_NAME}_orb`;
  const marker = new THREE.Sprite(
    makeSpriteMaterial(markerTexture, options.orbColor, options.sourceMarkerOpacity),
  );
  marker.name = `${SUN_VISUAL_NAME}_source_marker`;
  group.add(halo, orb, marker);
  return { group, halo, orb, marker, cacheKey: key, options };
}

function disposeRuntime(scene: THREE.Scene, runtime: EnvironmentSunVisualRuntime) {
  scene.remove(runtime.group);
  disposeObjectTree(runtime.group);
}

function updateSpriteMaterial(
  sprite: THREE.Sprite,
  color: string,
  opacity: number,
) {
  const material = sprite.material as THREE.SpriteMaterial;
  material.color.set(color);
  material.opacity = opacity;
  material.needsUpdate = true;
}

export function updateEnvironmentSunVisualDirection(
  runtime: EnvironmentSunVisualRuntime,
  sunDirection: THREE.Vector3,
): void {
  const options = runtime.options;
  const dir =
    sunDirection.lengthSq() > 0.000001
      ? sunDirection.clone().normalize()
      : new THREE.Vector3(0.6, -0.4, 0.7).normalize();
  runtime.group.position.copy(dir).multiplyScalar(options.orbDistanceM);
  runtime.group.renderOrder = options.orbRenderOrder;
  runtime.group.visible = options.orbVisible || options.sourceMarkerVisible;

  runtime.halo.visible = options.orbVisible && options.orbHaloOpacity > 0.001;
  runtime.orb.visible = options.orbVisible && options.orbOpacity > 0.001;
  runtime.marker.visible =
    options.sourceMarkerVisible && options.sourceMarkerOpacity > 0.001;

  runtime.halo.scale.setScalar(options.orbSizeM * options.orbHaloScale);
  runtime.orb.scale.setScalar(options.orbSizeM);
  runtime.marker.scale.setScalar(Math.max(options.orbSizeM * 0.42, 8000));

  for (const child of [runtime.halo, runtime.orb, runtime.marker]) {
    child.renderOrder = options.orbRenderOrder;
  }

  runtime.group.userData.environmentSunVisualDebug = {
    textureSource: "generated-canvas",
    cacheKey: runtime.cacheKey,
    material: "THREE.SpriteMaterial",
    geometry: "THREE.Sprite screen-aligned quad",
    orbVisible: options.orbVisible,
    sourceMarkerVisible: options.sourceMarkerVisible,
    orbColor: options.orbColor,
    orbOpacity: options.orbOpacity,
    orbSizeM: options.orbSizeM,
    orbDistanceM: options.orbDistanceM,
    orbEdgeSoftness: options.orbEdgeSoftness,
    orbHaloColor: options.orbHaloColor,
    orbHaloOpacity: options.orbHaloOpacity,
    orbHaloScale: options.orbHaloScale,
    direction: [dir.x, dir.y, dir.z],
    position: [
      runtime.group.position.x,
      runtime.group.position.y,
      runtime.group.position.z,
    ],
  };
}

export function applyEnvironmentSunVisual({
  scene,
  runtime,
  sun,
  sunDirection,
}: {
  scene: THREE.Scene;
  runtime: EnvironmentSunVisualRuntime | null;
  sun: SceneSun;
  sunDirection: THREE.Vector3;
}): EnvironmentSunVisualRuntime | null {
  const options = resolveSunVisualOptions(sun);
  if (!options.orbVisible && !options.sourceMarkerVisible) {
    if (runtime) disposeRuntime(scene, runtime);
    return null;
  }

  const key = textureKey(options);
  let nextRuntime = runtime;
  if (!nextRuntime || nextRuntime.cacheKey !== key) {
    if (nextRuntime) disposeRuntime(scene, nextRuntime);
    nextRuntime = createRuntime(options);
    scene.add(nextRuntime.group);
  } else {
    nextRuntime.options = options;
  }

  updateSpriteMaterial(nextRuntime.halo, options.orbHaloColor, options.orbHaloOpacity);
  updateSpriteMaterial(nextRuntime.orb, options.orbColor, options.orbOpacity);
  updateSpriteMaterial(
    nextRuntime.marker,
    options.orbColor,
    options.sourceMarkerOpacity,
  );
  updateEnvironmentSunVisualDirection(nextRuntime, sunDirection);
  return nextRuntime;
}
