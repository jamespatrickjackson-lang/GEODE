import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { EditableStyle } from "../../pages/types";
import { UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID, UTAH_FORGE_SCENE_SECTION_LAYER_ID, UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID } from "../../projectModules/utahForge/layerIds";
import { setTerrainShadowInfluence } from "../../loaders/topoLineMaterial";
import { applyPointDistanceLightMaterial } from "../shaders/pointDistanceLightShader";
import { setMaterialFog } from "../shaders/layerFogShader";
import { applyLocalAtmosphereVolumeStyle } from "./atmosphereVolumeStyle";
import { clamp01, clampRange, styleNumber } from "./styleUtils";

function styleAffectedByFog(style: EditableStyle): boolean {
  return style.affectedByFog !== false;
}

function styleFogDensity(style: EditableStyle, fallback: number): number {
  return typeof style.fogDensity === "number" && Number.isFinite(style.fogDensity)
    ? clampRange(style.fogDensity, 0.000001, 0.002)
    : fallback;
}

export function applyStyle(this: any, id: string, style: EditableStyle): void {
  this.appliedLayerStyles.set(id, style);
  if (id === UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID) {
    this.applyWorkingAreaFocusStyle(style);
    return;
  }
  if (applyLocalAtmosphereVolumeStyle(this, id, style)) return;
  const group = this.layers.get(id);
  const affectedByFog = styleAffectedByFog(style);
  const fogDensity = styleFogDensity(style, this.envFogDensity);
  if (group) {
    group.traverse((obj: THREE.Object3D) => {
      const mat = (obj as THREE.Mesh | THREE.Line).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        if (m.userData?.ignoreLayerStyle === true) continue;
        const targetOpacity =
          m.userData?.lakeFillMaterial === true &&
          typeof style.fillOpacity === "number"
            ? clamp01(style.fillOpacity)
            : typeof style.opacity === "number"
              ? style.opacity
              : this.baseOpacityForMaterial(m);
        const colored = m as THREE.Material & {
          color?: THREE.Color;
          emissive?: THREE.Color;
        };
        const preserveVertexColors =
          m.userData?.preserveVertexColors === true;
        const preserveMaterialColor =
          m.userData?.preserveMaterialColor === true ||
          obj.userData?.naipTileDiagnosticOutline === true ||
          obj.userData?.naipTileDiagnosticLabel === true;
        const preserveMaterialOpacity =
          m.userData?.preserveMaterialOpacity === true;
        const materialColor =
          m.userData?.lakeOutlineMaterial === true &&
          typeof style.outlineColor === "string"
            ? style.outlineColor
            : m.userData?.lakeFillMaterial === true &&
                typeof style.color === "string"
              ? style.color
              : style.color;
        if (
          typeof materialColor === "string" &&
          colored.color &&
          !preserveVertexColors &&
          !preserveMaterialColor
        ) {
          colored.color.set(materialColor);
          if (colored.emissive) {
            colored.emissive.set(materialColor);
          }
        }
        if (
          m instanceof LineMaterial &&
          typeof style.lineWidth === "number" &&
          m.userData?.drillAssayRole === undefined
        ) {
          const worldLineWidthScale =
            typeof m.userData?.worldLineWidthScale === "number"
              ? m.userData.worldLineWidthScale
              : 1;
          const minLineWidth =
            typeof m.userData?.worldLineWidthMin === "number"
              ? m.userData.worldLineWidthMin
              : 0.5;
          const maxLineWidth =
            typeof m.userData?.worldLineWidthMax === "number"
              ? m.userData.worldLineWidthMax
              : 12;
          m.linewidth = clampRange(
            style.lineWidth * worldLineWidthScale,
            minLineWidth,
            maxLineWidth,
          );
        }
        if (m instanceof THREE.PointsMaterial) {
          m.size = clampRange(
            typeof style.pointSizePx === "number"
              ? style.pointSizePx
              : m.size,
            0.5,
            24,
          );
          applyPointDistanceLightMaterial(
            m,
            styleNumber(style, "scalarDistanceLightStrength", 0, 0, 1),
          );
        }
        if (
          m instanceof LineMaterial &&
          m.userData?.terrainShadowInfluence !== undefined
        ) {
          setTerrainShadowInfluence(
            m,
            typeof style.terrainShadowInfluence === "number"
              ? style.terrainShadowInfluence
              : 0.09,
          );
        }
        if (!preserveMaterialOpacity) {
          m.opacity = targetOpacity;
          m.transparent =
            m.userData?.forceTransparent === true || targetOpacity < 1;
          if (m instanceof THREE.ShaderMaterial && m.uniforms.uOpacity) {
            m.uniforms.uOpacity.value = targetOpacity;
          }
          if (m.userData?.terrainMaterial === true) {
            m.transparent = true;
            m.depthWrite = targetOpacity >= 0.999;
          }
        }
        setMaterialFog(m, this.envFogEnabled && affectedByFog, fogDensity);
        m.needsUpdate = true;
      }
    });
  }
  this.applyTerrainFogStyle(id, affectedByFog, fogDensity);
  this.applyTerrainLiftStyle(id, style);
  const topoPublicSurfaceChanged =
    this.isTopoSurfaceLayerId(id) ||
    this.topoPublicSurfaceLayerIds().includes(id);
  if (topoPublicSurfaceChanged) {
    this.topoRuntime.applyPublicSurfaceClipStyle(
      this.styleForLayer(this.topoSurfaceLayerId()),
    );
  }
  if (this.isTopoSurfaceLayerId(id)) {
    for (const graticuleLayerId of this.topoGraticuleLayerIds()) {
      this.topoRuntime.applyGraticuleStyle(
        graticuleLayerId,
        this.styleForLayer(graticuleLayerId),
      );
    }
    this.reapplySiteSurfaceGuides();
    this.applyMtSurfaceMaskStyle(
      UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
      this.styleForLayer(UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID),
    );
  }
  if (topoPublicSurfaceChanged) {
    this.reapplyTopoAlignedOverlays();
  }
  this.applyTerrainCompositeStyle(id, style);
  this.topoRuntime.applyGraticuleStyle(id, style);
  this.applyGeochemStyle(id, style);
  this.applyHyperspectralStyle(id, style);
  this.applyImageryLidarAoiStyle(id, style);
  this.applyEzGammaStyle(id, style);
  this.applyDemoBoreholeStyle(id, style);
  this.applyCaseStudyBDemoLayerAlias(id, style);
  this.applySurfaceGradientStyle(id, style);
  this.applyScalarPreviewStyle(id, style);
  this.applyMtSurfaceMaskStyle(id, style);
  this.applyScalarVolumeStyle(id, style);
  this.applyMtThresholdSurfaceStyle(id, style);
  this.applyMtTopSurfaceStyle(id, style);
  this.applyPointMarkerStyle(id, style);
  this.applyResistivitySliceStyle(id, style);
  this.applySeismicBrowserStyle(id, style);
  this.applyContourDisplayStyle(id, style);
  this.applySiteSurfaceGuideStyle(id, style);
  applyLocalAtmosphereVolumeStyle(this, id, style);
  if (id === UTAH_FORGE_SCENE_SECTION_LAYER_ID) {
    this.sceneSectionStyleTween = null;
    this.sceneSectionHelperTransitionOpacity = 1;
    this.applySceneSectionPlanes(style);
  } else {
    this.reapplySceneSectionPlanes();
  }
  this.reapplyWorkingAreaFocus();
}
