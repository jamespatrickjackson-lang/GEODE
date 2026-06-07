import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export interface CaptureCameraPathLineOptions {
  points: readonly THREE.Vector3[];
  color: THREE.ColorRepresentation;
  linewidth: number;
  opacity: number;
  renderOrder: number;
  resolution: THREE.Vector2;
  userData?: Record<string, unknown> & {
    captureCameraPathEquationKind?: string;
    captureCameraPathEquationLabel?: string;
  };
}

export function createCaptureCameraPathLine({
  points,
  color,
  linewidth,
  opacity,
  renderOrder,
  resolution,
  userData,
}: CaptureCameraPathLineOptions): Line2 {
  const geometry = new LineGeometry();
  geometry.setPositions(points.flatMap((point) => [point.x, point.y, point.z]));
  const material = new LineMaterial({
    color,
    linewidth,
    worldUnits: false,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity,
  });
  material.resolution.set(resolution.x, resolution.y);
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  line.renderOrder = renderOrder;
  line.userData.geoseePickIgnore = true;
  line.userData.captureCameraPathOverlay = true;
  if (userData) {
    Object.assign(line.userData, userData);
    if (userData.captureCameraPathEquationKind) {
      line.userData.captureCameraPathEquationOverlay = true;
      line.userData.captureCameraPathEquationKind =
        userData.captureCameraPathEquationKind;
      line.userData.captureCameraPathEquationLabel =
        userData.captureCameraPathEquationLabel ??
        userData.captureCameraPathEquationKind;
    }
  }
  return line;
}

export function setCaptureCameraPathLineResolution(
  root: THREE.Object3D,
  width: number,
  height: number,
): void {
  root.traverse((node) => {
    const material = (node as { material?: THREE.Material | THREE.Material[] })
      .material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const item of materials) {
      if (item instanceof LineMaterial) {
        item.resolution.set(width, height);
      }
    }
  });
}

export function disposeCaptureCameraPathOverlayObject(node: THREE.Object3D): void {
  const geometry = (node as { geometry?: THREE.BufferGeometry }).geometry;
  if (geometry) {
    geometry.dispose();
  }
  const material = (node as { material?: THREE.Material | THREE.Material[] }).material;
  const materials = Array.isArray(material) ? material : material ? [material] : [];
  for (const item of materials) {
    const spriteMap = (item as THREE.SpriteMaterial).map;
    if (spriteMap) {
      spriteMap.dispose();
    }
    item.dispose();
  }
}
