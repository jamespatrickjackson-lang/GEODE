import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import {
  cleanDemoBoreholePath,
  type ScenePointTuple,
} from "../projectModules/utahForge/siteDetails";
import type {
  DemoBoreholeLineStyle,
  DemoBoreholePathTreatment,
} from "../pages/types";
import { debugLog } from "../utils/debugLog";

interface DemoBoreholePoint {
  mdFt: number;
  tvdFt: number;
  inclinationDeg: number | null;
  azimuthDeg: number | null;
  utm: [number, number, number];
  scene: [number, number, number];
}

interface DemoBoreholeWell {
  id: string;
  label: string;
  shortLabel?: string;
  role: "injection" | "production" | string;
  color: string;
  emissiveColor?: string;
  source: string;
  sourceUrl: string;
  sourceFile: string;
  trajectory: DemoBoreholePoint[];
}

interface DemoBoreholePriorityEntry {
  id: string;
  label?: string;
  displayLabel?: string;
  aliases?: string[];
  priority: number;
  sourceStatus: string;
  renderStatus: string;
  registrationStatus: string;
  claimStatus: string;
  linkedLayerId?: string | null;
  sourceLocation?: DemoBoreholeSourceLocation | null;
  sourceCandidates?: DemoBoreholeSourceLocation[];
}

interface DemoBoreholeSourceLocation {
  id: string;
  scene: [number, number, number];
  featureCode?: string;
  notes?: string;
}

interface DemoOrientationBlock {
  id: string;
  label: string;
  centerScene: [number, number, number];
  sizeM: [number, number, number];
  rotationDeg: number;
  sourceBasis: string;
}

interface DemoBoreholeManifest {
  schema: string;
  label: string;
  classification: string;
  notForEngineeringUse: boolean;
  orientationBlock?: DemoOrientationBlock;
  priorityRegistry?: DemoBoreholePriorityEntry[];
  wells: DemoBoreholeWell[];
  notes?: string[];
}

const BORE_HOLES_CATEGORY = "Bore Holes";
const DEFAULT_PIPE_RADIUS_M = 12;
const DEFAULT_COLLAR_RADIUS_M = 30;
const DEFAULT_SOURCE_LOCATION_TRACE_DIAMETER_M = 72;
const DEFAULT_SOURCE_LOCATION_TRACE_LENGTH_M = 900;
const DEFAULT_SOURCE_LOCATION_RING_RADIUS_M = 135;
const DEFAULT_SOURCE_LOCATION_RING_TUBE_M = 12;
const DEFAULT_SOURCE_LOCATION_CROSSHAIR_LENGTH_M = 320;
const DEFAULT_TUBE_SEGMENTS_PER_POINT = 1.5;
const TUBE_RENDER_ORDER = 7.2;
const LINE_RENDER_ORDER = 7.5;
const COLLAR_RENDER_ORDER = 7.8;
const SOURCE_LOCATION_TRACE_RENDER_ORDER = 7.9;
const BLOCK_RENDER_ORDER = 6.4;

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sceneVector(value: unknown): THREE.Vector3 | null {
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    !value.every((entry) => finiteNumber(entry))
  ) {
    return null;
  }
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function sceneTuple(value: unknown): ScenePointTuple | null {
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    !value.every((entry) => finiteNumber(entry))
  ) {
    return null;
  }
  return [value[0], value[1], value[2]];
}

function vectorsFromTuples(points: readonly ScenePointTuple[]): THREE.Vector3[] {
  return points.map((point) => new THREE.Vector3(point[0], point[1], point[2]));
}

function makeTubeGeometry(points: THREE.Vector3[], radiusM: number): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.4);
  return new THREE.TubeGeometry(
    curve,
    Math.max(48, Math.round(points.length * DEFAULT_TUBE_SEGMENTS_PER_POINT)),
    radiusM,
    18,
    false,
  );
}

function pointAtDistance(
  points: readonly THREE.Vector3[],
  distances: readonly number[],
  distanceM: number,
): THREE.Vector3 {
  if (distanceM <= 0) return points[0].clone();
  const total = distances[distances.length - 1] ?? 0;
  if (distanceM >= total) return points[points.length - 1].clone();
  for (let i = 1; i < distances.length; i += 1) {
    if (distances[i] < distanceM) continue;
    const startDistance = distances[i - 1];
    const segmentLength = Math.max(0.0001, distances[i] - startDistance);
    const t = (distanceM - startDistance) / segmentLength;
    return points[i - 1].clone().lerp(points[i], t);
  }
  return points[points.length - 1].clone();
}

function splitDashedSegments(
  points: readonly THREE.Vector3[],
  dashLengthM: number,
  dashGapM: number,
): THREE.Vector3[][] {
  if (points.length < 2) return [];
  const distances = [0];
  for (let i = 1; i < points.length; i += 1) {
    distances.push(distances[i - 1] + points[i - 1].distanceTo(points[i]));
  }
  const total = distances[distances.length - 1] ?? 0;
  const dash = Math.max(20, dashLengthM);
  const gap = Math.max(10, dashGapM);
  const cycle = dash + gap;
  const segments: THREE.Vector3[][] = [];
  for (let start = 0; start < total; start += cycle) {
    const end = Math.min(total, start + dash);
    if (end <= start) continue;
    const segment: THREE.Vector3[] = [pointAtDistance(points, distances, start)];
    for (let i = 1; i < points.length - 1; i += 1) {
      if (distances[i] > start && distances[i] < end) {
        segment.push(points[i].clone());
      }
    }
    segment.push(pointAtDistance(points, distances, end));
    if (segment.length > 1) segments.push(segment);
  }
  return segments;
}

function pipeSegmentsForStyle(
  points: readonly THREE.Vector3[],
  lineStyle: DemoBoreholeLineStyle,
  dashLengthM: number,
  dashGapM: number,
): THREE.Vector3[][] {
  return lineStyle === "dashed"
    ? splitDashedSegments(points, dashLengthM, dashGapM)
    : [points.map((point) => point.clone())];
}

function makeTubeMaterial(
  color: string,
  emissiveColor: string | undefined,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: emissiveColor ?? color,
    emissiveIntensity: 0.08,
    roughness: 0.38,
    metalness: 0.18,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: true,
    toneMapped: true,
    fog: true,
  });
  material.userData.forceTransparent = true;
  material.userData.preserveMaterialColor = true;
  return material;
}

function makeSourceTraceMaterial(color: string): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.2,
    roughness: 0.3,
    metalness: 0.12,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: false,
    toneMapped: true,
    fog: true,
  });
  material.userData.forceTransparent = true;
  material.userData.preserveMaterialColor = true;
  return material;
}

function makePathLine(points: THREE.Vector3[], color: string): Line2 {
  const geometry = new LineGeometry();
  geometry.setPositions(points.flatMap((point) => [point.x, point.y, point.z]));
  const material = new LineMaterial({
    color,
    linewidth: 2.2,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    depthTest: true,
    worldUnits: false,
  });
  material.resolution.set(window.innerWidth || 1920, window.innerHeight || 1080);
  material.fog = true;
  material.userData.forceTransparent = true;
  material.userData.preserveMaterialColor = true;
  const line = new Line2(geometry, material);
  line.renderOrder = LINE_RENDER_ORDER;
  return line;
}

function makeSourceLocationLine(
  points: readonly THREE.Vector3[],
  color: string,
  linewidth: number,
): Line2 {
  const geometry = new LineGeometry();
  geometry.setPositions(points.flatMap((point) => [point.x, point.y, point.z]));
  const material = new LineMaterial({
    color,
    linewidth,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: false,
    worldUnits: false,
  });
  material.resolution.set(window.innerWidth || 1920, window.innerHeight || 1080);
  material.fog = true;
  material.userData.forceTransparent = true;
  material.userData.preserveMaterialColor = true;
  const line = new Line2(geometry, material);
  line.renderOrder = SOURCE_LOCATION_TRACE_RENDER_ORDER;
  return line;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) entry.dispose();
}

function disposePipeRoot(root: THREE.Group): void {
  for (const child of [...root.children]) {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) disposeMaterial(mesh.material);
    root.remove(child);
  }
}

function addPipeSegment(
  root: THREE.Group,
  points: THREE.Vector3[],
  radiusM: number,
  color: string,
  emissiveColor: string | undefined,
): void {
  if (points.length < 2) return;
  const mesh = new THREE.Mesh(
    makeTubeGeometry(points, radiusM),
    makeTubeMaterial(color, emissiveColor),
  );
  mesh.name = `${root.name} segment ${root.children.length + 1}`;
  mesh.renderOrder = TUBE_RENDER_ORDER;
  mesh.userData = {
    displayName: root.userData.displayName,
    sceneLabelEligible: false,
    demoBoreholePipeSegment: true,
    demoBoreholeWellId: root.userData.demoBoreholeWellId,
    demoBoreholeRole: root.userData.demoBoreholeRole,
  };
  root.add(mesh);
}

function displayPathTuples(
  surveyPoints: readonly ScenePointTuple[],
  pathTreatment: DemoBoreholePathTreatment,
  smoothingStrength: number,
): ScenePointTuple[] {
  return cleanDemoBoreholePath(surveyPoints, pathTreatment, smoothingStrength);
}

function rebuildLineGeometry(line: Line2, points: readonly THREE.Vector3[]): void {
  line.geometry.dispose();
  const geometry = new LineGeometry();
  geometry.setPositions(points.flatMap((point) => [point.x, point.y, point.z]));
  line.geometry = geometry;
}

function addLabelAnchor(
  group: THREE.Group,
  name: string,
  displayName: string,
  position: THREE.Vector3,
  labelRole: "collar" | "toe" | "block" | "source-location",
  ownerId: string,
  liftM = 0,
): void {
  const anchor = new THREE.Object3D();
  anchor.name = name;
  anchor.position.copy(position);
  anchor.position.z += liftM;
  anchor.userData = {
    labelAnchor: true,
    sceneLabelEligible: true,
    displayName,
    labelKind: "siteElement",
    demoBoreholeLabelAnchor: true,
    demoBoreholeLabelRole: labelRole,
    demoBoreholeOwnerId: ownerId,
    demoBoreholeBaseLabelPosition: position.toArray(),
    demoBoreholeBaseLabelLiftM: liftM,
  };
  group.add(anchor);
}

function priorityEntryForWell(
  well: DemoBoreholeWell,
  entries?: DemoBoreholePriorityEntry[],
): DemoBoreholePriorityEntry | null {
  return (
    entries?.find(
      (entry) =>
        entry.id === well.id ||
        (Array.isArray(entry.aliases) && entry.aliases.includes(well.id)),
    ) ?? null
  );
}

function boreholeCategoryUserData(entry: DemoBoreholePriorityEntry | null) {
  return {
    forgeDataCategory: BORE_HOLES_CATEGORY,
    boreholePriority: entry?.priority,
    boreholeClaimStatus: entry?.claimStatus,
    boreholeRegistrationStatus: entry?.registrationStatus,
    boreholeRegistryId: entry?.id,
  };
}

function sourceLocationColor(entry: DemoBoreholePriorityEntry): string {
  if (entry.id === "58-32") return "#f6d365";
  if (entry.id === "78B-32") return "#84e1bc";
  if (entry.id === "unnamed-possible-seismic-monitoring-well") return "#d5d8e8";
  return "#f5f7ff";
}

function shortPriorityLabel(entry: DemoBoreholePriorityEntry): string {
  if (entry.id === "unnamed-possible-seismic-monitoring-well") return "Unnamed";
  return entry.label || entry.id;
}

function addSourceLocationMarker(
  group: THREE.Group,
  entry: DemoBoreholePriorityEntry,
  location: DemoBoreholeSourceLocation,
  label: string,
  color: string,
): void {
  const position = sceneVector(location.scene);
  if (!position) return;
  const markerGroup = new THREE.Group();
  markerGroup.name = `${label} source location trace`;
  const categoryUserData = boreholeCategoryUserData(entry);
  markerGroup.userData = {
    ...categoryUserData,
    displayName: label,
    sceneLabelEligible: false,
    demoBoreholeSourceLocation: true,
    demoBoreholeSourceLocationId: location.id,
    demoBoreholeRegistryId: entry.id,
    demoBoreholeRenderStatus: entry.renderStatus,
    demoBoreholeClaimStatus: entry.claimStatus,
    demoBoreholeSourceBaseColor: color,
    sourceFeatureCode: location.featureCode,
    sourceNotes: location.notes,
  };

  const traceRoot = new THREE.Group();
  traceRoot.name = `${label} rounded source trace`;
  traceRoot.position.copy(position);
  traceRoot.renderOrder = SOURCE_LOCATION_TRACE_RENDER_ORDER;
  traceRoot.userData = {
    ...markerGroup.userData,
    demoBoreholeSourceTraceRoot: true,
    demoBoreholeBaseSourceTraceDiameterM: DEFAULT_SOURCE_LOCATION_TRACE_DIAMETER_M,
    demoBoreholeBaseSourceTraceLengthM: DEFAULT_SOURCE_LOCATION_TRACE_LENGTH_M,
    sourceLocationTraceSemantic: "source-location-marker-not-trajectory",
  };

  const radius = DEFAULT_SOURCE_LOCATION_TRACE_DIAMETER_M * 0.5;
  const length = DEFAULT_SOURCE_LOCATION_TRACE_LENGTH_M;
  const material = makeSourceTraceMaterial(color);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 28, 1, false),
    material,
  );
  body.name = `${label} source trace body`;
  body.position.z = -length * 0.5;
  body.rotation.x = Math.PI / 2;
  body.renderOrder = SOURCE_LOCATION_TRACE_RENDER_ORDER;
  body.userData = {
    ...traceRoot.userData,
    demoBoreholeSourceTrace: true,
    demoBoreholeSourceTracePart: "body",
  };
  traceRoot.add(body);

  for (const [part, z] of [
    ["top", 0],
    ["bottom", -length],
  ] as const) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 28, 16),
      material.clone(),
    );
    cap.name = `${label} source trace ${part} cap`;
    cap.position.z = z;
    cap.renderOrder = SOURCE_LOCATION_TRACE_RENDER_ORDER + 0.01;
    cap.userData = {
      ...traceRoot.userData,
      demoBoreholeSourceTrace: true,
      demoBoreholeSourceTracePart: `${part}-cap`,
    };
    traceRoot.add(cap);
  }
  markerGroup.add(traceRoot);

  const line = makeSourceLocationLine(
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -length)],
    color,
    8,
  );
  line.name = `${label} source line trace`;
  line.position.copy(position);
  line.userData = {
    ...traceRoot.userData,
    demoBoreholeSourceLine: true,
  };
  markerGroup.add(line);

  const pinHead = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.25, 28, 16),
    makeSourceTraceMaterial(color),
  );
  pinHead.name = `${label} source pin head`;
  pinHead.position.copy(position);
  pinHead.renderOrder = SOURCE_LOCATION_TRACE_RENDER_ORDER + 0.02;
  pinHead.userData = {
    ...traceRoot.userData,
    demoBoreholeSourcePinHead: true,
  };
  markerGroup.add(pinHead);

  for (const [axis, points] of [
    [
      "x",
      [
        new THREE.Vector3(-DEFAULT_SOURCE_LOCATION_CROSSHAIR_LENGTH_M * 0.5, 0, 0),
        new THREE.Vector3(DEFAULT_SOURCE_LOCATION_CROSSHAIR_LENGTH_M * 0.5, 0, 0),
      ],
    ],
    [
      "y",
      [
        new THREE.Vector3(0, -DEFAULT_SOURCE_LOCATION_CROSSHAIR_LENGTH_M * 0.5, 0),
        new THREE.Vector3(0, DEFAULT_SOURCE_LOCATION_CROSSHAIR_LENGTH_M * 0.5, 0),
      ],
    ],
  ] as const) {
    const crosshair = makeSourceLocationLine(points, color, 6);
    crosshair.name = `${label} source crosshair ${axis}`;
    crosshair.position.copy(position);
    crosshair.renderOrder = SOURCE_LOCATION_TRACE_RENDER_ORDER + 0.03;
    crosshair.userData = {
      ...traceRoot.userData,
      demoBoreholeSourceCrosshair: true,
      demoBoreholeSourceCrosshairAxis: axis,
      demoBoreholeBaseSourceCrosshairLengthM: DEFAULT_SOURCE_LOCATION_CROSSHAIR_LENGTH_M,
    };
    markerGroup.add(crosshair);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(
      DEFAULT_SOURCE_LOCATION_RING_RADIUS_M,
      DEFAULT_SOURCE_LOCATION_RING_TUBE_M,
      12,
      72,
    ),
    makeSourceTraceMaterial("#ffffff"),
  );
  ring.name = `${label} source top toroid`;
  ring.position.copy(position);
  ring.renderOrder = SOURCE_LOCATION_TRACE_RENDER_ORDER + 0.04;
  ring.userData = {
    ...traceRoot.userData,
    demoBoreholeSourceTopRing: true,
    demoBoreholeBaseSourceRingRadiusM: DEFAULT_SOURCE_LOCATION_RING_RADIUS_M,
    demoBoreholeBaseSourceRingTubeM: DEFAULT_SOURCE_LOCATION_RING_TUBE_M,
  };
  markerGroup.add(ring);

  addLabelAnchor(
    markerGroup,
    `${location.id} source label`,
    label,
    position,
    "source-location",
    location.id,
    95,
  );
  group.add(markerGroup);
}

function addPrioritySourceMarkers(
  group: THREE.Group,
  priorityRegistry?: DemoBoreholePriorityEntry[],
): void {
  for (const entry of priorityRegistry ?? []) {
    if (entry.renderStatus === "trajectory-rendered") continue;
    const color = sourceLocationColor(entry);
    if (entry.sourceLocation) {
      addSourceLocationMarker(
        group,
        entry,
        entry.sourceLocation,
        shortPriorityLabel(entry),
        color,
      );
    }
    for (const candidate of entry.sourceCandidates ?? []) {
      addSourceLocationMarker(
        group,
        entry,
        candidate,
        `${shortPriorityLabel(entry)} ${candidate.id}`,
        color,
      );
    }
  }
}

function addWell(
  group: THREE.Group,
  well: DemoBoreholeWell,
  priorityRegistry?: DemoBoreholePriorityEntry[],
): void {
  const surveyPointTuples = well.trajectory
    .map((point) => sceneTuple(point.scene))
    .filter((point): point is ScenePointTuple => point !== null);
  const points = vectorsFromTuples(surveyPointTuples);
  if (points.length < 2) return;

  const priorityEntry = priorityEntryForWell(well, priorityRegistry);
  const categoryUserData = boreholeCategoryUserData(priorityEntry);

  const wellGroup = new THREE.Group();
  wellGroup.name = well.label;
  wellGroup.userData = {
    ...categoryUserData,
    displayName: well.label,
    sceneLabelEligible: false,
    demoBoreholeWell: true,
    demoBoreholeWellId: well.id,
    demoBoreholeRole: well.role,
    source: {
      submission: well.source,
      sourceUrl: well.sourceUrl,
      sourceFile: well.sourceFile,
    },
  };

  const pipeRoot = new THREE.Group();
  pipeRoot.name = `${well.id} pipe`;
  pipeRoot.userData = {
    ...categoryUserData,
    displayName: well.label,
    sceneLabelEligible: false,
    demoBoreholePipeRoot: true,
    demoBoreholeWellId: well.id,
    demoBoreholeRole: well.role,
    demoBoreholeSurveyPoints: surveyPointTuples,
    demoBoreholeRadiusM: DEFAULT_PIPE_RADIUS_M,
    demoBoreholeLineStyle: "solid",
    demoBoreholePathTreatment: "survey",
    demoBoreholeSmoothingStrength: 0,
    demoBoreholeDashLengthM: 260,
    demoBoreholeDashGapM: 150,
    demoBoreholeColor: well.color,
    demoBoreholeEmissiveColor: well.emissiveColor,
  };
  addPipeSegment(pipeRoot, points, DEFAULT_PIPE_RADIUS_M, well.color, well.emissiveColor);
  wellGroup.add(pipeRoot);

  const line = makePathLine(points, well.color);
  line.name = `${well.id} centerline`;
  line.userData = {
    ...categoryUserData,
    displayName: well.label,
    sceneLabelEligible: false,
    demoBoreholeCenterline: true,
    demoBoreholeWellId: well.id,
    demoBoreholeRole: well.role,
  };
  wellGroup.add(line);

  const collar = new THREE.Mesh(
    new THREE.SphereGeometry(DEFAULT_COLLAR_RADIUS_M, 24, 16),
    makeTubeMaterial(well.color, well.emissiveColor),
  );
  collar.name = `${well.id} collar`;
  collar.position.copy(points[0]);
  collar.renderOrder = COLLAR_RENDER_ORDER;
  collar.userData = {
    ...categoryUserData,
    displayName: well.label,
    sceneLabelEligible: false,
    demoBoreholeCollar: true,
    demoBoreholeWellId: well.id,
    demoBoreholeBaseCollarRadiusM: DEFAULT_COLLAR_RADIUS_M,
  };
  wellGroup.add(collar);

  addLabelAnchor(
    wellGroup,
    `${well.id} collar label`,
    well.shortLabel ?? well.label,
    points[0],
    "collar",
    well.id,
    95,
  );
  addLabelAnchor(
    wellGroup,
    `${well.id} toe label`,
    `${well.role === "production" ? "Production" : "Injection"} toe`,
    points[points.length - 1],
    "toe",
    well.id,
    40,
  );

  group.add(wellGroup);
}

function makeBlockMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    emissive: "#ffffff",
    emissiveIntensity: 0.018,
    roughness: 0.52,
    metalness: 0,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    depthTest: true,
    toneMapped: true,
    fog: true,
  });
  material.userData.forceTransparent = true;
  material.userData.preserveMaterialColor = true;
  return material;
}

function addOrientationBlock(group: THREE.Group, block: DemoOrientationBlock): void {
  const center = sceneVector(block.centerScene);
  if (!center) return;
  const [width, depth, height] = block.sizeM;
  if (![width, depth, height].every((value) => finiteNumber(value) && value > 0)) {
    return;
  }

  const geometry = new THREE.BoxGeometry(width, depth, height);
  const mesh = new THREE.Mesh(geometry, makeBlockMaterial());
  mesh.name = block.label;
  mesh.position.copy(center);
  mesh.rotation.z = THREE.MathUtils.degToRad(block.rotationDeg);
  mesh.renderOrder = BLOCK_RENDER_ORDER;
  mesh.userData = {
    displayName: block.label,
    sceneLabelEligible: false,
    demoOrientationBlock: true,
    demoBoreholeBlockId: block.id,
    demoOrientationBlockBaseCenter: block.centerScene,
    demoOrientationBlockBaseSize: block.sizeM,
    demoOrientationBlockBaseRotationDeg: block.rotationDeg,
    sourceBasis: block.sourceBasis,
  };
  group.add(mesh);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }),
  );
  edges.name = `${block.label} outline`;
  edges.position.copy(center);
  edges.rotation.z = mesh.rotation.z;
  edges.renderOrder = BLOCK_RENDER_ORDER + 0.05;
  edges.userData = {
    displayName: block.label,
    sceneLabelEligible: false,
    demoOrientationBlockEdge: true,
    demoBoreholeBlockId: block.id,
    demoOrientationBlockBaseCenter: block.centerScene,
    demoOrientationBlockBaseSize: block.sizeM,
    demoOrientationBlockBaseRotationDeg: block.rotationDeg,
    sourceBasis: block.sourceBasis,
  };
  group.add(edges);

  addLabelAnchor(
    group,
    `${block.id} label`,
    block.label,
    center,
    "block",
    block.id,
    height * 0.75,
  );
}

function normalizeManifest(value: unknown, url: string): DemoBoreholeManifest {
  if (!value || typeof value !== "object") {
    throw new Error(`Invalid demo borehole manifest: ${url}`);
  }
  const manifest = value as DemoBoreholeManifest;
  if (!Array.isArray(manifest.wells)) {
    throw new Error(`Demo borehole manifest missing wells: ${url}`);
  }
  return manifest;
}

export async function loadUtahForgeDemoBoreholes(
  url: string,
): Promise<THREE.Group> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch demo borehole manifest ${url}: ${response.status}`);
  }

  const manifest = normalizeManifest(await response.json(), url);
  const group = new THREE.Group();
  group.name = manifest.label || "Utah FORGE demo boreholes";
  group.userData = {
    forgeDataCategory: BORE_HOLES_CATEGORY,
    displayName: manifest.label,
    sceneLabelEligible: false,
    demoBoreholesLayer: true,
    classification: manifest.classification,
    notForEngineeringUse: manifest.notForEngineeringUse === true,
    priorityRegistry: manifest.priorityRegistry,
    notes: manifest.notes,
  };

  for (const well of manifest.wells) {
    addWell(group, well, manifest.priorityRegistry);
  }
  addPrioritySourceMarkers(group, manifest.priorityRegistry);
  if (manifest.orientationBlock) addOrientationBlock(group, manifest.orientationBlock);

  debugLog(
    `[loadUtahForgeDemoBoreholes] ${manifest.wells.length} wells from ${url}`,
  );
  return group;
}

export interface DemoBoreholeGeometryStyle {
  radiusM: number;
  color: string;
  opacity: number;
  lineStyle: DemoBoreholeLineStyle;
  dashLengthM: number;
  dashGapM: number;
  pathTreatment: DemoBoreholePathTreatment;
  smoothingStrength: number;
}

export function rebuildDemoBoreholePipeGeometry(
  pipeRoot: THREE.Object3D,
  style: DemoBoreholeGeometryStyle,
): THREE.Vector3[] {
  if (!pipeRoot.userData?.demoBoreholePipeRoot) return [];
  const rawPoints = pipeRoot.userData.demoBoreholeSurveyPoints;
  if (!Array.isArray(rawPoints)) return [];
  const surveyPoints = rawPoints
    .map((point) => sceneTuple(point))
    .filter((point): point is ScenePointTuple => point !== null);
  if (surveyPoints.length < 2) return [];
  const displayTuples = displayPathTuples(
    surveyPoints,
    style.pathTreatment,
    style.smoothingStrength,
  );
  const displayPoints = vectorsFromTuples(displayTuples);
  const buildKey = JSON.stringify({
    r: Number(style.radiusM.toFixed(3)),
    lineStyle: style.lineStyle,
    dashLengthM: Number(style.dashLengthM.toFixed(3)),
    dashGapM: Number(style.dashGapM.toFixed(3)),
    pathTreatment: style.pathTreatment,
    smoothingStrength: Number(style.smoothingStrength.toFixed(3)),
  });
  if (pipeRoot.userData.demoBoreholePipeBuildKey !== buildKey) {
    const root = pipeRoot as THREE.Group;
    disposePipeRoot(root);
    for (const segment of pipeSegmentsForStyle(
      displayPoints,
      style.lineStyle,
      style.dashLengthM,
      style.dashGapM,
    )) {
      addPipeSegment(
        root,
        segment,
        style.radiusM,
        style.color,
        typeof root.userData.demoBoreholeEmissiveColor === "string"
          ? root.userData.demoBoreholeEmissiveColor
          : style.color,
      );
    }
    pipeRoot.userData.demoBoreholePipeBuildKey = buildKey;
    pipeRoot.userData.demoBoreholeRadiusM = style.radiusM;
    pipeRoot.userData.demoBoreholeDisplayPoints = displayTuples;
  }
  pipeRoot.traverse((obj) => {
    if (obj.userData?.demoBoreholePipeSegment !== true) return;
    const mesh = obj as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (!material) return;
    material.color.set(style.color);
    material.emissive?.set(style.color);
    material.opacity = style.opacity;
    material.transparent = true;
    material.needsUpdate = true;
  });
  return displayPoints;
}

export function rebuildDemoBoreholeCenterlineGeometry(
  line: THREE.Object3D,
  points: readonly THREE.Vector3[],
): void {
  if (!line.userData?.demoBoreholeCenterline || !(line instanceof Line2)) {
    return;
  }
  rebuildLineGeometry(line, points);
}
