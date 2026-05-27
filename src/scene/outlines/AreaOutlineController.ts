import * as THREE from "three";
import type { AreaOutlineDef } from "../../pages/types";
import { SCENE_ORIGIN, utmToScene } from "../../constants";
import { disposeObjectTree } from "../disposeObjectTree";
import { getHeightSampler } from "../heightSampler";

export type AreaOutlineHandleMode = "move" | "scaleX" | "scaleY";

export interface AreaOutlinePreview {
  center: [number, number];
  radiusX: number;
  radiusY: number;
}

const AREA_OUTLINE_RENDER_ORDER = 6.35;
const AREA_OUTLINE_DEFAULT_LIFT_M = 18;
const AREA_OUTLINE_SEGMENTS = 144;

function clampRange(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function hardenAreaOutlineHelperMaterial(material: THREE.Material): void {
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  material.userData.ignoreLayerFog = true;
  (material as THREE.Material & { fog?: boolean }).fog = false;
  material.transparent = true;
  material.needsUpdate = true;
}

export class AreaOutlineController {
  private buildSeq = 0;
  private pickables: THREE.Object3D[] = [];

  constructor(
    private readonly layers: Map<string, THREE.Group>,
    private readonly isEditorMode: () => boolean,
  ) {}

  updateHandleVisibility(): void {
    const layer = this.layers.get("area-outlines");
    if (!layer) return;
    layer.traverse((obj) => {
      if (obj.userData?.areaOutlineEditorHandle === true) {
        obj.visible = this.isEditorMode();
      }
    });
  }

  listPickables(): THREE.Object3D[] {
    return this.isEditorMode() ? this.pickables : [];
  }

  private getRoot(id: string): THREE.Group | null {
    const layer = this.layers.get("area-outlines");
    if (!layer) return null;
    const root = layer.children.find(
      (child) => child.userData?.areaOutlineId === id,
    );
    return root instanceof THREE.Group ? root : null;
  }

  previewAreaOutlineMove(id: string, sceneCenter: THREE.Vector3): void {
    const root = this.getRoot(id);
    if (!root) return;
    root.position.x = sceneCenter.x;
    root.position.y = sceneCenter.y;
    root.userData.previewCenter = [
      sceneCenter.x + SCENE_ORIGIN.easting,
      sceneCenter.y + SCENE_ORIGIN.northing,
    ];
  }

  getAreaOutlineWorldCenter(id: string): THREE.Vector3 | null {
    const root = this.getRoot(id);
    return root ? root.position.clone() : null;
  }

  previewAreaOutlineScaleFromWorld(
    id: string,
    mode: "scaleX" | "scaleY",
    worldPoint: THREE.Vector3,
  ): void {
    const root = this.getRoot(id);
    if (!root) return;
    const local = root.worldToLocal(worldPoint.clone());
    const baseRadiusX = Number(root.userData.baseRadiusX ?? 1);
    const baseRadiusY = Number(root.userData.baseRadiusY ?? 1);
    if (mode === "scaleX") {
      const radius = clampRange(Math.abs(local.x), 10, 20000);
      root.scale.x = radius / Math.max(1, baseRadiusX);
      root.userData.previewRadiusX = radius;
    } else {
      const radius = clampRange(Math.abs(local.y), 10, 20000);
      root.scale.y = radius / Math.max(1, baseRadiusY);
      root.userData.previewRadiusY = radius;
    }
  }

  getAreaOutlinePreview(id: string): AreaOutlinePreview | null {
    const root = this.getRoot(id);
    if (!root) return null;
    const baseRadiusX = Number(root.userData.baseRadiusX ?? 1);
    const baseRadiusY = Number(root.userData.baseRadiusY ?? 1);
    const center =
      Array.isArray(root.userData.previewCenter) &&
      typeof root.userData.previewCenter[0] === "number" &&
      typeof root.userData.previewCenter[1] === "number"
        ? ([root.userData.previewCenter[0], root.userData.previewCenter[1]] as [
            number,
            number,
          ])
        : ([
            root.position.x + SCENE_ORIGIN.easting,
            root.position.y + SCENE_ORIGIN.northing,
          ] as [number, number]);
    return {
      center,
      radiusX:
        typeof root.userData.previewRadiusX === "number"
          ? root.userData.previewRadiusX
          : baseRadiusX * root.scale.x,
      radiusY:
        typeof root.userData.previewRadiusY === "number"
          ? root.userData.previewRadiusY
          : baseRadiusY * root.scale.y,
    };
  }

  private markPickable(
    obj: THREE.Object3D,
    id: string,
    mode: AreaOutlineHandleMode,
  ): void {
    obj.userData.areaOutlineEditorHandle = true;
    obj.userData.areaOutlineId = id;
    obj.userData.areaOutlineHandleMode = mode;
    obj.renderOrder = 4560;
    obj.visible = this.isEditorMode();
    this.pickables.push(obj);
  }

  private addEditorHandles(
    root: THREE.Group,
    outline: AreaOutlineDef,
    rx: number,
    ry: number,
  ): void {
    const mat = new THREE.MeshBasicMaterial({
      color: outline.outlineColor ?? outline.fillColor ?? "#ff8a3d",
      transparent: true,
      opacity: 0.82,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenAreaOutlineHelperMaterial(mat);
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(52, 16, 10),
      mat.clone(),
    );
    center.position.set(0, 0, 95);
    this.markPickable(center, outline.id, "move");
    root.add(center);

    const xHandle = new THREE.Mesh(
      new THREE.BoxGeometry(110, 110, 54),
      mat.clone(),
    );
    xHandle.position.set(rx, 0, 95);
    this.markPickable(xHandle, outline.id, "scaleX");
    root.add(xHandle);

    const yHandle = new THREE.Mesh(
      new THREE.BoxGeometry(110, 110, 54),
      mat.clone(),
    );
    yHandle.position.set(0, ry, 95);
    this.markPickable(yHandle, outline.id, "scaleY");
    root.add(yHandle);
  }

  rebuild(outlines: AreaOutlineDef[] = []): void {
    const layer = this.layers.get("area-outlines");
    if (!layer) return;
    const buildSeq = ++this.buildSeq;
    this.pickables = [];
    while (layer.children.length > 0) {
      const child = layer.children.pop()!;
      disposeObjectTree(child);
    }
    if (outlines.length === 0) return;
    getHeightSampler()
      .then((sampleHeight) => {
        if (buildSeq !== this.buildSeq) return;
        for (const outline of outlines) {
          layer.add(this.makeObject(outline, sampleHeight));
        }
        this.updateHandleVisibility();
      })
      .catch((e) => console.warn("area outline rebuild failed:", e));
  }

  private makeObject(
    outline: AreaOutlineDef,
    sampleHeight: (easting: number, northing: number) => number,
  ): THREE.Group {
    const centerE = Number(outline.center?.[0] ?? 612000);
    const centerN = Number(outline.center?.[1] ?? 5790000);
    const rx = clampRange(Number(outline.radiusX ?? 600), 10, 20000);
    const ry = clampRange(Number(outline.radiusY ?? 360), 10, 20000);
    const rotation = THREE.MathUtils.degToRad(outline.rotationDeg ?? 0);
    const lift = outline.liftMeters ?? AREA_OUTLINE_DEFAULT_LIFT_M;
    const centerZ = sampleHeight(centerE, centerN) + lift;
    const [cx, cy, cz] = utmToScene(centerE, centerN, centerZ);
    const root = new THREE.Group();
    root.name = outline.id;
    root.position.set(cx, cy, cz);
    root.rotation.z = rotation;
    root.userData = {
      areaOutline: true,
      areaOutlineId: outline.id,
      baseRadiusX: rx,
      baseRadiusY: ry,
      displayName: outline.label,
      labelKind: outline.labelKind ?? "area",
    };

    if (outline.fillVisible !== false) {
      const fillGeom = this.makeFillGeometry(
        centerE,
        centerN,
        centerZ,
        rx,
        ry,
        rotation,
        lift,
        sampleHeight,
      );
      const fillMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(outline.fillColor ?? "#ff8a3d"),
        transparent: true,
        opacity: clampRange(outline.fillOpacity ?? 0.2, 0, 1),
        depthTest: true,
        depthWrite: false,
        roughness: 0.74,
        metalness: 0.02,
        side: THREE.DoubleSide,
        toneMapped: true,
        fog: false,
      });
      fillMat.userData.forceTransparent = true;
      fillMat.userData.ignoreLayerStyle = true;
      const fill = new THREE.Mesh(fillGeom, fillMat);
      fill.renderOrder = AREA_OUTLINE_RENDER_ORDER - 0.05;
      fill.userData = {
        areaOutline: true,
        areaOutlineId: outline.id,
        areaOutlinePart: "fill",
        displayName: outline.label,
        labelKind: outline.labelKind ?? "area",
      };
      root.add(fill);
    }

    if (outline.outlineVisible !== false) {
      this.addDashes(
        root,
        outline,
        centerE,
        centerN,
        centerZ,
        rx,
        ry,
        rotation,
        lift,
        sampleHeight,
      );
    }
    this.addEditorHandles(root, outline, rx, ry);
    return root;
  }

  private makeFillGeometry(
    centerE: number,
    centerN: number,
    centerZ: number,
    rx: number,
    ry: number,
    rotation: number,
    lift: number,
    sampleHeight: (easting: number, northing: number) => number,
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const rings = 16;
    const segments = AREA_OUTLINE_SEGMENTS;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const indexAt = (ring: number, seg: number) =>
      ring === 0 ? 0 : 1 + (ring - 1) * segments + (seg % segments);
    const addVertex = (x: number, y: number) => {
      const e = centerE + cosR * x - sinR * y;
      const n = centerN + sinR * x + cosR * y;
      positions.push(x, y, sampleHeight(e, n) + lift - centerZ);
    };
    addVertex(0, 0);
    for (let r = 1; r <= rings; r++) {
      const f = r / rings;
      for (let s = 0; s < segments; s++) {
        const t = (s / segments) * Math.PI * 2;
        addVertex(Math.cos(t) * rx * f, Math.sin(t) * ry * f);
      }
    }
    const indices: number[] = [];
    for (let s = 0; s < segments; s++) {
      indices.push(0, indexAt(1, s), indexAt(1, s + 1));
    }
    for (let r = 2; r <= rings; r++) {
      for (let s = 0; s < segments; s++) {
        const a = indexAt(r - 1, s);
        const b = indexAt(r, s);
        const c = indexAt(r, s + 1);
        const d = indexAt(r - 1, s + 1);
        indices.push(a, b, c, a, c, d);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  private addDashes(
    root: THREE.Group,
    outline: AreaOutlineDef,
    centerE: number,
    centerN: number,
    centerZ: number,
    rx: number,
    ry: number,
    rotation: number,
    lift: number,
    sampleHeight: (easting: number, northing: number) => number,
  ): void {
    const color = new THREE.Color(outline.outlineColor ?? "#ff8a3d");
    const opacity = clampRange(outline.outlineOpacity ?? 0.95, 0, 1);
    const width = clampRange(outline.outlineWidthM ?? 14, 1, 300);
    const dashed = outline.dashed !== false;
    const flat2d = outline.outlineMode === "flat2d";
    const dashLength = clampRange(outline.dashLengthM ?? 170, 5, 2000);
    const dashGap = clampRange(outline.dashGapM ?? 90, 0, 2000);
    const circumference =
      Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const pattern = dashed ? dashLength + dashGap : circumference;
    const dashCount = Math.max(1, Math.ceil(circumference / pattern));
    const radialSegments = 8;
    const materialBase = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.015,
      transparent: true,
      opacity,
      depthTest: true,
      depthWrite: false,
      roughness: 0.62,
      metalness: 0.04,
      toneMapped: true,
      fog: false,
    });
    materialBase.userData.forceTransparent = true;
    materialBase.userData.ignoreLayerStyle = true;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const surfaceOffset = flat2d ? 0.35 : 0;
    const localSurfaceZ = (x: number, y: number) => {
      const e = centerE + cosR * x - sinR * y;
      const n = centerN + sinR * x + cosR * y;
      return sampleHeight(e, n) + lift + surfaceOffset - centerZ;
    };

    for (let i = 0; i < dashCount; i++) {
      const startDistance = i * pattern;
      const endDistance = dashed
        ? Math.min(startDistance + dashLength, circumference)
        : circumference;
      if (endDistance <= startDistance) continue;
      const t0 = (startDistance / circumference) * Math.PI * 2;
      const t1 = (endDistance / circumference) * Math.PI * 2;
      const points: THREE.Vector3[] = [];
      const steps = Math.max(3, Math.ceil(((t1 - t0) / (Math.PI * 2)) * 80));
      for (let j = 0; j <= steps; j++) {
        const t = t0 + (t1 - t0) * (j / steps);
        const x = Math.cos(t) * rx;
        const y = Math.sin(t) * ry;
        points.push(new THREE.Vector3(x, y, localSurfaceZ(x, y)));
      }
      const geom = flat2d
        ? this.makeRibbonGeometry(
            points,
            width,
            centerE,
            centerN,
            centerZ,
            rotation,
            lift + surfaceOffset,
            sampleHeight,
          )
        : new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points),
            steps * 3,
            width * 0.5,
            radialSegments,
            false,
          );
      const dash = new THREE.Mesh(geom, materialBase.clone());
      dash.renderOrder = AREA_OUTLINE_RENDER_ORDER;
      dash.userData = {
        areaOutline: true,
        areaOutlineId: outline.id,
        areaOutlinePart: "outline",
        displayName: outline.label,
        labelKind: outline.labelKind ?? "area",
      };
      root.add(dash);

      if (flat2d) continue;
      const capGeom = new THREE.SphereGeometry(width * 0.5, 12, 8);
      for (const point of [points[0], points[points.length - 1]]) {
        const cap = new THREE.Mesh(capGeom.clone(), materialBase.clone());
        cap.position.copy(point);
        cap.renderOrder = AREA_OUTLINE_RENDER_ORDER;
        cap.userData = {
          areaOutline: true,
          areaOutlineId: outline.id,
          areaOutlinePart: "outline-cap",
          displayName: outline.label,
          labelKind: outline.labelKind ?? "area",
        };
        root.add(cap);
      }
    }
  }

  private makeRibbonGeometry(
    points: THREE.Vector3[],
    width: number,
    centerE: number,
    centerN: number,
    centerZ: number,
    rotation: number,
    lift: number,
    sampleHeight: (easting: number, northing: number) => number,
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const indices: number[] = [];
    const half = width * 0.5;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const sampleLocalZ = (x: number, y: number) => {
      const e = centerE + cosR * x - sinR * y;
      const n = centerN + sinR * x + cosR * y;
      return sampleHeight(e, n) + lift - centerZ;
    };

    for (let i = 0; i < points.length; i++) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const leftX = points[i].x + nx * half;
      const leftY = points[i].y + ny * half;
      const rightX = points[i].x - nx * half;
      const rightY = points[i].y - ny * half;
      positions.push(leftX, leftY, sampleLocalZ(leftX, leftY));
      positions.push(rightX, rightY, sampleLocalZ(rightX, rightY));
      if (i < points.length - 1) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }
}
