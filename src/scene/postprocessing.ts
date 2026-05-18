import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// Post-processing chain for the cinematic look. Order:
//   RenderPass        -- main scene -> render target
//   SSAOPass          -- mesh contact depth / ambient occlusion
//   UnrealBloomPass   -- emissive bloom (drill traces, 2024 collars, targets)
//   GradePass         -- contrast/saturation/tint and vignette in one pass
//   SMAAPass          -- anti-alias post-processed geometry edges
//   OutputPass        -- final tone mapping + sRGB output
//
// All values are mutable at runtime so PageController can apply per-page
// cinematicExposure / bloomBoost.

const grdShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    contrast: { value: 1.06 },
    saturation: { value: 1.06 },
    tint: { value: new THREE.Color(0x101418) },
    tintStrength: { value: 0.04 },
    vignetteStrength: { value: 0.95 },
    vignetteSmoothness: { value: 0.75 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float contrast;
    uniform float saturation;
    uniform vec3 tint;
    uniform float tintStrength;
    uniform float vignetteStrength;
    uniform float vignetteSmoothness;
    varying vec2 vUv;

    vec3 saturationAdj(vec3 rgb, float adj) {
      const vec3 W = vec3(0.2126, 0.7152, 0.0722);
      vec3 grey = vec3(dot(rgb, W));
      return mix(grey, rgb, adj);
    }

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // Contrast around 0.5
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      // Saturation
      c.rgb = saturationAdj(c.rgb, saturation);
      // Color tint blend
      c.rgb = mix(c.rgb, c.rgb * tint * 8.0, tintStrength);
      // Smooth vignette
      vec2 d = vUv - 0.5;
      float r = length(d) * 1.4142;
      float v = smoothstep(vignetteStrength, vignetteStrength - vignetteSmoothness, r);
      c.rgb *= mix(1.0 - vignetteStrength * 0.5, 1.0, v);
      gl_FragColor = c;
    }
  `,
};

export interface PostHandle {
  composer: EffectComposer;
  ssaoPass: SSAOPass;
  bloomPass: UnrealBloomPass;
  gradePass: ShaderPass;
  smaaPass: SMAAPass;
  setSize(w: number, h: number): void;
  baseBloomStrength: number;
  setBloomStrength(s: number): void;
}

export function buildPostprocessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  initialSize: { w: number; h: number },
): PostHandle {
  const composer = new EffectComposer(renderer);
  const pixelRatio = renderer.getPixelRatio();
  composer.setPixelRatio(pixelRatio);
  composer.setSize(initialSize.w, initialSize.h);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const ssaoPass = new SSAOPass(scene, camera, initialSize.w, initialSize.h);
  ssaoPass.output = SSAOPass.OUTPUT.Default;
  ssaoPass.kernelRadius = 7;
  ssaoPass.minDistance = 0.004;
  ssaoPass.maxDistance = 0.12;
  ssaoPass.enabled = true;
  composer.addPass(ssaoPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(initialSize.w, initialSize.h),
    0.85, // strength (overwritten by env)
    0.6, // radius
    0.85, // threshold
  );
  composer.addPass(bloomPass);

  const gradePass = new ShaderPass(grdShader);
  composer.addPass(gradePass);

  const smaaPass = new SMAAPass(
    initialSize.w * pixelRatio,
    initialSize.h * pixelRatio,
  );
  composer.addPass(smaaPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  let baseBloomStrength = bloomPass.strength;

  const handle: PostHandle = {
    composer,
    ssaoPass,
    bloomPass,
    gradePass,
    smaaPass,
    setSize(w, h) {
      composer.setSize(w, h);
      ssaoPass.setSize(w, h);
      bloomPass.setSize(w, h);
      smaaPass.setSize(w * pixelRatio, h * pixelRatio);
    },
    baseBloomStrength,
    setBloomStrength(s) {
      baseBloomStrength = s;
      bloomPass.strength = s;
    },
  };
  // Sync the closure-bound base when set externally.
  Object.defineProperty(handle, "baseBloomStrength", {
    get: () => baseBloomStrength,
    set: (v: number) => {
      baseBloomStrength = v;
      bloomPass.strength = v;
    },
  });
  return handle;
}
