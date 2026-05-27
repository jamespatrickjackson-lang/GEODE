import * as THREE from "three";

const POINT_DISTANCE_LIGHT_NEAR_M = 0;
const POINT_DISTANCE_LIGHT_FAR_M = 180_000;

interface PointDistanceLightShader {
  uniforms: Record<string, { value: number }>;
  vertexShader: string;
  fragmentShader: string;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function applyPointDistanceLightMaterial(
  material: THREE.PointsMaterial,
  strength: number,
): void {
  const clampedStrength = clamp01(strength);
  material.userData.pointDistanceLightStrength = clampedStrength;
  material.userData.pointDistanceLightNearM = POINT_DISTANCE_LIGHT_NEAR_M;
  material.userData.pointDistanceLightFarM = POINT_DISTANCE_LIGHT_FAR_M;

  if (material.userData.pointDistanceLightPatched !== true) {
    const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previousOnBeforeCompile(shader, renderer);
      const patchedShader = shader as PointDistanceLightShader;
      patchedShader.uniforms.uPointDistanceLightStrength = {
        value: material.userData.pointDistanceLightStrength as number,
      };
      patchedShader.uniforms.uPointDistanceLightNear = {
        value: material.userData.pointDistanceLightNearM as number,
      };
      patchedShader.uniforms.uPointDistanceLightFar = {
        value: material.userData.pointDistanceLightFarM as number,
      };
      patchedShader.vertexShader = patchedShader.vertexShader
        .replace(
          "void main() {",
          [
            "uniform float uPointDistanceLightNear;",
            "uniform float uPointDistanceLightFar;",
            "varying float vPointDistanceLight;",
            "void main() {",
          ].join("\n"),
        )
        .replace(
          "#include <project_vertex>",
          [
            "#include <project_vertex>",
            "vPointDistanceLight = clamp((length(transformed.xy) - uPointDistanceLightNear) / max(1.0, uPointDistanceLightFar - uPointDistanceLightNear), 0.0, 1.0);",
          ].join("\n"),
        );
      patchedShader.fragmentShader = patchedShader.fragmentShader
        .replace(
          "void main() {",
          [
            "uniform float uPointDistanceLightStrength;",
            "varying float vPointDistanceLight;",
            "void main() {",
          ].join("\n"),
        )
        .replace(
          "#include <color_fragment>",
          [
            "#include <color_fragment>",
            "float pointDistanceLight = pow(vPointDistanceLight, 0.72);",
            "float pointDistanceMultiplier = mix(0.68, 1.42, pointDistanceLight);",
            "diffuseColor.rgb *= mix(1.0, pointDistanceMultiplier, uPointDistanceLightStrength);",
          ].join("\n"),
        );
      material.userData.pointDistanceLightShader = patchedShader;
    };
    material.customProgramCacheKey = () => "geosee-point-distance-light-v2";
    material.userData.pointDistanceLightPatched = true;
    material.needsUpdate = true;
  }

  const shader = material.userData.pointDistanceLightShader as
    | PointDistanceLightShader
    | undefined;
  if (shader) {
    shader.uniforms.uPointDistanceLightStrength.value = clampedStrength;
    shader.uniforms.uPointDistanceLightNear.value = POINT_DISTANCE_LIGHT_NEAR_M;
    shader.uniforms.uPointDistanceLightFar.value = POINT_DISTANCE_LIGHT_FAR_M;
  }
}
