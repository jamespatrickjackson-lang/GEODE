import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { EditableStyle } from "../pages/types";
import type { TerrainMaterialHandle } from "../scene/terrainMaterial";
import { styleNumber } from "./runtimeUtils";

const PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS = 48;
const PUBLIC_SURFACE_CLIP_RENDER_ORDER = 4550;
const PUBLIC_SURFACE_CLIP_DEFAULTS = {
  centerX: 0,
  centerY: 0,
  centerZ: 2000,
  sizeX: 279_150,
  sizeY: 227_900,
  sizeZ: 8000,
  rotationZDeg: 0,
} as const;

export interface PublicSurfaceClipBox {
  enabled: boolean;
  shape: "box" | "circle";
  center: THREE.Vector3;
  halfSize: THREE.Vector3;
  rotationZRad: number;
}

interface PublicSurfaceClipHandle {
  group: THREE.Group;
  line: LineSegments2;
}

export interface PublicSurfaceClipApplyContext {
  editorMode: boolean;
  publicLayerIds: string[];
  getLayerGroup(id: string): THREE.Group | undefined;
  getLayerStyle(id: string): EditableStyle;
  isGraticuleLayerId(id: string): boolean;
  onActiveChange(active: boolean): void;
  updateRendererLocalClipping(): void;
}

export function publicSurfaceFrameAuthored(style: EditableStyle): boolean {
  return (
    typeof style.publicSurfaceClipCenterX === "number" ||
    typeof style.publicSurfaceClipCenterY === "number" ||
    typeof style.publicSurfaceClipSizeX === "number" ||
    typeof style.publicSurfaceClipSizeY === "number" ||
    typeof style.publicSurfaceClipRotationZDeg === "number"
  );
}

export function publicSurfaceClipBox(style: EditableStyle): PublicSurfaceClipBox {
  const sizeX = styleNumber(
    style,
    "publicSurfaceClipSizeX",
    PUBLIC_SURFACE_CLIP_DEFAULTS.sizeX,
    100,
    500_000,
  );
  const sizeY = styleNumber(
    style,
    "publicSurfaceClipSizeY",
    PUBLIC_SURFACE_CLIP_DEFAULTS.sizeY,
    100,
    500_000,
  );
  const sizeZ = styleNumber(
    style,
    "publicSurfaceClipSizeZ",
    PUBLIC_SURFACE_CLIP_DEFAULTS.sizeZ,
    100,
    50_000,
  );
  return {
    enabled: style.publicSurfaceClipEnabled === true,
    shape: style.publicSurfaceClipShape === "circle" ? "circle" : "box",
    center: new THREE.Vector3(
      styleNumber(
        style,
        "publicSurfaceClipCenterX",
        PUBLIC_SURFACE_CLIP_DEFAULTS.centerX,
        -300_000,
        300_000,
      ),
      styleNumber(
        style,
        "publicSurfaceClipCenterY",
        PUBLIC_SURFACE_CLIP_DEFAULTS.centerY,
        -300_000,
        300_000,
      ),
      styleNumber(
        style,
        "publicSurfaceClipCenterZ",
        PUBLIC_SURFACE_CLIP_DEFAULTS.centerZ,
        -20_000,
        30_000,
      ),
    ),
    halfSize: new THREE.Vector3(sizeX * 0.5, sizeY * 0.5, sizeZ * 0.5),
    rotationZRad: THREE.MathUtils.degToRad(
      styleNumber(
        style,
        "publicSurfaceClipRotationZDeg",
        PUBLIC_SURFACE_CLIP_DEFAULTS.rotationZDeg,
        -180,
        180,
      ),
    ),
  };
}

export function publicSurfaceClipAxes(box: PublicSurfaceClipBox): {
  xAxis: THREE.Vector3;
  yAxis: THREE.Vector3;
  zAxis: THREE.Vector3;
} {
  const c = Math.cos(box.rotationZRad);
  const s = Math.sin(box.rotationZRad);
  return {
    xAxis: new THREE.Vector3(c, s, 0),
    yAxis: new THREE.Vector3(-s, c, 0),
    zAxis: new THREE.Vector3(0, 0, 1),
  };
}

export function publicSurfaceClipPlanes(
  box: PublicSurfaceClipBox,
): THREE.Plane[] {
  const { xAxis, yAxis, zAxis } = publicSurfaceClipAxes(box);
  const makePlane = (
    normal: THREE.Vector3,
    axis: THREE.Vector3,
    distance: number,
  ) => {
    const point = box.center.clone().addScaledVector(axis, distance);
    return new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal.clone(),
      point,
    );
  };
  const zPlanes = [
    makePlane(zAxis.clone().negate(), zAxis, box.halfSize.z),
    makePlane(zAxis, zAxis, -box.halfSize.z),
  ];
  if (box.shape === "circle") {
    const radius = Math.min(box.halfSize.x, box.halfSize.y);
    const radialPlanes: THREE.Plane[] = [];
    for (let i = 0; i < PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS; i += 1) {
      const theta = (i / PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS) * Math.PI * 2;
      const outward = xAxis
        .clone()
        .multiplyScalar(Math.cos(theta))
        .addScaledVector(yAxis, Math.sin(theta))
        .normalize();
      const point = box.center.clone().addScaledVector(outward, radius);
      radialPlanes.push(
        new THREE.Plane().setFromNormalAndCoplanarPoint(
          outward.clone().negate(),
          point,
        ),
      );
    }
    return [...radialPlanes, ...zPlanes];
  }
  return [
    makePlane(xAxis.clone().negate(), xAxis, box.halfSize.x),
    makePlane(xAxis, xAxis, -box.halfSize.x),
    makePlane(yAxis.clone().negate(), yAxis, box.halfSize.y),
    makePlane(yAxis, yAxis, -box.halfSize.y),
    ...zPlanes,
  ];
}

function publicSurfaceClipSegmentPositions(box: PublicSurfaceClipBox): number[] {
  const { xAxis, yAxis, zAxis } = publicSurfaceClipAxes(box);
  if (box.shape === "circle") {
    const positions: number[] = [];
    const radius = Math.min(box.halfSize.x, box.halfSize.y);
    const point = (theta: number, zSign: number) =>
      box.center
        .clone()
        .addScaledVector(xAxis, Math.cos(theta) * radius)
        .addScaledVector(yAxis, Math.sin(theta) * radius)
        .addScaledVector(zAxis, zSign * box.halfSize.z);
    for (let i = 0; i < PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS; i += 1) {
      const a = (i / PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS) * Math.PI * 2;
      const b = ((i + 1) / PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS) * Math.PI * 2;
      const bottomA = point(a, -1);
      const bottomB = point(b, -1);
      const topA = point(a, 1);
      const topB = point(b, 1);
      positions.push(
        bottomA.x,
        bottomA.y,
        bottomA.z,
        bottomB.x,
        bottomB.y,
        bottomB.z,
        topA.x,
        topA.y,
        topA.z,
        topB.x,
        topB.y,
        topB.z,
      );
      if (i % 6 === 0) {
        positions.push(
          bottomA.x,
          bottomA.y,
          bottomA.z,
          topA.x,
          topA.y,
          topA.z,
        );
      }
    }
    return positions;
  }
  const corner = (sx: number, sy: number, sz: number) =>
    box.center
      .clone()
      .addScaledVector(xAxis, sx * box.halfSize.x)
      .addScaledVector(yAxis, sy * box.halfSize.y)
      .addScaledVector(zAxis, sz * box.halfSize.z);
  const corners = [
    corner(-1, -1, -1),
    corner(1, -1, -1),
    corner(1, 1, -1),
    corner(-1, 1, -1),
    corner(-1, -1, 1),
    corner(1, -1, 1),
    corner(1, 1, 1),
    corner(-1, 1, 1),
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ] as const;
  return edges.flatMap(([a, b]) => [
    corners[a].x,
    corners[a].y,
    corners[a].z,
    corners[b].x,
    corners[b].y,
    corners[b].z,
  ]);
}

export class PublicSurfaceClipRuntime {
  private handle: PublicSurfaceClipHandle | null = null;
  private active = false;

  constructor(private readonly scene: THREE.Scene) {}

  isActive(): boolean {
    return this.active;
  }

  setEditorMode(enabled: boolean): void {
    if (this.handle) this.handle.group.visible = enabled && this.active;
  }

  notifyResize(width: number, height: number): void {
    const material = this.handle?.line.material;
    if (material instanceof LineMaterial) material.resolution.set(width, height);
  }

  dispose(): void {
    if (!this.handle) return;
    this.handle.group.parent?.remove(this.handle.group);
    this.handle.line.geometry.dispose();
    const material = this.handle.line.material;
    if (Array.isArray(material)) {
      for (const item of material) item.dispose();
    } else {
      material.dispose();
    }
    this.handle = null;
    this.active = false;
  }

  applyStyle(style: EditableStyle, context: PublicSurfaceClipApplyContext): void {
    const box = publicSurfaceClipBox(style);
    const planes = box.enabled ? publicSurfaceClipPlanes(box) : [];
    this.active = box.enabled;
    context.onActiveChange(box.enabled);
    context.updateRendererLocalClipping();

    for (const layerId of context.publicLayerIds) {
      const group = context.getLayerGroup(layerId);
      if (!group) continue;
      const graticuleUsesTerrainEdgeFrame =
        context.isGraticuleLayerId(layerId) &&
        context.getLayerStyle(layerId).graticuleEdgeFadeAware !== false;
      group.traverse((obj) => {
        const handle = (obj as THREE.Mesh).userData?.terrainHandle as
          | TerrainMaterialHandle
          | undefined;
        handle?.setPublicClip(
          box.enabled,
          box.shape,
          box.center,
          box.halfSize,
          box.rotationZRad,
        );

        const material = (
          obj as { material?: THREE.Material | THREE.Material[] }
        ).material;
        if (!material) return;
        const materials = Array.isArray(material) ? material : [material];
        for (const item of materials) {
          if (item.userData?.publicSurfaceClipHelper === true) continue;
          const terrainShaderHandlesClip =
            box.shape === "circle" && item.userData?.terrainMaterial === true;
          const publicSurfaceClipPlanes =
            box.enabled &&
            !terrainShaderHandlesClip &&
            !graticuleUsesTerrainEdgeFrame
              ? planes
              : null;
          item.userData.publicSurfaceClipPlanes = publicSurfaceClipPlanes;
          item.clippingPlanes = publicSurfaceClipPlanes;
          item.clipIntersection = false;
          item.needsUpdate = true;
        }
      });
    }
    this.rebuildHelper(box, context.editorMode);
  }

  private ensureHandle(): PublicSurfaceClipHandle {
    if (this.handle) return this.handle;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions([]);
    const material = new LineMaterial({
      color: 0xffffff,
      linewidth: 2.2,
      worldUnits: false,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
      dashed: false,
    });
    material.fog = false;
    material.userData.forceTransparent = true;
    material.resolution.set(
      window.innerWidth || 1920,
      window.innerHeight || 1080,
    );
    const line = new LineSegments2(geometry, material);
    line.name = "Public surface clipping box";
    line.renderOrder = PUBLIC_SURFACE_CLIP_RENDER_ORDER;
    line.userData.publicSurfaceClipHelper = true;
    const group = new THREE.Group();
    group.name = "__public_surface_clip_box__";
    group.visible = false;
    group.userData.publicSurfaceClipHelper = true;
    group.add(line);
    this.scene.add(group);
    this.handle = { group, line };
    return this.handle;
  }

  private rebuildHelper(box: PublicSurfaceClipBox, editorMode: boolean): void {
    const handle = this.ensureHandle();
    handle.group.visible = editorMode && box.enabled;
    if (!box.enabled) return;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(publicSurfaceClipSegmentPositions(box));
    handle.line.geometry.dispose();
    handle.line.geometry = geometry;
    handle.line.computeLineDistances();
  }
}
