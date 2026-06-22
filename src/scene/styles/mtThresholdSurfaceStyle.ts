import * as THREE from "three";
import { applyMtThresholdSurfaceMaterialOpacity } from "../../loaders/surfaceRenderPolicy";
import type { EditableStyle } from "../../pages/types";
import { UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID } from "../../projectModules/utahForge/layerIds";
import { resolveMtSurfaceBoundaries } from "../../projectModules/utahForge/mtSurfaceBoundaries";
import { styleColor, styleNumber } from "./styleUtils";

export function applyMtThresholdSurfaceStyle(this: any, id: string, style: EditableStyle): void {
  if (id !== UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID) return;
  const group = this.layers.get(id);
  if (!group) return;
  const boundaries = resolveMtSurfaceBoundaries(
    style,
    this.mtSurfaceBoundaryDefinitionsFromGroup(group),
  );
  const boundaryById = new Map(
    boundaries.map((boundary) => [boundary.id, boundary]),
  );
  const wireframe = style.mtThresholdSurfaceWireframe === true;
  const opacity = styleNumber(style, "opacity", 0.86, 0, 1);
  const roughness = styleNumber(
    style,
    "mtThresholdSurfaceRoughness",
    0.64,
    0,
    1,
  );
  const metalness = styleNumber(
    style,
    "mtThresholdSurfaceMetalness",
    0,
    0,
    1,
  );
  const smoothNormals = style.mtThresholdSurfaceSmoothNormals !== false;
  const emissiveBoost = styleNumber(
    style,
    "mtThresholdSurfaceEmissiveBoost",
    0.08,
    0,
    1,
  );
  const side =
    style.mtThresholdSurfaceSide === "front"
      ? THREE.FrontSide
      : THREE.DoubleSide;
  const wireframeColor = styleColor(
    style,
    "mtThresholdSurfaceWireframeColor",
    "#f8f4e8",
  );
  const wireframeOpacity = styleNumber(
    style,
    "mtThresholdSurfaceWireframeOpacity",
    0.42,
    0,
    1,
  );
  const selectedProductId =
    typeof style.mtIsosurfaceProductId === "string"
      ? style.mtIsosurfaceProductId
      : "mt-isosurface-full-extent";
  this.ensureLiveMtSurfaceBoundaries(
    group,
    selectedProductId,
    boundaries,
    style,
  );
  this.ensurePrecomputedMtSurfaceBoundaries(
    group,
    id,
    selectedProductId,
    boundaries,
    style,
  );
  group.traverse((obj: THREE.Object3D) => {
    if (obj.userData?.mtThresholdSurfacePreview !== true) return;
    const productId =
      typeof obj.userData.mtIsosurfaceProductId === "string"
        ? obj.userData.mtIsosurfaceProductId
        : "";
    const surfaceId =
      typeof obj.userData.mtThresholdSurfaceId === "string"
        ? obj.userData.mtThresholdSurfaceId
        : "";
    const productVisible =
      productId.length === 0 || productId === selectedProductId;
    const boundary = boundaryById.get(surfaceId);
    obj.visible = productVisible && boundary?.visible === true;
    const material = (obj as { material?: THREE.Material | THREE.Material[] })
      .material;
    const materials = Array.isArray(material)
      ? material
      : material
        ? [material]
        : [];
    for (const m of materials) {
      if ("wireframe" in m) {
        (m as THREE.Material & { wireframe: boolean }).wireframe = wireframe;
      }
      if ("vertexColors" in m) {
        // R4: binary tiles carry no per-vertex color attribute (color comes
        // from material.color below). Enabling vertexColors without a color
        // attribute makes three multiply by a default (0,0,0) → black surface.
        const hasVertexColor =
          (obj as THREE.Mesh).geometry?.getAttribute?.("color") != null;
        (m as THREE.Material & { vertexColors: boolean }).vertexColors =
          hasVertexColor && !wireframe;
      }
      if ("roughness" in m) {
        (m as THREE.Material & { roughness: number }).roughness = roughness;
      }
      if ("metalness" in m) {
        (m as THREE.Material & { metalness: number }).metalness = metalness;
      }
      if ("flatShading" in m) {
        (m as THREE.Material & { flatShading: boolean }).flatShading =
          !smoothNormals;
      }
      if ("emissive" in m) {
        (m as THREE.Material & { emissive: THREE.Color }).emissive.set(
          0xffffff,
        );
      }
      if ("emissiveIntensity" in m) {
        (m as THREE.Material & { emissiveIntensity: number }).emissiveIntensity =
          wireframe ? 0 : emissiveBoost;
      }
      if ("color" in m && wireframe) {
        (m as THREE.Material & { color: THREE.Color }).color.copy(
          wireframeColor,
        );
      } else if ("color" in m) {
        (m as THREE.Material & { color: THREE.Color }).color.set(
          boundary?.color ?? "#ffffff",
        );
      }
      m.side = side;
      const boundaryOpacity = boundary?.opacity ?? 1;
      const effectiveOpacity = wireframe
        ? wireframeOpacity
        : opacity * boundaryOpacity;
      applyMtThresholdSurfaceMaterialOpacity(
        m,
        effectiveOpacity,
        wireframe,
        true,
      );
      m.userData.mtThresholdSurfaceMasterOpacity = opacity;
      m.userData.mtThresholdSurfaceBoundaryOpacity = boundaryOpacity;
      m.userData.mtThresholdSurfaceWireframe = wireframe;
    }
  });
}
