import * as THREE from "three";
import type { EditableStyle } from "../../pages/types";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import { SHAHBAZI_GROUND_SURFACE_LAYER_ID } from "../../projectModules/shahbazi/layerIds";
import { DEFAULT_MT_RESISTIVITY_SLICE_ID } from "../../mtResistivity/sliceProducts";
import { getHeightSampler } from "../heightSampler";
import { applyMtSurfaceMaskPointMaterial } from "../shaders/mtSurfaceMaskShader";
import {
  DEFAULT_SURFACE_GRADIENT_HIGH_COLOR,
  DEFAULT_SURFACE_GRADIENT_LOW_COLOR,
  DEFAULT_SURFACE_GRADIENT_MID_COLOR,
  surfaceGradientColorAt,
} from "./colorScales";
import { clamp01, styleColor, styleNumber } from "./styleUtils";

const MT_SURFACE_MASK_DEFAULT_DEPTH_M = 25;
const MT_SURFACE_MASK_DEFAULT_FEATHER_M = 175;

function hasSurfaceGradientStyle(style: EditableStyle): boolean {
  return (
    typeof style.surfaceGradientLowColor === "string" ||
    typeof style.surfaceGradientMidColor === "string" ||
    typeof style.surfaceGradientHighColor === "string" ||
    typeof style.surfaceGradientMidpoint === "number" ||
    typeof style.surfaceGradientContrast === "number"
  );
}

export function applyMtSurfaceMaskStyleImpl(this: any, id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;
    this.restoreMtSurfaceMaskMaterials(id);
    const enabled = style.scalarSurfaceMaskEnabled !== false;
    const depthM = styleNumber(
      style,
      "scalarSurfaceMaskDepthM",
      MT_SURFACE_MASK_DEFAULT_DEPTH_M,
      0,
      500,
    );
    const featherM = styleNumber(
      style,
      "scalarSurfaceMaskFeatherM",
      MT_SURFACE_MASK_DEFAULT_FEATHER_M,
      0,
      1000,
    );

    void getHeightSampler().then((sampleHeight) => {
      if (this.layers.get(id) !== group) return;
      const origin = this.siteSurfaceGuideOrigin(group);
      const terrainGroup = this.layers.get(this.topoSurfaceLayerId());
      const terrainScaleZ =
        typeof terrainGroup?.scale.z === "number" &&
        Number.isFinite(terrainGroup.scale.z)
          ? terrainGroup.scale.z
          : 1;
      const terrainLiftZ =
        typeof terrainGroup?.position.z === "number" &&
        Number.isFinite(terrainGroup.position.z)
          ? terrainGroup.position.z
          : 0;
      const maskKey = [
        enabled ? "1" : "0",
        depthM.toFixed(3),
        featherM.toFixed(3),
        origin.easting.toFixed(3),
        origin.northing.toFixed(3),
        origin.elevation.toFixed(3),
        terrainScaleZ.toFixed(6),
        terrainLiftZ.toFixed(3),
      ].join("|");

      group.traverse((obj: THREE.Object3D) => {
        if (!(obj instanceof THREE.Points)) return;
        this.updateMtSurfaceMaskForPoints(obj, {
          enabled,
          depthM,
          featherM,
          origin,
          maskKey,
          sampleHeight,
          terrainScaleZ,
          terrainLiftZ,
        });
      });
    });
  }

export function updateMtSurfaceMaskForPointsImpl(this: any, points: THREE.Points, options: {
      enabled: boolean;
      depthM: number;
      featherM: number;
      origin: { easting: number; northing: number; elevation: number };
      maskKey: string;
      sampleHeight: (easting: number, northing: number) => number;
      terrainScaleZ: number;
      terrainLiftZ: number;
    }): void {
    const geometry = points.geometry;
    const position = geometry.getAttribute("position");
    if (!(position instanceof THREE.BufferAttribute)) return;

    const material = points.material;
    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) {
      if (mat instanceof THREE.PointsMaterial) {
        applyMtSurfaceMaskPointMaterial(mat);
      }
    }

    if (
      geometry.userData.mtSurfaceMaskKey === options.maskKey &&
      geometry.getAttribute("surfaceMaskAlpha")
    ) {
      return;
    }

    let alphaAttribute = geometry.getAttribute("surfaceMaskAlpha");
    if (
      !(alphaAttribute instanceof THREE.BufferAttribute) ||
      alphaAttribute.count !== position.count
    ) {
      alphaAttribute = new THREE.BufferAttribute(
        new Float32Array(position.count),
        1,
      );
      geometry.setAttribute("surfaceMaskAlpha", alphaAttribute);
    }

    const alpha = alphaAttribute.array as Float32Array;
    if (!options.enabled) {
      alpha.fill(1);
    } else {
      const world = new THREE.Vector3();
      points.updateMatrixWorld(true);
      const feather = Math.max(0.000001, options.featherM);
      for (let i = 0; i < position.count; i += 1) {
        world
          .set(position.getX(i), position.getY(i), position.getZ(i))
          .applyMatrix4(points.matrixWorld);
        const terrainSurfaceZ =
          (options.sampleHeight(
            options.origin.easting + world.x,
            options.origin.northing + world.y,
          ) -
            options.origin.elevation) *
            options.terrainScaleZ +
          options.terrainLiftZ;
        if (!Number.isFinite(terrainSurfaceZ)) {
          alpha[i] = 1;
          continue;
        }
        const clearanceM = terrainSurfaceZ - world.z;
        if (clearanceM <= options.depthM) {
          alpha[i] = 0;
        } else if (options.featherM <= 0) {
          alpha[i] = 1;
        } else {
          const t = clamp01((clearanceM - options.depthM) / feather);
          alpha[i] = t * t * (3 - 2 * t);
        }
      }
    }
    alphaAttribute.needsUpdate = true;
    geometry.userData.mtSurfaceMaskKey = options.maskKey;
  }

export function restoreMtSurfaceMaskMaterialsImpl(this: any, id: string): void {
    if (id !== UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;
    group.traverse((obj: THREE.Object3D) => {
      const material = (obj as THREE.Points).material;
      const materials = Array.isArray(material) ? material : [material];
      for (const mat of materials) {
        if (!(mat instanceof THREE.PointsMaterial)) continue;
        mat.depthWrite = false;
        mat.depthTest = true;
        mat.blending = THREE.NormalBlending;
        mat.toneMapped = false;
        mat.needsUpdate = true;
      }
    });
  }

export function applySurfaceGradientStyleImpl(this: any, id: string, style: EditableStyle): void {
    if (
      id !== SHAHBAZI_GROUND_SURFACE_LAYER_ID ||
      !hasSurfaceGradientStyle(style)
    ) {
      return;
    }

    const group = this.layers.get(id);
    if (!group) return;

    const meshes: THREE.Mesh[] = [];
    let minZ = Infinity;
    let maxZ = -Infinity;

    group.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.userData?.meshPreview !== true) return;
      const position = obj.geometry.getAttribute("position");
      if (!(position instanceof THREE.BufferAttribute)) return;
      meshes.push(obj);
      for (let i = 0; i < position.count; i += 1) {
        const z = position.getZ(i);
        if (Number.isFinite(z)) {
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z);
        }
      }
    });

    if (
      meshes.length === 0 ||
      !Number.isFinite(minZ) ||
      !Number.isFinite(maxZ)
    ) {
      return;
    }

    const zRange = Math.max(0.0001, maxZ - minZ);
    const lowColor = styleColor(
      style,
      "surfaceGradientLowColor",
      DEFAULT_SURFACE_GRADIENT_LOW_COLOR,
    );
    const midColor = styleColor(
      style,
      "surfaceGradientMidColor",
      DEFAULT_SURFACE_GRADIENT_MID_COLOR,
    );
    const highColor = styleColor(
      style,
      "surfaceGradientHighColor",
      DEFAULT_SURFACE_GRADIENT_HIGH_COLOR,
    );
    const midpoint = styleNumber(
      style,
      "surfaceGradientMidpoint",
      0.5,
      0.05,
      0.95,
    );
    const contrast = styleNumber(
      style,
      "surfaceGradientContrast",
      1,
      0.35,
      2.5,
    );
    const scratch = new THREE.Color();

    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      const position = geometry.getAttribute("position");
      if (!(position instanceof THREE.BufferAttribute)) continue;

      let color = geometry.getAttribute("color");
      if (
        !(color instanceof THREE.BufferAttribute) ||
        color.count !== position.count
      ) {
        color = new THREE.BufferAttribute(
          new Float32Array(position.count * 3),
          3,
        );
        geometry.setAttribute("color", color);
      }

      for (let i = 0; i < position.count; i += 1) {
        surfaceGradientColorAt(
          (position.getZ(i) - minZ) / zRange,
          midpoint,
          contrast,
          lowColor,
          midColor,
          highColor,
          scratch,
        );
        color.setXYZ(i, scratch.r, scratch.g, scratch.b);
      }
      color.needsUpdate = true;

      const material = mesh.material;
      const materials = Array.isArray(material) ? material : [material];
      for (const m of materials) {
        if ("vertexColors" in m) {
          (m as THREE.Material & { vertexColors: boolean }).vertexColors = true;
          m.needsUpdate = true;
        }
      }
    }
  }

export function applyMtTopSurfaceStyleImpl(this: any, id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;

    const liftM = styleNumber(style, "meshSurfaceLiftM", 0, -12000, 12000);
    const wireframe = style.meshWireframe === true;
    const roughness = styleNumber(style, "meshRoughness", 0.72, 0, 1);
    const metalness = styleNumber(style, "meshMetalness", 0.02, 0, 1);
    const tint = styleColor(style, "color", "#ffffff");

    const liftedRoots = group.children.length > 0 ? group.children : [group];
    for (const child of liftedRoots) {
      const baseZ =
        typeof child.userData.mtTopSurfaceBaseZ === "number"
          ? child.userData.mtTopSurfaceBaseZ
          : child.position.z;
      child.userData.mtTopSurfaceBaseZ = baseZ;
      child.position.z = baseZ + liftM;
      child.updateMatrixWorld();
    }

    group.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const material = obj.material;
      const materials = Array.isArray(material) ? material : [material];
      for (const m of materials) {
        if (m.userData?.ignoreLayerStyle === true) continue;
        if ("wireframe" in m) {
          (m as THREE.Material & { wireframe: boolean }).wireframe = wireframe;
        }
        if ("roughness" in m) {
          (m as THREE.Material & { roughness: number }).roughness = roughness;
        }
        if ("metalness" in m) {
          (m as THREE.Material & { metalness: number }).metalness = metalness;
        }
        if ("color" in m) {
          (m as THREE.Material & { color: THREE.Color }).color.copy(tint);
        }
        m.needsUpdate = true;
      }
    });
  }

export function applyPointMarkerStyleImpl(this: any, id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_STATIONS_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;

    const defaultRadius =
      typeof group.userData.defaultMarkerRadiusM === "number"
        ? group.userData.defaultMarkerRadiusM
        : 1;
    const defaultLift =
      typeof group.userData.defaultMarkerLiftM === "number"
        ? group.userData.defaultMarkerLiftM
        : 0;
    const defaultLabelLift =
      typeof group.userData.defaultMarkerLabelLiftM === "number"
        ? group.userData.defaultMarkerLabelLiftM
        : 1;
    const radius = styleNumber(
      style,
      "pointMarkerRadiusM",
      defaultRadius,
      0.05,
      20000,
    );
    const lift = styleNumber(
      style,
      "pointMarkerLiftM",
      defaultLift,
      -20000,
      20000,
    );
    const labelLift = styleNumber(
      style,
      "pointMarkerLabelLiftM",
      defaultLabelLift,
      0,
      50000,
    );
    const alignToTopo = style.pointMarkerAlignToTopo === true;
    const markerBaseZ = (obj: THREE.Object3D) => {
      const baseZ =
        typeof obj.userData.baseZ === "number"
          ? obj.userData.baseZ
          : obj.position.z;
      if (!alignToTopo) return baseZ;
      const baseX =
        typeof obj.userData.baseX === "number" ? obj.userData.baseX : obj.position.x;
      const baseY =
        typeof obj.userData.baseY === "number" ? obj.userData.baseY : obj.position.y;
      const topoZ = this.renderedTopoSurfaceZ?.(baseX, baseY);
      return typeof topoZ === "number" && Number.isFinite(topoZ)
        ? topoZ
        : baseZ;
    };
    const selectedStationId =
      typeof style.mtStationQcSelectedStationId === "string"
        ? style.mtStationQcSelectedStationId
        : "";
    group.userData.mtStationQcSelectedStationId = selectedStationId;

    group.traverse((obj: THREE.Object3D) => {
      if (obj.userData?.pointMarker === true && obj instanceof THREE.Mesh) {
        const baseRadius =
          typeof obj.userData.baseMarkerRadiusM === "number"
            ? obj.userData.baseMarkerRadiusM
            : defaultRadius;
        const scale = radius / Math.max(0.0001, baseRadius);
        obj.scale.setScalar(scale);
        obj.position.z = markerBaseZ(obj) + lift;
        const stationId =
          typeof obj.userData.sourceProperties?.stationId === "string"
            ? obj.userData.sourceProperties.stationId
            : typeof obj.userData.markerId === "string"
              ? obj.userData.markerId
              : "";
        const material = obj.material;
        const materials = Array.isArray(material) ? material : [material];
        for (const m of materials) {
          if ("color" in m) {
            (m as THREE.Material & { color: THREE.Color }).color.set(
              stationId && stationId === selectedStationId
                ? "#ffd34d"
                : (style.color ?? "#999999"),
            );
          }
          if ("emissive" in m) {
            (m as THREE.Material & { emissive: THREE.Color }).emissive.set(
              stationId && stationId === selectedStationId
                ? "#ff7a2c"
                : "#000000",
            );
          }
          m.needsUpdate = true;
        }
      }
      if (obj.userData?.pointMarkerLabelAnchor === true) {
        obj.position.z = markerBaseZ(obj) + lift + labelLift;
      }
    });
  }

export function applyResistivitySliceStyleImpl(this: any, id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;
    const horizontalVisible =
      style.resistivityHorizontalSlicesVisible !== false;
    const verticalVisible = style.resistivityVerticalSectionsVisible !== false;
    const topTraceVisible = style.resistivitySectionTopTraceVisible !== false;
    const sliceMode = style.resistivitySliceMode === "single" ? "single" : "stack";
    const selectedSliceId =
      typeof style.resistivitySelectedSliceId === "string"
        ? style.resistivitySelectedSliceId
        : DEFAULT_MT_RESISTIVITY_SLICE_ID;
    const perSlice =
      typeof style.resistivitySliceVisibility === "object" &&
      style.resistivitySliceVisibility !== null
        ? (style.resistivitySliceVisibility as Record<string, boolean>)
        : {};

    group.traverse((obj: THREE.Object3D) => {
      if (
        obj.userData?.resistivitySlicePreview !== true &&
        obj.userData?.resistivitySectionTopTrace !== true
      ) {
        return;
      }
      const kind =
        typeof obj.userData.resistivitySliceKind === "string"
          ? obj.userData.resistivitySliceKind
          : "";
      const sliceId =
        typeof obj.userData.resistivitySliceId === "string"
          ? obj.userData.resistivitySliceId
          : "";
      const groupVisible =
        kind === "vertical-section" ? verticalVisible : horizontalVisible;
      const stackVisible =
        sliceMode === "stack" || sliceId === selectedSliceId;
      const roleVisible =
        obj.userData?.resistivitySectionTopTrace === true
          ? topTraceVisible
          : true;
      obj.visible =
        groupVisible && roleVisible && stackVisible && perSlice[sliceId] !== false;
    });
  }
