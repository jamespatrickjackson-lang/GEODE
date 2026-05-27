import * as THREE from "three";

const LAYER_FOG_SHADER_KEY = "layer-fog-density:v1";

function shaderMaterialHasThreeFogUniforms(
  material: THREE.ShaderMaterial,
): boolean {
  const uniforms = material.uniforms as Record<string, { value: unknown }>;
  return !!uniforms?.fogColor && (!!uniforms.fogDensity || !!uniforms.fogNear);
}

function ensureLayerFogDensityShader(
  material: THREE.Material,
  density: number,
): void {
  material.userData.layerFogDensity = density;
  const uniform = material.userData.layerFogDensityUniform as
    | { value: number }
    | undefined;
  if (uniform) uniform.value = density;
  if (material.userData.layerFogDensityShader === true) return;

  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    shader.uniforms.layerFogDensity = {
      value: material.userData.layerFogDensity ?? density,
    };
    material.userData.layerFogDensityUniform = shader.uniforms.layerFogDensity;
    if (shader.fragmentShader.includes("#include <common>")) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nuniform float layerFogDensity;",
      );
    } else {
      shader.fragmentShader = `uniform float layerFogDensity;\n${shader.fragmentShader}`;
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <fog_fragment>",
      `
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp( - layerFogDensity * layerFogDensity * vFogDepth * vFogDepth );
          #else
            float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
          #endif
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
        #endif
      `,
    );
  };
  material.customProgramCacheKey = () =>
    `${previousKey()}|${LAYER_FOG_SHADER_KEY}`;
  material.userData.layerFogDensityShader = true;
  material.needsUpdate = true;
}

export function setMaterialFog(
  material: THREE.Material,
  enabled: boolean,
  density: number,
): void {
  if (material.userData?.ignoreLayerFog === true) return;
  const foggable = material as THREE.Material & {
    fog?: boolean;
    uniforms?: Record<string, { value: unknown }>;
  };
  if (material instanceof THREE.ShaderMaterial) {
    if (!shaderMaterialHasThreeFogUniforms(material)) {
      if (foggable.fog !== false) {
        foggable.fog = false;
        material.needsUpdate = true;
      }
      return;
    }
  }
  if (enabled) ensureLayerFogDensityShader(material, density);
  if (foggable.fog === enabled) return;
  foggable.fog = enabled;
  material.needsUpdate = true;
}
