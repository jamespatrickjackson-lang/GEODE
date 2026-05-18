import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { utmToScene } from "../constants";
import { getHeightSampler } from "../scene/heightSampler";
import { debugLog } from "../utils/debugLog";
import { enableDistanceAttenuatedLineWidth } from "./topoLineMaterial";

const LINE_LIFT_M = 18;
const STATION_LIFT_M = 24;
const STATION_RADIUS_M = 18;
const LINE_WIDTH_PX = 3.2;
const LINE_RENDER_ORDER = 6.1;
const STATION_RENDER_ORDER = 6.2;

interface IpStation {
  waypointId: string;
  station: number;
  easting: number;
  northing: number;
  elevation?: number;
}

interface IpLineFeature {
  type: "Feature";
  properties: {
    id: string;
    displayName: string;
    target: string;
    lineName: string;
    stationCount: number;
    stations?: IpStation[];
    [k: string]: unknown;
  };
  geometry: {
    type: "LineString";
    coordinates: Array<[number, number, number?]>;
  } | null;
}

interface IpLineCollection {
  type: "FeatureCollection";
  features: IpLineFeature[];
}

function targetColor(target: string): number {
  return target === "Three Firs" ? 0x79d7df : 0xffb84d;
}

export async function loadIpSurveyLines(url: string): Promise<THREE.Group> {
  const [res, sample] = await Promise.all([
    fetch(url).then((r) => r.json()) as Promise<IpLineCollection>,
    getHeightSampler(),
  ]);

  const group = new THREE.Group();
  group.name = "ip-survey-lines-2024";
  group.userData.displayName = "2024 IP survey lines";

  const lineMaterial = new LineMaterial({
    color: 0xffb84d,
    linewidth: LINE_WIDTH_PX,
    worldUnits: false,
    transparent: true,
    opacity: 0.92,
    depthTest: true,
    depthWrite: false,
  });
  lineMaterial.fog = true;
  enableDistanceAttenuatedLineWidth(lineMaterial);
  lineMaterial.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );
  group.userData.traceMaterial = lineMaterial;

  const stationGeom = new THREE.SphereGeometry(STATION_RADIUS_M, 24, 16);
  const stationMaterials = new Map<string, THREE.MeshStandardMaterial>();
  const materialForTarget = (target: string) => {
    const key = target || "unknown";
    const cached = stationMaterials.get(key);
    if (cached) return cached;
    const color = targetColor(target);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.016,
      transparent: true,
      opacity: 0.84,
      depthTest: true,
      depthWrite: false,
      roughness: 0.42,
      metalness: 0.1,
      toneMapped: true,
      fog: true,
    });
    mat.userData.forceTransparent = true;
    stationMaterials.set(key, mat);
    return mat;
  };

  let lineCount = 0;
  let stationCount = 0;

  for (const feat of res.features) {
    const geometry = feat.geometry;
    if (!geometry || geometry.type !== "LineString") continue;
    const positions: number[] = [];
    let prev: [number, number, number] | null = null;
    for (const [e, n] of geometry.coordinates) {
      const z = sample(e, n) + LINE_LIFT_M;
      const [sx, sy, sz] = utmToScene(e, n, z);
      if (prev) positions.push(prev[0], prev[1], prev[2], sx, sy, sz);
      prev = [sx, sy, sz];
    }
    if (positions.length === 0) continue;

    const lineGeom = new LineSegmentsGeometry();
    lineGeom.setPositions(positions);
    const material = lineMaterial.clone();
    material.color.set(targetColor(feat.properties.target));
    material.resolution.copy(lineMaterial.resolution);
    const line = new LineSegments2(lineGeom, material);
    line.computeLineDistances();
    line.renderOrder = LINE_RENDER_ORDER;
    line.userData = {
      ipSurveyLine: true,
      ipSurveyPart: "line",
      displayName: feat.properties.displayName,
      lineName: feat.properties.lineName,
      target: feat.properties.target,
    };
    group.add(line);
    lineCount++;

    for (const station of feat.properties.stations ?? []) {
      const e = Number(station.easting);
      const n = Number(station.northing);
      if (!Number.isFinite(e) || !Number.isFinite(n)) continue;
      const z = sample(e, n) + STATION_LIFT_M;
      const [sx, sy, sz] = utmToScene(e, n, z);
      const marker = new THREE.Mesh(
        stationGeom,
        materialForTarget(feat.properties.target).clone(),
      );
      marker.position.set(sx, sy, sz);
      marker.renderOrder = STATION_RENDER_ORDER;
      marker.userData = {
        ipSurveyStation: true,
        ipSurveyPart: "station",
        displayName: `${feat.properties.lineName} station ${station.station}`,
        lineName: feat.properties.lineName,
        target: feat.properties.target,
        preserveMaterialColor: true,
      };
      group.add(marker);
      stationCount++;
    }
  }

  debugLog(
    `[loadIpSurveyLines] ${lineCount} lines, ${stationCount} stations`,
  );
  return group;
}
