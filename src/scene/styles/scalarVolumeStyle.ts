import * as THREE from "three";
import type { EditableStyle } from "../../pages/types";
import { UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID } from "../../projectModules/utahForge/layerIds";
import {
  DEFAULT_SCALAR_HIGH_COLOR,
  DEFAULT_SCALAR_LOW_COLOR,
  DEFAULT_SCALAR_MID_COLOR,
} from "./colorScales";
import { styleColor, styleNumber } from "./styleUtils";

export function scalarVolumeTransferModeCode(this: any, style: EditableStyle): number {
  if (style.scalarVolumeTransferMode === "soft") return 0;
  if (style.scalarVolumeTransferMode === "dense") return 2;
  return 1;
}

export function applyScalarVolumeStyle(this: any, id: string, style: EditableStyle): void {
  if (id !== UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) return;
  const group = this.layers.get(id);
  if (!group) return;

  const products = Array.isArray(group.userData.scalarVolumeProducts)
    ? (group.userData.scalarVolumeProducts as Array<{ id?: unknown }>)
        .map((product) => product.id)
        .filter(
          (productId): productId is string => typeof productId === "string",
        )
    : [];
  const requested =
    typeof style.scalarVolumeProductId === "string"
      ? style.scalarVolumeProductId
      : typeof group.userData.scalarVolumeDefaultProductId === "string"
        ? group.userData.scalarVolumeDefaultProductId
        : products[0];
  const selectedProductId =
    requested && (products.length === 0 || products.includes(requested))
      ? requested
      : products[0];
  group.userData.scalarVolumeSelectedProductId = selectedProductId;

  const lowColor = styleColor(
    style,
    "scalarColorLow",
    DEFAULT_SCALAR_LOW_COLOR,
  );
  const midColor = styleColor(
    style,
    "scalarColorMid",
    DEFAULT_SCALAR_MID_COLOR,
  );
  const highColor = styleColor(
    style,
    "scalarColorHigh",
    DEFAULT_SCALAR_HIGH_COLOR,
  );
  const midpoint = styleNumber(style, "scalarMidpoint", 0.5, 0.05, 0.95);
  const contrast = styleNumber(style, "scalarContrast", 1.05, 0.35, 3);
  const opacity = styleNumber(
    style,
    "scalarVolumeOpacity",
    styleNumber(style, "opacity", 0.48, 0, 1),
    0,
    1,
  );
  const isoSourceOpacity =
    style.sectionIsoEnabled === true
      ? styleNumber(style, "sectionIsoSourceOpacity", 0, 0, 1)
      : 1;
  const renderOpacity = opacity * isoSourceOpacity;
  const density = styleNumber(style, "scalarVolumeDensity", 0.72, 0, 2);
  const sampleSteps = styleNumber(
    style,
    "scalarVolumeSampleSteps",
    112,
    24,
    192,
  );
  const maskVisible = style.scalarVolumeMaskVisible !== false ? 1 : 0;
  const transferMode = scalarVolumeTransferModeCode(style);

  group.traverse((obj: THREE.Object3D) => {
    if (obj.userData?.scalarVolume !== true || !(obj instanceof THREE.Mesh))
      return;
    const productId =
      typeof obj.userData.scalarVolumeProductId === "string"
        ? obj.userData.scalarVolumeProductId
        : "";
    obj.visible = productId === selectedProductId;
    const material = obj.material;
    const materials = Array.isArray(material) ? material : [material];
    const sourceRange = Array.isArray(obj.userData.scalarVolumeSourceRange)
      ? (obj.userData.scalarVolumeSourceRange as number[])
      : [-2, 4.5];
    const displayRange = Array.isArray(obj.userData.scalarVolumeDisplayRange)
      ? (obj.userData.scalarVolumeDisplayRange as number[])
      : [0.139879, 3.937122];
    const sourceMin = Number.isFinite(sourceRange[0]) ? sourceRange[0] : -2;
    const sourceMax = Number.isFinite(sourceRange[1]) ? sourceRange[1] : 4.5;
    const displayMin = styleNumber(
      style,
      "scalarDisplayMin",
      Number.isFinite(displayRange[0]) ? displayRange[0] : 0.139879,
      -100,
      100,
    );
    const rawDisplayMax = styleNumber(
      style,
      "scalarDisplayMax",
      Number.isFinite(displayRange[1]) ? displayRange[1] : 3.937122,
      -100,
      100,
    );
    const displayMax = Math.max(rawDisplayMax, displayMin + 0.000001);
    const thresholdMin = styleNumber(
      style,
      "scalarVolumeThresholdMin",
      styleNumber(style, "scalarFocusMin", sourceMin, -100, 100),
      -100,
      100,
    );
    const rawThresholdMax = styleNumber(
      style,
      "scalarVolumeThresholdMax",
      styleNumber(style, "scalarFocusMax", sourceMax, -100, 100),
      -100,
      100,
    );
    const thresholdMax = Math.max(rawThresholdMax, thresholdMin + 0.000001);
    for (const m of materials) {
      if (!(m instanceof THREE.ShaderMaterial)) continue;
      const uniforms = m.uniforms;
      if (uniforms.uColorLow) uniforms.uColorLow.value.copy(lowColor);
      if (uniforms.uColorMid) uniforms.uColorMid.value.copy(midColor);
      if (uniforms.uColorHigh) uniforms.uColorHigh.value.copy(highColor);
      if (uniforms.uDisplayMin) uniforms.uDisplayMin.value = displayMin;
      if (uniforms.uDisplayMax) uniforms.uDisplayMax.value = displayMax;
      if (uniforms.uThresholdMin) uniforms.uThresholdMin.value = thresholdMin;
      if (uniforms.uThresholdMax) uniforms.uThresholdMax.value = thresholdMax;
      if (uniforms.uMidpoint) uniforms.uMidpoint.value = midpoint;
      if (uniforms.uContrast) uniforms.uContrast.value = contrast;
      if (uniforms.uOpacity) uniforms.uOpacity.value = renderOpacity;
      this.setProductOpacityBaseForMaterial(m, renderOpacity);
      if (uniforms.uDensity) uniforms.uDensity.value = density;
      if (uniforms.uSampleSteps) uniforms.uSampleSteps.value = sampleSteps;
      if (uniforms.uTransferMode) uniforms.uTransferMode.value = transferMode;
      if (uniforms.uMaskVisible) uniforms.uMaskVisible.value = maskVisible;
      m.userData.scalarVolumeUniformState = {
        productId,
        visible: obj.visible,
        displayMin,
        displayMax,
        thresholdMin,
        thresholdMax,
        opacity: renderOpacity,
        sourceOpacity: opacity,
        sectionIsoSourceOpacity: isoSourceOpacity,
        density,
        sampleSteps,
        transferMode,
        maskVisible,
      };
      m.needsUpdate = true;
    }
  });
  this.updateMtVolumeCutIsoOverlays(style);
}
