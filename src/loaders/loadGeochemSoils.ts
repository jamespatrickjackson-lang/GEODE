import * as THREE from "three";
import { utmToScene } from "../constants";
import { getHeightSampler } from "../scene/heightSampler";
import { debugLog } from "../utils/debugLog";

const SYMBOL_LIFT_M = 24;
const SYMBOL_RADIUS_M = 78;
const SYMBOL_THICKNESS_M = 5;
const OUTLINE_TUBE_RATIO = 0.055;
const SYMBOL_RENDER_ORDER = 6.25;
const CYLINDER_AXIS = new THREE.Vector3(0, 1, 0);
const UP_AXIS = new THREE.Vector3(0, 0, 1);

export interface GeochemElementStats {
  label: string;
  symbol?: string;
  unit: string;
  count: number;
  min: number;
  q20?: number;
  q40?: number;
  median?: number;
  q60?: number;
  q80?: number;
  p90?: number;
  max: number;
}

interface GeochemFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: "Point";
    coordinates: [number, number, number?];
  } | null;
}

interface GeochemCollection {
  type: "FeatureCollection";
  properties?: {
    elements?: Record<string, GeochemElementStats>;
    [k: string]: unknown;
  };
  features: GeochemFeature[];
}

function numberProp(props: Record<string, unknown>, key: string): number | null {
  const value = props[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "n/a";
  const decimals = unit === "%" ? 3 : value < 1 ? 3 : value < 10 ? 2 : 1;
  return `${value.toFixed(decimals)} ${unit}`;
}

export async function loadGeochemSoils(url: string): Promise<THREE.Group> {
  const [res, sample] = await Promise.all([
    fetch(url).then((r) => r.json()) as Promise<GeochemCollection>,
    getHeightSampler(),
  ]);

  const group = new THREE.Group();
  group.name = "geochem-soils-2024";
  group.userData.displayName = "2024 GP Soil Geochemistry";
  group.userData.geochemElements = res.properties?.elements ?? {};

  const fillGeom = new THREE.CylinderGeometry(
    1,
    1,
    1,
    48,
    1,
    false,
  );
  fillGeom.computeVertexNormals();

  const outlineGeom = new THREE.TorusGeometry(
    1,
    OUTLINE_TUBE_RATIO,
    8,
    64,
  );
  outlineGeom.computeVertexNormals();

  const fillBase = new THREE.MeshStandardMaterial({
    color: 0xd9482f,
    transparent: true,
    opacity: 0.9,
    depthTest: true,
    depthWrite: false,
    roughness: 0.46,
    metalness: 0.08,
    emissive: 0x3b120c,
    emissiveIntensity: 0.01,
    toneMapped: true,
    fog: true,
  });
  fillBase.userData.forceTransparent = true;
  fillBase.userData.preserveMaterialColor = true;

  const outlineBase = new THREE.MeshStandardMaterial({
    color: 0x241f18,
    transparent: true,
    opacity: 0.62,
    depthTest: true,
    depthWrite: false,
    roughness: 0.54,
    metalness: 0.08,
    toneMapped: true,
    fog: true,
  });
  outlineBase.userData.forceTransparent = true;
  outlineBase.userData.preserveMaterialColor = true;

  let count = 0;
  for (const feat of res.features) {
    if (!feat.geometry || feat.geometry.type !== "Point") continue;
    const [e, n] = feat.geometry.coordinates;
    if (!Number.isFinite(e) || !Number.isFinite(n)) continue;
    const terrainZ = sample(e, n);
    const [sx, sy, sz] = utmToScene(e, n, terrainZ + SYMBOL_LIFT_M);
    const props = feat.properties ?? {};
    const elements: Record<string, number> = {};
    for (const [key, value] of Object.entries(props)) {
      if (
        (key.endsWith("_ppm") || key.endsWith("_pct")) &&
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        elements[key] = value;
      }
    }

    const sampleId =
      typeof props.sampleId === "string"
        ? props.sampleId
        : typeof props.id === "string"
          ? props.id
          : `soil-${count + 1}`;
    const cu = numberProp(props, "cu_ppm");
    const au = numberProp(props, "au_ppm");
    const mo = numberProp(props, "mo_ppm");
    const displayName = `${sampleId} soil | Cu ${formatValue(
      cu,
      "ppm",
    )} | Au ${formatValue(au, "ppm")} | Mo ${formatValue(mo, "ppm")}`;

    const root = new THREE.Group();
    root.name = sampleId;
    root.position.set(sx, sy, sz);
    root.userData = {
      geochemSampleRoot: true,
      displayName,
      sampleId,
      elements,
      baseLiftM: SYMBOL_LIFT_M,
      baseRadiusM: SYMBOL_RADIUS_M,
      baseThicknessM: SYMBOL_THICKNESS_M,
      easting: e,
      northing: n,
      terrainZ,
      sceneTerrainZ: sz - SYMBOL_LIFT_M,
    };

    const fill = new THREE.Mesh(fillGeom, fillBase.clone());
    fill.quaternion.setFromUnitVectors(CYLINDER_AXIS, UP_AXIS);
    fill.scale.set(SYMBOL_RADIUS_M, SYMBOL_THICKNESS_M, SYMBOL_RADIUS_M);
    fill.renderOrder = SYMBOL_RENDER_ORDER;
    fill.userData = {
      geochemPart: "fill",
      preserveMaterialColor: true,
      displayName,
    };
    root.add(fill);

    const outline = new THREE.Mesh(outlineGeom, outlineBase.clone());
    outline.position.z = SYMBOL_THICKNESS_M * 0.62;
    outline.scale.setScalar(SYMBOL_RADIUS_M);
    outline.renderOrder = SYMBOL_RENDER_ORDER + 0.05;
    outline.userData = {
      geochemPart: "outline",
      preserveMaterialColor: true,
      displayName,
    };
    root.add(outline);

    group.add(root);
    count++;
  }

  debugLog(`[loadGeochemSoils] ${count} soil samples`);
  return group;
}
