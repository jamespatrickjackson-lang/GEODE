import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { debugLog } from "../utils/debugLog";

interface CameraPoseFeature {
  type: "Feature";
  properties?: {
    id?: string | number;
    displayName?: string;
    imageId?: number;
    sourceRole?: string;
    [key: string]: unknown;
  };
  geometry:
    | {
        type: "Point";
        coordinates: [number, number, number?];
      }
    | {
        type: "LineString";
        coordinates: Array<[number, number, number?]>;
      }
    | null;
}

interface CameraPoseCollection {
  type: "FeatureCollection";
  name?: string;
  properties?: Record<string, unknown>;
  features: CameraPoseFeature[];
}

const PATH_LINE_WIDTH_PX = 2.4;
const CAMERA_RADIUS_M = 0.52;
const CAMERA_MARKER_STRIDE = 8;
const RENDER_ORDER = 13.25;

function pointIsFinite(point: [number, number, number?]): point is [number, number, number] {
  return (
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    Number.isFinite(point[2] ?? 0)
  );
}

export async function loadCameraFlightPath(url: string): Promise<THREE.Group> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch camera poses ${url}: ${response.status}`);
  }

  const data = (await response.json()) as CameraPoseCollection;
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error(`Invalid camera pose GeoJSON: ${url}`);
  }

  const group = new THREE.Group();
  group.name = data.name ?? "camera flight path";
  group.userData.displayName = data.name ?? "Camera flight path";
  group.userData.cameraPoseCollection = true;
  group.userData.sourceProperties = data.properties;

  const pathMaterial = new LineMaterial({
    color: 0xf5d45b,
    linewidth: PATH_LINE_WIDTH_PX,
    worldUnits: false,
    transparent: true,
    opacity: 0.86,
    depthTest: true,
    depthWrite: false,
  });
  pathMaterial.fog = false;
  pathMaterial.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );
  group.userData.traceMaterial = pathMaterial;

  const markerGeometry = new THREE.SphereGeometry(CAMERA_RADIUS_M, 14, 10);
  markerGeometry.computeVertexNormals();
  const markerMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5d45b,
    emissive: 0x6f5200,
    emissiveIntensity: 0.025,
    transparent: true,
    opacity: 0.92,
    depthTest: true,
    depthWrite: false,
    roughness: 0.42,
    metalness: 0.08,
    toneMapped: true,
    fog: false,
  });
  markerMaterial.userData.forceTransparent = true;

  let pathCount = 0;
  let markerCount = 0;

  for (const feature of data.features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type === "LineString") {
      const segments: number[] = [];
      let previous: [number, number, number] | null = null;
      for (const rawPoint of feature.geometry.coordinates) {
        const point: [number, number, number] = [
          rawPoint[0],
          rawPoint[1],
          rawPoint[2] ?? 0,
        ];
        if (!pointIsFinite(point)) continue;
        if (previous) {
          segments.push(previous[0], previous[1], previous[2]);
          segments.push(point[0], point[1], point[2]);
        }
        previous = point;
      }
      if (segments.length > 0) {
        const geometry = new LineSegmentsGeometry();
        geometry.setPositions(segments);
        const line = new LineSegments2(geometry, pathMaterial);
        line.computeLineDistances();
        line.renderOrder = RENDER_ORDER;
        line.userData.displayName =
          feature.properties?.displayName ?? "Camera flight path";
        group.add(line);
        pathCount += 1;
      }
      continue;
    }

    if (feature.geometry.type !== "Point") continue;
    const rawPoint = feature.geometry.coordinates;
    const point: [number, number, number] = [
      rawPoint[0],
      rawPoint[1],
      rawPoint[2] ?? 0,
    ];
    if (!pointIsFinite(point)) continue;

    const imageId =
      typeof feature.properties?.imageId === "number"
        ? feature.properties.imageId
        : markerCount + 1;
    if ((imageId - 1) % CAMERA_MARKER_STRIDE !== 0 && imageId !== 158) {
      continue;
    }

    const marker = new THREE.Mesh(markerGeometry, markerMaterial.clone());
    marker.name = `camera-pose-${String(imageId).padStart(3, "0")}`;
    marker.position.set(point[0], point[1], point[2]);
    marker.renderOrder = RENDER_ORDER + 0.05;
    marker.userData = {
      cameraPoseMarker: true,
      displayName:
        feature.properties?.displayName ??
        `Shahbazi image ${String(imageId).padStart(3, "0")} camera`,
      imageId,
      sourceProperties: feature.properties,
    };
    group.add(marker);
    markerCount += 1;
  }

  debugLog(
    `[loadCameraFlightPath] ${pathCount} path, ${markerCount} displayed camera markers from ${url}`,
  );
  return group;
}
