import * as THREE from "three";
import { debugLog } from "../utils/debugLog";

interface PointMarkerFeature {
  type: "Feature";
  properties?: {
    id?: string | number;
    displayName?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number, number?];
  } | null;
}

interface PointMarkerCollection {
  type: "FeatureCollection";
  name?: string;
  properties?: {
    pointCount?: number;
    visualMarkerRadiusM?: number;
    visualLabelLiftM?: number;
    [key: string]: unknown;
  };
  features: PointMarkerFeature[];
}

const MARKER_RADIUS_M = 0.42;
const LABEL_LIFT_M = 1.15;
const RENDER_ORDER = 13;

export async function loadPointMarkers(url: string): Promise<THREE.Group> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch point markers ${url}: ${response.status}`);
  }

  const data = (await response.json()) as PointMarkerCollection;
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error(`Invalid point marker GeoJSON: ${url}`);
  }

  const group = new THREE.Group();
  group.name = data.name ?? "point markers";
  group.userData.displayName = data.name ?? "Point markers";
  group.userData.pointMarkerCollection = true;
  group.userData.sourceProperties = data.properties;

  const markerRadius =
    typeof data.properties?.visualMarkerRadiusM === "number" &&
    Number.isFinite(data.properties.visualMarkerRadiusM)
      ? Math.max(0.05, data.properties.visualMarkerRadiusM)
      : MARKER_RADIUS_M;
  const labelLift =
    typeof data.properties?.visualLabelLiftM === "number" &&
    Number.isFinite(data.properties.visualLabelLiftM)
      ? Math.max(0.05, data.properties.visualLabelLiftM)
      : LABEL_LIFT_M;
  group.userData.defaultMarkerRadiusM = markerRadius;
  group.userData.defaultMarkerLiftM = 0;
  group.userData.defaultMarkerLabelLiftM = labelLift;
  const markerGeometry = new THREE.SphereGeometry(markerRadius, 16, 12);
  markerGeometry.computeVertexNormals();
  const markerMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff066,
    emissive: 0x7c5c00,
    emissiveIntensity: 0.03,
    transparent: true,
    opacity: 0.96,
    depthTest: true,
    depthWrite: false,
    roughness: 0.4,
    metalness: 0.08,
    toneMapped: true,
    fog: false,
  });
  markerMaterial.userData.forceTransparent = true;

  let count = 0;
  for (const feature of data.features) {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates || feature.geometry?.type !== "Point") continue;
    const [x, y, rawZ = 0] = coordinates;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rawZ)) {
      continue;
    }

    const id = feature.properties?.id ?? count + 1;
    const displayName =
      feature.properties?.displayName ?? `Point marker ${String(id)}`;
    const marker = new THREE.Mesh(markerGeometry, markerMaterial.clone());
    marker.name = `point-marker-${String(id)}`;
    marker.position.set(x, y, rawZ);
    marker.renderOrder = RENDER_ORDER;
    marker.userData = {
      pointMarker: true,
      displayName,
      markerId: id,
      baseX: x,
      baseY: y,
      baseZ: rawZ,
      baseMarkerRadiusM: markerRadius,
      sourceProperties: feature.properties,
    };
    group.add(marker);

    const labelAnchor = new THREE.Object3D();
    labelAnchor.name = `point-marker-${String(id)}-label`;
    labelAnchor.position.set(x, y, rawZ + labelLift);
    labelAnchor.userData = {
      labelAnchor: true,
      displayName,
      markerId: id,
      pointMarker: true,
      pointMarkerLabelAnchor: true,
      baseX: x,
      baseY: y,
      baseZ: rawZ,
      baseLabelLiftM: labelLift,
    };
    group.add(labelAnchor);
    count += 1;
  }

  debugLog(`[loadPointMarkers] ${count} markers from ${url}`);
  return group;
}
