import * as THREE from "three";
import type {
  EditableStyle,
  EnvironmentSetup,
  PresentationPage,
  SceneProperties,
  Vec3,
} from "../../pages/types";
import {
  activeRenderPresetIdForPage,
  projectRenderPresets,
  scenePatchForRenderPreset,
} from "../../pages/renderPresets";
import { applyTopoMaterialAuthority } from "../../topoMap/materialAuthority";
import { disposeObjectTree } from "../disposeObjectTree";
import { clampRange } from "../styles/styleUtils";
import { applyEnvironmentSunVisual } from "./sunVisual";

const TONE_MAPPING_MAP: Record<
  NonNullable<SceneProperties["toneMapping"]>,
  THREE.ToneMapping
> = {
  none: THREE.NoToneMapping,
  linear: THREE.LinearToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  cineon: THREE.CineonToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping ?? THREE.ACESFilmicToneMapping,
};
const LIGHT_MODE_BG = "#a0a0a0";
const DEFAULT_SCENE_FOG_DENSITY = 0.00018;
const COLOR_FILTER_COLORS: Record<string, string> = {
  none: "#ffffff",
  warm: "#ffe1bd",
  cool: "#cfe4ff",
  bleach: "#fff4d8",
  noir: "#d8d8d8",
  "teal-orange": "#ffd1ad",
  sepia: "#f1c083",
  infrared: "#ff9bc4",
};

function aspectRatioForMask(
  mask: NonNullable<SceneProperties["compositionGuides"]>["aspectMask"],
): number {
  switch (mask) {
    case "16:9":
      return 16 / 9;
    case "1.85:1":
      return 1.85;
    case "2.39:1":
      return 2.39;
    case "none":
    default:
      return 0;
  }
}

function aspectRatioForPresentationFrame(
  ratio: NonNullable<SceneProperties["presentationFrame"]>["aspectRatio"],
): number {
  switch (ratio) {
    case "16:9":
      return 16 / 9;
    case "1.85:1":
      return 1.85;
    case "2.39:1":
      return 2.39;
    case "4:3":
      return 4 / 3;
    case "none":
    default:
      return 0;
  }
}

function filterColorForPreset(
  preset: NonNullable<SceneProperties["colorGrade"]>["filterPreset"],
): string {
  return COLOR_FILTER_COLORS[preset ?? "none"] ?? COLOR_FILTER_COLORS.none;
}

function safeUniforms(
  uniforms: unknown,
): Record<string, { value: any }> {
  return uniforms as Record<string, { value: any }>;
}

function sunDirectionFromAngles(
  azimuthDeg: number,
  elevationDeg: number,
): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const elev = THREE.MathUtils.degToRad(elevationDeg);
  const cosE = Math.cos(elev);
  return new THREE.Vector3(
    Math.sin(az) * cosE,
    Math.cos(az) * cosE,
    Math.sin(elev),
  );
}

function styleAffectedByFog(style: EditableStyle): boolean {
  return style.affectedByFog !== false;
}

function styleFogDensity(style: EditableStyle, fallback: number): number {
  return typeof style.fogDensity === "number" &&
    Number.isFinite(style.fogDensity)
    ? clampRange(style.fogDensity, 0.000001, 0.002)
    : fallback;
}

function mergeSceneProperties(
  base: SceneProperties | undefined,
  patch: Partial<SceneProperties> | null,
): SceneProperties {
  const scene = base ?? {};
  if (!patch) return scene;
  return {
    ...scene,
    ...patch,
    fog: { ...(scene.fog ?? {}), ...(patch.fog ?? {}) },
    bloom: { ...(scene.bloom ?? {}), ...(patch.bloom ?? {}) },
    camera: { ...(scene.camera ?? {}), ...(patch.camera ?? {}) },
    lighting: {
      ...(scene.lighting ?? {}),
      ...(patch.lighting ?? {}),
      hemisphere: {
        ...(scene.lighting?.hemisphere ?? {}),
        ...(patch.lighting?.hemisphere ?? {}),
      },
      directional: {
        ...(scene.lighting?.directional ?? {}),
        ...(patch.lighting?.directional ?? {}),
      },
      fill: {
        ...(scene.lighting?.fill ?? {}),
        ...(patch.lighting?.fill ?? {}),
      },
      rim: {
        ...(scene.lighting?.rim ?? {}),
        ...(patch.lighting?.rim ?? {}),
      },
    },
    ambientOcclusion: {
      ...(scene.ambientOcclusion ?? {}),
      ...(patch.ambientOcclusion ?? {}),
    },
    terrain: {
      ...(scene.terrain ?? {}),
      ...(patch.terrain ?? {}),
    },
    colorGrade: {
      ...(scene.colorGrade ?? {}),
      ...(patch.colorGrade ?? {}),
    },
    vignette: {
      ...(scene.vignette ?? {}),
      ...(patch.vignette ?? {}),
    },
    depthOfField: {
      ...(scene.depthOfField ?? {}),
      ...(patch.depthOfField ?? {}),
    },
    tiltShift: {
      ...(scene.tiltShift ?? {}),
      ...(patch.tiltShift ?? {}),
    },
    lensEffects: {
      ...(scene.lensEffects ?? {}),
      ...(patch.lensEffects ?? {}),
    },
    motionTrails: {
      ...(scene.motionTrails ?? {}),
      ...(patch.motionTrails ?? {}),
    },
    presentationFrame: {
      ...(scene.presentationFrame ?? {}),
      ...(patch.presentationFrame ?? {}),
    },
    compositionGuides: {
      ...(scene.compositionGuides ?? {}),
      ...(patch.compositionGuides ?? {}),
    },
    sun: { ...(scene.sun ?? {}), ...(patch.sun ?? {}) },
    gui: {
      ...(scene.gui ?? {}),
      ...(patch.gui ?? {}),
      labels: {
        ...(scene.gui?.labels ?? {}),
        ...(patch.gui?.labels ?? {}),
      },
    },
  };
}

function hardenStudioHelperMaterial(material: THREE.Material): void {
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  material.userData.ignoreLayerFog = true;
  (material as THREE.Material & { fog?: boolean }).fog = false;
  material.transparent = true;
  material.needsUpdate = true;
}

function hardenStudioHelperTree(obj: THREE.Object3D): void {
  obj.renderOrder = 4500;
  obj.traverse((child) => {
    child.renderOrder = 4500;
    const mesh = child as THREE.Object3D & {
      material?: THREE.Material | THREE.Material[];
    };
    if (!mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) hardenStudioHelperMaterial(mat);
  });
}

interface CinematicPostProcessingOptions {
  page?: Pick<
    PresentationPage,
    "bloomBoost" | "camera" | "cameraObjectFocus" | "cinematicExposure"
  > | null;
  nowMs?: number;
  applyPageMood?: boolean;
}

function fogColorForPost(sp: SceneProperties): THREE.Color {
  const lightMode = sp.lightMode === true;
  const darkBgHex = sp.background ?? "#23252a";
  const lightBgHex = sp.lightModeBackground ?? LIGHT_MODE_BG;
  const fogHex = lightMode
    ? (sp.fog?.lightModeColor ?? lightBgHex)
    : (sp.fog?.color ?? darkBgHex);
  return new THREE.Color(fogHex);
}

function scenePointToVector(point: Vec3 | undefined): THREE.Vector3 | null {
  return point ? new THREE.Vector3(...point) : null;
}

function resolveDepthOfFieldFocusPoint(
  dof: NonNullable<SceneProperties["depthOfField"]>,
  page:
    | Pick<PresentationPage, "camera" | "cameraObjectFocus">
    | null
    | undefined,
): THREE.Vector3 | null {
  if (dof.focusMode === "manual-distance") return null;
  if (dof.focusMode === "picked-point") {
    return scenePointToVector(dof.focusPoint);
  }
  if (dof.focusMode === "camera-object") {
    return (
      scenePointToVector(page?.cameraObjectFocus?.worldPoint) ??
      scenePointToVector(dof.focusPoint) ??
      scenePointToVector(page?.camera?.target)
    );
  }
  return scenePointToVector(page?.camera?.target) ?? scenePointToVector(dof.focusPoint);
}

export function resolveDepthOfFieldFocusDistance(
  dof: NonNullable<SceneProperties["depthOfField"]>,
  page:
    | Pick<PresentationPage, "camera" | "cameraObjectFocus">
    | null
    | undefined,
  camera: THREE.Camera | null | undefined,
): { distanceM: number; focusPoint: THREE.Vector3 | null } {
  const focusPoint = resolveDepthOfFieldFocusPoint(dof, page);
  const manualDistance = dof.focusDistanceM ?? 1000;
  const distance =
    focusPoint && camera
      ? camera.position.distanceTo(focusPoint)
      : manualDistance;
  return {
    distanceM: Math.max(1, distance + (dof.focusOffsetM ?? 0)),
    focusPoint,
  };
}

function syncDepthOfFieldDebugPlane(
  this: any,
  camera: THREE.Camera | null | undefined,
  distanceM: number,
  dof: NonNullable<SceneProperties["depthOfField"]>,
  visible: boolean,
): void {
  const existing = this.dofFocusDebugPlane as THREE.Mesh | undefined;
  if (!visible || !camera) {
    if (existing) {
      existing.removeFromParent();
      existing.geometry.dispose();
      const material = existing.material;
      if (Array.isArray(material)) material.forEach((mat) => mat.dispose());
      else material.dispose();
      this.dofFocusDebugPlane = null;
    }
    return;
  }

  let plane = existing;
  if (!plane) {
    plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: "#9edfff",
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    plane.name = "Depth of field focus debug plane";
    plane.renderOrder = 4600;
    plane.userData.ignoreLayerFog = true;
    this.dofFocusDebugPlane = plane;
    this.scene?.add(plane);
  } else if (!plane.parent) {
    this.scene?.add(plane);
  }

  const opacity = clampRange(dof.debugFocusPlaneOpacity ?? 0.16, 0.02, 0.5);
  const materials = Array.isArray(plane.material)
    ? plane.material
    : [plane.material];
  for (const material of materials) {
    if ("opacity" in material) {
      material.opacity = opacity;
      material.needsUpdate = true;
    }
  }

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const clampedDistance = Math.max(1, distanceM);
  plane.position.copy(camera.position).addScaledVector(direction, clampedDistance);
  plane.quaternion.copy(camera.quaternion);
  const perspective = camera as THREE.PerspectiveCamera;
  const fovRad =
    typeof perspective.fov === "number"
      ? THREE.MathUtils.degToRad(perspective.fov)
      : THREE.MathUtils.degToRad(45);
  const h = Math.max(50, Math.tan(fovRad / 2) * clampedDistance * 0.56);
  const aspect =
    typeof perspective.aspect === "number" && Number.isFinite(perspective.aspect)
      ? perspective.aspect
      : 16 / 9;
  const debugScale = clampRange(dof.debugFocusPlaneScale ?? 1, 0.1, 3);
  plane.scale.set(h * aspect * debugScale, h * debugScale, 1);
}

export function applyCinematicPostProcessing(
  this: any,
  sp: SceneProperties,
  options: CinematicPostProcessingOptions = {},
): void {
  if (!this.postHandle) return;

  const page = options.page ?? this.lastEffectivePage ?? null;
  const fogColor = fogColorForPost(sp);
  const nowMs =
    typeof options.nowMs === "number" && Number.isFinite(options.nowMs)
      ? options.nowMs
      : typeof performance !== "undefined"
        ? performance.now()
        : Date.now();

  if (options.applyPageMood === true) {
    const baseExposure = sp.exposure ?? 1.0;
    this.baseExposure = baseExposure;
    this.renderer.toneMappingExposure =
      baseExposure * (page?.cinematicExposure ?? 1.0);
  }

  const bp = this.postHandle.bloomPass;
  const b = sp.bloom ?? {};
  const baseBloomStrength = b.strength ?? 0;
  this.postHandle.baseBloomStrength = baseBloomStrength;
  bp.radius = b.radius ?? 0.7;
  bp.threshold = b.threshold ?? 0.82;
  if (options.applyPageMood === true) {
    bp.strength = baseBloomStrength * (page?.bloomBoost ?? 1.0);
  }

  const ao = sp.ambientOcclusion ?? {};
  const ssao = this.postHandle.ssaoPass;
  ssao.enabled = ao.enabled ?? true;
  ssao.kernelRadius = ao.radius ?? 7;
  ssao.minDistance = ao.minDistance ?? 0.004;
  ssao.maxDistance = ao.maxDistance ?? 0.12;

  const postHandle = this.postHandle;
  const dof = sp.depthOfField ?? {};
  const bokehPass = postHandle.bokehPass;
  const bokehUniforms = safeUniforms(bokehPass.uniforms);
  const activeCamera = this.activeCamera as THREE.Camera | null | undefined;
  const { distanceM: focusDistance, focusPoint } =
    resolveDepthOfFieldFocusDistance(dof, page, activeCamera);
  const aperture = clampRange(dof.aperture ?? 0.00002, 0, 0.0002);
  const maxBlur = clampRange(dof.maxBlur ?? 0.004, 0, 0.03);
  bokehPass.enabled = dof.enabled === true && aperture > 0 && maxBlur > 0;
  syncDepthOfFieldDebugPlane.call(
    this,
    activeCamera,
    focusDistance,
    dof,
    dof.enabled === true && dof.debugFocusPlane === true,
  );
  this.lastCinematicDofDebug = {
    enabled: bokehPass.enabled,
    focusMode: dof.focusMode ?? "page-target",
    focusDistanceM: focusDistance,
    focusPoint: focusPoint ? [focusPoint.x, focusPoint.y, focusPoint.z] : null,
    debugFocusPlane: dof.debugFocusPlane === true,
    debugFocusPlaneOpacity: dof.debugFocusPlaneOpacity ?? 0.16,
    debugFocusPlaneScale: dof.debugFocusPlaneScale ?? 1,
  };
  if (bokehUniforms.focus) bokehUniforms.focus.value = focusDistance;
  if (bokehUniforms.aperture) bokehUniforms.aperture.value = aperture;
  if (bokehUniforms.maxblur) bokehUniforms.maxblur.value = maxBlur;

  const tilt = sp.tiltShift ?? {};
  const tiltShiftPass = postHandle.tiltShiftPass;
  const tiltUniforms = tiltShiftPass.uniforms;
  const tiltBlur = clampRange(tilt.blur ?? 0, 0, 1);
  tiltShiftPass.enabled = tilt.enabled === true && tiltBlur > 0;
  tiltUniforms.center.value.set(tilt.centerX ?? 0.5, tilt.centerY ?? 0.5);
  tiltUniforms.angle.value = THREE.MathUtils.degToRad(tilt.angleDeg ?? 0);
  tiltUniforms.bandSize.value = clampRange(tilt.bandSize ?? 0.28, 0.02, 0.9);
  tiltUniforms.feather.value = clampRange(tilt.feather ?? 0.2, 0.01, 0.8);
  tiltUniforms.blur.value = tiltBlur;

  const trails = sp.motionTrails ?? {};
  const trailAmount = clampRange(trails.amount ?? 0, 0, 1);
  postHandle.afterimagePass.enabled =
    trails.enabled === true && trailAmount > 0.001;
  postHandle.afterimagePass.uniforms.damp.value = 0.82 + trailAmount * 0.17;

  const gp = postHandle.gradePass.uniforms;
  const grade = sp.colorGrade ?? {};
  gp.contrast.value = grade.contrast ?? 1.06;
  gp.saturation.value = grade.saturation ?? 1.06;
  gp.vibrancy.value = grade.vibrancy ?? 1.0;
  if (grade.tint) {
    gp.tint.value.set(grade.tint);
  } else {
    gp.tint.value.copy(fogColor);
  }
  gp.tintStrength.value = grade.tintStrength ?? 0.04;
  gp.temperature.value = clampRange(grade.temperature ?? 0, -1, 1);
  gp.blackPoint.value = clampRange(grade.blackPoint ?? 0, 0, 0.8);
  gp.whitePoint.value = clampRange(grade.whitePoint ?? 1, 0.2, 2);
  gp.lift.value = clampRange(grade.lift ?? 0, -0.5, 0.5);
  gp.gamma.value = clampRange(grade.gamma ?? 1, 0.25, 3);
  gp.gain.value = clampRange(grade.gain ?? 1, 0, 3);
  gp.splitShadowColor.value.set(grade.splitShadowColor ?? "#182238");
  gp.splitHighlightColor.value.set(grade.splitHighlightColor ?? "#ffd29a");
  gp.splitToneAmount.value = clampRange(grade.splitToneAmount ?? 0, 0, 1);
  gp.filterColor.value.set(filterColorForPreset(grade.filterPreset));
  gp.filterIntensity.value = clampRange(grade.filterIntensity ?? 0, 0, 1);
  const v = sp.vignette ?? {};
  gp.vignetteStrength.value = v.strength ?? 0.95;
  gp.vignetteSmoothness.value = v.smoothness ?? 0.75;

  const lens = sp.lensEffects ?? {};
  gp.grainAmount.value = clampRange(lens.grain ?? 0, 0, 0.35);
  gp.grainSize.value = clampRange(lens.grainSize ?? 1, 0.25, 16);
  gp.distortion.value = clampRange(lens.distortion ?? 0, -1, 1);
  gp.chromaticAberration.value = clampRange(
    lens.chromaticAberration ?? 0,
    0,
    1,
  );
  gp.sharpen.value = clampRange(lens.sharpen ?? 0, 0, 1);
  gp.diffusion.value = clampRange(lens.diffusion ?? 0, 0, 1);
  gp.halation.value = clampRange(lens.halation ?? 0, 0, 1);
  gp.anamorphicStreak.value = clampRange(lens.anamorphicStreak ?? 0, 0, 1);
  gp.anamorphicStreakLength.value = clampRange(
    lens.anamorphicStreakLength ?? 0.45,
    0,
    1,
  );
  gp.anamorphicStreakThreshold.value = clampRange(
    lens.anamorphicStreakThreshold ?? 0.82,
    0.2,
    1,
  );
  const frame = sp.presentationFrame ?? {};
  const frameAspectRatio = aspectRatioForPresentationFrame(
    frame.aspectRatio,
  );
  gp.frameEnabled.value =
    frame.letterbox === true && frameAspectRatio > 0 ? 1 : 0;
  gp.frameAspectRatio.value = frameAspectRatio;
  gp.frameOpacity.value = clampRange(frame.matteOpacity ?? 0.72, 0, 1);
  gp.frameColor.value.set(frame.matteColor ?? "#000000");
  gp.cornerFade.value = clampRange(frame.cornerFade ?? 0, 0, 1);
  gp.gateWeave.value = clampRange(frame.gateWeave ?? 0, 0, 1);
  gp.time.value = nowMs / 1000;

  const guides = sp.compositionGuides ?? {};
  const guidesEnabled = guides.enabled === true;
  gp.guideEnabled.value = guidesEnabled ? 1 : 0;
  gp.guideRuleOfThirds.value =
    guidesEnabled && guides.ruleOfThirds === true ? 1 : 0;
  gp.guideCenterCross.value =
    guidesEnabled && guides.centerCross === true ? 1 : 0;
  gp.guideSafeFrame.value =
    guidesEnabled && guides.safeFrame === true ? 1 : 0;
  gp.guideAspectRatio.value = guidesEnabled
    ? aspectRatioForMask(guides.aspectMask)
    : 0;
  gp.guideLineThickness.value = clampRange(guides.lineThickness ?? 0.25, 0.1, 2);
}

export function applyEnvironment(this: any, environment: EnvironmentSetup): void {
  this.lastEnv = environment;
  const presetId = activeRenderPresetIdForPage(
    environment,
    this.lastEffectivePage,
  );
  this.lastAppliedRenderPresetId = presetId ?? null;
  const presetPatch = scenePatchForRenderPreset(
    presetId,
    projectRenderPresets(environment),
  );
  // Precedence: authored base/sub-master scene -> render preset patch -> page
  // sceneOverrides -> preview/editor patch. Page-local scene authoring must
  // win over active presets, matching page layer override behavior.
  const sceneWithPreset = mergeSceneProperties(environment.scene, presetPatch);
  const sceneWithPageOverrides = mergeSceneProperties(
    sceneWithPreset,
    this.lastEffectivePage?.sceneOverrides ?? null,
  );
  const sp = mergeSceneProperties(
    sceneWithPageOverrides,
    this.environmentScenePreviewPatch,
  );
  this.currentSceneProperties = sp;
  const authoritativeTerrain = applyTopoMaterialAuthority(
    sp.terrain,
    environment.scene?.terrain,
  );
  if (authoritativeTerrain) sp.terrain = authoritativeTerrain;
  this.topoRuntime.setCurrentTerrain(sp.terrain ?? {});
  this.setStudioSceneElementsVisible(sp.lighting?.showSceneElements ?? true);
  this.applyDrillingAssayDisplay(sp);
  this.applyTopoDetailDistanceDisplay(sp);
  this.rebuildAreaOutlines(sp.areaOutlines ?? []);

  // ---- tone mapping + exposure ---------------------------------------
  const tm = sp.toneMapping ?? "aces";
  this.renderer.toneMapping = TONE_MAPPING_MAP[tm];
  this.baseExposure = sp.exposure ?? 1.0;
  this.renderer.toneMappingExposure = this.baseExposure;

  // ---- background ------------------------------------------------------
  // Renderer clear color and fog tint are independently authored. Existing
  // background/fog.color fields remain the dark/default mode values.
  const lightMode = sp.lightMode === true;
  const darkBgHex = sp.background ?? "#23252a";
  const lightBgHex = sp.lightModeBackground ?? LIGHT_MODE_BG;
  const bgHex = lightMode ? lightBgHex : darkBgHex;
  const bgColor = new THREE.Color(bgHex);
  this.renderer.setClearColor(bgColor);
  this.scene.background = bgColor;

  // ---- sun direction (drives key light + terrain hillshade) ---------
  const sunAz = sp.sun?.azimuth ?? 235;
  const sunEl = sp.sun?.elevation ?? 22;
  const sunConfigKey = `${sunAz}:${sunEl}`;
  const sunConfigChanged = sunConfigKey !== this.lastSunConfigKey;
  this.lastSunConfigKey = sunConfigKey;
  this.previousSunDir.copy(this.currentSunDir);
  this.authoredWorldSunDir.copy(sunDirectionFromAngles(sunAz, sunEl));
  this.baseSunLockToCamera = sp.sun?.lockToCamera === true;
  const nextSunLockToCamera =
    this.lastEffectivePage?.sunLockToCamera ?? this.baseSunLockToCamera;
  const keepCameraLockedSun =
    nextSunLockToCamera && this.sunLockToCamera && !sunConfigChanged;
  if (keepCameraLockedSun) {
    this.currentSunDir.copy(this.previousSunDir);
  } else {
    this.currentSunDir.copy(this.authoredWorldSunDir);
    this.cameraLocalSunDir.copy(this.authoredWorldSunDir);
  }
  this.sunLockToCamera = nextSunLockToCamera;
  this.pendingCameraSunCapture = false;
  if (this.sunLockToCamera && !keepCameraLockedSun) {
    this.requestCameraSunCapture(this.currentSunDir);
  }
  this.envSunVisual = applyEnvironmentSunVisual({
    scene: this.scene,
    runtime: this.envSunVisual ?? null,
    sun: sp.sun ?? {},
    sunDirection: this.currentSunDir,
  });

  // ---- lights --------------------------------------------------------
  const tearDown = (light: THREE.Light | null) => {
    if (!light) return;
    this.scene.remove(light);
    (light as { dispose?: () => void }).dispose?.();
  };
  tearDown(this.envHemiLight);
  tearDown(this.envKeyLight);
  tearDown(this.envFillLight);
  tearDown(this.envRimLight);
  this.clearLightingStudioSources();
  this.envHemiLight = null;
  this.envKeyLight = null;
  this.envFillLight = null;
  this.envRimLight = null;

  const studioLights = sp.lighting?.enabled !== false;
  const sunLightEnabled = sp.sun?.lightEnabled !== false;
  const sunLightingActive = studioLights && sunLightEnabled;
  const terrainSettings = sp.terrain ?? {};
  const projectedMapShadowsEnabled =
    terrainSettings.projectedMapShadowsEnabled === true;
  const projectedMapShadowOpacity = clampRange(
    terrainSettings.projectedMapShadowOpacity ?? 0.45,
    0,
    1,
  );
  const projectedMapShadowSoftness = clampRange(
    terrainSettings.projectedMapShadowSoftness ?? 3,
    0,
    12,
  );
  const projectedMapShadowBias = clampRange(
    terrainSettings.projectedMapShadowBias ?? -0.00035,
    -0.01,
    0.01,
  );
  const showStudioSceneElements =
    this.editorMode && this.studioSceneElementsVisible;

  // Hemisphere with strong floor: "sky" tint (since there's no actual
  // sky now, just a top-coming wash) on top, warm "ground" tint below.
  // Studio off falls back to a neutral wash: useful for checking the
  // presentation lighting treatment without introducing measuring-tool
  // style controls.
  const hemi = sp.lighting?.hemisphere;
  const h = new THREE.HemisphereLight(
    new THREE.Color(hemi?.sky ?? "#c4d4ee"),
    new THREE.Color(hemi?.ground ?? "#48362a"),
    studioLights ? (hemi?.intensity ?? 0.42) : 0,
  );
  this.scene.add(h);
  this.envHemiLight = h;

  // Key light (sun). Position from sun direction.
  const dir = sp.lighting?.directional ?? {};
  const k = new THREE.DirectionalLight(
    new THREE.Color(dir.color ?? "#ffe2b8"),
    sunLightingActive ? (dir.intensity ?? 2.35) : 0,
  );
  k.position
    .copy(this.currentSunDir)
    .multiplyScalar(projectedMapShadowsEnabled ? 1_500_000 : 8000);
  k.target.position.set(0, 0, 0);
  k.target.updateMatrixWorld();
  k.castShadow =
    sunLightingActive &&
    projectedMapShadowsEnabled &&
    projectedMapShadowOpacity > 0.001 &&
    dir.castShadow !== false;
  if (k.castShadow) {
    const shadowExtentM = 900_000;
    const shadowCamera = k.shadow.camera as THREE.OrthographicCamera;
    shadowCamera.left = -shadowExtentM;
    shadowCamera.right = shadowExtentM;
    shadowCamera.top = shadowExtentM;
    shadowCamera.bottom = -shadowExtentM;
    shadowCamera.near = 100;
    shadowCamera.far = 3_000_000;
    shadowCamera.updateProjectionMatrix();
    k.shadow.mapSize.set(4096, 4096);
    k.shadow.radius = projectedMapShadowSoftness;
    k.shadow.bias = projectedMapShadowBias;
    k.shadow.normalBias = Math.abs(projectedMapShadowBias) * 1000;
    k.shadow.intensity = projectedMapShadowOpacity;
  }
  this.scene.add(k);
  this.envKeyLight = k;

  if (studioLights) {
    // Fill light: counter to the key, kept modest so scene objects retain
    // visible light direction instead of becoming evenly washed.
    const fill = sp.lighting?.fill ?? {};
    const f = new THREE.DirectionalLight(
      new THREE.Color(fill.color ?? "#9ab7d8"),
      fill.intensity ?? 0.22,
    );
    const [fpx, fpy, fpz] = fill.position ?? [-3500, 3500, 3000];
    f.position.set(fpx, fpy, fpz);
    f.target.position.set(0, 0, 0);
    f.target.updateMatrixWorld();
    this.scene.add(f);
    this.envFillLight = f;

    const rim = sp.lighting?.rim ?? {};
    const r = new THREE.DirectionalLight(
      new THREE.Color(rim.color ?? "#ffd9a0"),
      rim.intensity ?? 0.28,
    );
    const [rpx, rpy, rpz] = rim.position ?? [0, -6000, 1500];
    r.position.set(rpx, rpy, rpz);
    r.target.position.set(0, 0, 0);
    r.target.updateMatrixWorld();
    this.scene.add(r);
    this.envRimLight = r;

    const sources = sp.lighting?.sources ?? [];
    if (sources.length > 0) {
      const helperGroup = new THREE.Group();
      helperGroup.name = "__lighting_studio_helpers__";
      helperGroup.visible = showStudioSceneElements;
      for (const source of sources) {
        this.addLightingStudioSource(source, helperGroup);
      }
      hardenStudioHelperTree(helperGroup);
      if (helperGroup.children.length > 0) {
        this.scene.add(helperGroup);
        this.envLightHelperGroup = helperGroup;
      } else {
        disposeObjectTree(helperGroup);
      }
    }
  }

  // ---- exponential fog ----------------------------------------------
  if (this.envFog) {
    this.scene.fog = null;
    this.envFog = null;
  }
  // Density tuned so the far edge of the terrain can dissolve before the
  // tile edge while fog tint stays independently authorable.
  const fogHex = lightMode
    ? (sp.fog?.lightModeColor ?? lightBgHex)
    : (sp.fog?.color ?? darkBgHex);
  const fogColor = new THREE.Color(fogHex);
  const density = sp.fog?.density ?? DEFAULT_SCENE_FOG_DENSITY;
  const fogEnabled = sp.fog?.enabled !== false;
  this.envFogEnabled = fogEnabled;
  this.envFogDensity = density;
  if (fogEnabled) {
    const fog = new THREE.FogExp2(fogColor, density);
    this.scene.fog = fog;
    this.envFog = fog;
  } else {
    this.scene.fog = null;
    this.envFog = null;
  }

  this.renderer.shadowMap.enabled = k.castShadow;
  this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // ---- terrain shader uniforms --------------------------------------
  const terrainGroup = this.topoSurfaceGroup();
  if (terrainGroup) {
    terrainGroup.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!mesh.userData?.terrainHandle) return;
      mesh.receiveShadow = k.castShadow;
      mesh.castShadow = false;
    });
    const topoSceneProperties = sunLightEnabled
      ? sp
      : {
          ...sp,
          terrain: {
            ...(sp.terrain ?? {}),
            hillshadeIntensity: 0,
            projectedMapShadowsEnabled: false,
          },
        };
    this.topoRuntime.applyEnvironment({
      sceneProperties: topoSceneProperties,
      sunDirection: this.currentSunDir,
      fogColor,
      fogDensity: density,
      lightMode,
    });
    const surfaceLayerId = this.topoSurfaceLayerId();
    for (const layerId of [
      surfaceLayerId,
      "hydrography-lakes",
      "three-firs-target",
      "great-plains-target",
      "claim-boundary",
      "bedrock-geology",
      "trees-vri",
    ]) {
      const style = this.styleForLayer(layerId);
      this.applyTerrainFogStyle(
        layerId,
        styleAffectedByFog(style),
        styleFogDensity(style, density),
      );
    }
    this.topoRuntime.applyAllGraticuleStyles();
    this.topoRuntime.rebuildBranding(sp);
    this.reapplySiteSurfaceGuides?.();
    this.reapplyTopoAlignedOverlays?.();
  }

  // ---- post-processing -----------------------------------------------
  applyCinematicPostProcessing.call(this, sp, {
    page: this.lastEffectivePage ?? null,
  });
}
