import * as THREE from "three";
import type {
  ResolvedSceneSectionFrame,
  ResolvedSceneSectionPlane,
  SceneSectionAxis,
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

function axisCode(axis: SceneSectionAxis): number {
  return axis === "y" ? 1 : axis === "z" ? 2 : 0;
}

export function setSceneSectionObjectVisibilityUniforms(
  uniforms: Record<string, { value: unknown }> | undefined,
  enabled: boolean,
  planes: ResolvedSceneSectionPlane[],
  frames: ResolvedSceneSectionFrame[],
  visibility: SceneSectionObjectVisibility,
): void {
  if (!uniforms) return;
  const ensure = <T>(key: string, value: T) => {
    if (!uniforms[key]) uniforms[key] = { value };
    return uniforms[key] as { value: T };
  };
  ensure<number>("uSceneSectionObjectVisibilityEnabled", 0).value = enabled
    ? 1
    : 0;
  ensure<number>("uSceneSectionObjectVisibilityPlaneCount", 0).value = enabled
    ? Math.min(SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT, planes.length)
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
    const plane = planes[i];
    if (!normalUniform.value[i]) normalUniform.value[i] = new THREE.Vector3();
    normalUniform.value[i].copy(plane?.normal ?? new THREE.Vector3());
    positionUniform.value[i] = plane?.positionM ?? 0;
    invertUniform.value[i] = plane?.invert ? 1 : 0;
    planeOpacityUniform.value[i] = plane
      ? clamp01(
          visibility.outsideOpacityByFrameId[plane.frameId] ??
            visibility.outsideOpacityByAxis[plane.axis] ??
            1,
        )
      : 1;
  }

  const activeFrames = enabled
    ? frames.slice(0, SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT)
    : [];
  ensure<number>("uSceneSectionObjectVisibilityFrameCount", 0).value =
    activeFrames.length;
  const frameAxesUniform = ensure<number[]>(
    "uSceneSectionObjectVisibilityFrameAxes",
    Array.from({ length: SCENE_SECTION_OBJECT_VISIBILITY_SLOT_COUNT }, () => 0),
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
    frameAxesUniform.value[i] = frame ? axisCode(frame.axis) : 0;
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
          visibility.outsideOpacityByFrameId[frame.frameId] ??
            visibility.outsideOpacityByAxis[frame.axis] ??
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
): void {
  material.userData.sceneSectionObjectVisibilityEnabled = enabled;
  material.userData.sceneSectionObjectVisibilityPlanes = planes;
  material.userData.sceneSectionObjectVisibilityFrames = frames;
  material.userData.sceneSectionObjectVisibility = visibility;

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
            "uniform int uSceneSectionObjectVisibilityPlaneCount;",
            "uniform vec3 uSceneSectionObjectVisibilityNormals[8];",
            "uniform float uSceneSectionObjectVisibilityPositions[8];",
            "uniform int uSceneSectionObjectVisibilityInvert[8];",
            "uniform float uSceneSectionObjectVisibilityPlaneOpacity[8];",
            "uniform int uSceneSectionObjectVisibilityFrameCount;",
            "uniform int uSceneSectionObjectVisibilityFrameAxes[8];",
            "uniform vec4 uSceneSectionObjectVisibilityFrameBounds[8];",
            "uniform float uSceneSectionObjectVisibilityFrameOpacity[8];",
            "varying vec3 vSceneSectionObjectVisibilityWorldPosition;",
            "float sceneSectionObjectVisibilityAlpha(vec3 position) {",
            "  if (uSceneSectionObjectVisibilityEnabled == 0) return 1.0;",
            "  float alpha = 1.0;",
            "  for (int i = 0; i < 8; i += 1) {",
            "    if (i >= uSceneSectionObjectVisibilityPlaneCount) break;",
            "    vec3 normal = normalize(uSceneSectionObjectVisibilityNormals[i]);",
            "    float distance = dot(position, normal) - uSceneSectionObjectVisibilityPositions[i];",
            "    if (uSceneSectionObjectVisibilityInvert[i] == 1) distance = -distance;",
            "    if (distance > 0.0) alpha = min(alpha, clamp(uSceneSectionObjectVisibilityPlaneOpacity[i], 0.0, 1.0));",
            "  }",
            "  for (int i = 0; i < 8; i += 1) {",
            "    if (i >= uSceneSectionObjectVisibilityFrameCount) break;",
            "    int axis = uSceneSectionObjectVisibilityFrameAxes[i];",
            "    vec4 bounds = uSceneSectionObjectVisibilityFrameBounds[i];",
            "    float a = axis == 0 ? position.y : position.x;",
            "    float b = axis == 2 ? position.y : position.z;",
            "    bool inside = a >= bounds.x && a <= bounds.y && b >= bounds.z && b <= bounds.w;",
            "    if (!inside) alpha = min(alpha, clamp(uSceneSectionObjectVisibilityFrameOpacity[i], 0.0, 1.0));",
            "  }",
            "  return alpha;",
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
      `${previousKey()}|geosee-scene-section-object-visibility-v1`;
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
    );
  }
  if (enabled && visibility.hasSoftOpacity) {
    material.transparent = true;
    material.needsUpdate = true;
  }
}
