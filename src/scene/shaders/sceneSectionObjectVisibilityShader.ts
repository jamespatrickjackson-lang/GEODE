import * as THREE from "three";
import type {
  ResolvedSceneSectionFrame,
  ResolvedSceneSectionPlane,
  SceneSectionMaskTransition,
  SceneSectionObjectVisibility,
} from "../SceneManager";

const SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT = 8;

interface SceneSectionObjectVisibilityShader {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function setSceneSectionObjectVisibilityUniforms(
  uniforms: Record<string, { value: unknown }> | undefined,
  enabled: boolean,
  planes: ResolvedSceneSectionPlane[],
  frames: ResolvedSceneSectionFrame[],
  visibility: SceneSectionObjectVisibility,
  maskTransition?: SceneSectionMaskTransition | null,
): void {
  if (!uniforms) return;
  const ensure = <T>(key: string, value: T) => {
    if (!uniforms[key]) uniforms[key] = { value };
    return uniforms[key] as { value: T };
  };
  const sourcePlanes = maskTransition?.source.planes ?? planes;
  const sourceFrames = maskTransition?.source.frames ?? frames;
  const sourceVisibility = maskTransition?.source.visibility ?? visibility;
  const sourceEnabled = maskTransition
    ? maskTransition.source.visibility.active
    : enabled;
  ensure<number>("uSceneSectionTransitionEnabled", 0).value = maskTransition
    ? 1
    : 0;
  ensure<number>("uSceneSectionTransitionProgress", 0).value = clamp01(
    maskTransition?.progress ?? 0,
  );
  ensure<number>("uSceneSectionObjectVisibilityEnabled", 0).value = enabled
    ? 1
    : 0;
  ensure<number>("uSceneSectionObjectVisibilityPlaneCount", 0).value = sourceEnabled
    ? Math.min(SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT, sourcePlanes.length)
    : 0;
  const normalUniform = ensure<THREE.Vector3[]>(
    "uSceneSectionObjectVisibilityNormals",
    Array.from(
      { length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT },
      () => new THREE.Vector3(),
    ),
  );
  const positionUniform = ensure<number[]>(
    "uSceneSectionObjectVisibilityPositions",
    Array.from({ length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT }, () => 0),
  );
  const invertUniform = ensure<number[]>(
    "uSceneSectionObjectVisibilityInvert",
    Array.from({ length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT }, () => 0),
  );
  const planeOpacityUniform = ensure<number[]>(
    "uSceneSectionObjectVisibilityPlaneOpacity",
    Array.from({ length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT }, () => 1),
  );
  for (let i = 0; i < SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT; i += 1) {
    const plane = sourcePlanes[i];
    if (!normalUniform.value[i]) normalUniform.value[i] = new THREE.Vector3();
    normalUniform.value[i].copy(plane?.normal ?? new THREE.Vector3());
    positionUniform.value[i] = plane?.signedDistanceM ?? 0;
    invertUniform.value[i] = plane?.invert ? 1 : 0;
    planeOpacityUniform.value[i] = plane
      ? clamp01(
          sourceVisibility.outsideOpacityByFrameId[plane.frameId] ??
            sourceVisibility.outsideOpacityByAxis[plane.axis] ??
            1,
        )
      : 1;
  }

  const activeFrames = sourceEnabled
    ? sourceFrames.slice(0, SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT)
    : [];
  ensure<number>("uSceneSectionObjectVisibilityFrameCount", 0).value =
    activeFrames.length;
  const frameAxisAUniform = ensure<THREE.Vector3[]>(
    "uSceneSectionObjectVisibilityFrameAxisA",
    Array.from(
      { length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT },
      () => new THREE.Vector3(),
    ),
  );
  const frameAxisBUniform = ensure<THREE.Vector3[]>(
    "uSceneSectionObjectVisibilityFrameAxisB",
    Array.from(
      { length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT },
      () => new THREE.Vector3(),
    ),
  );
  const frameBoundsUniform = ensure<THREE.Vector4[]>(
    "uSceneSectionObjectVisibilityFrameBounds",
    Array.from(
      { length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT },
      () => new THREE.Vector4(),
    ),
  );
  const frameOpacityUniform = ensure<number[]>(
    "uSceneSectionObjectVisibilityFrameOpacity",
    Array.from({ length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT }, () => 1),
  );
  for (let i = 0; i < SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT; i += 1) {
    const frame = activeFrames[i];
    if (!frameAxisAUniform.value[i]) {
      frameAxisAUniform.value[i] = new THREE.Vector3();
    }
    if (!frameAxisBUniform.value[i]) {
      frameAxisBUniform.value[i] = new THREE.Vector3();
    }
    frameAxisAUniform.value[i].copy(
      frame?.axisAVector ?? new THREE.Vector3(1, 0, 0),
    );
    frameAxisBUniform.value[i].copy(
      frame?.axisBVector ?? new THREE.Vector3(0, 1, 0),
    );
    if (!frameBoundsUniform.value[i]) {
      frameBoundsUniform.value[i] = new THREE.Vector4();
    }
    frameBoundsUniform.value[i].set(
      frame?.minAM ?? -250_000,
      frame?.maxAM ?? 250_000,
      frame?.minBM ?? -250_000,
      frame?.maxBM ?? 250_000,
    );
    frameOpacityUniform.value[i] = frame
      ? clamp01(
          sourceVisibility.outsideOpacityByFrameId[frame.frameId] ??
            sourceVisibility.outsideOpacityByAxis[frame.axis] ??
            1,
        )
      : 1;
  }

  const targetVisibility = maskTransition?.target.visibility ?? visibility;
  const targetPlanes = maskTransition?.target.planes ?? [];
  const targetFrames =
    maskTransition && targetVisibility.active
      ? maskTransition.target.frames.slice(0, SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT)
      : [];
  ensure<number>("uSceneSectionObjectVisibilityTargetPlaneCount", 0).value =
    maskTransition && targetVisibility.active
      ? Math.min(SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT, targetPlanes.length)
      : 0;
  const targetNormalUniform = ensure<THREE.Vector3[]>(
    "uSceneSectionObjectVisibilityTargetNormals",
    Array.from(
      { length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT },
      () => new THREE.Vector3(),
    ),
  );
  const targetPositionUniform = ensure<number[]>(
    "uSceneSectionObjectVisibilityTargetPositions",
    Array.from({ length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT }, () => 0),
  );
  const targetInvertUniform = ensure<number[]>(
    "uSceneSectionObjectVisibilityTargetInvert",
    Array.from({ length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT }, () => 0),
  );
  const targetPlaneOpacityUniform = ensure<number[]>(
    "uSceneSectionObjectVisibilityTargetPlaneOpacity",
    Array.from({ length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT }, () => 1),
  );
  for (let i = 0; i < SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT; i += 1) {
    const plane = targetPlanes[i];
    if (!targetNormalUniform.value[i]) {
      targetNormalUniform.value[i] = new THREE.Vector3();
    }
    targetNormalUniform.value[i].copy(plane?.normal ?? new THREE.Vector3());
    targetPositionUniform.value[i] = plane?.signedDistanceM ?? 0;
    targetInvertUniform.value[i] = plane?.invert ? 1 : 0;
    targetPlaneOpacityUniform.value[i] = plane
      ? clamp01(
          targetVisibility.outsideOpacityByFrameId[plane.frameId] ??
            targetVisibility.outsideOpacityByAxis[plane.axis] ??
            1,
        )
      : 1;
  }
  ensure<number>("uSceneSectionObjectVisibilityTargetFrameCount", 0).value =
    targetFrames.length;
  const targetFrameAxisAUniform = ensure<THREE.Vector3[]>(
    "uSceneSectionObjectVisibilityTargetFrameAxisA",
    Array.from(
      { length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT },
      () => new THREE.Vector3(),
    ),
  );
  const targetFrameAxisBUniform = ensure<THREE.Vector3[]>(
    "uSceneSectionObjectVisibilityTargetFrameAxisB",
    Array.from(
      { length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT },
      () => new THREE.Vector3(),
    ),
  );
  const targetFrameBoundsUniform = ensure<THREE.Vector4[]>(
    "uSceneSectionObjectVisibilityTargetFrameBounds",
    Array.from(
      { length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT },
      () => new THREE.Vector4(),
    ),
  );
  const targetFrameOpacityUniform = ensure<number[]>(
    "uSceneSectionObjectVisibilityTargetFrameOpacity",
    Array.from({ length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT }, () => 1),
  );
  for (let i = 0; i < SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT; i += 1) {
    const frame = targetFrames[i];
    if (!targetFrameAxisAUniform.value[i]) {
      targetFrameAxisAUniform.value[i] = new THREE.Vector3();
    }
    if (!targetFrameAxisBUniform.value[i]) {
      targetFrameAxisBUniform.value[i] = new THREE.Vector3();
    }
    targetFrameAxisAUniform.value[i].copy(
      frame?.axisAVector ?? new THREE.Vector3(1, 0, 0),
    );
    targetFrameAxisBUniform.value[i].copy(
      frame?.axisBVector ?? new THREE.Vector3(0, 1, 0),
    );
    if (!targetFrameBoundsUniform.value[i]) {
      targetFrameBoundsUniform.value[i] = new THREE.Vector4();
    }
    targetFrameBoundsUniform.value[i].set(
      frame?.minAM ?? -250_000,
      frame?.maxAM ?? 250_000,
      frame?.minBM ?? -250_000,
      frame?.maxBM ?? 250_000,
    );
    targetFrameOpacityUniform.value[i] = frame
      ? clamp01(
          targetVisibility.outsideOpacityByFrameId[frame.frameId] ??
            targetVisibility.outsideOpacityByAxis[frame.axis] ??
            1,
        )
      : 1;
  }
}

export function applySceneSectionObjectVisibilityBuiltInMaterial(
  material: THREE.Material,
  enabled: boolean,
  planes: ResolvedSceneSectionPlane[],
  frames: ResolvedSceneSectionFrame[],
  visibility: SceneSectionObjectVisibility,
  maskTransition?: SceneSectionMaskTransition | null,
): void {
  material.userData.sceneSectionObjectVisibilityEnabled = enabled;
  material.userData.sceneSectionObjectVisibilityPlanes = planes;
  material.userData.sceneSectionObjectVisibilityFrames = frames;
  material.userData.sceneSectionObjectVisibility = visibility;
  material.userData.sceneSectionObjectVisibilityMaskTransition =
    maskTransition ?? null;

  if (material.userData.sceneSectionObjectVisibilityPatched !== true) {
    const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
    const previousKey = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previousOnBeforeCompile(shader, renderer);
      const patchedShader = shader as SceneSectionObjectVisibilityShader;
      setSceneSectionObjectVisibilityUniforms(
        patchedShader.uniforms,
        material.userData.sceneSectionObjectVisibilityEnabled === true,
        (material.userData.sceneSectionObjectVisibilityPlanes ??
          []) as ResolvedSceneSectionPlane[],
        (material.userData.sceneSectionObjectVisibilityFrames ??
          []) as ResolvedSceneSectionFrame[],
        (material.userData
          .sceneSectionObjectVisibility as SceneSectionObjectVisibility) ?? {
          outsideOpacityByAxis: { x: 1, y: 1, z: 1 },
          outsideOpacityByFrameId: {},
          active: false,
          hasSoftOpacity: false,
        },
        (material.userData
          .sceneSectionObjectVisibilityMaskTransition as SceneSectionMaskTransition | null) ??
          null,
      );
      if (
        patchedShader.vertexShader.includes("void main() {") &&
        patchedShader.fragmentShader.includes("diffuseColor")
      ) {
        patchedShader.vertexShader = patchedShader.vertexShader.replace(
          "void main() {",
          [
            "varying vec3 vSceneSectionObjectVisibilityWorldPosition;",
            "void main() {",
            "  vSceneSectionObjectVisibilityWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;",
          ].join("\n"),
        );
        patchedShader.fragmentShader = patchedShader.fragmentShader.replace(
          "void main() {",
          [
            "uniform int uSceneSectionObjectVisibilityEnabled;",
            "uniform int uSceneSectionTransitionEnabled;",
            "uniform float uSceneSectionTransitionProgress;",
            "uniform int uSceneSectionObjectVisibilityPlaneCount;",
            "uniform vec3 uSceneSectionObjectVisibilityNormals[8];",
            "uniform float uSceneSectionObjectVisibilityPositions[8];",
            "uniform int uSceneSectionObjectVisibilityInvert[8];",
            "uniform float uSceneSectionObjectVisibilityPlaneOpacity[8];",
            "uniform int uSceneSectionObjectVisibilityFrameCount;",
            "uniform vec3 uSceneSectionObjectVisibilityFrameAxisA[8];",
            "uniform vec3 uSceneSectionObjectVisibilityFrameAxisB[8];",
            "uniform vec4 uSceneSectionObjectVisibilityFrameBounds[8];",
            "uniform float uSceneSectionObjectVisibilityFrameOpacity[8];",
            "uniform int uSceneSectionObjectVisibilityTargetPlaneCount;",
            "uniform vec3 uSceneSectionObjectVisibilityTargetNormals[8];",
            "uniform float uSceneSectionObjectVisibilityTargetPositions[8];",
            "uniform int uSceneSectionObjectVisibilityTargetInvert[8];",
            "uniform float uSceneSectionObjectVisibilityTargetPlaneOpacity[8];",
            "uniform int uSceneSectionObjectVisibilityTargetFrameCount;",
            "uniform vec3 uSceneSectionObjectVisibilityTargetFrameAxisA[8];",
            "uniform vec3 uSceneSectionObjectVisibilityTargetFrameAxisB[8];",
            "uniform vec4 uSceneSectionObjectVisibilityTargetFrameBounds[8];",
            "uniform float uSceneSectionObjectVisibilityTargetFrameOpacity[8];",
            "varying vec3 vSceneSectionObjectVisibilityWorldPosition;",
            "float sceneSectionObjectVisibilityTargetAlpha(vec3 position) {",
            "  float alpha = 1.0;",
            "  for (int i = 0; i < 8; i += 1) {",
            "    if (i >= uSceneSectionObjectVisibilityTargetPlaneCount) break;",
            "    vec3 normal = normalize(uSceneSectionObjectVisibilityTargetNormals[i]);",
            "    float distance = dot(position, normal) - uSceneSectionObjectVisibilityTargetPositions[i];",
            "    if (uSceneSectionObjectVisibilityTargetInvert[i] == 1) distance = -distance;",
            "    if (distance > 0.0) alpha = min(alpha, clamp(uSceneSectionObjectVisibilityTargetPlaneOpacity[i], 0.0, 1.0));",
            "  }",
            "  for (int i = 0; i < 8; i += 1) {",
            "    if (i >= uSceneSectionObjectVisibilityTargetFrameCount) break;",
            "    vec3 axisA = normalize(uSceneSectionObjectVisibilityTargetFrameAxisA[i]);",
            "    vec3 axisB = normalize(uSceneSectionObjectVisibilityTargetFrameAxisB[i]);",
            "    vec4 bounds = uSceneSectionObjectVisibilityTargetFrameBounds[i];",
            "    float a = dot(position, axisA);",
            "    float b = dot(position, axisB);",
            "    bool inside = a >= bounds.x && a <= bounds.y && b >= bounds.z && b <= bounds.w;",
            "    if (!inside) alpha = min(alpha, clamp(uSceneSectionObjectVisibilityTargetFrameOpacity[i], 0.0, 1.0));",
            "  }",
            "  return alpha;",
            "}",
            "float sceneSectionObjectVisibilityAlpha(vec3 position) {",
            "  float alpha = 1.0;",
            "  if (uSceneSectionObjectVisibilityEnabled != 0) {",
            "    for (int i = 0; i < 8; i += 1) {",
            "      if (i >= uSceneSectionObjectVisibilityPlaneCount) break;",
            "      vec3 normal = normalize(uSceneSectionObjectVisibilityNormals[i]);",
            "      float distance = dot(position, normal) - uSceneSectionObjectVisibilityPositions[i];",
            "      if (uSceneSectionObjectVisibilityInvert[i] == 1) distance = -distance;",
            "      if (distance > 0.0) alpha = min(alpha, clamp(uSceneSectionObjectVisibilityPlaneOpacity[i], 0.0, 1.0));",
            "    }",
            "    for (int i = 0; i < 8; i += 1) {",
            "      if (i >= uSceneSectionObjectVisibilityFrameCount) break;",
            "      vec3 axisA = normalize(uSceneSectionObjectVisibilityFrameAxisA[i]);",
            "      vec3 axisB = normalize(uSceneSectionObjectVisibilityFrameAxisB[i]);",
            "      vec4 bounds = uSceneSectionObjectVisibilityFrameBounds[i];",
            "      float a = dot(position, axisA);",
            "      float b = dot(position, axisB);",
            "      bool inside = a >= bounds.x && a <= bounds.y && b >= bounds.z && b <= bounds.w;",
            "      if (!inside) alpha = min(alpha, clamp(uSceneSectionObjectVisibilityFrameOpacity[i], 0.0, 1.0));",
            "    }",
            "  }",
            "  float sourceAlpha = alpha;",
            "  if (uSceneSectionTransitionEnabled == 0) return sourceAlpha;",
            "  float targetAlpha = sceneSectionObjectVisibilityTargetAlpha(position);",
            "  return mix(sourceAlpha, targetAlpha, clamp(uSceneSectionTransitionProgress, 0.0, 1.0));",
            "}",
            "void main() {",
          ].join("\n"),
        );
        const alphaPatch = [
          "float sceneSectionObjectVisibilityLayerAlpha = sceneSectionObjectVisibilityAlpha(vSceneSectionObjectVisibilityWorldPosition);",
          "diffuseColor.a *= sceneSectionObjectVisibilityLayerAlpha;",
          "if (diffuseColor.a <= 0.001) discard;",
        ].join("\n");
        if (
          patchedShader.fragmentShader.includes("#include <alphatest_fragment>")
        ) {
          patchedShader.fragmentShader = patchedShader.fragmentShader.replace(
            "#include <alphatest_fragment>",
            `${alphaPatch}\n#include <alphatest_fragment>`,
          );
        } else {
          patchedShader.fragmentShader = patchedShader.fragmentShader.replace(
            "#include <dithering_fragment>",
            `${alphaPatch}\n#include <dithering_fragment>`,
          );
        }
      }
      material.userData.sceneSectionObjectVisibilityShader = patchedShader;
    };
    material.customProgramCacheKey = () =>
      `${previousKey()}|geosee-scene-section-object-visibility-v3`;
    material.userData.sceneSectionObjectVisibilityPatched = true;
    material.needsUpdate = true;
  }

  const shader = material.userData.sceneSectionObjectVisibilityShader as
    | SceneSectionObjectVisibilityShader
    | undefined;
  if (shader) {
    setSceneSectionObjectVisibilityUniforms(
      shader.uniforms,
      enabled,
      planes,
      frames,
      visibility,
      maskTransition,
    );
  }
  if ((enabled && visibility.hasSoftOpacity) || maskTransition) {
    material.transparent = true;
    material.needsUpdate = true;
  }
}
