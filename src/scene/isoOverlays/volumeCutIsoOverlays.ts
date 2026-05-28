import * as THREE from "three";
import type { EditableStyle } from "../../pages/types";
import {
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import { disposeObjectTree } from "../disposeObjectTree";
import {
  DEFAULT_SCALAR_HIGH_COLOR,
  DEFAULT_SCALAR_LOW_COLOR,
  DEFAULT_SCALAR_MID_COLOR,
  DEFAULT_SEISMIC_HIGH_COLOR,
  DEFAULT_SEISMIC_LOW_COLOR,
  DEFAULT_SEISMIC_MID_COLOR,
  seismicBackgroundAlphaAt,
} from "../styles/colorScales";
import { clampRange, styleColor, styleNumber } from "../styles/styleUtils";
import {
  mtVolumeCutSectionId,
  mtVolumeCutTargetKey,
  seismicVolumeCutSectionId,
  seismicVolumeCutTargetKey,
  updateScalarSectionIsoOverlay,
  type ScalarSectionIsoOptions,
} from "./sectionIsoOverlay";
import type {
  ResolvedSceneSectionFrame,
  ResolvedSceneSectionPlane,
  ScalarSectionIsoTarget,
} from "../SceneManager";

const MT_VOLUME_SECTION_ISO_GRID_SIZE = 96;

export function listMtVolumeCutIsoTargetsImpl(this: any, layerId?: string): ScalarSectionIsoTarget[] {
    if (layerId && layerId !== UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID)
      return [];
    const mesh = this.activeScalarVolumeMesh();
    if (!mesh) return [];
    const productId =
      typeof mesh.userData.scalarVolumeProductId === "string"
        ? mesh.userData.scalarVolumeProductId
        : mesh.uuid;
    const productLabel =
      typeof mesh.userData.scalarVolumeProductLabel === "string"
        ? mesh.userData.scalarVolumeProductLabel
        : "MT volume";
    const sourceRange = Array.isArray(mesh.userData.scalarVolumeSourceRange)
      ? (mesh.userData.scalarVolumeSourceRange as number[])
      : [-2, 4.5];
    const scalarMin = Number.isFinite(sourceRange[0]) ? sourceRange[0] : -2;
    const scalarMax = Number.isFinite(sourceRange[1]) ? sourceRange[1] : 4.5;
    return this.sceneSectionActivePlanes(this.lastSceneSectionStyle).map(
      (plane: ResolvedSceneSectionPlane) => ({
        targetKey: mtVolumeCutTargetKey(
          UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
          productId,
          plane.axis,
        ),
        layerId: UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        sectionId: mtVolumeCutSectionId(productId, plane.axis),
        label: `${productLabel} ${plane.axis.toUpperCase()} cut`,
        kind: "MT volume cut",
        group: "mt-volume-cuts",
        groupLabel: "MT volume cuts",
        visible: true,
        scalarMin,
        scalarMax,
      }),
    );
  }

export function listSeismicVolumeCutIsoTargetsImpl(this: any, layerId?: string): ScalarSectionIsoTarget[] {
    if (layerId && layerId !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) return [];
    const mesh = this.activeSeismicVolumeMesh();
    if (!mesh) return [];
    const productId =
      typeof mesh.userData.seismicProductId === "string"
        ? mesh.userData.seismicProductId
        : mesh.uuid;
    const productLabel =
      typeof mesh.userData.seismicProductLabel === "string"
        ? mesh.userData.seismicProductLabel
        : "Seismic volume";
    return this.sceneSectionActivePlanes(this.lastSceneSectionStyle).map(
      (plane: ResolvedSceneSectionPlane) => ({
        targetKey: seismicVolumeCutTargetKey(
          UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
          productId,
          plane.axis,
        ),
        layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        sectionId: seismicVolumeCutSectionId(productId, plane.axis),
        label: `${productLabel} ${plane.axis.toUpperCase()} volume cut`,
        kind: "seismic volume cut",
        group: "seismic-volume-cuts",
        groupLabel: "Seismic volume cuts",
        visible: true,
        scalarMin: 0,
        scalarMax: 1,
      }),
    );
  }

export function scalarVolumeIsoOverlayGroupImpl(this: any, volumeLayer: THREE.Group): THREE.Group {
    const existing = volumeLayer.userData.mtVolumeSectionIsoOverlayGroup as
      | THREE.Group
      | undefined;
    if (existing && existing.parent === volumeLayer) return existing;
    const group = new THREE.Group();
    group.name = "mt-volume-section-iso-overlays";
    group.userData.ignoreLayerStyle = true;
    group.userData.sceneSectionHelper = true;
    group.userData.mtVolumeSectionIsoOverlayGroup = true;
    volumeLayer.userData.mtVolumeSectionIsoOverlayGroup = group;
    volumeLayer.add(group);
    return group;
  }

export function clearMtVolumeCutIsoOverlaysImpl(this: any, volumeLayer?: THREE.Group): void {
    const group = (
      volumeLayer ?? this.layers.get(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID)
    )?.userData.mtVolumeSectionIsoOverlayGroup as THREE.Group | undefined;
    if (!group) return;
    const parent = group.parent;
    if (parent) parent.remove(group);
    disposeObjectTree(group);
    if (volumeLayer) delete volumeLayer.userData.mtVolumeSectionIsoOverlayGroup;
  }

export function sampleScalarVolumeByteImpl(this: any, bytes: Uint8Array, dimensions: [number, number, number], u: number, v: number, w: number): number {
    const [nx, ny, nz] = dimensions;
    const x = clampRange(u, 0, 1) * Math.max(0, nx - 1);
    const y = clampRange(v, 0, 1) * Math.max(0, ny - 1);
    const z = clampRange(w, 0, 1) * Math.max(0, nz - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const x1 = Math.min(nx - 1, x0 + 1);
    const y1 = Math.min(ny - 1, y0 + 1);
    const z1 = Math.min(nz - 1, z0 + 1);
    const tx = x - x0;
    const ty = y - y0;
    const tz = z - z0;
    const sample = (ix: number, iy: number, iz: number): number => {
      const index = ix + nx * (iy + ny * iz);
      return bytes[index] ?? 0;
    };
    const c000 = sample(x0, y0, z0);
    const c100 = sample(x1, y0, z0);
    const c010 = sample(x0, y1, z0);
    const c110 = sample(x1, y1, z0);
    const c001 = sample(x0, y0, z1);
    const c101 = sample(x1, y0, z1);
    const c011 = sample(x0, y1, z1);
    const c111 = sample(x1, y1, z1);
    const c00 = c000 + (c100 - c000) * tx;
    const c10 = c010 + (c110 - c010) * tx;
    const c01 = c001 + (c101 - c001) * tx;
    const c11 = c011 + (c111 - c011) * tx;
    const c0 = c00 + (c10 - c00) * ty;
    const c1 = c01 + (c11 - c01) * ty;
    return c0 + (c1 - c0) * tz;
  }

export function buildMtVolumeCutMeshImpl(this: any, mesh: THREE.Mesh, plane: ResolvedSceneSectionPlane, options: {
      sourceMin: number;
      sourceMax: number;
      thresholdMin: number;
      thresholdMax: number;
      maskVisible: boolean;
      targetKey: string;
      sectionFrame?: ResolvedSceneSectionFrame | null;
    }): {
    mesh: THREE.Mesh;
    values: Float32Array;
    alphaValues: Float32Array;
  } | null {
    const dimensions = Array.isArray(mesh.userData.scalarVolumeDimensions)
      ? (mesh.userData.scalarVolumeDimensions as [number, number, number])
      : null;
    const bounds = mesh.userData.scalarVolumeBounds as
      | { min?: [number, number, number]; max?: [number, number, number] }
      | undefined;
    const volumeData = mesh.userData.scalarVolumeData as Uint8Array | undefined;
    const maskData = mesh.userData.scalarVolumeMaskData as
      | Uint8Array
      | undefined;
    if (!dimensions || !bounds?.min || !bounds.max || !volumeData) return null;
    const [nx, ny, nz] = dimensions;
    if (nx <= 1 || ny <= 1 || nz <= 1) return null;

    const min = bounds.min;
    const max = bounds.max;
    const axisIndex = plane.axis === "x" ? 0 : plane.axis === "y" ? 1 : 2;
    if (plane.positionM < min[axisIndex] || plane.positionM > max[axisIndex]) {
      return null;
    }

    const grid = MT_VOLUME_SECTION_ISO_GRID_SIZE;
    const positions = new Float32Array(grid * grid * 3);
    const values = new Float32Array(grid * grid);
    const alphaValues = new Float32Array(grid * grid);
    const axisA = plane.axis === "x" ? 1 : 0;
    const axisB = plane.axis === "z" ? 1 : 2;
    const coords = [0, 0, 0];

    for (let j = 0; j < grid; j += 1) {
      const bT = j / (grid - 1);
      for (let i = 0; i < grid; i += 1) {
        const aT = i / (grid - 1);
        coords[axisIndex] = plane.positionM;
        coords[axisA] = min[axisA] + (max[axisA] - min[axisA]) * aT;
        coords[axisB] = min[axisB] + (max[axisB] - min[axisB]) * bT;
        const vertexIndex = i + j * grid;
        positions[vertexIndex * 3] = coords[0];
        positions[vertexIndex * 3 + 1] = coords[1];
        positions[vertexIndex * 3 + 2] = coords[2];
        const insideSectionFrame =
          !options.sectionFrame ||
          (coords[options.sectionFrame.axisAIndex] >=
            options.sectionFrame.minAM &&
            coords[options.sectionFrame.axisAIndex] <=
              options.sectionFrame.maxAM &&
            coords[options.sectionFrame.axisBIndex] >=
              options.sectionFrame.minBM &&
            coords[options.sectionFrame.axisBIndex] <=
              options.sectionFrame.maxBM);
        const u = (coords[0] - min[0]) / Math.max(0.000001, max[0] - min[0]);
        const v = (coords[1] - min[1]) / Math.max(0.000001, max[1] - min[1]);
        const w = (coords[2] - min[2]) / Math.max(0.000001, max[2] - min[2]);
        const normalized =
          this.sampleScalarVolumeByte(volumeData, dimensions, u, v, w) / 255;
        const scalar =
          options.sourceMin +
          normalized * (options.sourceMax - options.sourceMin);
        const mask =
          options.maskVisible && maskData
            ? this.sampleScalarVolumeByte(maskData, dimensions, u, v, w) / 255
            : 1;
        values[vertexIndex] = scalar;
        alphaValues[vertexIndex] =
          insideSectionFrame &&
          scalar >= options.thresholdMin &&
          scalar <= options.thresholdMax &&
          mask > 0.01
            ? mask
            : 0;
      }
    }

    const indices: number[] = [];
    for (let j = 0; j < grid - 1; j += 1) {
      for (let i = 0; i < grid - 1; i += 1) {
        const a = i + j * grid;
        const b = i + 1 + j * grid;
        const c = i + (j + 1) * grid;
        const d = i + 1 + (j + 1) * grid;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({
      visible: false,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      fog: false,
    });
    material.userData.ignoreLayerStyle = true;
    material.userData.sceneSectionHelper = true;
    const cut = new THREE.Mesh(geometry, material);
    cut.name = `${plane.axis.toUpperCase()} MT volume ISO cut`;
    cut.userData.ignoreLayerStyle = true;
    cut.userData.sceneSectionHelper = true;
    cut.userData.sectionIsoTargetKey = options.targetKey;
    cut.userData.sectionIsoPlaneAxis = plane.axis;
    cut.userData.sectionIsoPlanePositionM = plane.positionM;
    return { mesh: cut, values, alphaValues };
  }

export function updateMtVolumeCutIsoOverlaysImpl(this: any, style: EditableStyle): void {
    const volumeLayer = this.layers.get(
      UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
    );
    if (!volumeLayer) return;
    this.clearMtVolumeCutIsoOverlays(volumeLayer);
    if (style.sectionIsoEnabled !== true || !volumeLayer.visible) return;
    const mesh = this.activeScalarVolumeMesh();
    if (!mesh) return;
    const planes = this.sceneSectionActivePlanes(this.lastSceneSectionStyle);
    if (planes.length === 0) return;
    const sectionBounds = this.sceneSectionBounds(
      this.lastSceneSectionStyle,
      this.sceneSectionLayerIds(this.lastSceneSectionStyle),
      this.sceneSectionProductIds(this.lastSceneSectionStyle),
    );
    const sectionFrames = this.resolveSceneSectionFrames(
      this.lastSceneSectionStyle,
      sectionBounds,
    );

    const productId =
      typeof mesh.userData.scalarVolumeProductId === "string"
        ? mesh.userData.scalarVolumeProductId
        : mesh.uuid;
    const selectedTargets =
      typeof style.sectionIsoTargetIds === "object" &&
      style.sectionIsoTargetIds !== null
        ? (style.sectionIsoTargetIds as Record<string, boolean>)
        : {};
    const sourceRange = Array.isArray(mesh.userData.scalarVolumeSourceRange)
      ? (mesh.userData.scalarVolumeSourceRange as number[])
      : [-2, 4.5];
    const displayRange = Array.isArray(mesh.userData.scalarVolumeDisplayRange)
      ? (mesh.userData.scalarVolumeDisplayRange as number[])
      : [sourceRange[0], sourceRange[1]];
    const sourceMin = Number.isFinite(sourceRange[0]) ? sourceRange[0] : -2;
    const sourceMax = Number.isFinite(sourceRange[1]) ? sourceRange[1] : 4.5;
    const displayMin = styleNumber(
      style,
      "scalarDisplayMin",
      Number.isFinite(displayRange[0]) ? displayRange[0] : sourceMin,
      -100,
      100,
    );
    const displayMax = Math.max(
      styleNumber(
        style,
        "scalarDisplayMax",
        Number.isFinite(displayRange[1]) ? displayRange[1] : sourceMax,
        -100,
        100,
      ),
      displayMin + 0.000001,
    );
    const thresholdMin = styleNumber(
      style,
      "scalarVolumeThresholdMin",
      styleNumber(style, "scalarFocusMin", sourceMin, -100, 100),
      -100,
      100,
    );
    const thresholdMax = Math.max(
      styleNumber(
        style,
        "scalarVolumeThresholdMax",
        styleNumber(style, "scalarFocusMax", sourceMax, -100, 100),
        -100,
        100,
      ),
      thresholdMin + 0.000001,
    );
    const isoMin = clampRange(
      styleNumber(style, "sectionIsoMin", thresholdMin, sourceMin, sourceMax),
      sourceMin,
      sourceMax,
    );
    const isoMax = clampRange(
      Math.max(
        styleNumber(style, "sectionIsoMax", thresholdMax, sourceMin, sourceMax),
        isoMin + 0.000001,
      ),
      isoMin + 0.000001,
      sourceMax,
    );
    const baseOptions = {
      layerId: UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
      enabled: true,
      linesVisible: style.sectionIsoLinesVisible !== false,
      bandsVisible: style.sectionIsoBandsVisible !== false,
      selectedTargetIds: selectedTargets,
      isoMin,
      isoMax,
      levelCount: Math.round(
        styleNumber(style, "sectionIsoLevelCount", 5, 2, 32),
      ),
      lineWidth: styleNumber(style, "sectionIsoLineWidth", 2.6, 0, 12),
      lineStyle: style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid",
      bandOpacity: styleNumber(style, "sectionIsoBandOpacity", 0.32, 0, 0.85),
      fillOffset: styleNumber(style, "sectionIsoFillOffset", 0, -1, 1),
      colorMin: displayMin,
      colorMax: displayMax,
      midpoint: styleNumber(style, "scalarMidpoint", 0.5, 0.05, 0.95),
      contrast: styleNumber(style, "scalarContrast", 1.05, 0.35, 3),
      lowColor: styleColor(style, "scalarColorLow", DEFAULT_SCALAR_LOW_COLOR),
      midColor: styleColor(style, "scalarColorMid", DEFAULT_SCALAR_MID_COLOR),
      highColor: styleColor(
        style,
        "scalarColorHigh",
        DEFAULT_SCALAR_HIGH_COLOR,
      ),
      skipSceneSectionClipping: true,
    } satisfies Omit<ScalarSectionIsoOptions, "targetKey" | "alphaValues">;

    const overlayGroup = this.scalarVolumeIsoOverlayGroup(volumeLayer);
    for (const plane of planes) {
      const targetKey = mtVolumeCutTargetKey(
        UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        productId,
        plane.axis,
      );
      if (selectedTargets[targetKey] === false) continue;
      const cut = this.buildMtVolumeCutMesh(mesh, plane, {
        sourceMin,
        sourceMax,
        thresholdMin,
        thresholdMax,
        maskVisible: style.scalarVolumeMaskVisible !== false,
        targetKey,
        sectionFrame:
          sectionFrames.find(
            (frame: ResolvedSceneSectionFrame) => frame.axis === plane.axis,
          ) ?? null,
      });
      if (!cut) continue;
      updateScalarSectionIsoOverlay(cut.mesh, cut.values, {
        ...baseOptions,
        targetKey,
        alphaValues: cut.alphaValues,
      });
      if (cut.mesh.userData.scalarSectionIsoOverlayRoot) {
        overlayGroup.add(cut.mesh);
      } else {
        disposeObjectTree(cut.mesh);
      }
    }
    if (overlayGroup.children.length === 0) {
      this.clearMtVolumeCutIsoOverlays(volumeLayer);
    }
  }

export function seismicVolumeIsoOverlayGroupImpl(this: any, seismicLayer: THREE.Group): THREE.Group {
    const existing = seismicLayer.userData
      .seismicVolumeSectionIsoOverlayGroup as THREE.Group | undefined;
    if (existing && existing.parent === seismicLayer) return existing;
    const group = new THREE.Group();
    group.name = "seismic-volume-section-iso-overlays";
    group.userData.ignoreLayerStyle = true;
    group.userData.sceneSectionHelper = true;
    group.userData.seismicVolumeSectionIsoOverlayGroup = true;
    seismicLayer.userData.seismicVolumeSectionIsoOverlayGroup = group;
    seismicLayer.add(group);
    return group;
  }

export function clearSeismicVolumeCutIsoOverlaysImpl(this: any, seismicLayer?: THREE.Group): void {
    const group = (
      seismicLayer ?? this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID)
    )?.userData.seismicVolumeSectionIsoOverlayGroup as THREE.Group | undefined;
    if (!group) return;
    const parent = group.parent;
    if (parent) parent.remove(group);
    disposeObjectTree(group);
    if (seismicLayer) {
      delete seismicLayer.userData.seismicVolumeSectionIsoOverlayGroup;
    }
  }

export function buildSeismicVolumeCutMeshImpl(this: any, mesh: THREE.Mesh, plane: ResolvedSceneSectionPlane, options: {
      amplitudeMin: number;
      amplitudeMax: number;
      amplitudeGamma: number;
      removeBackground: boolean;
      backgroundCutoff: number;
      targetKey: string;
    }): {
    mesh: THREE.Mesh;
    values: Float32Array;
    alphaValues: Float32Array;
  } | null {
    const dimensions = Array.isArray(mesh.userData.seismicVolumeDimensions)
      ? (mesh.userData.seismicVolumeDimensions as [number, number, number])
      : null;
    const bounds =
      (mesh.userData.seismicVolumeCurrentBounds as
        | { min?: [number, number, number]; max?: [number, number, number] }
        | undefined) ??
      (mesh.userData.seismicVolumeBaseBounds as
        | { min?: [number, number, number]; max?: [number, number, number] }
        | undefined);
    const volumeData = mesh.userData.seismicVolumeData as
      | Uint8Array
      | undefined;
    if (!dimensions || !bounds?.min || !bounds.max || !volumeData) return null;
    const [nx, ny, nz] = dimensions;
    if (nx <= 1 || ny <= 1 || nz <= 1) return null;

    const min = bounds.min;
    const max = bounds.max;
    const axisIndex = plane.axis === "x" ? 0 : plane.axis === "y" ? 1 : 2;
    if (plane.positionM < min[axisIndex] || plane.positionM > max[axisIndex]) {
      return null;
    }

    const grid = MT_VOLUME_SECTION_ISO_GRID_SIZE;
    const positions = new Float32Array(grid * grid * 3);
    const values = new Float32Array(grid * grid);
    const alphaValues = new Float32Array(grid * grid);
    const axisA = plane.axis === "x" ? 1 : 0;
    const axisB = plane.axis === "z" ? 1 : 2;
    const coords = [0, 0, 0];

    for (let j = 0; j < grid; j += 1) {
      const bT = j / (grid - 1);
      for (let i = 0; i < grid; i += 1) {
        const aT = i / (grid - 1);
        coords[axisIndex] = plane.positionM;
        coords[axisA] = min[axisA] + (max[axisA] - min[axisA]) * aT;
        coords[axisB] = min[axisB] + (max[axisB] - min[axisB]) * bT;
        const vertexIndex = i + j * grid;
        positions[vertexIndex * 3] = coords[0];
        positions[vertexIndex * 3 + 1] = coords[1];
        positions[vertexIndex * 3 + 2] = coords[2];
        const u = (coords[0] - min[0]) / Math.max(0.000001, max[0] - min[0]);
        const v = (coords[1] - min[1]) / Math.max(0.000001, max[1] - min[1]);
        const w = (coords[2] - min[2]) / Math.max(0.000001, max[2] - min[2]);
        const amplitude =
          this.sampleScalarVolumeByte(volumeData, dimensions, u, v, w) / 255;
        values[vertexIndex] = amplitude;
        alphaValues[vertexIndex] = seismicBackgroundAlphaAt(
          amplitude,
          options.amplitudeMin,
          options.amplitudeMax,
          options.removeBackground,
          options.amplitudeGamma,
          options.backgroundCutoff,
        );
      }
    }

    const indices: number[] = [];
    for (let j = 0; j < grid - 1; j += 1) {
      for (let i = 0; i < grid - 1; i += 1) {
        const a = i + j * grid;
        const b = i + 1 + j * grid;
        const c = i + (j + 1) * grid;
        const d = i + 1 + (j + 1) * grid;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({
      visible: false,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      fog: false,
    });
    material.userData.ignoreLayerStyle = true;
    material.userData.sceneSectionHelper = true;
    const cut = new THREE.Mesh(geometry, material);
    cut.name = `${plane.axis.toUpperCase()} seismic volume ISO cut`;
    cut.userData.ignoreLayerStyle = true;
    cut.userData.sceneSectionHelper = true;
    cut.userData.sectionIsoTargetKey = options.targetKey;
    cut.userData.sectionIsoPlaneAxis = plane.axis;
    cut.userData.sectionIsoPlanePositionM = plane.positionM;
    return { mesh: cut, values, alphaValues };
  }

export function updateSeismicVolumeCutIsoOverlaysImpl(this: any, style: EditableStyle): void {
    const seismicLayer = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    if (!seismicLayer) return;
    this.clearSeismicVolumeCutIsoOverlays(seismicLayer);
    if (style.sectionIsoEnabled !== true || !seismicLayer.visible) return;
    const mesh = this.activeSeismicVolumeMesh();
    if (!mesh) return;
    const planes = this.sceneSectionActivePlanes(this.lastSceneSectionStyle);
    if (planes.length === 0) return;

    const productId =
      typeof mesh.userData.seismicProductId === "string"
        ? mesh.userData.seismicProductId
        : mesh.uuid;
    const selectedTargets =
      typeof style.sectionIsoTargetIds === "object" &&
      style.sectionIsoTargetIds !== null
        ? (style.sectionIsoTargetIds as Record<string, boolean>)
        : {};
    const amplitudeMin = styleNumber(style, "seismicAmplitudeMin", 0.08, 0, 1);
    const amplitudeMax = Math.max(
      amplitudeMin + 0.001,
      styleNumber(style, "seismicAmplitudeMax", 0.92, 0, 1),
    );
    const amplitudeGamma = styleNumber(
      style,
      "seismicAmplitudeGamma",
      1,
      0.35,
      2.5,
    );
    const removeBackground = style.seismicRemoveBackground === true;
    const backgroundCutoff = styleNumber(
      style,
      "seismicBackgroundCutoff",
      0.16,
      0,
      0.45,
    );
    const rawIsoMin = styleNumber(style, "sectionIsoMin", amplitudeMin, 0, 1);
    const isoMin = clampRange(rawIsoMin, 0, 1);
    const rawIsoMax = styleNumber(style, "sectionIsoMax", amplitudeMax, 0, 1);
    const isoMax = clampRange(
      Math.max(rawIsoMax, isoMin + 0.000001),
      isoMin + 0.000001,
      1,
    );
    const colormap =
      style.seismicColormap === "grayscale" ||
      style.seismicColormap === "velocity"
        ? style.seismicColormap
        : "blue-white-red";
    const colorMode =
      colormap === "grayscale"
        ? "seismic-grayscale"
        : colormap === "velocity"
          ? "seismic-velocity"
          : "seismic-blue-white-red";
    const baseOptions = {
      layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
      enabled: true,
      linesVisible: style.sectionIsoLinesVisible !== false,
      bandsVisible: style.sectionIsoBandsVisible !== false,
      selectedTargetIds: selectedTargets,
      isoMin,
      isoMax,
      levelCount: Math.round(
        styleNumber(style, "sectionIsoLevelCount", 5, 2, 32),
      ),
      lineWidth: styleNumber(style, "sectionIsoLineWidth", 2.6, 0, 12),
      lineStyle: style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid",
      bandOpacity: styleNumber(style, "sectionIsoBandOpacity", 0.32, 0, 0.85),
      fillOffset: styleNumber(style, "sectionIsoFillOffset", 0, -1, 1),
      colorMode,
      amplitudeGamma,
      colorMin: amplitudeMin,
      colorMax: amplitudeMax,
      midpoint: 0.5,
      contrast: 1,
      lowColor: new THREE.Color(DEFAULT_SEISMIC_LOW_COLOR),
      midColor: new THREE.Color(DEFAULT_SEISMIC_MID_COLOR),
      highColor: new THREE.Color(DEFAULT_SEISMIC_HIGH_COLOR),
      skipSceneSectionClipping: true,
    } satisfies Omit<ScalarSectionIsoOptions, "targetKey" | "alphaValues">;

    const overlayGroup = this.seismicVolumeIsoOverlayGroup(seismicLayer);
    for (const plane of planes) {
      const targetKey = seismicVolumeCutTargetKey(
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        productId,
        plane.axis,
      );
      if (selectedTargets[targetKey] === false) continue;
      const cut = this.buildSeismicVolumeCutMesh(mesh, plane, {
        amplitudeMin,
        amplitudeMax,
        amplitudeGamma,
        removeBackground,
        backgroundCutoff,
        targetKey,
      });
      if (!cut) continue;
      updateScalarSectionIsoOverlay(cut.mesh, cut.values, {
        ...baseOptions,
        targetKey,
        alphaValues: cut.alphaValues,
      });
      if (cut.mesh.userData.scalarSectionIsoOverlayRoot) {
        overlayGroup.add(cut.mesh);
      } else {
        disposeObjectTree(cut.mesh);
      }
    }
    if (overlayGroup.children.length === 0) {
      this.clearSeismicVolumeCutIsoOverlays(seismicLayer);
    }
  }
