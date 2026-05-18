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
      ? "topo-distance-line-width:v3:dashed"
      : "topo-distance-line-width:v3:solid";

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
    material.userData.distanceLineUniforms = {
      near: shader.uniforms.distanceLineWidthNear,
      far: shader.uniforms.distanceLineWidthFar,
      minScale: shader.uniforms.distanceLineMinScale,
      minAlpha: shader.uniforms.distanceLineMinAlpha,
    } satisfies DistanceLineUniforms;
    material.userData.terrainShadeLineUniforms = {
      influence: shader.uniforms.terrainShadowInfluence,
    } satisfies TerrainShadeLineUniforms;

    shader.vertexShader = shader.vertexShader.replace(
      "uniform float linewidth;\n\t\tuniform vec2 resolution;",
      `uniform float linewidth;
		uniform vec2 resolution;
		uniform float distanceLineWidthNear;
		uniform float distanceLineWidthFar;
		uniform float distanceLineMinScale;
		uniform float distanceLineMinAlpha;
		varying float vTopoDistanceFade;`,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "\t\t\t// camera space\n\t\t\tvec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );\n\t\t\tvec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );",
      `			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );
			float topoLineDepth = max( 0.0, - mix( start.z, end.z, 0.5 ) );
			float topoDistanceT = smoothstep( distanceLineWidthNear, distanceLineWidthFar, topoLineDepth );
			float topoWidthScale = mix( 1.0, distanceLineMinScale, topoDistanceT );
			vTopoDistanceFade = mix( 1.0, distanceLineMinAlpha, topoDistanceT );`,
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
		varying float vTopoDistanceFade;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#if defined( USE_COLOR_ALPHA )
			diffuseColor *= vec4( mix( vec3( 1.0 ), vColor.xyz, clamp( terrainShadowInfluence, 0.0, 1.0 ) ), vColor.w );
		#elif defined( USE_COLOR )
			diffuseColor.rgb *= mix( vec3( 1.0 ), vColor.xyz, clamp( terrainShadowInfluence, 0.0, 1.0 ) );
		#endif`,
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
