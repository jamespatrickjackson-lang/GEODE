import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { debugLog } from "../utils/debugLog";

interface CameraFrustumFeature {
  type: "Feature";
  properties?: {
    id?: string | number;
    displayName?: string;
    imageId?: number;
    apex?: [number, number, number];
    [key: string]: unknown;
  };
  geometry:
    | {
        type: "LineString";
        coordinates: Array<[number, number, number?]>;
      }
    | {
        type: "MultiLineString";
        coordinates: Array<Array<[number, number, number?]>>;
      }
    | null;
}

interface CameraFrustumCollection {
  type: "FeatureCollection";
  name?: string;
  properties?: Record<string, unknown>;
  features: CameraFrustumFeature[];
}

const LINE_WIDTH_PX = 1.55;
const RENDER_ORDER = 13.45;

function normalizedPoint(point: [number, number, number?]): [number, number, number] | null {
  const next: [number, number, number] = [point[0], point[1], point[2] ?? 0];
  return next.every((value) => Number.isFinite(value)) ? next : null;
}

function appendLineSegments(
  segments: number[],
  coordinates: Array<[number, number, number?]>,
): void {
  let previous: [number, number, number] | null = null;
  for (const rawPoint of coordinates) {
    const point = normalizedPoint(rawPoint);
    if (!point) continue;
    if (previous) {
      segments.push(previous[0], previous[1], previous[2]);
      segments.push(point[0], point[1], point[2]);
    }
    previous = point;
  }
}

export async function loadCameraFrustums(url: string): Promise<THREE.Group> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch camera frustums ${url}: ${response.status}`);
  }

  const data = (await response.json()) as CameraFrustumCollection;
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error(`Invalid camera frustum GeoJSON: ${url}`);
  }

  const group = new THREE.Group();
  group.name = data.name ?? "camera frustums";
  group.userData.displayName = data.name ?? "Camera frustums";
  group.userData.cameraFrustumCollection = true;
  group.userData.sourceProperties = data.properties;

  const segments: number[] = [];
  let frustumCount = 0;

  for (const feature of data.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === "LineString") {
      appendLineSegments(segments, geometry.coordinates);
      frustumCount += 1;
    } else if (geometry.type === "MultiLineString") {
      for (const line of geometry.coordinates) appendLineSegments(segments, line);
      frustumCount += 1;
    }

    const apex = feature.properties?.apex;
    if (
      Array.isArray(apex) &&
      apex.length >= 3 &&
      apex.every((value) => typeof value === "number" && Number.isFinite(value))
    ) {
      const labelAnchor = new THREE.Object3D();
      labelAnchor.name = `camera-frustum-${String(
        feature.properties?.imageId ?? frustumCount,
      )}-label`;
      labelAnchor.position.set(apex[0], apex[1], apex[2]);
      labelAnchor.userData = {
        labelAnchor: true,
        cameraFrustumLabel: true,
        displayName:
          feature.properties?.displayName ??
          `Camera frustum ${String(feature.properties?.imageId ?? frustumCount)}`,
        sourceProperties: feature.properties,
      };
      group.add(labelAnchor);
    }
  }

  if (segments.length > 0) {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(segments);
    const material = new LineMaterial({
      color: 0x8ee8ff,
      linewidth: LINE_WIDTH_PX,
      worldUnits: false,
      transparent: true,
      opacity: 0.74,
      depthTest: true,
      depthWrite: false,
    });
    material.fog = false;
    material.resolution.set(
      window.innerWidth || 1920,
      window.innerHeight || 1080,
    );
    group.userData.traceMaterial = material;

    const line = new LineSegments2(geometry, material);
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER;
    line.userData.displayName = data.name ?? "Camera frustums";
    group.add(line);
  }

  debugLog(
    `[loadCameraFrustums] ${frustumCount} frustums, ${
      segments.length / 6
    } segments from ${url}`,
  );
  return group;
}
