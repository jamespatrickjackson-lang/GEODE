import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { EditableStyle } from "../../pages/types";
import { UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID } from "../../projectModules/utahForge/layerIds";
import {
  UTAH_FORGE_DEMO_BOREHOLE_WELL_IDS,
  resolveDemoBoreholeSourceLocationItemStyle,
  resolveDemoBoreholeSourceLocationStyle,
  resolveDemoBoreholeWellStyle,
  resolveDemoOrientationBlockStyle,
} from "../../projectModules/utahForge/siteDetails";
import type { ResolvedSceneOffset } from "../../projectModules/utahForge/siteDetails";
import {
  rebuildDemoBoreholeCenterlineGeometry,
  rebuildDemoBoreholePipeGeometry,
} from "../../loaders/loadUtahForgeDemoBoreholes";
import { loadBoreholeIconTexture } from "../../loaders/boreholeIcon";
import { clamp01, clampRange } from "./styleUtils";

type SiteDetailStyleHost = {
  layers: Map<string, THREE.Group>;
  renderedTopoSurfaceKey?: () => string;
  renderedTopoSurfaceZ?: (x: number, y: number) => number | null;
};

const SITE_DETAILS_ALWAYS_ON_TOP_RENDER_ORDER = 10_000;

function objectMaterials(obj: THREE.Object3D): THREE.Material[] {
  const material = (obj as { material?: THREE.Material | THREE.Material[] })
    .material;
  if (!material) return [];
  return Array.isArray(material) ? material : [material];
}

function applySiteDetailsRenderPolicy(
  obj: THREE.Object3D,
  alwaysOnTop: boolean,
): void {
  if (typeof obj.userData.siteDetailsBaseRenderOrder !== "number") {
    obj.userData.siteDetailsBaseRenderOrder = obj.renderOrder;
  }
  const baseRenderOrder =
    typeof obj.userData.siteDetailsBaseRenderOrder === "number"
      ? obj.userData.siteDetailsBaseRenderOrder
      : 0;
  obj.renderOrder = alwaysOnTop
    ? SITE_DETAILS_ALWAYS_ON_TOP_RENDER_ORDER + baseRenderOrder
    : baseRenderOrder;

  for (const material of objectMaterials(obj)) {
    if (typeof material.userData.siteDetailsBaseDepthTest !== "boolean") {
      material.userData.siteDetailsBaseDepthTest = material.depthTest;
    }
    if (typeof material.userData.siteDetailsBaseDepthWrite !== "boolean") {
      material.userData.siteDetailsBaseDepthWrite = material.depthWrite;
    }
    material.depthTest = alwaysOnTop
      ? false
      : material.userData.siteDetailsBaseDepthTest;
    material.depthWrite = alwaysOnTop
      ? false
      : material.userData.siteDetailsBaseDepthWrite;
    material.needsUpdate = true;
  }
}

export function applyEzGammaStyle(this: unknown, layerId: string, style: EditableStyle): void {
  if (layerId !== "ez-gamma-2024") return;
  const host = this as SiteDetailStyleHost;
  const group = host.layers.get(layerId);
  if (!group) return;
  const bool = (value: unknown, fallback: boolean) =>
    typeof value === "boolean" ? value : fallback;
  const color = (value: unknown, fallback: string) =>
    typeof value === "string" ? value : fallback;
  const numeric = (
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ) =>
    clampRange(
      typeof value === "number" && Number.isFinite(value) ? value : fallback,
      min,
      max,
    );
  const applyMaterial = (
    obj: THREE.Object3D,
    nextColor: string,
    nextOpacity: number,
  ) => {
    const material = (obj as THREE.Mesh | THREE.Line).material as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (!material) return;
    const mats = Array.isArray(material) ? material : [material];
    for (const mat of mats) {
      const colored = mat as THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
      };
      colored.color?.set(nextColor);
      colored.emissive?.set(nextColor);
      mat.opacity = clamp01(nextOpacity);
      mat.transparent =
        mat.userData?.forceTransparent === true || mat.opacity < 1;
      mat.depthWrite = false;
      mat.needsUpdate = true;
    }
  };
  const depthScale = clampRange(
    typeof style.gammaDepthScale === "number" ? style.gammaDepthScale : 1,
    0.2,
    1.8,
  );
  const trackOffset = clampRange(
    typeof style.gammaTrackOffsetM === "number"
      ? style.gammaTrackOffsetM
      : 36,
    0,
    220,
  );
  const trackWidth = clampRange(
    typeof style.gammaTrackWidthM === "number" ? style.gammaTrackWidthM : 78,
    20,
    220,
  );
  const panelOpacity = clampRange(
    typeof style.gammaPanelOpacity === "number" ? style.gammaPanelOpacity : 0,
    0,
    1,
  );
  const panelVisible = bool(style.gammaPanelVisible, panelOpacity > 0.001);
  const panelColor = color(style.gammaPanelColor, "#1d211a");
  const trackScale = trackWidth / 78;
  const panelWidth = (trackOffset + trackWidth + 14) * 2;
  const collarVisible = bool(style.gammaCollarVisible, true);
  const collarColor = color(style.gammaCollarColor, "#9ee4ac");
  const collarOpacity = numeric(style.gammaCollarOpacity, 0.94, 0, 1);
  const collarRadius = numeric(style.gammaCollarRadiusM, 14, 2, 60);

  const tubeSettings = {
    surveyTube: {
      visible: bool(style.gammaSurveyTubeVisible, true),
      color: color(style.gammaSurveyTubeColor, "#e7ddc7"),
      opacity: numeric(style.gammaSurveyTubeOpacity, 0.34, 0, 1),
      radius: numeric(style.gammaSurveyTubeRadiusM, 3.6, 0.5, 24),
      mode: style.gammaSurveyTubeMode === "dashed" ? "dashed" : "solid",
    },
    loggedOverburden: {
      visible: bool(style.gammaLoggedOverburdenVisible, true),
      color: color(style.gammaLoggedOverburdenColor, "#d2a35f"),
      opacity: numeric(style.gammaLoggedOverburdenOpacity, 0.42, 0, 1),
      radius: numeric(style.gammaLoggedOverburdenRadiusM, 7.92, 0.5, 36),
      mode: style.gammaLoggedOverburdenMode === "dashed" ? "dashed" : "solid",
    },
    bedrockInterval: {
      visible: bool(style.gammaBedrockIntervalVisible, true),
      color: color(style.gammaBedrockIntervalColor, "#75c878"),
      opacity: numeric(style.gammaBedrockIntervalOpacity, 0.46, 0, 1),
      radius: numeric(style.gammaBedrockIntervalRadiusM, 6.12, 0.5, 36),
      mode: style.gammaBedrockIntervalMode === "dashed" ? "dashed" : "solid",
    },
  } as const;

  const contactShape = style.gammaContactShape === "coin" ? "coin" : "torus";
  const contactBaseRadius = 42;
  const contactRadius = numeric(style.gammaContactRadiusM, 42, 6, 120);
  const contactThickness = numeric(
    style.gammaContactThicknessM,
    3.2,
    0.4,
    18,
  );
  const contactRadiusScale = contactRadius / contactBaseRadius;
  const contactSettings = {
    1: {
      visible: bool(style.gammaContact1Visible, true),
      color: color(style.gammaContact1Color, "#fff2bc"),
      opacity: numeric(style.gammaContact1Opacity, 0.86, 0, 1),
    },
    2: {
      visible: bool(style.gammaContact2Visible, true),
      color: color(style.gammaContact2Color, "#e6d4a2"),
      opacity: numeric(style.gammaContact2Opacity, 0.55, 0, 1),
    },
  } as const;

  const tracesVisible = bool(style.gammaTracesVisible, true);
  const redTraceVisible = bool(style.gammaRedTraceVisible, true);
  const blueTraceVisible = bool(style.gammaBlueTraceVisible, true);
  const mirrorTraceVisible = bool(style.gammaMirrorTraceVisible, true);
  const redTraceColor = color(style.gammaRedTraceColor, "#f04a45");
  const blueTraceColor = color(style.gammaBlueTraceColor, "#3576ff");
  const traceOpacity = numeric(style.gammaTraceOpacity, 0.92, 0, 1);
  const traceWidth = numeric(
    style.gammaTraceWidthPx ?? style.lineWidth,
    2.4,
    0.25,
    14,
  );

  group.traverse((obj) => {
    if (obj.userData?.ezGammaHoleRoot === true) {
      obj.scale.z = depthScale;
    }
    if (obj.userData?.ezGammaPart === "collar") {
      const baseRadius =
        typeof obj.userData.ezGammaBaseRadiusM === "number"
          ? obj.userData.ezGammaBaseRadiusM
          : 14;
      obj.visible = collarVisible;
      obj.scale.setScalar(collarRadius / Math.max(0.001, baseRadius));
      applyMaterial(obj, collarColor, collarOpacity);
    }
    if (obj.userData?.ezGammaTubeMesh === true) {
      const part = obj.userData.ezGammaTubePart as
        | keyof typeof tubeSettings
        | undefined;
      const setting = part ? tubeSettings[part] : undefined;
      if (setting) {
        const variant =
          obj.userData.ezGammaTubeVariant === "dashed" ? "dashed" : "solid";
        const baseRadius =
          typeof obj.userData.ezGammaTubeBaseRadiusM === "number"
            ? obj.userData.ezGammaTubeBaseRadiusM
            : setting.radius;
        const radiusScale = setting.radius / Math.max(0.001, baseRadius);
        obj.visible = setting.visible && variant === setting.mode;
        obj.scale.set(radiusScale, 1, radiusScale);
        applyMaterial(obj, setting.color, setting.opacity);
      }
    }
    if (obj.userData?.ezGammaContact === true) {
      const index = obj.userData.ezGammaContactIndex === 2 ? 2 : 1;
      const setting = contactSettings[index];
      const shape =
        obj.userData.ezGammaContactShape === "coin" ? "coin" : "torus";
      const baseThickness =
        typeof obj.userData.ezGammaContactBaseThicknessM === "number"
          ? obj.userData.ezGammaContactBaseThicknessM
          : contactThickness;
      const thicknessScale =
        contactThickness / Math.max(0.001, baseThickness);
      obj.visible = setting.visible && shape === contactShape;
      if (shape === "coin") {
        obj.scale.set(contactRadiusScale, thicknessScale, contactRadiusScale);
      } else {
        obj.scale.set(contactRadiusScale, contactRadiusScale, thicknessScale);
      }
      applyMaterial(obj, setting.color, setting.opacity);
    }
    if (obj.userData?.ezGammaTrackGroup === true) {
      const side = obj.userData.ezGammaTrackSide === -1 ? -1 : 1;
      obj.position.x = trackOffset * side;
      obj.scale.x = trackScale;
    }
    if (obj.userData?.ezGammaTrackPanel === true) {
      obj.visible = panelVisible && panelOpacity > 0.001;
      const baseWidth =
        typeof obj.userData.ezGammaPanelBaseWidthM === "number"
          ? obj.userData.ezGammaPanelBaseWidthM
          : 256;
      obj.position.x = 0;
      obj.scale.x = baseWidth > 0 ? panelWidth / baseWidth : 1;
      applyMaterial(obj, panelColor, panelOpacity);
    }
    if (obj.userData?.ezGammaCurve === true) {
      const run = obj.userData.ezGammaCurveRun === "red" ? "red" : "blue";
      const side = obj.userData.ezGammaTraceSide === -1 ? -1 : 1;
      obj.visible =
        tracesVisible &&
        (side === 1 || mirrorTraceVisible) &&
        (run === "red" ? redTraceVisible : blueTraceVisible);
      const material = (obj as THREE.Line).material as
        | THREE.Material
        | undefined;
      if (material instanceof LineMaterial) {
        material.color.set(run === "red" ? redTraceColor : blueTraceColor);
        material.opacity = traceOpacity;
        material.transparent = true;
        material.linewidth = traceWidth;
        material.depthWrite = false;
        material.depthTest = false;
        material.needsUpdate = true;
      }
    }
  });
}

export function applyDemoBoreholeStyle(this: unknown, layerId: string, style: EditableStyle): void {
  if (layerId !== UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID) return;
  const host = this as SiteDetailStyleHost;
  const group = host.layers.get(layerId);
  if (!group) return;
  const layerOpacity = clamp01(
    typeof style.opacity === "number" ? style.opacity : 1,
  );
  const alwaysOnTop = style.siteDetailsAlwaysOnTop === true;
  const alignToTopo = style.siteDetailsAlignToTopo === true;
  const topoTransformKey = alignToTopo
    ? (host.renderedTopoSurfaceKey?.() ?? "topo:unavailable")
    : "source";
  const displayPointsByWellId = new Map<string, THREE.Vector3[]>();
  const blockStyle = resolveDemoOrientationBlockStyle(style);
  const sourceLocationStyle = resolveDemoBoreholeSourceLocationStyle(style);
  // The shared element kit is active when the master toggle is on and the layer
  // is not fully faded. Each element additionally gates on its own *Visible flag
  // and per-borehole show/hide; the legacy `mode` no longer gates rendering.
  const sourceLocationsActive =
    sourceLocationStyle.visible && layerOpacity > 0.001;
  const sourceLocationIdForObject = (obj: THREE.Object3D): string | null =>
    typeof obj.userData?.demoBoreholeSourceLocationId === "string"
      ? obj.userData.demoBoreholeSourceLocationId
      : null;
  // Per-borehole show/hide. Trajectory wells toggle via their own `visible`;
  // source-location boreholes toggle via `items[id]`.
  const boreholeElementVisible = (obj: THREE.Object3D): boolean => {
    const id = sourceLocationIdForObject(obj);
    if (!id) return true;
    if (!resolveDemoBoreholeSourceLocationItemStyle(style, id).visible) {
      return false;
    }
    if (
      style.demoBoreholeWells?.[id] ||
      (UTAH_FORGE_DEMO_BOREHOLE_WELL_IDS as readonly string[]).includes(id)
    ) {
      return resolveDemoBoreholeWellStyle(style, id).visible;
    }
    return true;
  };
  const sourceLocationItemLabelVisible = (obj: THREE.Object3D) => {
    const id = sourceLocationIdForObject(obj);
    return id
      ? resolveDemoBoreholeSourceLocationItemStyle(style, id).labelVisible
      : true;
  };
  const offsetForObject = (
    base: THREE.Vector3,
    offset: ResolvedSceneOffset,
  ): THREE.Vector3 =>
    base.clone().add(new THREE.Vector3(offset[0], offset[1], offset[2]));
  const applyMeshSourceMaterial = (
    obj: THREE.Object3D,
    color: string,
    opacity: number,
  ) => {
    const mesh = obj as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (!material) return;
    material.color.set(color);
    material.emissive?.set(color);
    material.opacity = clamp01(opacity);
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = false;
    material.needsUpdate = true;
  };
  const applyLineSourceMaterial = (
    obj: THREE.Object3D,
    color: string,
    opacity: number,
    linewidth: number,
    dashed = false,
    dashSize = 0,
    gapSize = 0,
  ) => {
    const line = obj as Line2;
    const material = line.material;
    if (!(material instanceof LineMaterial)) return;
    material.color.set(color);
    material.opacity = clamp01(opacity);
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = false;
    material.linewidth = linewidth;
    material.dashed = dashed;
    if (dashed) {
      material.dashSize = Math.max(1, dashSize);
      material.gapSize = Math.max(1, gapSize);
      if (line.userData.demoBoreholeLineDistances !== true) {
        line.computeLineDistances();
        line.userData.demoBoreholeLineDistances = true;
      }
    }
    material.needsUpdate = true;
  };
  const tupleToVector = (value: unknown): THREE.Vector3 | null => {
    if (
      !Array.isArray(value) ||
      value.length < 3 ||
      !value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    ) {
      return null;
    }
    return new THREE.Vector3(value[0], value[1], value[2]);
  };
  const alignPointToTopo = (point: THREE.Vector3): THREE.Vector3 => {
    const next = point.clone();
    if (!alignToTopo) return next;
    const topoZ = host.renderedTopoSurfaceZ?.(point.x, point.y);
    if (typeof topoZ === "number" && Number.isFinite(topoZ)) {
      next.z = topoZ;
    }
    return next;
  };
  const basePositionForObject = (obj: THREE.Object3D): THREE.Vector3 | null => {
    const stored = tupleToVector(obj.userData.demoBoreholeBasePosition);
    if (stored) return stored;
    obj.userData.demoBoreholeBasePosition = [
      obj.position.x,
      obj.position.y,
      obj.position.z,
    ];
    return obj.position.clone();
  };

  group.traverse((obj) => {
    if (obj.userData?.demoBoreholePipeRoot === true) {
      const wellId =
        typeof obj.userData.demoBoreholeWellId === "string"
          ? obj.userData.demoBoreholeWellId
          : "";
      const wellStyle = resolveDemoBoreholeWellStyle(style, wellId);
      obj.visible = wellStyle.visible;
      const displayPoints = rebuildDemoBoreholePipeGeometry(obj, {
        radiusM: wellStyle.pipeDiameterM * 0.5,
        color: wellStyle.color,
        opacity: wellStyle.opacity * layerOpacity,
        lineStyle: wellStyle.lineStyle,
        dashLengthM: wellStyle.dashLengthM,
        dashGapM: wellStyle.dashGapM,
        pathTreatment: wellStyle.pathTreatment,
        smoothingStrength: wellStyle.smoothingStrength,
        displayPointTransform: alignToTopo ? alignPointToTopo : undefined,
        displayPointTransformKey: topoTransformKey,
      });
      displayPointsByWellId.set(wellId, displayPoints);
    }
  });

  group.traverse((obj) => {
    const wellId =
      typeof obj.userData?.demoBoreholeWellId === "string"
        ? obj.userData.demoBoreholeWellId
        : "";
    const wellStyle = wellId
      ? resolveDemoBoreholeWellStyle(style, wellId)
      : null;
    const displayPoints = wellId ? displayPointsByWellId.get(wellId) : null;

    if (wellStyle && obj.userData?.demoBoreholeWell === true) {
      obj.visible = wellStyle.visible;
    }
    if (
      wellStyle &&
      displayPoints &&
      obj.userData?.demoBoreholeCenterline === true
    ) {
      obj.visible = wellStyle.visible && wellStyle.centerlineVisible;
      rebuildDemoBoreholeCenterlineGeometry(obj, displayPoints);
      const line = obj as Line2;
      if (line.material instanceof LineMaterial) {
        line.material.color.set(wellStyle.centerlineColor);
        line.material.opacity = wellStyle.centerlineOpacity * layerOpacity;
        line.material.transparent = true;
        line.material.linewidth = wellStyle.centerlineWidth;
        line.material.needsUpdate = true;
      }
    }
    if (
      wellStyle &&
      displayPoints &&
      obj.userData?.demoBoreholeCollar === true
    ) {
      obj.visible = wellStyle.visible && wellStyle.collarVisible;
      if (displayPoints[0]) obj.position.copy(displayPoints[0]);
      const baseRadius =
        typeof obj.userData.demoBoreholeBaseCollarRadiusM === "number"
          ? obj.userData.demoBoreholeBaseCollarRadiusM
          : 30;
      obj.scale.setScalar(
        wellStyle.collarDiameterM * 0.5 / Math.max(0.001, baseRadius),
      );
      const mesh = obj as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (material) {
        material.color.set(wellStyle.color);
        material.emissive?.set(wellStyle.color);
        material.opacity = wellStyle.opacity * layerOpacity;
        material.transparent = true;
        material.needsUpdate = true;
      }
    }
    if (
      wellStyle &&
      displayPoints &&
      obj.userData?.demoBoreholeLabelAnchor === true &&
      obj.userData?.demoBoreholeOwnerId === wellId
    ) {
      const labelRole = obj.userData.demoBoreholeLabelRole;
      if (labelRole === "collar") {
        obj.visible = wellStyle.visible && wellStyle.collarLabelVisible;
        if (displayPoints[0]) {
          obj.position.copy(displayPoints[0]);
          obj.position.z += wellStyle.collarLabelLiftM;
        }
        obj.userData.displayName = wellStyle.collarLabelText;
      } else if (labelRole === "toe") {
        obj.visible = wellStyle.visible && wellStyle.toeLabelVisible;
        const toe = displayPoints[displayPoints.length - 1];
        if (toe) {
          obj.position.copy(toe);
          obj.position.z += wellStyle.toeLabelLiftM;
        }
        obj.userData.displayName = wellStyle.toeLabelText;
      }
    }
    if (obj.userData?.demoBoreholeSourceTraceRoot === true) {
      obj.visible =
        sourceLocationsActive &&
        boreholeElementVisible(obj) &&
        sourceLocationStyle.depthTraceVisible;
      const basePosition = basePositionForObject(obj);
      if (basePosition) obj.position.copy(alignPointToTopo(basePosition));
    }
    if (obj.userData?.demoBoreholeSourceTrace === true) {
      obj.visible =
        sourceLocationsActive &&
        boreholeElementVisible(obj) &&
        sourceLocationStyle.depthTraceVisible;
      const baseDiameter =
        typeof obj.userData.demoBoreholeBaseSourceTraceDiameterM === "number"
          ? obj.userData.demoBoreholeBaseSourceTraceDiameterM
          : 72;
      const baseLength =
        typeof obj.userData.demoBoreholeBaseSourceTraceLengthM === "number"
          ? obj.userData.demoBoreholeBaseSourceTraceLengthM
          : 900;
      const diameterScale =
        sourceLocationStyle.diameterM / Math.max(0.001, baseDiameter);
      const lengthScale =
        sourceLocationStyle.lengthM / Math.max(0.001, baseLength);
      if (obj.userData.demoBoreholeSourceTracePart === "body") {
        obj.position.z = -sourceLocationStyle.lengthM * 0.5;
        obj.scale.set(diameterScale, lengthScale, diameterScale);
      } else {
        obj.position.z =
          obj.userData.demoBoreholeSourceTracePart === "bottom-cap"
            ? -sourceLocationStyle.lengthM
            : 0;
        obj.scale.setScalar(diameterScale);
      }
      applyMeshSourceMaterial(
        obj,
        sourceLocationStyle.depthTraceColor,
        sourceLocationStyle.depthTraceOpacity * layerOpacity,
      );
    }
    if (obj.userData?.demoBoreholeSourceLine === true) {
      obj.visible =
        sourceLocationsActive &&
        boreholeElementVisible(obj) &&
        sourceLocationStyle.lineVisible;
      const basePosition = basePositionForObject(obj);
      if (basePosition) obj.position.copy(alignPointToTopo(basePosition));
      const baseLength =
        typeof obj.userData.demoBoreholeBaseSourceTraceLengthM === "number"
          ? obj.userData.demoBoreholeBaseSourceTraceLengthM
          : 900;
      obj.scale.set(1, 1, sourceLocationStyle.depthM / Math.max(0.001, baseLength));
      applyLineSourceMaterial(
        obj,
        sourceLocationStyle.lineColor,
        sourceLocationStyle.lineOpacity * layerOpacity,
        sourceLocationStyle.lineWidth,
        sourceLocationStyle.lineDashed,
        sourceLocationStyle.lineDashLengthM,
        sourceLocationStyle.lineDashGapM,
      );
    }
    if (obj.userData?.demoBoreholeSourcePinHead === true) {
      obj.visible =
        sourceLocationsActive &&
        boreholeElementVisible(obj) &&
        sourceLocationStyle.groundBallVisible;
      const basePosition = basePositionForObject(obj);
      if (basePosition) {
        obj.position.copy(
          offsetForObject(
            alignPointToTopo(basePosition),
            sourceLocationStyle.groundBallOffsetM,
          ),
        );
      }
      const baseDiameter =
        typeof obj.userData.demoBoreholeBaseSourceTraceDiameterM === "number"
          ? obj.userData.demoBoreholeBaseSourceTraceDiameterM
          : 72;
      const builtRadius = baseDiameter * 0.625;
      obj.scale.setScalar(
        sourceLocationStyle.groundBallRadiusM / Math.max(0.001, builtRadius),
      );
      applyMeshSourceMaterial(
        obj,
        sourceLocationStyle.groundBallColor,
        sourceLocationStyle.groundBallOpacity * layerOpacity,
      );
    }
    if (obj.userData?.demoBoreholeSourceCrosshair === true) {
      obj.visible =
        sourceLocationsActive &&
        boreholeElementVisible(obj) &&
        sourceLocationStyle.crosshairVisible;
      const basePosition = basePositionForObject(obj);
      if (basePosition) obj.position.copy(alignPointToTopo(basePosition));
      const baseLength =
        typeof obj.userData.demoBoreholeBaseSourceCrosshairLengthM === "number"
          ? obj.userData.demoBoreholeBaseSourceCrosshairLengthM
          : 320;
      const scale =
        sourceLocationStyle.crosshairLengthM / Math.max(0.001, baseLength);
      obj.scale.set(scale, scale, 1);
      applyLineSourceMaterial(
        obj,
        sourceLocationStyle.crosshairColor,
        sourceLocationStyle.crosshairOpacity * layerOpacity,
        sourceLocationStyle.crosshairWidth,
      );
    }
    if (obj.userData?.demoBoreholeSourceTopRing === true) {
      obj.visible =
        sourceLocationsActive &&
        boreholeElementVisible(obj) &&
        sourceLocationStyle.topRingVisible;
      const basePosition = basePositionForObject(obj);
      if (basePosition) {
        obj.position.copy(
          offsetForObject(
            alignPointToTopo(basePosition),
            sourceLocationStyle.topRingOffsetM,
          ),
        );
      }
      const mesh = obj as THREE.Mesh;
      if (
        mesh.geometry instanceof THREE.TorusGeometry &&
        (mesh.userData.demoBoreholeAppliedRingRadiusM !==
          sourceLocationStyle.topRingRadiusM ||
          mesh.userData.demoBoreholeAppliedRingTubeM !==
            sourceLocationStyle.topRingTubeM)
      ) {
        mesh.geometry.dispose();
        mesh.geometry = new THREE.TorusGeometry(
          sourceLocationStyle.topRingRadiusM,
          sourceLocationStyle.topRingTubeM,
          12,
          72,
        );
        mesh.userData.demoBoreholeAppliedRingRadiusM =
          sourceLocationStyle.topRingRadiusM;
        mesh.userData.demoBoreholeAppliedRingTubeM =
          sourceLocationStyle.topRingTubeM;
      }
      applyMeshSourceMaterial(
        obj,
        sourceLocationStyle.topRingColor,
        sourceLocationStyle.topRingOpacity * layerOpacity,
      );
    }
    if (
      obj.userData?.demoBoreholeLabelAnchor === true &&
      obj.userData?.demoBoreholeLabelRole === "source-location"
    ) {
      obj.visible =
        sourceLocationsActive &&
        boreholeElementVisible(obj) &&
        sourceLocationItemLabelVisible(obj) &&
        sourceLocationStyle.labelVisible;
      const basePosition = tupleToVector(obj.userData.demoBoreholeBaseLabelPosition);
      if (basePosition) {
        obj.position.copy(alignPointToTopo(basePosition));
        obj.position.z += sourceLocationStyle.labelLiftM;
      }
    }
    if (obj.userData?.demoBoreholeSourceIconMount === true) {
      const basePosition = basePositionForObject(obj);
      if (basePosition) {
        obj.position.copy(
          offsetForObject(
            alignPointToTopo(basePosition),
            sourceLocationStyle.icon.offsetM,
          ),
        );
      }
      obj.visible =
        sourceLocationsActive &&
        boreholeElementVisible(obj) &&
        sourceLocationStyle.icon.visible &&
        sourceLocationStyle.icon.src !== null;
    }
    if (obj.userData?.demoBoreholeSourceIcon === true) {
      const wantKind =
        sourceLocationStyle.icon.orientation === "billboard"
          ? "billboard"
          : "axis";
      obj.visible = obj.userData.demoBoreholeSourceIconKind === wantKind;
      obj.scale.setScalar(Math.max(0.001, sourceLocationStyle.icon.sizeM));
      const material = (obj as THREE.Mesh | THREE.Sprite).material as
        | THREE.MeshBasicMaterial
        | THREE.SpriteMaterial
        | undefined;
      if (material) {
        material.color.set(sourceLocationStyle.icon.color);
        material.transparent = true;
        const targetOpacity = clamp01(
          sourceLocationStyle.icon.opacity * layerOpacity,
        );
        const src = sourceLocationStyle.icon.src;
        if (!src) {
          obj.userData.demoBoreholeIconAppliedSrc = null;
          material.map = null;
          material.opacity = 0;
        } else {
          material.opacity = material.map ? targetOpacity : 0;
          if (obj.userData.demoBoreholeIconAppliedSrc !== src) {
            obj.userData.demoBoreholeIconAppliedSrc = src;
            loadBoreholeIconTexture(src).then((texture) => {
              if (obj.userData.demoBoreholeIconAppliedSrc !== src) return;
              material.map = texture;
              material.opacity = texture ? targetOpacity : 0;
              material.needsUpdate = true;
            });
          }
        }
        material.needsUpdate = true;
      }
    }
    if (
      obj.userData?.demoOrientationBlock === true ||
      obj.userData?.demoOrientationBlockEdge === true
    ) {
      const baseCenter = tupleToVector(obj.userData.demoOrientationBlockBaseCenter);
      const baseSize = Array.isArray(obj.userData.demoOrientationBlockBaseSize)
        ? obj.userData.demoOrientationBlockBaseSize
        : null;
      if (!baseCenter || !baseSize || baseSize.length < 3) return;
      const baseWidth = typeof baseSize[0] === "number" ? baseSize[0] : 118;
      const baseDepth = typeof baseSize[1] === "number" ? baseSize[1] : 68;
      const baseHeight = typeof baseSize[2] === "number" ? baseSize[2] : 34;
      obj.visible =
        blockStyle.visible &&
        (obj.userData.demoOrientationBlock === true ||
          blockStyle.outlineVisible);
      obj.position.set(
        baseCenter.x,
        baseCenter.y,
        alignPointToTopo(baseCenter).z +
          blockStyle.liftM +
          (blockStyle.heightM - baseHeight) * 0.5,
      );
      obj.scale.set(
        blockStyle.widthM / Math.max(0.001, baseWidth),
        blockStyle.depthM / Math.max(0.001, baseDepth),
        blockStyle.heightM / Math.max(0.001, baseHeight),
      );
      obj.rotation.z = THREE.MathUtils.degToRad(blockStyle.rotationDeg);
      const material = (obj as THREE.Mesh | THREE.LineSegments).material as
        | THREE.Material
        | undefined;
      const colored = material as
        | (THREE.Material & {
            color?: THREE.Color;
            opacity?: number;
            linewidth?: number;
          })
        | undefined;
      if (colored?.color) {
        colored.color.set(
          obj.userData.demoOrientationBlockEdge === true
            ? blockStyle.outlineColor
            : blockStyle.fillColor,
        );
      }
      if (colored) {
        colored.opacity =
          (obj.userData.demoOrientationBlockEdge === true
            ? blockStyle.outlineOpacity
            : blockStyle.opacity) * layerOpacity;
        colored.transparent = true;
        if ("linewidth" in colored) colored.linewidth = blockStyle.outlineThickness;
        colored.needsUpdate = true;
      }
    }
    if (
      obj.userData?.demoBoreholeLabelAnchor === true &&
      obj.userData?.demoBoreholeLabelRole === "block"
    ) {
      const baseCenter = tupleToVector(
        obj.parent?.children.find(
          (child) => child.userData?.demoOrientationBlock === true,
        )?.userData.demoOrientationBlockBaseCenter,
      );
      const blockMesh = obj.parent?.children.find(
        (child) => child.userData?.demoOrientationBlock === true,
      );
      if (baseCenter && blockMesh) {
        obj.visible = blockStyle.visible && blockStyle.labelVisible;
        obj.position.set(
          baseCenter.x,
          baseCenter.y,
          blockMesh.position.z + blockStyle.labelLiftM,
        );
        obj.userData.displayName = blockStyle.labelText;
      }
    }
  });

  group.traverse((obj) => {
    applySiteDetailsRenderPolicy(obj, alwaysOnTop);
  });
}

export function applyGeochemStyle(this: unknown, layerId: string, style: EditableStyle): void {
  if (layerId !== "geochem-soils-2024") return;
  const host = this as SiteDetailStyleHost;
  const group = host.layers.get(layerId);
  if (!group) return;
  const sampleRoots: THREE.Object3D[] = [];
  group.traverse((obj) => {
    if (obj.userData?.geochemSampleRoot === true) sampleRoots.push(obj);
  });
  if (sampleRoots.length === 0) return;

  const elements =
    (group.userData.geochemElements as
      | Record<
          string,
          {
            label?: string;
            symbol?: string;
            unit?: string;
            min?: number;
            q20?: number;
            q40?: number;
            q60?: number;
            q80?: number;
            max?: number;
          }
        >
      | undefined) ?? {};
  const firstElement = Object.keys(elements)[0] ?? "cu_ppm";
  let element =
    typeof style.geochemElement === "string"
      ? style.geochemElement
      : "cu_ppm";
  const hasSelectedElement = sampleRoots.some((root) => {
    const values = root.userData.elements as
      | Record<string, number>
      | undefined;
    return typeof values?.[element] === "number";
  });
  if (!hasSelectedElement) element = firstElement;

  const values = sampleRoots
    .map((root) => {
      const map = root.userData.elements as
        | Record<string, number>
        | undefined;
      const value = map?.[element];
      return typeof value === "number" && Number.isFinite(value)
        ? value
        : null;
    })
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (values.length === 0) return;

  const numeric = (
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ) =>
    clampRange(
      typeof value === "number" && Number.isFinite(value) ? value : fallback,
      min,
      max,
    );
  const color = (value: unknown, fallback: string) =>
    typeof value === "string" ? value : fallback;
  const quantile = (q: number) => {
    if (values.length === 1) return values[0];
    const pos = (values.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return values[lo];
    const t = pos - lo;
    return values[lo] * (1 - t) + values[hi] * t;
  };
  const stats = elements[element] ?? {};
  const breaks = [stats.q20, stats.q40, stats.q60, stats.q80].map((v, i) =>
    typeof v === "number" && Number.isFinite(v) ? v : quantile((i + 1) / 5),
  );
  const minValue =
    typeof stats.min === "number" && Number.isFinite(stats.min)
      ? stats.min
      : values[0];
  const maxValue =
    typeof stats.max === "number" && Number.isFinite(stats.max)
      ? stats.max
      : values[values.length - 1];
  const minRadius = numeric(style.geochemSymbolMinRadiusM, 45, 5, 400);
  const maxRadius = numeric(
    style.geochemSymbolMaxRadiusM,
    160,
    minRadius,
    600,
  );
  const lift = numeric(style.geochemLiftM, 24, 0, 220);
  const thickness = numeric(style.geochemSymbolThicknessM, 5, 0.5, 45);
  const opacity = numeric(
    style.geochemOpacity ?? style.opacity,
    typeof style.opacity === "number" ? style.opacity : 0.92,
    0,
    1,
  );
  const showOutline = style.geochemShowOutline !== false;
  const outlineOpacity = showOutline
    ? numeric(style.geochemOutlineOpacity, 0.65, 0, 1)
    : 0;
  const lowColor = new THREE.Color(color(style.geochemPaletteLow, "#2b6cb0"));
  const midColor = new THREE.Color(color(style.geochemPaletteMid, "#f2cf43"));
  const highColor = new THREE.Color(
    color(style.geochemPaletteHigh, "#c92a2a"),
  );
  const outlineColor = color(style.geochemOutlineColor, "#221f1c");
  const useLogScale = style.geochemUseLogScale !== false;
  const classColor = (classIndex: number) => {
    const t = classIndex / 4;
    const c = new THREE.Color();
    if (t <= 0.5) c.lerpColors(lowColor, midColor, t / 0.5);
    else c.lerpColors(midColor, highColor, (t - 0.5) / 0.5);
    return c;
  };
  const transform = (value: number) =>
    useLogScale ? Math.log10(Math.max(value, 0.000001)) : value;
  const minTransformed = transform(minValue);
  const maxTransformed = transform(maxValue);
  const denom = Math.max(0.000001, maxTransformed - minTransformed);
  const unit = stats.unit ?? (element.endsWith("_pct") ? "%" : "ppm");
  const label = stats.symbol ?? stats.label ?? element.replace("_", " ");
  const formatValue = (value: number) => {
    const decimals = unit === "%" ? 3 : value < 1 ? 3 : value < 10 ? 2 : 1;
    return `${value.toFixed(decimals)} ${unit}`;
  };

  const applyMaterial = (
    obj: THREE.Object3D,
    nextColor: THREE.Color | string,
    nextOpacity: number,
  ) => {
    const material = (obj as THREE.Mesh).material as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (!material) return;
    const mats = Array.isArray(material) ? material : [material];
    for (const mat of mats) {
      const colored = mat as THREE.Material & { color?: THREE.Color };
      if (colored.color) colored.color.set(nextColor);
      mat.opacity = clamp01(nextOpacity);
      mat.transparent = true;
      mat.depthWrite = false;
      mat.needsUpdate = true;
    }
  };

  for (const root of sampleRoots) {
    const map = root.userData.elements as Record<string, number> | undefined;
    const value = map?.[element];
    const valid = typeof value === "number" && Number.isFinite(value);
    root.visible = valid;
    if (!valid) continue;
    let classIndex = breaks.findIndex((breakValue) => value <= breakValue);
    if (classIndex < 0) classIndex = 4;
    const t = clamp01((transform(value) - minTransformed) / denom);
    const radius = minRadius + (maxRadius - minRadius) * t;
    const fillColor = classColor(classIndex);
    const sceneTerrainZ =
      typeof root.userData.sceneTerrainZ === "number"
        ? root.userData.sceneTerrainZ
        : root.position.z - lift;
    root.position.z = sceneTerrainZ + lift;
    const sampleId =
      typeof root.userData.sampleId === "string"
        ? root.userData.sampleId
        : "Soil sample";
    const displayName = `${sampleId} | ${label} ${formatValue(value)}`;
    root.userData.displayName = displayName;

    for (const child of root.children) {
      child.userData.displayName = displayName;
      if (child.userData.geochemPart === "fill") {
        child.visible = opacity > 0.001;
        child.scale.set(radius, thickness, radius);
        applyMaterial(child, fillColor, opacity);
      }
      if (child.userData.geochemPart === "outline") {
        child.visible = showOutline && outlineOpacity > 0.001;
        child.position.z = thickness * 0.62;
        child.scale.setScalar(radius);
        applyMaterial(child, outlineColor, outlineOpacity);
      }
    }
  }
}

export function applyHyperspectralStyle(this: unknown, layerId: string, style: EditableStyle): void {
  if (layerId !== "hyperspectral-coverage-2024") return;
  const host = this as SiteDetailStyleHost;
  const group = host.layers.get(layerId);
  if (!group) return;
  const radius = clampRange(
    typeof style.hyperspectralRadiusM === "number"
      ? style.hyperspectralRadiusM
      : 18,
    2,
    90,
  );
  const endpointVisible = style.hyperspectralEndpointVisible !== false;
  const endpointRadius = clampRange(
    typeof style.hyperspectralEndpointRadiusM === "number"
      ? style.hyperspectralEndpointRadiusM
      : 30,
    2,
    140,
  );
  const opacity = clampRange(
    typeof style.opacity === "number" ? style.opacity : 0.72,
    0,
    1,
  );
  const color = typeof style.color === "string" ? style.color : "#b26cff";
  group.traverse((obj) => {
    if (obj.userData?.hyperspectralCoverage !== true) return;
    const part = obj.userData.hyperspectralPart;
    if (part === "tube") {
      const length =
        typeof obj.userData.segmentLength === "number"
          ? obj.userData.segmentLength
          : obj.scale.y;
      obj.visible = opacity > 0.001;
      obj.scale.set(radius, length, radius);
    } else if (part === "endpoint") {
      obj.visible = endpointVisible && opacity > 0.001;
      obj.scale.setScalar(endpointRadius);
    }
    const material = (obj as THREE.Mesh).material as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (!material) return;
    const mats = Array.isArray(material) ? material : [material];
    for (const mat of mats) {
      const colored = mat as THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
      };
      colored.color?.set(color);
      colored.emissive?.set(color);
      mat.opacity = opacity;
      mat.transparent = true;
      mat.depthWrite = false;
      mat.needsUpdate = true;
    }
  });
}

export function applyImageryLidarAoiStyle(this: unknown, 
  layerId: string,
  style: EditableStyle,
): void {
  if (layerId !== "imagery-lidar-aoi-2024") return;
  const host = this as SiteDetailStyleHost;
  const group = host.layers.get(layerId);
  if (!group) return;
  const cornerVisible = style.imageryCornerVisible !== false;
  const cornerRadius = clampRange(
    typeof style.imageryCornerRadiusM === "number"
      ? style.imageryCornerRadiusM
      : 95,
    0,
    240,
  );
  const opacity = clampRange(
    typeof style.opacity === "number" ? style.opacity : 0.95,
    0,
    1,
  );
  group.traverse((obj) => {
    if (obj.userData?.imageryLidarAoi !== true) return;
    if (obj.userData.imageryLidarPart === "corner") {
      obj.visible = cornerVisible && opacity > 0.001 && cornerRadius > 0.001;
      obj.scale.setScalar(cornerRadius);
    }
  });
}
