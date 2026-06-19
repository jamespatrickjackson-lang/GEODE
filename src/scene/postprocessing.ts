import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// Post-processing chain for the cinematic look. Order:
//   RenderPass        -- main scene -> render target
//   SSAOPass          -- mesh contact depth / ambient occlusion
//   BokehPass         -- optional depth of field
//   UnrealBloomPass   -- emissive bloom (drill traces, collars, targets)
//   TiltShiftPass     -- optional band-masked directional blur
//   AfterimagePass    -- optional motion trails
//   LensGradePass     -- grade, vignette, film grain, optics in one pass
//   SMAAPass          -- anti-alias post-processed geometry edges
//   OutputPass        -- final tone mapping + sRGB output
//
// All values are mutable at runtime so PageController can apply per-page
// cinematicExposure / bloomBoost and the editor can preview scene patches.

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const tiltShiftShader = {
  name: "TiltShiftPass",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    center: { value: new THREE.Vector2(0.5, 0.5) },
    angle: { value: 0 },
    bandSize: { value: 0.28 },
    feather: { value: 0.2 },
    blur: { value: 0 },
  },
  vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform vec2 center;
    uniform float angle;
    uniform float bandSize;
    uniform float feather;
    uniform float blur;
    varying vec2 vUv;

    vec4 sampleFrame(vec2 uv) {
      return texture2D(tDiffuse, clamp(uv, vec2(0.001), vec2(0.999)));
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (blur <= 0.0001) {
        gl_FragColor = base;
        return;
      }

      vec2 axis = normalize(vec2(cos(angle), sin(angle)));
      vec2 normal = vec2(-axis.y, axis.x);
      float distanceToBand = abs(dot(vUv - center, normal));
      float mask = smoothstep(bandSize, bandSize + max(feather, 0.0001), distanceToBand);
      vec2 stepUv = axis * blur * 18.0 / max(resolution, vec2(1.0));

      vec4 blurred = base * 0.18;
      blurred += sampleFrame(vUv - stepUv * 4.0) * 0.05;
      blurred += sampleFrame(vUv - stepUv * 3.0) * 0.09;
      blurred += sampleFrame(vUv - stepUv * 2.0) * 0.12;
      blurred += sampleFrame(vUv - stepUv) * 0.16;
      blurred += sampleFrame(vUv + stepUv) * 0.16;
      blurred += sampleFrame(vUv + stepUv * 2.0) * 0.12;
      blurred += sampleFrame(vUv + stepUv * 3.0) * 0.09;
      blurred += sampleFrame(vUv + stepUv * 4.0) * 0.05;

      gl_FragColor = mix(base, blurred, mask);
    }
  `,
};

const lensGradeShader = {
  name: "LensGradePass",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    contrast: { value: 1.06 },
    saturation: { value: 1.06 },
    vibrancy: { value: 1.0 },
    tint: { value: new THREE.Color(0x101418) },
    tintStrength: { value: 0.04 },
    vignetteStrength: { value: 0.95 },
    vignetteSmoothness: { value: 0.75 },
    temperature: { value: 0 },
    blackPoint: { value: 0 },
    whitePoint: { value: 1 },
    lift: { value: 0 },
    gamma: { value: 1 },
    gain: { value: 1 },
    splitShadowColor: { value: new THREE.Color(0x182238) },
    splitHighlightColor: { value: new THREE.Color(0xffd29a) },
    splitToneAmount: { value: 0 },
    filterColor: { value: new THREE.Color(0xffffff) },
    filterIntensity: { value: 0 },
    grainAmount: { value: 0 },
    grainSize: { value: 1 },
    distortion: { value: 0 },
    chromaticAberration: { value: 0 },
    sharpen: { value: 0 },
    diffusion: { value: 0 },
    halation: { value: 0 },
    anamorphicStreak: { value: 0 },
    anamorphicStreakLength: { value: 0.45 },
    anamorphicStreakThreshold: { value: 0.82 },
    frameEnabled: { value: 0 },
    frameAspectRatio: { value: 0 },
    frameOpacity: { value: 0.72 },
    frameColor: { value: new THREE.Color(0x000000) },
    cornerFade: { value: 0 },
    gateWeave: { value: 0 },
    guideEnabled: { value: 0 },
    guideRuleOfThirds: { value: 0 },
    guideCenterCross: { value: 0 },
    guideSafeFrame: { value: 0 },
    guideAspectRatio: { value: 0 },
    guideLineThickness: { value: 0.25 },
    time: { value: 0 },
  },
  vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float contrast;
    uniform float saturation;
    uniform float vibrancy;
    uniform vec3 tint;
    uniform float tintStrength;
    uniform float vignetteStrength;
    uniform float vignetteSmoothness;
    uniform float temperature;
    uniform float blackPoint;
    uniform float whitePoint;
    uniform float lift;
    uniform float gamma;
    uniform float gain;
    uniform vec3 splitShadowColor;
    uniform vec3 splitHighlightColor;
    uniform float splitToneAmount;
    uniform vec3 filterColor;
    uniform float filterIntensity;
    uniform float grainAmount;
    uniform float grainSize;
    uniform float distortion;
    uniform float chromaticAberration;
    uniform float sharpen;
    uniform float diffusion;
    uniform float halation;
    uniform float anamorphicStreak;
    uniform float anamorphicStreakLength;
    uniform float anamorphicStreakThreshold;
    uniform float frameEnabled;
    uniform float frameAspectRatio;
    uniform float frameOpacity;
    uniform vec3 frameColor;
    uniform float cornerFade;
    uniform float gateWeave;
    uniform float guideEnabled;
    uniform float guideRuleOfThirds;
    uniform float guideCenterCross;
    uniform float guideSafeFrame;
    uniform float guideAspectRatio;
    uniform float guideLineThickness;
    uniform float time;
    varying vec2 vUv;

    vec2 distortUv(vec2 uv, float amount) {
      vec2 p = uv * 2.0 - 1.0;
      float r2 = dot(p, p);
      p *= 1.0 + amount * 0.18 * r2;
      return clamp(p * 0.5 + 0.5, vec2(0.001), vec2(0.999));
    }

    vec3 sampleOptics(vec2 uv) {
      vec2 duv = distortUv(uv, distortion);
      vec2 radial = normalize((duv - 0.5) + vec2(0.0001));
      vec2 ca = radial * chromaticAberration * 0.006;
      float r = texture2D(tDiffuse, clamp(duv + ca, vec2(0.001), vec2(0.999))).r;
      float g = texture2D(tDiffuse, duv).g;
      float b = texture2D(tDiffuse, clamp(duv - ca, vec2(0.001), vec2(0.999))).b;
      return vec3(r, g, b);
    }

    vec3 saturationAdj(vec3 rgb, float adj) {
      const vec3 W = vec3(0.2126, 0.7152, 0.0722);
      vec3 grey = vec3(dot(rgb, W));
      return mix(grey, rgb, adj);
    }

    vec3 vibrancyAdj(vec3 rgb, float adj) {
      float mx = max(max(rgb.r, rgb.g), rgb.b);
      float mn = min(min(rgb.r, rgb.g), rgb.b);
      float currentSat = (mx > 0.0001) ? (mx - mn) / mx : 0.0;
      float headroom = clamp(1.0 - currentSat, 0.0, 1.0);
      float effectiveAdj = mix(1.0, adj, headroom);
      return saturationAdj(rgb, effectiveAdj);
    }

    float luma(vec3 rgb) {
      return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    }

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    vec3 highlightOnly(vec3 rgb, float threshold) {
      float y = luma(rgb);
      return rgb * smoothstep(threshold, 1.0, y);
    }

    vec3 sampleHighlight(vec2 uv, float threshold) {
      return highlightOnly(sampleOptics(clamp(uv, vec2(0.001), vec2(0.999))), threshold);
    }

    vec3 applyPresentationFrame(vec3 color, vec2 uv) {
      vec3 framed = color;
      if (cornerFade > 0.0001) {
        vec2 p = abs(uv - 0.5) * 2.0;
        float corner = smoothstep(0.58, 1.28, length(p));
        framed *= mix(1.0, 1.0 - clamp(cornerFade, 0.0, 1.0) * 0.72, corner);
      }
      if (frameEnabled < 0.5 || frameAspectRatio <= 0.0 || frameOpacity <= 0.0001) {
        return framed;
      }
      float screenAspect = resolution.x / max(resolution.y, 1.0);
      float outside = 0.0;
      if (screenAspect > frameAspectRatio) {
        float visibleWidth = frameAspectRatio / screenAspect;
        float insetX = (1.0 - visibleWidth) * 0.5;
        outside = max(step(uv.x, insetX), step(1.0 - insetX, uv.x));
      } else {
        float visibleHeight = screenAspect / frameAspectRatio;
        float insetY = (1.0 - visibleHeight) * 0.5;
        outside = max(step(uv.y, insetY), step(1.0 - insetY, uv.y));
      }
      return mix(framed, frameColor, outside * clamp(frameOpacity, 0.0, 1.0));
    }

    float guideLine(float value, float target, float width) {
      return 1.0 - smoothstep(width, width * 2.0, abs(value - target));
    }

    float guideRect(vec2 uv, vec2 inset, float width) {
      float left = guideLine(uv.x, inset.x, width);
      float right = guideLine(uv.x, 1.0 - inset.x, width);
      float top = guideLine(uv.y, inset.y, width);
      float bottom = guideLine(uv.y, 1.0 - inset.y, width);
      float vertical = max(left, right) * step(inset.y, uv.y) * step(uv.y, 1.0 - inset.y);
      float horizontal = max(top, bottom) * step(inset.x, uv.x) * step(uv.x, 1.0 - inset.x);
      return max(vertical, horizontal);
    }

    vec3 applyGuides(vec3 color, vec2 uv) {
      if (guideEnabled < 0.5) return color;
      float width = max(guideLineThickness / max(resolution.x, resolution.y), 0.0003);
      float mask = 0.0;
      if (guideRuleOfThirds > 0.5) {
        mask = max(mask, guideLine(uv.x, 1.0 / 3.0, width));
        mask = max(mask, guideLine(uv.x, 2.0 / 3.0, width));
        mask = max(mask, guideLine(uv.y, 1.0 / 3.0, width));
        mask = max(mask, guideLine(uv.y, 2.0 / 3.0, width));
      }
      if (guideCenterCross > 0.5) {
        float crossX = guideLine(uv.x, 0.5, width) * step(abs(uv.y - 0.5), 0.07);
        float crossY = guideLine(uv.y, 0.5, width) * step(abs(uv.x - 0.5), 0.07);
        mask = max(mask, max(crossX, crossY));
      }
      if (guideSafeFrame > 0.5) {
        mask = max(mask, guideRect(uv, vec2(0.06, 0.06), width));
      }
      if (guideAspectRatio > 0.0) {
        float screenAspect = resolution.x / max(resolution.y, 1.0);
        vec2 inset = vec2(0.0);
        float outside = 0.0;
        if (screenAspect > guideAspectRatio) {
          float visibleWidth = guideAspectRatio / screenAspect;
          inset.x = (1.0 - visibleWidth) * 0.5;
          outside = max(step(uv.x, inset.x), step(1.0 - inset.x, uv.x));
        } else {
          float visibleHeight = screenAspect / guideAspectRatio;
          inset.y = (1.0 - visibleHeight) * 0.5;
          outside = max(step(uv.y, inset.y), step(1.0 - inset.y, uv.y));
        }
        color = mix(color, color * 0.35, outside * 0.48);
        mask = max(mask, guideRect(uv, inset, width));
      }
      return mix(color, vec3(1.0, 0.92, 0.72), clamp(mask, 0.0, 1.0) * 0.78);
    }

    void main() {
      vec2 pixel = 1.0 / max(resolution, vec2(1.0));
      vec2 wovenUv = vUv;
      if (gateWeave > 0.0001) {
        vec2 weave = vec2(
          sin(time * 1.73) + sin(time * 5.11) * 0.35,
          cos(time * 1.27) + sin(time * 4.67) * 0.28
        ) * pixel * gateWeave * 6.0;
        wovenUv = clamp(vUv + weave, vec2(0.001), vec2(0.999));
      }
      vec3 c = sampleOptics(wovenUv);

      if (diffusion > 0.0001 || sharpen > 0.0001) {
        vec3 crossBlur =
          sampleOptics(vUv + vec2(pixel.x, 0.0)) +
          sampleOptics(vUv - vec2(pixel.x, 0.0)) +
          sampleOptics(vUv + vec2(0.0, pixel.y)) +
          sampleOptics(vUv - vec2(0.0, pixel.y));
        crossBlur *= 0.25;
        c = mix(c, crossBlur, clamp(diffusion, 0.0, 1.0));
        c = mix(c, clamp(c * 1.8 - crossBlur * 0.8, 0.0, 4.0), clamp(sharpen, 0.0, 1.0));
      }

      if (halation > 0.0001 || anamorphicStreak > 0.0001) {
        float threshold = clamp(anamorphicStreakThreshold, 0.2, 1.0);
        vec3 glow = vec3(0.0);
        glow += sampleHighlight(wovenUv + vec2(pixel.x * 2.0, 0.0), threshold) * 0.18;
        glow += sampleHighlight(wovenUv - vec2(pixel.x * 2.0, 0.0), threshold) * 0.18;
        glow += sampleHighlight(wovenUv + vec2(0.0, pixel.y * 2.0), threshold) * 0.12;
        glow += sampleHighlight(wovenUv - vec2(0.0, pixel.y * 2.0), threshold) * 0.12;
        c += glow * vec3(1.25, 0.58, 0.32) * clamp(halation, 0.0, 1.0);

        vec3 streak = vec3(0.0);
        float lengthPx = mix(8.0, 88.0, clamp(anamorphicStreakLength, 0.0, 1.0));
        streak += sampleHighlight(wovenUv + vec2(pixel.x * lengthPx * 0.25, 0.0), threshold) * 0.24;
        streak += sampleHighlight(wovenUv - vec2(pixel.x * lengthPx * 0.25, 0.0), threshold) * 0.24;
        streak += sampleHighlight(wovenUv + vec2(pixel.x * lengthPx * 0.55, 0.0), threshold) * 0.14;
        streak += sampleHighlight(wovenUv - vec2(pixel.x * lengthPx * 0.55, 0.0), threshold) * 0.14;
        streak += sampleHighlight(wovenUv + vec2(pixel.x * lengthPx, 0.0), threshold) * 0.08;
        streak += sampleHighlight(wovenUv - vec2(pixel.x * lengthPx, 0.0), threshold) * 0.08;
        c += streak * vec3(0.68, 0.84, 1.55) * clamp(anamorphicStreak, 0.0, 1.0);
      }

      c = (c - 0.5) * contrast + 0.5;
      c = max(c, vec3(0.0));
      c = saturationAdj(c, saturation);
      c = max(c, vec3(0.0));
      c = vibrancyAdj(c, vibrancy);
      c = max(c, vec3(0.0));
      c.r += temperature * 0.08;
      c.b -= temperature * 0.08;
      c = (c - blackPoint) / max(whitePoint - blackPoint, 0.001);
      c = max(c + lift, vec3(0.0));
      c = pow(c, vec3(1.0 / max(gamma, 0.001))) * gain;
      c = mix(c, c * tint * 8.0, tintStrength);

      float y = luma(c);
      vec3 splitColor = mix(splitShadowColor, splitHighlightColor, smoothstep(0.28, 0.72, y));
      c = mix(c, c * splitColor * 1.45, clamp(splitToneAmount, 0.0, 1.0));
      c = mix(c, c * filterColor * 1.2, clamp(filterIntensity, 0.0, 1.0));

      vec2 d = vUv - 0.5;
      float r = length(d) * 1.4142;
      float v = smoothstep(vignetteStrength, vignetteStrength - vignetteSmoothness, r);
      c *= mix(1.0 - vignetteStrength * 0.5, 1.0, v);

      if (grainAmount > 0.0001) {
        float g = rand(floor(vUv * resolution / max(grainSize, 0.25)) + time);
        c += (g - 0.5) * grainAmount;
      }

      c = applyGuides(c, vUv);
      c = applyPresentationFrame(c, vUv);

      gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
    }
  `,
};

export interface PostHandle {
  composer: EffectComposer;
  ssaoPass: SSAOPass;
  bokehPass: BokehPass;
  bloomPass: UnrealBloomPass;
  tiltShiftPass: ShaderPass;
  afterimagePass: AfterimagePass;
  lensGradePass: ShaderPass;
  gradePass: ShaderPass;
  smaaPass: SMAAPass;
  setSize(w: number, h: number): void;
  setPixelRatio(pixelRatio: number): void;
  setCaptureMultisample(samples: number): void;
  applyCaptureCleanGrade(tiled: boolean): void;
  clearCaptureGrade(): void;
  baseBloomStrength: number;
  setBloomStrength(s: number): void;
}

// Post-recoverable lens/film FX (all lensGrade uniforms). Stripped to 0 for the
// Clean Master capture grade so the master is sharp/seam-free and the look is
// applied in post. The color-grade uniforms (contrast/saturation/temperature/
// lift/gamma/gain/split-tone/filter) are intentionally NOT in this list.
const CLEAN_GRADE_ZERO_UNIFORMS = [
  "vignetteStrength",
  "grainAmount",
  "chromaticAberration",
  "distortion",
  "frameEnabled",
  "cornerFade",
  "guideEnabled",
  "halation",
  "anamorphicStreak",
  "gateWeave",
  "diffusion",
  "sharpen",
] as const;

export function buildPostprocessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  initialSize: { w: number; h: number },
): PostHandle {
  const composer = new EffectComposer(renderer);
  let pixelRatio = renderer.getPixelRatio();
  let currentWidth = initialSize.w;
  let currentHeight = initialSize.h;
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

  const bokehPass = new BokehPass(scene, camera, {
    focus: 1000,
    aperture: 0.00002,
    maxblur: 0.004,
  });
  bokehPass.enabled = false;
  composer.addPass(bokehPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(initialSize.w, initialSize.h),
    0.85,
    0.6,
    0.85,
  );
  composer.addPass(bloomPass);

  const tiltShiftPass = new ShaderPass(tiltShiftShader);
  tiltShiftPass.enabled = false;
  tiltShiftPass.uniforms.resolution.value.set(initialSize.w, initialSize.h);
  composer.addPass(tiltShiftPass);

  const afterimagePass = new AfterimagePass(0.96);
  afterimagePass.enabled = false;
  composer.addPass(afterimagePass);

  const lensGradePass = new ShaderPass(lensGradeShader);
  lensGradePass.uniforms.resolution.value.set(initialSize.w, initialSize.h);
  composer.addPass(lensGradePass);

  const smaaPass = new SMAAPass(
    initialSize.w * pixelRatio,
    initialSize.h * pixelRatio,
  );
  composer.addPass(smaaPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  let baseBloomStrength = bloomPass.strength;
  let captureGradeSnapshot:
    | {
        lens: Record<string, number>;
        bloom: boolean;
        bokeh: boolean;
        tilt: boolean;
        afterimage: boolean;
        smaa: boolean;
      }
    | null = null;

  const handle: PostHandle = {
    composer,
    ssaoPass,
    bokehPass,
    bloomPass,
    tiltShiftPass,
    afterimagePass,
    lensGradePass,
    gradePass: lensGradePass,
    smaaPass,
    setSize(w, h) {
      currentWidth = w;
      currentHeight = h;
      composer.setSize(w, h);
      ssaoPass.setSize(w, h);
      bokehPass.setSize(w, h);
      bloomPass.setSize(w, h);
      tiltShiftPass.uniforms.resolution.value.set(w, h);
      afterimagePass.setSize(w, h);
      lensGradePass.uniforms.resolution.value.set(w, h);
      smaaPass.setSize(w * pixelRatio, h * pixelRatio);
    },
    setPixelRatio(nextPixelRatio) {
      pixelRatio = nextPixelRatio;
      composer.setPixelRatio(pixelRatio);
      smaaPass.setSize(currentWidth * pixelRatio, currentHeight * pixelRatio);
    },
    setCaptureMultisample(samples) {
      // WebGL2 MSAA on the composer's ping-pong render targets. The renderer
      // built with `antialias: true` only multisamples the default framebuffer,
      // which the composer bypasses (RenderPass draws into its own RT), so
      // geometry edges in composed output otherwise rely on SMAA alone. Raising
      // RT samples gives true multisampled geometry edges under the capture
      // lock; 0 restores the live (non-MSAA) profile.
      const safe =
        Number.isFinite(samples) && samples > 0 ? Math.floor(samples) : 0;
      if (
        composer.renderTarget1.samples === safe &&
        composer.renderTarget2.samples === safe
      ) {
        return;
      }
      composer.renderTarget1.samples = safe;
      composer.renderTarget2.samples = safe;
      // Drop the cached GPU framebuffers so the renderer rebuilds them with the
      // new sample count on the next render (the texture objects stay valid).
      composer.renderTarget1.dispose();
      composer.renderTarget2.dispose();
    },
    applyCaptureCleanGrade(tiled) {
      // Clean Master: strip post-recoverable lens/film FX + detail-destroying
      // FX so the captured master is sharp and seam-free (removes the per-tile
      // vignette grid / seams). Snapshot the authored values once so the live
      // profile restores exactly on clearCaptureGrade. Idempotent: safe to call
      // every captured frame to override any per-frame applyEnvironment re-enable.
      if (!captureGradeSnapshot) {
        const lens: Record<string, number> = {};
        for (const key of CLEAN_GRADE_ZERO_UNIFORMS) {
          lens[key] = lensGradePass.uniforms[key]?.value as number;
        }
        captureGradeSnapshot = {
          lens,
          bloom: bloomPass.enabled,
          bokeh: bokehPass.enabled,
          tilt: tiltShiftPass.enabled,
          afterimage: afterimagePass.enabled,
          smaa: smaaPass.enabled,
        };
      }
      for (const key of CLEAN_GRADE_ZERO_UNIFORMS) {
        if (lensGradePass.uniforms[key]) lensGradePass.uniforms[key].value = 0;
      }
      bloomPass.enabled = false;
      bokehPass.enabled = false;
      tiltShiftPass.enabled = false;
      afterimagePass.enabled = false;
      // On the tiled route MSAA + the headless 2x superscale already cover edge
      // AA, and per-tile SMAA seams; drop it for tiled clean capture only.
      if (tiled) smaaPass.enabled = false;
    },
    clearCaptureGrade() {
      const snap = captureGradeSnapshot;
      if (!snap) return;
      for (const key of CLEAN_GRADE_ZERO_UNIFORMS) {
        if (lensGradePass.uniforms[key]) {
          lensGradePass.uniforms[key].value = snap.lens[key];
        }
      }
      bloomPass.enabled = snap.bloom;
      bokehPass.enabled = snap.bokeh;
      tiltShiftPass.enabled = snap.tilt;
      afterimagePass.enabled = snap.afterimage;
      smaaPass.enabled = snap.smaa;
      captureGradeSnapshot = null;
    },
    baseBloomStrength,
    setBloomStrength(s) {
      baseBloomStrength = s;
      bloomPass.strength = s;
    },
  };
  Object.defineProperty(handle, "baseBloomStrength", {
    get: () => baseBloomStrength,
    set: (v: number) => {
      baseBloomStrength = v;
      bloomPass.strength = v;
    },
  });
  return handle;
}
