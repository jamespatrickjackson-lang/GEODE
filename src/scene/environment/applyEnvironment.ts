import * as THREE from "three";
import type { EditableStyle, EnvironmentSetup, SceneProperties } from "../../pages/types";
import {
  activeRenderPresetIdForPage,
  projectRenderPresets,
  scenePatchForRenderPreset,
} from "../../pages/renderPresets";
import { applyTopoMaterialAuthority } from "../../topoMap/materialAuthority";
import { disposeObjectTree } from "../disposeObjectTree";
import { clampRange } from "../styles/styleUtils";

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
    studioLights ? (dir.intensity ?? 2.35) : 0,
  );
  k.position.copy(this.currentSunDir).multiplyScalar(8000);
  k.target.position.set(0, 0, 0);
  k.target.updateMatrixWorld();
  // Cast shadows are forced OFF regardless of env config. At 40km
  // terrain scale shadow maps alias visibly even at 8192^2, and the
  // foreground objects (drill collars, target outlines) are emissive
  // HDR pieces rendered through bloom -- shadow casting from them
  // would just add noise. All depth and form on terrain comes from
  // the analytical hillshade in the terrain shader.
  k.castShadow = false;
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

  // Shadow pass disabled -- no caster, no receiver, no work for the
  // renderer. Hillshade in the terrain shader carries all the depth
  // cues we want.
  this.renderer.shadowMap.enabled = false;

  // ---- terrain shader uniforms --------------------------------------
  const terrainGroup = this.topoSurfaceGroup();
  if (terrainGroup) {
    this.topoRuntime.applyEnvironment({
      sceneProperties: sp,
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
  }

  // ---- post-processing -----------------------------------------------
  if (this.postHandle) {
    const bp = this.postHandle.bloomPass;
    const b = sp.bloom ?? {};
    this.postHandle.baseBloomStrength = b.strength ?? 0;
    bp.radius = b.radius ?? 0.7;
    bp.threshold = b.threshold ?? 0.82;

    const ao = sp.ambientOcclusion ?? {};
    const ssao = this.postHandle.ssaoPass;
    ssao.enabled = ao.enabled ?? true;
    ssao.kernelRadius = ao.radius ?? 7;
    ssao.minDistance = ao.minDistance ?? 0.004;
    ssao.maxDistance = ao.maxDistance ?? 0.12;

    const gp = this.postHandle.gradePass.uniforms;
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
    const v = sp.vignette ?? {};
    gp.vignetteStrength.value = v.strength ?? 0.95;
    gp.vignetteSmoothness.value = v.smoothness ?? 0.75;
  }
}
