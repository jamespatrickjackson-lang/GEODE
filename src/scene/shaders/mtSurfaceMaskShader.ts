import * as THREE from "three";

interface MtSurfaceMaskShader {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

export function applyMtSurfaceMaskPointMaterial(
  material: THREE.PointsMaterial,
): void {
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = true;
  material.blending = THREE.NormalBlending;
  material.toneMapped = false;

  if (material.userData.mtSurfaceMaskPatched === true) return;

  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    const patchedShader = shader as MtSurfaceMaskShader;
    if (!patchedShader.vertexShader.includes("surfaceMaskAlpha")) {
      patchedShader.vertexShader = patchedShader.vertexShader.replace(
        "void main() {",
        [
          "attribute float surfaceMaskAlpha;",
          "varying float vMtSurfaceMaskAlpha;",
          "void main() {",
          "  vMtSurfaceMaskAlpha = clamp(surfaceMaskAlpha, 0.0, 1.0);",
        ].join("\n"),
      );
    }
    if (!patchedShader.fragmentShader.includes("vMtSurfaceMaskAlpha")) {
      patchedShader.fragmentShader = patchedShader.fragmentShader.replace(
        "void main() {",
        ["varying float vMtSurfaceMaskAlpha;", "void main() {"].join("\n"),
      );
      const alphaPatch = [
        "diffuseColor.a *= clamp(vMtSurfaceMaskAlpha, 0.0, 1.0);",
        "if (diffuseColor.a <= 0.001) discard;",
      ].join("\n");
      if (patchedShader.fragmentShader.includes("#include <alphatest_fragment>")) {
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
    material.userData.mtSurfaceMaskShader = patchedShader;
  };
  material.customProgramCacheKey = () =>
    `${previousKey()}|geosee-mt-surface-mask-v1`;
  material.userData.mtSurfaceMaskPatched = true;
  material.needsUpdate = true;
}
