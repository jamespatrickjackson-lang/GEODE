import * as THREE from "three";
import { WORKING_AREA_FOCUS_DEFAULT_BOUNDS } from "../../projectModules/utahForge/workingAreaFocus";

interface WorkingAreaFocusShader {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function setWorkingAreaFocusShaderUniforms(
  uniforms: Record<string, { value: unknown }> | undefined,
  enabled: boolean,
  boundsMin: THREE.Vector3,
  boundsMax: THREE.Vector3,
  outsideOpacity: number,
): void {
  if (!uniforms) return;
  const ensure = <T>(key: string, value: T) => {
    if (!uniforms[key]) uniforms[key] = { value };
    return uniforms[key] as { value: T };
  };
  ensure<number>("uWorkingAreaFocusEnabled", 0).value = enabled ? 1 : 0;
  ensure<THREE.Vector3>(
    "uWorkingAreaFocusBoundsMin",
    new THREE.Vector3(),
  ).value.copy(boundsMin);
  ensure<THREE.Vector3>(
    "uWorkingAreaFocusBoundsMax",
    new THREE.Vector3(),
  ).value.copy(boundsMax);
  ensure<number>("uWorkingAreaFocusOutsideOpacity", 1).value =
    clamp01(outsideOpacity);
}

export function applyWorkingAreaFocusBuiltInMaterial(
  material: THREE.Material,
  enabled: boolean,
  boundsMin: THREE.Vector3,
  boundsMax: THREE.Vector3,
  outsideOpacity: number,
): void {
  material.userData.workingAreaFocusEnabled = enabled;
  material.userData.workingAreaFocusBoundsMin = boundsMin.clone();
  material.userData.workingAreaFocusBoundsMax = boundsMax.clone();
  material.userData.workingAreaFocusOutsideOpacity = clamp01(outsideOpacity);

  if (material.userData.workingAreaFocusPatched !== true) {
    const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
    const previousKey = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previousOnBeforeCompile(shader, renderer);
      const patchedShader = shader as WorkingAreaFocusShader;
      setWorkingAreaFocusShaderUniforms(
        patchedShader.uniforms,
        material.userData.workingAreaFocusEnabled === true,
        (material.userData.workingAreaFocusBoundsMin as THREE.Vector3) ??
          WORKING_AREA_FOCUS_DEFAULT_BOUNDS.min,
        (material.userData.workingAreaFocusBoundsMax as THREE.Vector3) ??
          WORKING_AREA_FOCUS_DEFAULT_BOUNDS.max,
        typeof material.userData.workingAreaFocusOutsideOpacity === "number"
          ? material.userData.workingAreaFocusOutsideOpacity
          : 1,
      );
      if (
        patchedShader.vertexShader.includes("void main() {") &&
        patchedShader.fragmentShader.includes("diffuseColor")
      ) {
        patchedShader.vertexShader = patchedShader.vertexShader.replace(
          "void main() {",
          [
            "varying vec3 vWorkingAreaFocusWorldPosition;",
            "void main() {",
            "  vWorkingAreaFocusWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;",
          ].join("\n"),
        );
        patchedShader.fragmentShader = patchedShader.fragmentShader.replace(
          "void main() {",
          [
            "uniform int uWorkingAreaFocusEnabled;",
            "uniform vec3 uWorkingAreaFocusBoundsMin;",
            "uniform vec3 uWorkingAreaFocusBoundsMax;",
            "uniform float uWorkingAreaFocusOutsideOpacity;",
            "varying vec3 vWorkingAreaFocusWorldPosition;",
            "float workingAreaFocusAlpha(vec3 position) {",
            "  if (uWorkingAreaFocusEnabled == 0) return 1.0;",
            "  bool inside = all(greaterThanEqual(position, uWorkingAreaFocusBoundsMin)) && all(lessThanEqual(position, uWorkingAreaFocusBoundsMax));",
            "  return inside ? 1.0 : clamp(uWorkingAreaFocusOutsideOpacity, 0.0, 1.0);",
            "}",
            "void main() {",
          ].join("\n"),
        );
        const alphaPatch = [
          "float workingAreaFocusLayerAlpha = workingAreaFocusAlpha(vWorkingAreaFocusWorldPosition);",
          "diffuseColor.a *= workingAreaFocusLayerAlpha;",
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
      material.userData.workingAreaFocusShader = patchedShader;
    };
    material.customProgramCacheKey = () =>
      `${previousKey()}|geosee-working-area-focus-v1`;
    material.userData.workingAreaFocusPatched = true;
    material.needsUpdate = true;
  }

  const shader = material.userData.workingAreaFocusShader as
    | WorkingAreaFocusShader
    | undefined;
  if (shader) {
    setWorkingAreaFocusShaderUniforms(
      shader.uniforms,
      enabled,
      boundsMin,
      boundsMax,
      outsideOpacity,
    );
  }
}
