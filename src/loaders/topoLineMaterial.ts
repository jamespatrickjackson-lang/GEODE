import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

interface DistanceWidthOptions {
  near?: number;
  far?: number;
  minScale?: number;
  minAlpha?: number;
}

const DEFAULT_TOPO_DISTANCE_LINE = {
  near: 5000,
  far: 19000,
  minScale: 0.67,
  minAlpha: 0.2,
};

type DistanceLineSettings = Required<DistanceWidthOptions>;

interface DistanceLineUniforms {
  near: { value: number };
  far: { value: number };
  minScale: { value: number };
  minAlpha: { value: number };
}

interface TerrainShadeLineUniforms {
  influence: { value: number };
}

export interface TopoGraticuleEdgeFadeOptions {
  enabled?: boolean;
  strength?: number;
  lineColor?: string;
  boundsMin?: [number, number];
  boundsMax?: [number, number];
  edgeFadeDistanceM?: number;
  edgeFadeShape?: "square" | "rounded-square" | "circle";
  edgeFadeInsetM?: number;
  edgeFadeCornerRadiusM?: number;
}

type TopoGraticuleEdgeFadeSettings = Required<TopoGraticuleEdgeFadeOptions>;

interface TopoGraticuleEdgeFadeUniforms {
  enabled: { value: number };
  strength: { value: number };
  lineColor: { value: THREE.Color };
  boundsMin: { value: THREE.Vector2 };
  boundsMax: { value: THREE.Vector2 };
  edgeFadeDistance: { value: number };
  edgeFadeShape: { value: number };
  edgeFadeInset: { value: number };
  edgeFadeCornerRadius: { value: number };
}

function resolveSettings(
  options: DistanceWidthOptions = {},
): DistanceLineSettings {
  return {
    near: options.near ?? DEFAULT_TOPO_DISTANCE_LINE.near,
    far: options.far ?? DEFAULT_TOPO_DISTANCE_LINE.far,
    minScale: options.minScale ?? DEFAULT_TOPO_DISTANCE_LINE.minScale,
    minAlpha: options.minAlpha ?? DEFAULT_TOPO_DISTANCE_LINE.minAlpha,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function edgeFadeShapeValue(
  shape: TopoGraticuleEdgeFadeOptions["edgeFadeShape"],
): number {
  if (shape === "rounded-square") return 1;
  if (shape === "circle") return 2;
  return 0;
}

function resolveEdgeFadeSettings(
  options: TopoGraticuleEdgeFadeOptions = {},
): TopoGraticuleEdgeFadeSettings {
  return {
    enabled: options.enabled === true,
    strength: clamp01(options.strength ?? 1),
    lineColor: options.lineColor ?? "#ffffff",
    boundsMin: options.boundsMin ?? [-1, -1],
    boundsMax: options.boundsMax ?? [1, 1],
    edgeFadeDistanceM: Math.max(0, options.edgeFadeDistanceM ?? 0),
    edgeFadeShape:
      options.edgeFadeShape === "rounded-square" ||
      options.edgeFadeShape === "circle"
        ? options.edgeFadeShape
        : "square",
    edgeFadeInsetM: Math.max(0, options.edgeFadeInsetM ?? 0),
    edgeFadeCornerRadiusM: Math.max(0, options.edgeFadeCornerRadiusM ?? 0),
  };
}

// Three's LineMaterial uses screen-space pixel width by default. That's useful
// close to the camera, but distant topo lines read too heavy because they never
// perspectively shrink. This small shader patch keeps the editor's lineWidth
// controls intact while easing far topo-detail lines down toward a hairline.
export function enableDistanceAttenuatedLineWidth(
  material: LineMaterial,
  options: DistanceWidthOptions = {},
): void {
  material.userData.distanceAttenuatedLineWidth = true;
  setDistanceAttenuatedLineWidth(material, options);
  material.customProgramCacheKey = () =>
    material.dashed
      ? "topo-distance-line-width:v4:dashed"
      : "topo-distance-line-width:v4:solid";

  material.onBeforeCompile = (shader) => {
    const settings = resolveSettings(
      material.userData.distanceLineSettings as DistanceWidthOptions,
    );
    shader.uniforms.distanceLineWidthNear = { value: settings.near };
    shader.uniforms.distanceLineWidthFar = { value: settings.far };
    shader.uniforms.distanceLineMinScale = { value: settings.minScale };
    shader.uniforms.distanceLineMinAlpha = { value: settings.minAlpha };
    shader.uniforms.terrainShadowInfluence = {
      value: material.userData.terrainShadowInfluence ?? 0,
    };
    const edgeSettings = resolveEdgeFadeSettings(
      material.userData
        .topoGraticuleEdgeFadeSettings as TopoGraticuleEdgeFadeOptions,
    );
    shader.uniforms.topoGraticuleEdgeFadeEnabled = {
      value: edgeSettings.enabled ? 1 : 0,
    };
    shader.uniforms.topoGraticuleEdgeFadeStrength = {
      value: edgeSettings.strength,
    };
    shader.uniforms.topoGraticuleEdgeLineColor = {
      value: new THREE.Color(edgeSettings.lineColor),
    };
    shader.uniforms.topoGraticuleTerrainBoundsMin = {
      value: new THREE.Vector2(...edgeSettings.boundsMin),
    };
    shader.uniforms.topoGraticuleTerrainBoundsMax = {
      value: new THREE.Vector2(...edgeSettings.boundsMax),
    };
    shader.uniforms.topoGraticuleEdgeFadeDistance = {
      value: edgeSettings.edgeFadeDistanceM,
    };
    shader.uniforms.topoGraticuleEdgeFadeShape = {
      value: edgeFadeShapeValue(edgeSettings.edgeFadeShape),
    };
    shader.uniforms.topoGraticuleEdgeFadeInset = {
      value: edgeSettings.edgeFadeInsetM,
    };
    shader.uniforms.topoGraticuleEdgeFadeCornerRadius = {
      value: edgeSettings.edgeFadeCornerRadiusM,
    };
    material.userData.distanceLineUniforms = {
      near: shader.uniforms.distanceLineWidthNear,
      far: shader.uniforms.distanceLineWidthFar,
      minScale: shader.uniforms.distanceLineMinScale,
      minAlpha: shader.uniforms.distanceLineMinAlpha,
    } satisfies DistanceLineUniforms;
    material.userData.terrainShadeLineUniforms = {
      influence: shader.uniforms.terrainShadowInfluence,
    } satisfies TerrainShadeLineUniforms;
    material.userData.topoGraticuleEdgeFadeUniforms = {
      enabled: shader.uniforms.topoGraticuleEdgeFadeEnabled,
      strength: shader.uniforms.topoGraticuleEdgeFadeStrength,
      lineColor: shader.uniforms.topoGraticuleEdgeLineColor,
      boundsMin: shader.uniforms.topoGraticuleTerrainBoundsMin,
      boundsMax: shader.uniforms.topoGraticuleTerrainBoundsMax,
      edgeFadeDistance: shader.uniforms.topoGraticuleEdgeFadeDistance,
      edgeFadeShape: shader.uniforms.topoGraticuleEdgeFadeShape,
      edgeFadeInset: shader.uniforms.topoGraticuleEdgeFadeInset,
      edgeFadeCornerRadius: shader.uniforms.topoGraticuleEdgeFadeCornerRadius,
    } satisfies TopoGraticuleEdgeFadeUniforms;

    shader.vertexShader = shader.vertexShader.replace(
      "uniform float linewidth;\n\t\tuniform vec2 resolution;",
      `uniform float linewidth;
		uniform vec2 resolution;
		uniform float distanceLineWidthNear;
		uniform float distanceLineWidthFar;
		uniform float distanceLineMinScale;
		uniform float distanceLineMinAlpha;
		uniform float topoGraticuleEdgeFadeEnabled;
		uniform float topoGraticuleEdgeFadeStrength;
		uniform vec2 topoGraticuleTerrainBoundsMin;
		uniform vec2 topoGraticuleTerrainBoundsMax;
		uniform float topoGraticuleEdgeFadeDistance;
		uniform float topoGraticuleEdgeFadeShape;
		uniform float topoGraticuleEdgeFadeInset;
		uniform float topoGraticuleEdgeFadeCornerRadius;
		varying float vTopoDistanceFade;
		varying float vTopoGraticuleEdgeFade;

		float topoGraticuleInsideDistance( vec2 worldPos ) {
			vec2 terrainCenter = ( topoGraticuleTerrainBoundsMin + topoGraticuleTerrainBoundsMax ) * 0.5;
			vec2 terrainHalfSize = max(
				( topoGraticuleTerrainBoundsMax - topoGraticuleTerrainBoundsMin ) * 0.5 - vec2( max( topoGraticuleEdgeFadeInset, 0.0 ) ),
				vec2( 1.0 )
			);
			vec2 localPos = worldPos - terrainCenter;
			if ( topoGraticuleEdgeFadeShape > 1.5 ) {
				float radius = min( terrainHalfSize.x, terrainHalfSize.y );
				return radius - length( localPos );
			}
			if ( topoGraticuleEdgeFadeShape > 0.5 ) {
				float radius = clamp(
					topoGraticuleEdgeFadeCornerRadius,
					0.0,
					max( 0.0, min( terrainHalfSize.x, terrainHalfSize.y ) - 1.0 )
				);
				vec2 q = abs( localPos ) - ( terrainHalfSize - vec2( radius ) );
				float signedDist =
					length( max( q, vec2( 0.0 ) ) ) +
					min( max( q.x, q.y ), 0.0 ) -
					radius;
				return -signedDist;
			}
			return min(
				terrainHalfSize.x - abs( localPos.x ),
				terrainHalfSize.y - abs( localPos.y )
			);
		}`,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "\t\t\t// camera space\n\t\t\tvec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );\n\t\t\tvec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );",
      `			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );
			vec4 startWorld = modelMatrix * vec4( instanceStart, 1.0 );
			vec4 endWorld = modelMatrix * vec4( instanceEnd, 1.0 );
			float topoLineDepth = max( 0.0, - mix( start.z, end.z, 0.5 ) );
			float topoDistanceT = smoothstep( distanceLineWidthNear, distanceLineWidthFar, topoLineDepth );
			float topoWidthScale = mix( 1.0, distanceLineMinScale, topoDistanceT );
			vTopoDistanceFade = mix( 1.0, distanceLineMinAlpha, topoDistanceT );
			float topoEdgeDistance = min(
				topoGraticuleInsideDistance( startWorld.xy ),
				topoGraticuleInsideDistance( endWorld.xy )
			);
			float topoEdgeWidth = max( topoGraticuleEdgeFadeDistance, 1.0 );
			float topoEdgeFade = 1.0 - smoothstep( 0.0, topoEdgeWidth, topoEdgeDistance );
			vTopoGraticuleEdgeFade =
				clamp( topoEdgeFade, 0.0, 1.0 ) *
				clamp( topoGraticuleEdgeFadeEnabled, 0.0, 1.0 ) *
				clamp( topoGraticuleEdgeFadeStrength, 0.0, 1.0 );`,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "\t\t\t\t// adjust for linewidth\n\t\t\t\toffset *= linewidth;",
      `				// adjust for linewidth, then perspectively soften distant topo ink
				offset *= linewidth * topoWidthScale;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "uniform float linewidth;",
      `uniform float linewidth;
		uniform float terrainShadowInfluence;
		uniform vec3 topoGraticuleEdgeLineColor;
		varying float vTopoDistanceFade;
		varying float vTopoGraticuleEdgeFade;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#if defined( USE_COLOR_ALPHA )
			diffuseColor *= vec4( mix( vec3( 1.0 ), vColor.xyz, clamp( terrainShadowInfluence, 0.0, 1.0 ) ), vColor.w );
		#elif defined( USE_COLOR )
			diffuseColor.rgb *= mix( vec3( 1.0 ), vColor.xyz, clamp( terrainShadowInfluence, 0.0, 1.0 ) );
		#endif
			diffuseColor.rgb = mix(
				diffuseColor.rgb,
				topoGraticuleEdgeLineColor,
				clamp( vTopoGraticuleEdgeFade, 0.0, 1.0 )
			);`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "\t\t\tfloat alpha = opacity;",
      `			float alpha = opacity * clamp( vTopoDistanceFade, 0.0, 1.0 );`,
    );
  };

  material.needsUpdate = true;
}

export function setDistanceAttenuatedLineWidth(
  material: LineMaterial,
  options: DistanceWidthOptions = {},
): void {
  const settings = resolveSettings(options);
  material.userData.distanceLineSettings = settings;
  const uniforms = material.userData
    .distanceLineUniforms as DistanceLineUniforms | undefined;
  if (uniforms) {
    uniforms.near.value = settings.near;
    uniforms.far.value = settings.far;
    uniforms.minScale.value = settings.minScale;
    uniforms.minAlpha.value = settings.minAlpha;
  }
}

export function setTerrainShadowInfluence(
  material: LineMaterial,
  influence: number,
): void {
  const value = Math.min(1, Math.max(0, influence));
  material.userData.terrainShadowInfluence = value;
  const uniforms = material.userData
    .terrainShadeLineUniforms as TerrainShadeLineUniforms | undefined;
  if (uniforms) uniforms.influence.value = value;
}

export function setTopoGraticuleEdgeFade(
  material: LineMaterial,
  options: TopoGraticuleEdgeFadeOptions = {},
): void {
  const settings = resolveEdgeFadeSettings(options);
  material.userData.topoGraticuleEdgeFadeSettings = settings;
  const uniforms = material.userData
    .topoGraticuleEdgeFadeUniforms as
    | TopoGraticuleEdgeFadeUniforms
    | undefined;
  if (uniforms) {
    uniforms.enabled.value = settings.enabled ? 1 : 0;
    uniforms.strength.value = settings.strength;
    uniforms.lineColor.value.set(settings.lineColor);
    uniforms.boundsMin.value.set(settings.boundsMin[0], settings.boundsMin[1]);
    uniforms.boundsMax.value.set(settings.boundsMax[0], settings.boundsMax[1]);
    uniforms.edgeFadeDistance.value = settings.edgeFadeDistanceM;
    uniforms.edgeFadeShape.value = edgeFadeShapeValue(settings.edgeFadeShape);
    uniforms.edgeFadeInset.value = settings.edgeFadeInsetM;
    uniforms.edgeFadeCornerRadius.value = settings.edgeFadeCornerRadiusM;
  }
}
