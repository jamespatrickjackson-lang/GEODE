import * as THREE from "three";

function makeBlankMask(): THREE.DataTexture {
  // 1x1 RGBA8 zeros -- shader's lake-mask sample returns 0 everywhere
  // until loadLakes publishes a real mask via setLakeMask().
  const t = new THREE.DataTexture(
    new Uint8Array([0, 0, 0, 0]),
    1,
    1,
    THREE.RGBAFormat,
  );
  t.needsUpdate = true;
  return t;
}

function fogDensityToFar(density: number): number {
  return 3 / Math.max(density, 0.000001);
}

// Stylized terrain shader. Reads world-space elevation (Z, since we're Z-up)
// and produces an elevation-based ramp modulated by hillshade (N·L). Adds a
// subtle deterministic value-noise to break up flat color plateaus so the
// ramp doesn't band visibly at the breakpoints.
//
// The material is created once per terrain mesh; the runtime updates ramp
// colors / sun direction via the public setters. Sun direction must be
// kept in sync with whatever directional light the scene actually uses
// (typically the same vector the Sky shader's sun position points to).

export interface TerrainMaterialParams {
  rampLow?: string;
  rampMid?: string;
  rampHigh?: string;
  elevLowM?: number;
  elevHighM?: number;
  elevationOffsetM?: number;
  surfaceElevationEnabled?: boolean;
  surfaceElevationLegendVisible?: boolean;
  surfaceElevationMinM?: number;
  surfaceElevationMaxM?: number;
  surfaceElevationColors?: string[];
  surfaceElevationColorPositions?: number[];
  surfaceElevationMidpoints?: number[];
  surfaceElevationTransitionSoftness?: number;
  surfaceElevationColorBlend?: number;
  surfaceElevationReverse?: boolean;
  hillshadeIntensity?: number;
  rockHueVariance?: number;
  // Shadow / hillshade definition. 0 = soft Gouraud-style gradient
  // (smooth vertex normals only), 1 = a tighter relief terminator.
  shadowSharpness?: number;
  // Visual triangle/facet reveal. Keep low for smooth regional terrain,
  // increase when the user wants the mesh tessellation to read as faceted
  // shaded relief.
  facetStrength?: number;
  // Softens the finite terrain-tile boundary into the scene atmosphere.
  // This prevents the far mesh edge from reading as a hard black,
  // saw-toothed horizon when fog is disabled or the camera pulls back.
  edgeFadeDistanceM?: number;
  edgeFadeShape?: "square" | "rounded-square" | "circle";
  edgeFadeInsetM?: number;
  edgeFadeCornerRadiusM?: number;
  // Color of shadowed areas. Pure black makes shadows muddy under
  // bloom; a slight cool tint reads as atmospheric.
  shadowTint?: string;
  // Shader-drawn reference grid in world metres. Because it is part of the
  // double-sided terrain material, it remains readable from below the tile.
  gridEnabled?: boolean;
  gridColor?: string;
  gridOpacity?: number;
  gridSpacingM?: number;
  gridLineWidthM?: number;
  undersideOpacity?: number;
  fogEnabled?: boolean;
  fogColor?: string;
  fogNear?: number;
  fogFar?: number;
  fogDensity?: number;
}

export interface TerrainMaterialHandle {
  material: THREE.ShaderMaterial;
  setOpacity(opacity: number): void;
  setSunDirection(dir: THREE.Vector3): void;
  setParams(p: TerrainMaterialParams): void;
  setTerrainFogEnabled(enabled: boolean): void;
  setTerrainFogDensity(density: number): void;
  setTerrainBounds(
    boundsMin: [number, number],
    boundsMax: [number, number],
  ): void;
  // Lake painting: lakes are NOT rendered as separate meshes any more.
  // A rasterized polygon mask is overlaid onto terrain pixels by the
  // fragment shader, recoloring them to lake color where the mask is
  // set. This avoids z-fighting, vertex-normal lighting on the lake
  // surface, and the "crumpled tinfoil" look that previous lake meshes
  // produced.
  setLakeMask(
    texture: THREE.Texture,
    boundsMin: [number, number],
    boundsMax: [number, number],
  ): void;
  setLakeColor(color: string): void;
  setLakeOpacity(opacity: number): void;
  setLakeFogEnabled(enabled: boolean): void;
  setLakeFogDensity(density: number): void;
  // Target glow slots -- additive (rather than replacement) overlays
  // that paint a soft tinted glow on terrain pixels inside a target's
  // mask. Slot IDs the shader knows about: "target-three-firs",
  // "target-great-plains".
  setTargetMask(
    slot: TargetSlotId,
    texture: THREE.Texture,
    boundsMin: [number, number],
    boundsMax: [number, number],
  ): void;
  setTargetColor(slot: TargetSlotId, color: string): void;
  setTargetOpacity(slot: TargetSlotId, opacity: number): void;
  setTargetFogEnabled(slot: TargetSlotId, enabled: boolean): void;
  setTargetFogDensity(slot: TargetSlotId, density: number): void;
  // Claim boundary -- single polygon mask, flat tinted mix onto terrain
  // pixels (same blend math as the target slots, just an additional
  // non-glow channel). No bloom, no lighting modulation.
  setClaimMask(
    texture: THREE.Texture,
    boundsMin: [number, number],
    boundsMax: [number, number],
  ): void;
  setClaimColor(color: string): void;
  setClaimOpacity(opacity: number): void;
  setClaimFogEnabled(enabled: boolean): void;
  setClaimFogDensity(density: number): void;
  // Bedrock geology -- the texture itself carries per-pixel COLOUR
  // (one rasterized colour per stratigraphic unit), not a uniform
  // single-colour mask. Shader samples RGBA and mixes into terrain at
  // the per-texel alpha multiplied by uGeologyOpacity.
  setGeologyMask(
    texture: THREE.Texture,
    boundsMin: [number, number],
    boundsMax: [number, number],
  ): void;
  setGeologyOpacity(opacity: number): void;
  setGeologyFogEnabled(enabled: boolean): void;
  setGeologyFogDensity(density: number): void;
  // VRI forest cover -- mask texture stores the dissolved forest body in
  // the red channel. This keeps tree cover map-like and terrain-painted
  // instead of rendering thousands of symbolic 3D trees.
  setForestMask(
    texture: THREE.Texture,
    boundsMin: [number, number],
    boundsMax: [number, number],
  ): void;
  setForestColor(color: string): void;
  setForestOutlineColor(color: string): void;
  setForestFillOpacity(opacity: number): void;
  setForestOutlineOpacity(opacity: number): void;
  setForestEdge(threshold: number, softness: number): void;
  setForestFogEnabled(enabled: boolean): void;
  setForestFogDensity(density: number): void;
  setPublicClip(
    enabled: boolean,
    shape: "box" | "circle",
    center: THREE.Vector3,
    halfSize: THREE.Vector3,
    rotationZRad: number,
  ): void;
}

export type TargetSlotId = "target-three-firs" | "target-great-plains";

const DEFAULT_SURFACE_ELEVATION_COLORS = [
  "#5147b8",
  "#2e8fd8",
  "#4fc3c7",
  "#93d66b",
  "#fff24d",
] as const;
const DEFAULT_SURFACE_ELEVATION_POSITIONS = [0, 0.25, 0.5, 0.75, 1] as const;
const DEFAULT_SURFACE_ELEVATION_MIDPOINTS = [0.5, 0.5, 0.5, 0.5] as const;
const SURFACE_ELEVATION_STOP_GAP = 0.01;

function makeSurfaceElevationColors(colors?: string[]): THREE.Color[] {
  return Array.from({ length: 5 }, (_, index) => {
    return new THREE.Color(
      colors?.[index] ?? DEFAULT_SURFACE_ELEVATION_COLORS[index],
    );
  });
}

function applySurfaceElevationColors(
  target: THREE.Color[],
  colors: string[] | undefined,
): void {
  for (let index = 0; index < 5; index += 1) {
    target[index].set(
      colors?.[index] ?? DEFAULT_SURFACE_ELEVATION_COLORS[index],
    );
  }
}

function makeSurfaceElevationPositions(values?: number[]): number[] {
  let previous = 0;
  return Array.from({ length: 5 }, (_, index) => {
    const fallback = DEFAULT_SURFACE_ELEVATION_POSITIONS[index];
    const raw =
      typeof values?.[index] === "number" && Number.isFinite(values[index])
        ? values[index]
        : fallback;
    const remaining = 4 - index;
    const min = index === 0 ? 0 : previous + SURFACE_ELEVATION_STOP_GAP;
    const max = 1 - remaining * SURFACE_ELEVATION_STOP_GAP;
    const next = THREE.MathUtils.clamp(raw, min, max);
    previous = next;
    return next;
  });
}

function applySurfaceElevationPositions(
  target: number[],
  values: number[] | undefined,
): void {
  const next = makeSurfaceElevationPositions(values);
  for (let index = 0; index < 5; index += 1) target[index] = next[index];
}

function makeSurfaceElevationMidpoints(values?: number[]): number[] {
  return Array.from({ length: 4 }, (_, index) => {
    const raw =
      typeof values?.[index] === "number" && Number.isFinite(values[index])
        ? values[index]
        : DEFAULT_SURFACE_ELEVATION_MIDPOINTS[index];
    return THREE.MathUtils.clamp(raw, 0.05, 0.95);
  });
}

function applySurfaceElevationMidpoints(
  target: number[],
  values: number[] | undefined,
): void {
  const next = makeSurfaceElevationMidpoints(values);
  for (let index = 0; index < 4; index += 1) target[index] = next[index];
}

function edgeFadeShapeValue(
  shape: TerrainMaterialParams["edgeFadeShape"],
): number {
  if (shape === "rounded-square") return 1;
  if (shape === "circle") return 2;
  return 0;
}

export function buildTerrainMaterial(
  initial: TerrainMaterialParams = {},
): TerrainMaterialHandle {
  const uniforms = {
    uOpacity: { value: 1 },
    uRampLow: { value: new THREE.Color(initial.rampLow ?? "#3d3a30") },
    uRampMid: { value: new THREE.Color(initial.rampMid ?? "#7a6a4f") },
    uRampHigh: { value: new THREE.Color(initial.rampHigh ?? "#c4b58c") },
    uElevLow: { value: initial.elevLowM ?? 800 },
    uElevHigh: { value: initial.elevHighM ?? 1450 },
    uElevationOffsetM: { value: initial.elevationOffsetM ?? 1000 },
    uSurfaceElevationEnabled: {
      value: initial.surfaceElevationEnabled === true ? 1 : 0,
    },
    uSurfaceElevationMin: { value: initial.surfaceElevationMinM ?? 1500 },
    uSurfaceElevationMax: { value: initial.surfaceElevationMaxM ?? 3500 },
    uSurfaceElevationColors: {
      value: makeSurfaceElevationColors(initial.surfaceElevationColors),
    },
    uSurfaceElevationPositions: {
      value: makeSurfaceElevationPositions(
        initial.surfaceElevationColorPositions,
      ),
    },
    uSurfaceElevationMidpoints: {
      value: makeSurfaceElevationMidpoints(initial.surfaceElevationMidpoints),
    },
    uSurfaceElevationTransitionSoftness: {
      value: THREE.MathUtils.clamp(
        initial.surfaceElevationTransitionSoftness ?? 1,
        0,
        1,
      ),
    },
    uSurfaceElevationColorBlend: {
      value: THREE.MathUtils.clamp(
        initial.surfaceElevationColorBlend ?? 1,
        0,
        1,
      ),
    },
    uSurfaceElevationReverse: {
      value: initial.surfaceElevationReverse === true ? 1 : 0,
    },
    uHillshade: { value: initial.hillshadeIntensity ?? 0.9 },
    uHueVariance: { value: initial.rockHueVariance ?? 0.06 },
    uSunDir: { value: new THREE.Vector3(0.6, -0.4, 0.7).normalize() },
    // Lifted ambient floor (was 0x3a4555). Shadow side of terrain must
    // always carry visible hillshade detail regardless of camera angle --
    // collapsing to flat black at grazing angles was the bug we were
    // patching with "lock to view." Real fix is here: a floor that
    // never lets the shaded side go below readable.
    uAmbient: { value: new THREE.Color(0x5a6878) },
    uShadowSharpness: { value: initial.shadowSharpness ?? 0.45 },
    uFacetStrength: { value: initial.facetStrength ?? 0.12 },
    uEdgeFadeDistance: { value: initial.edgeFadeDistanceM ?? 0 },
    uEdgeFadeShape: { value: edgeFadeShapeValue(initial.edgeFadeShape) },
    uEdgeFadeInset: { value: Math.max(0, initial.edgeFadeInsetM ?? 0) },
    uEdgeFadeCornerRadius: {
      value: Math.max(0, initial.edgeFadeCornerRadiusM ?? 0),
    },
    uTerrainBoundsMin: { value: new THREE.Vector2(-1, -1) },
    uTerrainBoundsMax: { value: new THREE.Vector2(1, 1) },
    uShadowTint: { value: new THREE.Color(initial.shadowTint ?? "#3a3f4d") },
    uFogEnabled: { value: initial.fogEnabled === false ? 0 : 1 },
    uFogColor: { value: new THREE.Color(initial.fogColor ?? "#0e1318") },
    uFogNear: { value: initial.fogNear ?? 8000 },
    uFogFar: {
      value: initial.fogFar ?? fogDensityToFar(initial.fogDensity ?? 0.00018),
    },
    uGridEnabled: { value: initial.gridEnabled === false ? 0 : 1 },
    uGridColor: { value: new THREE.Color(initial.gridColor ?? "#f1dec0") },
    uGridOpacity: { value: initial.gridOpacity ?? 0.18 },
    uGridSpacing: { value: initial.gridSpacingM ?? 1000 },
    uGridLineWidth: { value: initial.gridLineWidthM ?? 18 },
    uUndersideOpacity: { value: initial.undersideOpacity ?? 0 },
    // Lake mask defaults to a 1x1 transparent texture so the shader can
    // sample it unconditionally. uLakeOpacity defaults to 0 so no lake
    // paint shows until the real mask is plugged in.
    uLakeMask: { value: makeBlankMask() as THREE.Texture },
    uLakeBoundsMin: { value: new THREE.Vector2(0, 0) },
    uLakeBoundsMax: { value: new THREE.Vector2(1, 1) },
    uLakeColor: { value: new THREE.Color("#1a2530") },
    uLakeOpacity: { value: 0 },
    uLakeFogEnabled: { value: 1 },
    uLakeFogFar: { value: fogDensityToFar(initial.fogDensity ?? 0.00018) },
    // Target glow slot 0 -- Three Firs by convention.
    uTarget0Mask: { value: makeBlankMask() as THREE.Texture },
    uTarget0BoundsMin: { value: new THREE.Vector2(0, 0) },
    uTarget0BoundsMax: { value: new THREE.Vector2(1, 1) },
    uTarget0Color: { value: new THREE.Color("#ff5a8a") },
    uTarget0Opacity: { value: 0 },
    uTarget0FogEnabled: { value: 1 },
    uTarget0FogFar: { value: fogDensityToFar(initial.fogDensity ?? 0.00018) },
    // Target glow slot 1 -- Great Plains by convention.
    uTarget1Mask: { value: makeBlankMask() as THREE.Texture },
    uTarget1BoundsMin: { value: new THREE.Vector2(0, 0) },
    uTarget1BoundsMax: { value: new THREE.Vector2(1, 1) },
    uTarget1Color: { value: new THREE.Color("#9a6cff") },
    uTarget1Opacity: { value: 0 },
    uTarget1FogEnabled: { value: 1 },
    uTarget1FogFar: { value: fogDensityToFar(initial.fogDensity ?? 0.00018) },
    // Claim boundary -- consolidated property polygon. Same flat-mix
    // blend as targets, separate channel so it composes independently.
    uClaimMask: { value: makeBlankMask() as THREE.Texture },
    uClaimBoundsMin: { value: new THREE.Vector2(0, 0) },
    uClaimBoundsMax: { value: new THREE.Vector2(1, 1) },
    uClaimColor: { value: new THREE.Color("#e8d8b0") },
    uClaimOpacity: { value: 0 },
    uClaimFogEnabled: { value: 1 },
    uClaimFogFar: { value: fogDensityToFar(initial.fogDensity ?? 0.00018) },
    // Bedrock geology -- per-pixel colour carried in the mask texture
    // itself (RGBA). Shader composites by mixing texel.rgb into surface
    // at texel.a * uGeologyOpacity.
    uGeologyMask: { value: makeBlankMask() as THREE.Texture },
    uGeologyBoundsMin: { value: new THREE.Vector2(0, 0) },
    uGeologyBoundsMax: { value: new THREE.Vector2(1, 1) },
    uGeologyOpacity: { value: 0 },
    uGeologyFogEnabled: { value: 1 },
    uGeologyFogFar: { value: fogDensityToFar(initial.fogDensity ?? 0.00018) },
    // VRI forest-cover body. Texture channel: R = dissolved polygon body,
    // including its smooth outer/no-data edge.
    uForestMask: { value: makeBlankMask() as THREE.Texture },
    uForestBoundsMin: { value: new THREE.Vector2(0, 0) },
    uForestBoundsMax: { value: new THREE.Vector2(1, 1) },
    uForestColor: { value: new THREE.Color("#4fa563") },
    uForestOutlineColor: { value: new THREE.Color("#143a20") },
    uForestFillOpacity: { value: 0 },
    uForestOutlineOpacity: { value: 0 },
    uForestEdgeThreshold: { value: 0.5 },
    uForestEdgeSoftness: { value: 0.035 },
    uForestFogEnabled: { value: 1 },
    uForestFogFar: { value: fogDensityToFar(initial.fogDensity ?? 0.00018) },
    uPublicClipEnabled: { value: 0 },
    uPublicClipShape: { value: 0 },
    uPublicClipCenter: { value: new THREE.Vector3(0, 0, 0) },
    uPublicClipHalfSize: { value: new THREE.Vector3(1, 1, 1) },
    uPublicClipCosSin: { value: new THREE.Vector2(1, 0) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        // World-space normal. Three.js's built-in normalMatrix is the
        // inverse-transpose of MODELVIEW, so it produces a VIEW-space
        // normal -- the lambertian dot below uses uSunDir in world
        // space, so a view-space normal made shading view-dependent
        // (dark patches that drift across terrain as the camera
        // orbited). mat3(modelMatrix) keeps everything in world space.
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uRampLow;
      uniform vec3 uRampMid;
      uniform vec3 uRampHigh;
      uniform float uElevLow;
      uniform float uElevHigh;
      uniform float uElevationOffsetM;
      uniform float uSurfaceElevationEnabled;
      uniform float uSurfaceElevationMin;
      uniform float uSurfaceElevationMax;
      uniform vec3 uSurfaceElevationColors[5];
      uniform float uSurfaceElevationPositions[5];
      uniform float uSurfaceElevationMidpoints[4];
      uniform float uSurfaceElevationTransitionSoftness;
      uniform float uSurfaceElevationColorBlend;
      uniform float uSurfaceElevationReverse;
      uniform float uHillshade;
      uniform float uHueVariance;
      uniform vec3 uSunDir;
      uniform vec3 uAmbient;
      uniform float uShadowSharpness;
      uniform float uFacetStrength;
      uniform float uEdgeFadeDistance;
      uniform float uEdgeFadeShape;
      uniform float uEdgeFadeInset;
      uniform float uEdgeFadeCornerRadius;
      uniform vec2 uTerrainBoundsMin;
      uniform vec2 uTerrainBoundsMax;
      uniform vec3 uShadowTint;
      uniform float uFogEnabled;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uGridEnabled;
      uniform vec3 uGridColor;
      uniform float uGridOpacity;
      uniform float uGridSpacing;
      uniform float uGridLineWidth;
      uniform float uUndersideOpacity;
      uniform sampler2D uLakeMask;
      uniform vec2 uLakeBoundsMin;
      uniform vec2 uLakeBoundsMax;
      uniform vec3 uLakeColor;
      uniform float uLakeOpacity;
      uniform float uLakeFogEnabled;
      uniform float uLakeFogFar;
      uniform sampler2D uTarget0Mask;
      uniform vec2 uTarget0BoundsMin;
      uniform vec2 uTarget0BoundsMax;
      uniform vec3 uTarget0Color;
      uniform float uTarget0Opacity;
      uniform float uTarget0FogEnabled;
      uniform float uTarget0FogFar;
      uniform sampler2D uTarget1Mask;
      uniform vec2 uTarget1BoundsMin;
      uniform vec2 uTarget1BoundsMax;
      uniform vec3 uTarget1Color;
      uniform float uTarget1Opacity;
      uniform float uTarget1FogEnabled;
      uniform float uTarget1FogFar;
      uniform sampler2D uClaimMask;
      uniform vec2 uClaimBoundsMin;
      uniform vec2 uClaimBoundsMax;
      uniform vec3 uClaimColor;
      uniform float uClaimOpacity;
      uniform float uClaimFogEnabled;
      uniform float uClaimFogFar;
      uniform sampler2D uGeologyMask;
      uniform vec2 uGeologyBoundsMin;
      uniform vec2 uGeologyBoundsMax;
      uniform float uGeologyOpacity;
      uniform float uGeologyFogEnabled;
      uniform float uGeologyFogFar;
      uniform sampler2D uForestMask;
      uniform vec2 uForestBoundsMin;
      uniform vec2 uForestBoundsMax;
      uniform vec3 uForestColor;
      uniform vec3 uForestOutlineColor;
      uniform float uForestFillOpacity;
      uniform float uForestOutlineOpacity;
      uniform float uForestEdgeThreshold;
      uniform float uForestEdgeSoftness;
      uniform float uForestFogEnabled;
      uniform float uForestFogFar;
      uniform float uPublicClipEnabled;
      uniform float uPublicClipShape;
      uniform vec3 uPublicClipCenter;
      uniform vec3 uPublicClipHalfSize;
      uniform vec2 uPublicClipCosSin;

      varying vec3 vWorldPos;
      varying vec3 vNormal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x)
                              + (d - b) * u.x * u.y;
      }
      float gridMask(vec2 worldXY, float spacing, float lineWidth) {
        float safeSpacing = max(spacing, 1.0);
        float halfWidth = max(lineWidth * 0.5, 0.01);
        vec2 cell = abs(fract(worldXY / safeSpacing + 0.5) - 0.5) *
                    safeSpacing;
        float distToLine = min(cell.x, cell.y);
        float aa = max(fwidth(distToLine), 1.0);
        return 1.0 - smoothstep(halfWidth, halfWidth + aa, distToLine);
      }

      float surfaceElevationEase(float x) {
        float clamped = clamp(x, 0.0, 1.0);
        float stepped = step(0.5, clamped);
        float smoothed = smoothstep(0.0, 1.0, clamped);
        float softness = clamp(uSurfaceElevationTransitionSoftness, 0.0, 1.0);
        if (softness < 0.5) {
          return mix(stepped, clamped, softness * 2.0);
        }
        return mix(clamped, smoothed, (softness - 0.5) * 2.0);
      }

      float surfaceElevationMidpointBias(float x, float midpoint) {
        float m = clamp(midpoint, 0.05, 0.95);
        if (x < m) {
          return 0.5 * x / max(m, 0.0001);
        }
        return 0.5 + 0.5 * (x - m) / max(1.0 - m, 0.0001);
      }

      vec3 surfaceElevationRampSegment(
        float t,
        float left,
        float right,
        vec3 leftColor,
        vec3 rightColor,
        float midpoint
      ) {
        float localT = (t - left) / max(right - left, 0.0001);
        float biasedT = surfaceElevationMidpointBias(localT, midpoint);
        return mix(leftColor, rightColor, surfaceElevationEase(biasedT));
      }

      vec3 surfaceElevationRamp(float t) {
        float x = clamp(t, 0.0, 1.0);
        float p0 = clamp(uSurfaceElevationPositions[0], 0.0, 1.0);
        float p1 = clamp(uSurfaceElevationPositions[1], p0 + 0.0001, 1.0);
        float p2 = clamp(uSurfaceElevationPositions[2], p1 + 0.0001, 1.0);
        float p3 = clamp(uSurfaceElevationPositions[3], p2 + 0.0001, 1.0);
        float p4 = clamp(uSurfaceElevationPositions[4], p3 + 0.0001, 1.0);
        if (x <= p0) return uSurfaceElevationColors[0];
        if (x < p1) {
          return surfaceElevationRampSegment(
            x,
            p0,
            p1,
            uSurfaceElevationColors[0],
            uSurfaceElevationColors[1],
            uSurfaceElevationMidpoints[0]
          );
        }
        if (x < p2) {
          return surfaceElevationRampSegment(
            x,
            p1,
            p2,
            uSurfaceElevationColors[1],
            uSurfaceElevationColors[2],
            uSurfaceElevationMidpoints[1]
          );
        }
        if (x < p3) {
          return surfaceElevationRampSegment(
            x,
            p2,
            p3,
            uSurfaceElevationColors[2],
            uSurfaceElevationColors[3],
            uSurfaceElevationMidpoints[2]
          );
        }
        if (x < p4) {
          return surfaceElevationRampSegment(
            x,
            p3,
            p4,
            uSurfaceElevationColors[3],
            uSurfaceElevationColors[4],
            uSurfaceElevationMidpoints[3]
          );
        }
        return uSurfaceElevationColors[4];
      }

      void main() {
        if (uPublicClipEnabled > 0.5) {
          vec3 rel = vWorldPos - uPublicClipCenter;
          vec2 localXY = vec2(
            dot(rel.xy, vec2(uPublicClipCosSin.x, uPublicClipCosSin.y)),
            dot(rel.xy, vec2(-uPublicClipCosSin.y, uPublicClipCosSin.x))
          );
          vec3 localPos = vec3(localXY, rel.z);
          if (abs(localPos.z) > uPublicClipHalfSize.z) {
            discard;
          }
          if (uPublicClipShape > 0.5) {
            float radius = min(uPublicClipHalfSize.x, uPublicClipHalfSize.y);
            if (length(localPos.xy) > radius) {
              discard;
            }
          } else {
            if (
              abs(localPos.x) > uPublicClipHalfSize.x ||
              abs(localPos.y) > uPublicClipHalfSize.y
            ) {
              discard;
            }
          }
        }

        // Elevation ramp.
        float elev = vWorldPos.z + uElevationOffsetM;
        float t = clamp(
          (elev - uElevLow) / max(0.0001, uElevHigh - uElevLow),
          0.0,
          1.0
        );
        vec3 base;
        if (t < 0.5) {
          base = mix(uRampLow, uRampMid, smoothstep(0.0, 1.0, t * 2.0));
        } else {
          base = mix(uRampMid, uRampHigh,
                     smoothstep(0.0, 1.0, (t - 0.5) * 2.0));
        }
        vec3 topoBase = base;
        if (uSurfaceElevationEnabled > 0.5) {
          float elevationT = clamp(
            (elev - uSurfaceElevationMin) /
              max(0.0001, uSurfaceElevationMax - uSurfaceElevationMin),
            0.0,
            1.0
          );
          if (uSurfaceElevationReverse > 0.5) {
            elevationT = 1.0 - elevationT;
          }
          base = mix(
            topoBase,
            surfaceElevationRamp(elevationT),
            clamp(uSurfaceElevationColorBlend, 0.0, 1.0)
          );
        }
        float n = noise(vWorldPos.xy * 0.0015) - 0.5;
        base *= 1.0 + n * uHueVariance;

        // Per-pixel facet normal via screen-space world-position
        // derivatives. Sharper than the Gouraud-interpolated vertex
        // normal -- reads as actual terrain triangulation rather than a
        // soft gradient.
        vec3 dPdx = dFdx(vWorldPos);
        vec3 dPdy = dFdy(vWorldPos);
        vec3 facetN = normalize(cross(dPdx, dPdy));
        vec3 vertexN = normalize(vNormal);
        if (dot(facetN, vertexN) < 0.0) facetN = -facetN;
        vec3 N = normalize(mix(vertexN, facetN, uFacetStrength));

        vec3 L = normalize(uSunDir);
        float ndl = dot(N, L);

        // Single-color modulation -- base color always carries through.
        // The previous shader mixed between base*shadowTint (dark) and
        // base*hillshade (bright) using a sharp terminator, which let
        // back-facing facets crash to near-zero on per-feature ridges.
        // Now: lambertian is sqrt-compressed (lifts dark values) and
        // mixed against a 0.55 floor, so shadow side is *modulated*,
        // not erased. Color information stays visible everywhere.
        float lambert = clamp(ndl, 0.0, 1.0);
        float litCompressed = sqrt(lambert);
        float litAmount = mix(0.55, 1.0, litCompressed);

        // Sharpness scales the lit-side boost above 1.0 for crisper
        // relief on the sun-facing slopes WITHOUT pulling the shadow
        // floor down.
        litAmount += uShadowSharpness * 0.4 * litCompressed;

        vec3 surface = base * (uAmbient * 0.55 + uHillshade * litAmount);

        // Subtle atmospheric tint on the shadow side -- multiplied at
        // very low blend weight so it cools the shadows slightly without
        // muting their color. Capped at 12% mix at full shadow.
        float shadowAmount = 1.0 - litCompressed;
        surface = mix(surface, surface * uShadowTint * 2.5, shadowAmount * 0.12);

        // Ridge highlight on cliff facets -- pure additive so it can't
        // pull surface darker. Scales with sharpness.
        float slope = 1.0 - clamp(facetN.z, 0.0, 1.0);
        surface += base * pow(slope, 5.0) * litCompressed * 0.4 *
                   uFacetStrength;
        vec3 terrainSurface = surface;

        // Lake painting -- recolors terrain pixels where the rasterized
        // lake mask is set. Lakes are NOT separate meshes; they're
        // terrain pixels with a different color. Mask UV maps the
        // pixel's scene XY into the mask texture's bounds. Hillshade
        // is preserved (multiplied through) so lakes still pick up
        // sun direction and read as part of the terrain surface.
        if (uLakeOpacity > 0.001) {
          vec2 lakeUv = (vWorldPos.xy - uLakeBoundsMin) /
                       (uLakeBoundsMax - uLakeBoundsMin);
          if (lakeUv.x >= 0.0 && lakeUv.x <= 1.0 &&
              lakeUv.y >= 0.0 && lakeUv.y <= 1.0) {
            float lakeMaskAlpha = texture2D(uLakeMask, lakeUv).a;
            // Modulate lake color by the same lighting term so it sits
            // visually with the rest of the terrain.
            vec3 lakeShaded = uLakeColor * (uAmbient * 0.55 + uHillshade * litAmount);
            surface = mix(
              surface,
              lakeShaded,
              lakeMaskAlpha * uLakeOpacity
            );
          }
        }

        // Target zone fills -- flat solid color mixed into terrain at the
        // layer's opacity. NOT additive; not lighting-modulated. Reads
        // as a translucent coloured film over the map, not a glow.
        // Glow comes exclusively from the emissive ring outline +
        // bloom on its own line geometry.
        if (uTarget0Opacity > 0.001) {
          vec2 t0Uv = (vWorldPos.xy - uTarget0BoundsMin) /
                     (uTarget0BoundsMax - uTarget0BoundsMin);
          if (t0Uv.x >= 0.0 && t0Uv.x <= 1.0 &&
              t0Uv.y >= 0.0 && t0Uv.y <= 1.0) {
            float a = texture2D(uTarget0Mask, t0Uv).a;
            surface = mix(surface, uTarget0Color, a * uTarget0Opacity);
          }
        }
        if (uTarget1Opacity > 0.001) {
          vec2 t1Uv = (vWorldPos.xy - uTarget1BoundsMin) /
                     (uTarget1BoundsMax - uTarget1BoundsMin);
          if (t1Uv.x >= 0.0 && t1Uv.x <= 1.0 &&
              t1Uv.y >= 0.0 && t1Uv.y <= 1.0) {
            float a = texture2D(uTarget1Mask, t1Uv).a;
            surface = mix(surface, uTarget1Color, a * uTarget1Opacity);
          }
        }

        // Bedrock geology -- per-pixel colour wash. The texture carries
        // BCGS canonical colours per stratigraphic unit; we sample the
        // RGBA and mix into surface at texel.a * uGeologyOpacity.
        // Composited BEFORE the target / claim slots so those tints
        // still read on top of any geology colour they overlap.
        if (uGeologyOpacity > 0.001) {
          vec2 gUv = (vWorldPos.xy - uGeologyBoundsMin) /
                    (uGeologyBoundsMax - uGeologyBoundsMin);
          if (gUv.x >= 0.0 && gUv.x <= 1.0 &&
              gUv.y >= 0.0 && gUv.y <= 1.0) {
            vec4 g = texture2D(uGeologyMask, gUv);
            surface = mix(surface, g.rgb, g.a * uGeologyOpacity);
          }
        }

        // Claim boundary -- flat tinted wash over terrain inside the
        // dissolved property polygon. Mixed BEFORE targets composite so
        // a target glow inside the property still reads on top of the
        // tint... actually we placed it after targets above; this is
        // fine because target opacity is much higher than claim.
        // Mathematically commutative for low opacities.
        if (uClaimOpacity > 0.001) {
          vec2 cUv = (vWorldPos.xy - uClaimBoundsMin) /
                    (uClaimBoundsMax - uClaimBoundsMin);
          if (cUv.x >= 0.0 && cUv.x <= 1.0 &&
              cUv.y >= 0.0 && cUv.y <= 1.0) {
            float a = texture2D(uClaimMask, cUv).a;
            surface = mix(surface, uClaimColor, a * uClaimOpacity);
          }
        }

        // Back side readability: when the camera moves below the map tile,
        // keep a terrain-colour floor instead of letting the underside become
        // a dark stencil where only the grid reads.
        // Distance fog -- ties terrain into atmospheric haze near far edges.
        surface = terrainSurface;
        float depth = length(vWorldPos.xy);
        float fogF = clamp((depth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0) *
                     clamp(uFogEnabled, 0.0, 1.0);
        surface = mix(surface, uFogColor, fogF);

        // Terrain-composited layers are painted after the terrain fog pass so
        // each layer can use its own fog density or skip fog entirely.
        if (uLakeOpacity > 0.001) {
          vec2 lakeUv = (vWorldPos.xy - uLakeBoundsMin) /
                       (uLakeBoundsMax - uLakeBoundsMin);
          if (lakeUv.x >= 0.0 && lakeUv.x <= 1.0 &&
              lakeUv.y >= 0.0 && lakeUv.y <= 1.0) {
            float lakeMaskAlpha = texture2D(uLakeMask, lakeUv).a;
            vec3 lakeShaded = uLakeColor * (uAmbient * 0.55 + uHillshade * litAmount);
            float lakeFogF = clamp((depth - uFogNear) / (uLakeFogFar - uFogNear), 0.0, 1.0) *
                             clamp(uLakeFogEnabled, 0.0, 1.0);
            lakeShaded = mix(lakeShaded, uFogColor, lakeFogF);
            surface = mix(surface, lakeShaded, lakeMaskAlpha * uLakeOpacity);
          }
        }
        if (uTarget0Opacity > 0.001) {
          vec2 t0Uv = (vWorldPos.xy - uTarget0BoundsMin) /
                     (uTarget0BoundsMax - uTarget0BoundsMin);
          if (t0Uv.x >= 0.0 && t0Uv.x <= 1.0 &&
              t0Uv.y >= 0.0 && t0Uv.y <= 1.0) {
            float a = texture2D(uTarget0Mask, t0Uv).a;
            float targetFogF = clamp((depth - uFogNear) / (uTarget0FogFar - uFogNear), 0.0, 1.0) *
                               clamp(uTarget0FogEnabled, 0.0, 1.0);
            vec3 targetColor = mix(uTarget0Color, uFogColor, targetFogF);
            surface = mix(surface, targetColor, a * uTarget0Opacity);
          }
        }
        if (uTarget1Opacity > 0.001) {
          vec2 t1Uv = (vWorldPos.xy - uTarget1BoundsMin) /
                     (uTarget1BoundsMax - uTarget1BoundsMin);
          if (t1Uv.x >= 0.0 && t1Uv.x <= 1.0 &&
              t1Uv.y >= 0.0 && t1Uv.y <= 1.0) {
            float a = texture2D(uTarget1Mask, t1Uv).a;
            float targetFogF = clamp((depth - uFogNear) / (uTarget1FogFar - uFogNear), 0.0, 1.0) *
                               clamp(uTarget1FogEnabled, 0.0, 1.0);
            vec3 targetColor = mix(uTarget1Color, uFogColor, targetFogF);
            surface = mix(surface, targetColor, a * uTarget1Opacity);
          }
        }
        if (uGeologyOpacity > 0.001) {
          vec2 gUv = (vWorldPos.xy - uGeologyBoundsMin) /
                    (uGeologyBoundsMax - uGeologyBoundsMin);
          if (gUv.x >= 0.0 && gUv.x <= 1.0 &&
              gUv.y >= 0.0 && gUv.y <= 1.0) {
            vec4 g = texture2D(uGeologyMask, gUv);
            float geologyFogF = clamp((depth - uFogNear) / (uGeologyFogFar - uFogNear), 0.0, 1.0) *
                                clamp(uGeologyFogEnabled, 0.0, 1.0);
            vec3 geologyColor = mix(g.rgb, uFogColor, geologyFogF);
            surface = mix(surface, geologyColor, g.a * uGeologyOpacity);
          }
        }
        if (uClaimOpacity > 0.001) {
          vec2 cUv = (vWorldPos.xy - uClaimBoundsMin) /
                    (uClaimBoundsMax - uClaimBoundsMin);
          if (cUv.x >= 0.0 && cUv.x <= 1.0 &&
              cUv.y >= 0.0 && cUv.y <= 1.0) {
            float a = texture2D(uClaimMask, cUv).a;
            float claimFogF = clamp((depth - uFogNear) / (uClaimFogFar - uFogNear), 0.0, 1.0) *
                              clamp(uClaimFogEnabled, 0.0, 1.0);
            vec3 claimColor = mix(uClaimColor, uFogColor, claimFogF);
            surface = mix(surface, claimColor, a * uClaimOpacity);
          }
        }
        if (uForestFillOpacity > 0.001 || uForestOutlineOpacity > 0.001) {
          vec2 fUv = (vWorldPos.xy - uForestBoundsMin) /
                    (uForestBoundsMax - uForestBoundsMin);
          if (fUv.x >= 0.0 && fUv.x <= 1.0 &&
              fUv.y >= 0.0 && fUv.y <= 1.0) {
            vec4 f = texture2D(uForestMask, fUv);
            float forestMaskRaw = max(f.r, f.g);
            float forestMask = step(uForestEdgeThreshold, forestMaskRaw);
            if (uForestEdgeSoftness > 0.0005) {
              forestMask = smoothstep(
                uForestEdgeThreshold - uForestEdgeSoftness,
                uForestEdgeThreshold + uForestEdgeSoftness,
                forestMaskRaw
              );
            }
            float forestOpacity = max(uForestFillOpacity, uForestOutlineOpacity);
            float forestFogF = clamp((depth - uFogNear) / (uForestFogFar - uFogNear), 0.0, 1.0) *
                               clamp(uForestFogEnabled, 0.0, 1.0);
            vec3 forestColor = mix(uForestColor, uFogColor, forestFogF);
            surface = mix(surface, forestColor, forestMask * forestOpacity);
          }
        }

        if (uEdgeFadeDistance > 1.0) {
          vec2 terrainCenter = (uTerrainBoundsMin + uTerrainBoundsMax) * 0.5;
          vec2 terrainHalfSize = max(
            (uTerrainBoundsMax - uTerrainBoundsMin) * 0.5 - vec2(max(uEdgeFadeInset, 0.0)),
            vec2(1.0)
          );
          vec2 localPos = vWorldPos.xy - terrainCenter;
          float insideDist;
          if (uEdgeFadeShape > 1.5) {
            float radius = min(terrainHalfSize.x, terrainHalfSize.y);
            insideDist = radius - length(localPos);
          } else if (uEdgeFadeShape > 0.5) {
            float radius = clamp(
              uEdgeFadeCornerRadius,
              0.0,
              max(0.0, min(terrainHalfSize.x, terrainHalfSize.y) - 1.0)
            );
            vec2 q = abs(localPos) - (terrainHalfSize - vec2(radius));
            float signedDist =
              length(max(q, vec2(0.0))) +
              min(max(q.x, q.y), 0.0) -
              radius;
            insideDist = -signedDist;
          } else {
            insideDist = min(
              terrainHalfSize.x - abs(localPos.x),
              terrainHalfSize.y - abs(localPos.y)
            );
          }
          float edgeFade = smoothstep(0.0, uEdgeFadeDistance, insideDist);
          surface = mix(uFogColor, surface, clamp(edgeFade, 0.0, 1.0));
        }

        // Underside reference grid only. The top face stays clean for map
        // reading; when the camera moves below the tile, the same terrain
        // surface remains visible with a grid to orient position.
        if (!gl_FrontFacing) {
          float alpha = clamp(max(uUndersideOpacity, uOpacity), 0.0, 1.0);
          gl_FragColor = vec4(surface, alpha);
          return;
        }

        gl_FragColor = vec4(surface, clamp(uOpacity, 0.0, 1.0));
      }
    `,
  });
  material.userData.terrainMaterial = true;
  material.transparent = true;

  return {
    material,
    setOpacity(opacity) {
      const next = THREE.MathUtils.clamp(opacity, 0, 1);
      uniforms.uOpacity.value = next;
      material.opacity = next;
      material.transparent = true;
      material.depthWrite = next >= 0.999;
      material.needsUpdate = true;
    },
    setSunDirection(dir) {
      uniforms.uSunDir.value.copy(dir);
    },
    setParams(p) {
      if (p.rampLow) uniforms.uRampLow.value.set(p.rampLow);
      if (p.rampMid) uniforms.uRampMid.value.set(p.rampMid);
      if (p.rampHigh) uniforms.uRampHigh.value.set(p.rampHigh);
      if (typeof p.elevLowM === "number") uniforms.uElevLow.value = p.elevLowM;
      if (typeof p.elevHighM === "number")
        uniforms.uElevHigh.value = p.elevHighM;
      if (typeof p.elevationOffsetM === "number")
        uniforms.uElevationOffsetM.value = p.elevationOffsetM;
      if (typeof p.surfaceElevationEnabled === "boolean")
        uniforms.uSurfaceElevationEnabled.value = p.surfaceElevationEnabled
          ? 1
          : 0;
      if (typeof p.surfaceElevationMinM === "number")
        uniforms.uSurfaceElevationMin.value = p.surfaceElevationMinM;
      if (typeof p.surfaceElevationMaxM === "number")
        uniforms.uSurfaceElevationMax.value = p.surfaceElevationMaxM;
      if (Array.isArray(p.surfaceElevationColors)) {
        applySurfaceElevationColors(
          uniforms.uSurfaceElevationColors.value,
          p.surfaceElevationColors,
        );
      }
      if (Array.isArray(p.surfaceElevationColorPositions)) {
        applySurfaceElevationPositions(
          uniforms.uSurfaceElevationPositions.value,
          p.surfaceElevationColorPositions,
        );
      }
      if (Array.isArray(p.surfaceElevationMidpoints)) {
        applySurfaceElevationMidpoints(
          uniforms.uSurfaceElevationMidpoints.value,
          p.surfaceElevationMidpoints,
        );
      }
      if (typeof p.surfaceElevationTransitionSoftness === "number") {
        uniforms.uSurfaceElevationTransitionSoftness.value =
          THREE.MathUtils.clamp(p.surfaceElevationTransitionSoftness, 0, 1);
      }
      if (typeof p.surfaceElevationColorBlend === "number") {
        uniforms.uSurfaceElevationColorBlend.value = THREE.MathUtils.clamp(
          p.surfaceElevationColorBlend,
          0,
          1,
        );
      }
      if (typeof p.surfaceElevationReverse === "boolean")
        uniforms.uSurfaceElevationReverse.value = p.surfaceElevationReverse
          ? 1
          : 0;
      if (typeof p.hillshadeIntensity === "number")
        uniforms.uHillshade.value = p.hillshadeIntensity;
      if (typeof p.rockHueVariance === "number")
        uniforms.uHueVariance.value = p.rockHueVariance;
      if (typeof p.shadowSharpness === "number")
        uniforms.uShadowSharpness.value = p.shadowSharpness;
      if (typeof p.facetStrength === "number")
        uniforms.uFacetStrength.value = p.facetStrength;
      if (typeof p.edgeFadeDistanceM === "number")
        uniforms.uEdgeFadeDistance.value = Math.max(0, p.edgeFadeDistanceM);
      if (typeof p.edgeFadeShape === "string")
        uniforms.uEdgeFadeShape.value = edgeFadeShapeValue(p.edgeFadeShape);
      if (typeof p.edgeFadeInsetM === "number")
        uniforms.uEdgeFadeInset.value = Math.max(0, p.edgeFadeInsetM);
      if (typeof p.edgeFadeCornerRadiusM === "number")
        uniforms.uEdgeFadeCornerRadius.value = Math.max(
          0,
          p.edgeFadeCornerRadiusM,
        );
      if (p.shadowTint) uniforms.uShadowTint.value.set(p.shadowTint);
      if (typeof p.gridEnabled === "boolean")
        uniforms.uGridEnabled.value = p.gridEnabled ? 1 : 0;
      if (p.gridColor) uniforms.uGridColor.value.set(p.gridColor);
      if (typeof p.gridOpacity === "number")
        uniforms.uGridOpacity.value = p.gridOpacity;
      if (typeof p.gridSpacingM === "number")
        uniforms.uGridSpacing.value = p.gridSpacingM;
      if (typeof p.gridLineWidthM === "number")
        uniforms.uGridLineWidth.value = p.gridLineWidthM;
      if (typeof p.undersideOpacity === "number")
        uniforms.uUndersideOpacity.value = p.undersideOpacity;
      if (typeof p.fogEnabled === "boolean")
        uniforms.uFogEnabled.value = p.fogEnabled ? 1 : 0;
      if (p.fogColor) uniforms.uFogColor.value.set(p.fogColor);
      if (typeof p.fogNear === "number") uniforms.uFogNear.value = p.fogNear;
      if (typeof p.fogFar === "number") uniforms.uFogFar.value = p.fogFar;
      if (typeof p.fogDensity === "number")
        uniforms.uFogFar.value = fogDensityToFar(p.fogDensity);
    },
    setTerrainFogEnabled(enabled) {
      uniforms.uFogEnabled.value = enabled ? 1 : 0;
    },
    setTerrainFogDensity(density) {
      uniforms.uFogFar.value = fogDensityToFar(density);
    },
    setTerrainBounds(boundsMin, boundsMax) {
      uniforms.uTerrainBoundsMin.value.set(boundsMin[0], boundsMin[1]);
      uniforms.uTerrainBoundsMax.value.set(boundsMax[0], boundsMax[1]);
    },
    setLakeMask(texture, boundsMin, boundsMax) {
      uniforms.uLakeMask.value = texture;
      uniforms.uLakeBoundsMin.value.set(boundsMin[0], boundsMin[1]);
      uniforms.uLakeBoundsMax.value.set(boundsMax[0], boundsMax[1]);
      material.needsUpdate = true;
    },
    setLakeColor(color) {
      uniforms.uLakeColor.value.set(color);
    },
    setLakeOpacity(opacity) {
      uniforms.uLakeOpacity.value = opacity;
    },
    setLakeFogEnabled(enabled) {
      uniforms.uLakeFogEnabled.value = enabled ? 1 : 0;
    },
    setLakeFogDensity(density) {
      uniforms.uLakeFogFar.value = fogDensityToFar(density);
    },
    setTargetMask(slot, texture, boundsMin, boundsMax) {
      const slotIdx = slot === "target-three-firs" ? 0 : 1;
      const maskU =
        slotIdx === 0 ? uniforms.uTarget0Mask : uniforms.uTarget1Mask;
      const minU =
        slotIdx === 0 ? uniforms.uTarget0BoundsMin : uniforms.uTarget1BoundsMin;
      const maxU =
        slotIdx === 0 ? uniforms.uTarget0BoundsMax : uniforms.uTarget1BoundsMax;
      maskU.value = texture;
      minU.value.set(boundsMin[0], boundsMin[1]);
      maxU.value.set(boundsMax[0], boundsMax[1]);
      material.needsUpdate = true;
    },
    setTargetColor(slot, color) {
      const c =
        slot === "target-three-firs"
          ? uniforms.uTarget0Color
          : uniforms.uTarget1Color;
      c.value.set(color);
    },
    setTargetOpacity(slot, opacity) {
      const o =
        slot === "target-three-firs"
          ? uniforms.uTarget0Opacity
          : uniforms.uTarget1Opacity;
      o.value = opacity;
    },
    setTargetFogEnabled(slot, enabled) {
      const o =
        slot === "target-three-firs"
          ? uniforms.uTarget0FogEnabled
          : uniforms.uTarget1FogEnabled;
      o.value = enabled ? 1 : 0;
    },
    setTargetFogDensity(slot, density) {
      const o =
        slot === "target-three-firs"
          ? uniforms.uTarget0FogFar
          : uniforms.uTarget1FogFar;
      o.value = fogDensityToFar(density);
    },
    setClaimMask(texture, boundsMin, boundsMax) {
      uniforms.uClaimMask.value = texture;
      uniforms.uClaimBoundsMin.value.set(boundsMin[0], boundsMin[1]);
      uniforms.uClaimBoundsMax.value.set(boundsMax[0], boundsMax[1]);
      material.needsUpdate = true;
    },
    setClaimColor(color) {
      uniforms.uClaimColor.value.set(color);
    },
    setClaimOpacity(opacity) {
      uniforms.uClaimOpacity.value = opacity;
    },
    setClaimFogEnabled(enabled) {
      uniforms.uClaimFogEnabled.value = enabled ? 1 : 0;
    },
    setClaimFogDensity(density) {
      uniforms.uClaimFogFar.value = fogDensityToFar(density);
    },
    setGeologyMask(texture, boundsMin, boundsMax) {
      uniforms.uGeologyMask.value = texture;
      uniforms.uGeologyBoundsMin.value.set(boundsMin[0], boundsMin[1]);
      uniforms.uGeologyBoundsMax.value.set(boundsMax[0], boundsMax[1]);
      material.needsUpdate = true;
    },
    setGeologyOpacity(opacity) {
      uniforms.uGeologyOpacity.value = opacity;
    },
    setGeologyFogEnabled(enabled) {
      uniforms.uGeologyFogEnabled.value = enabled ? 1 : 0;
    },
    setGeologyFogDensity(density) {
      uniforms.uGeologyFogFar.value = fogDensityToFar(density);
    },
    setForestMask(texture, boundsMin, boundsMax) {
      uniforms.uForestMask.value = texture;
      uniforms.uForestBoundsMin.value.set(boundsMin[0], boundsMin[1]);
      uniforms.uForestBoundsMax.value.set(boundsMax[0], boundsMax[1]);
      material.needsUpdate = true;
    },
    setForestColor(color) {
      uniforms.uForestColor.value.set(color);
    },
    setForestOutlineColor(color) {
      uniforms.uForestOutlineColor.value.set(color);
    },
    setForestFillOpacity(opacity) {
      uniforms.uForestFillOpacity.value = opacity;
    },
    setForestOutlineOpacity(opacity) {
      uniforms.uForestOutlineOpacity.value = opacity;
    },
    setForestEdge(threshold, softness) {
      uniforms.uForestEdgeThreshold.value = Math.min(
        0.95,
        Math.max(0.05, threshold),
      );
      uniforms.uForestEdgeSoftness.value = Math.min(
        0.25,
        Math.max(0, softness),
      );
    },
    setForestFogEnabled(enabled) {
      uniforms.uForestFogEnabled.value = enabled ? 1 : 0;
    },
    setForestFogDensity(density) {
      uniforms.uForestFogFar.value = fogDensityToFar(density);
    },
    setPublicClip(enabled, shape, center, halfSize, rotationZRad) {
      uniforms.uPublicClipEnabled.value = enabled ? 1 : 0;
      uniforms.uPublicClipShape.value = shape === "circle" ? 1 : 0;
      uniforms.uPublicClipCenter.value.copy(center);
      uniforms.uPublicClipHalfSize.value.copy(halfSize);
      uniforms.uPublicClipCosSin.value.set(
        Math.cos(rotationZRad),
        Math.sin(rotationZRad),
      );
    },
  };
}
