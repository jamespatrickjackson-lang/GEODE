import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { utmToScene } from "../constants";
import { debugLog } from "../utils/debugLog";

interface GammaSample {
  depthM: number;
  runRedCps?: number | null;
  runBlueCps?: number | null;
}

interface EzGammaFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number, number] };
  properties: {
    id: string;
    displayName?: string;
    gammaCpsMax?: number;
    surveyDepthM?: number;
    loggedOverburdenM?: number | null;
    interpretedOverburden1M?: number | null;
    interpretedOverburden2M?: number | null;
    image?: string | null;
    gammaSamples?: GammaSample[];
    [k: string]: unknown;
  };
}

interface EzGammaCollection {
  type: "FeatureCollection";
  features: EzGammaFeature[];
}

const DEFAULT_TRACK_OFFSET_M = 36;
const DEFAULT_TRACK_WIDTH_M = 78;
const STEM_RADIUS_M = 3.6;
const COLLAR_RADIUS_M = 14;
const CONTACT_RING_RADIUS_M = 42;
const CONTACT_RING_TUBE_M = 3.2;
const CONTACT_COIN_THICKNESS_M = 2.4;
const PANEL_EXTRA_WIDTH_M = 28;
const PANEL_RENDER_ORDER = 6.8;
const STEM_RENDER_ORDER = 7.0;
const CURVE_RENDER_ORDER = 7.4;
const CONTACT_RENDER_ORDER = 7.7;
const CURVE_LINE_WIDTH_PX = 2.4;
const TUBE_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function clampNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function makeMaterial(
  color: THREE.ColorRepresentation,
  opacity: number,
  preserveColor = false,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.012,
    roughness: 0.42,
    metalness: 0.1,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    toneMapped: true,
    fog: false,
  });
  mat.userData.forceTransparent = true;
  if (preserveColor) mat.userData.preserveMaterialColor = true;
  return mat;
}

function makePanelMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x1d211a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: true,
    fog: false,
  });
  mat.userData.forceTransparent = true;
  mat.userData.preserveMaterialColor = true;
  mat.userData.preserveMaterialOpacity = true;
  return mat;
}

function makeCurveMaterial(color: THREE.ColorRepresentation): LineMaterial {
  const mat = new LineMaterial({
    color,
    linewidth: CURVE_LINE_WIDTH_PX,
    worldUnits: false,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: false,
  });
  mat.resolution.set(window.innerWidth || 1920, window.innerHeight || 1080);
  mat.fog = false;
  mat.userData.forceTransparent = true;
  mat.userData.preserveMaterialColor = true;
  return mat;
}

function addVerticalCylinder(
  group: THREE.Group,
  topDepthM: number,
  bottomDepthM: number,
  radiusM: number,
  material: THREE.Material,
  name: string,
  part: "surveyTube" | "loggedOverburden" | "bedrockInterval",
): void {
  const height = Math.max(0.1, bottomDepthM - topDepthM);
  const container = new THREE.Group();
  container.name = name;
  container.userData.ezGammaTubeGroup = true;
  container.userData.ezGammaTubePart = part;
  container.userData.ezGammaTubeBaseRadiusM = radiusM;
  container.userData.ezGammaTubeBaseHeightM = height;
  container.userData.ezGammaTubeTopDepthM = topDepthM;
  container.userData.ezGammaTubeBottomDepthM = bottomDepthM;

  const solid = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusM, radiusM, height, 14, 1, true),
    material,
  );
  solid.name = `${name}-solid`;
  solid.position.z = -(topDepthM + bottomDepthM) * 0.5;
  solid.quaternion.setFromUnitVectors(TUBE_AXIS, Z_AXIS);
  solid.renderOrder = STEM_RENDER_ORDER;
  solid.userData.ezGammaTubeMesh = true;
  solid.userData.ezGammaTubeVariant = "solid";
  solid.userData.ezGammaTubePart = part;
  solid.userData.ezGammaTubeBaseRadiusM = radiusM;
  container.add(solid);

  const dashCount = Math.max(3, Math.min(18, Math.round(height / 14)));
  const dashPitch = height / dashCount;
  const dashHeight = dashPitch * 0.54;
  for (let i = 0; i < dashCount; i++) {
    const dashTop = topDepthM + i * dashPitch + dashPitch * 0.12;
    const dashBottom = Math.min(bottomDepthM, dashTop + dashHeight);
    const dash = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusM, radiusM, dashBottom - dashTop, 14, 1, true),
      material,
    );
    dash.name = `${name}-dash-${i + 1}`;
    dash.position.z = -(dashTop + dashBottom) * 0.5;
    dash.quaternion.setFromUnitVectors(TUBE_AXIS, Z_AXIS);
    dash.renderOrder = STEM_RENDER_ORDER;
    dash.visible = false;
    dash.userData.ezGammaTubeMesh = true;
    dash.userData.ezGammaTubeVariant = "dashed";
    dash.userData.ezGammaTubePart = part;
    dash.userData.ezGammaTubeBaseRadiusM = radiusM;
    container.add(dash);
  }

  group.add(container);
}

function addContactRing(
  group: THREE.Group,
  depthM: number | null | undefined,
  radiusM: number,
  material: THREE.Material,
  name: string,
  contactIndex: 1 | 2,
): void {
  if (typeof depthM !== "number" || !Number.isFinite(depthM)) return;
  const container = new THREE.Group();
  container.name = name;
  container.userData.ezGammaContactGroup = true;
  container.userData.ezGammaContactIndex = contactIndex;
  container.position.z = -depthM;

  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radiusM, CONTACT_RING_TUBE_M, 8, 72),
    material,
  );
  torus.name = `${name}-torus`;
  torus.renderOrder = CONTACT_RENDER_ORDER;
  torus.userData.ezGammaContact = true;
  torus.userData.ezGammaContactShape = "torus";
  torus.userData.ezGammaContactIndex = contactIndex;
  torus.userData.ezGammaContactBaseRadiusM = radiusM;
  torus.userData.ezGammaContactBaseThicknessM = CONTACT_RING_TUBE_M;
  container.add(torus);

  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusM, radiusM, CONTACT_COIN_THICKNESS_M, 72),
    material,
  );
  coin.name = `${name}-coin`;
  coin.quaternion.setFromUnitVectors(TUBE_AXIS, Z_AXIS);
  coin.renderOrder = CONTACT_RENDER_ORDER;
  coin.visible = false;
  coin.userData.ezGammaContact = true;
  coin.userData.ezGammaContactShape = "coin";
  coin.userData.ezGammaContactIndex = contactIndex;
  coin.userData.ezGammaContactBaseRadiusM = radiusM;
  coin.userData.ezGammaContactBaseThicknessM = CONTACT_COIN_THICKNESS_M;
  container.add(coin);

  group.add(container);
}

function makeCurve(
  samples: GammaSample[],
  key: "runRedCps" | "runBlueCps",
  cpsMax: number,
  color: THREE.ColorRepresentation,
  side: 1 | -1 = 1,
): Line2 | null {
  const positions: number[] = [];
  for (const sample of samples) {
    const depth = clampNumber(sample.depthM, NaN);
    const cps = clampNumber(sample[key], NaN);
    if (!Number.isFinite(depth) || !Number.isFinite(cps)) continue;
    const x = Math.max(0, Math.min(1, cps / cpsMax)) * DEFAULT_TRACK_WIDTH_M;
    positions.push(x * side, 0, -depth);
  }
  if (positions.length < 6) return null;
  const geom = new LineGeometry();
  geom.setPositions(positions);
  const line = new Line2(geom, makeCurveMaterial(color));
  line.name =
    key === "runRedCps"
      ? side === 1
        ? "ez-gamma-red-run"
        : "ez-gamma-red-run-mirror"
      : side === 1
        ? "ez-gamma-blue-run"
        : "ez-gamma-blue-run-mirror";
  line.computeLineDistances();
  line.renderOrder = CURVE_RENDER_ORDER;
  line.userData.ezGammaCurve = true;
  line.userData.ezGammaCurveRun = key === "runRedCps" ? "red" : "blue";
  line.userData.ezGammaTraceSide = side;
  line.userData.displayName =
    key === "runRedCps" ? "Red gamma run" : "Blue gamma run";
  return line;
}

function addTrackPanel(
  track: THREE.Group,
  surveyDepthM: number,
): void {
  const mirroredWidth =
    (DEFAULT_TRACK_OFFSET_M + DEFAULT_TRACK_WIDTH_M + PANEL_EXTRA_WIDTH_M * 0.5) *
    2;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(
      mirroredWidth,
      Math.max(20, surveyDepthM),
    ),
    makePanelMaterial(),
  );
  panel.name = "ez-gamma-log-panel";
  panel.position.set(0, -2.6, -surveyDepthM * 0.5);
  panel.rotation.x = Math.PI / 2;
  panel.renderOrder = PANEL_RENDER_ORDER;
  panel.userData.ezGammaTrackPanel = true;
  panel.userData.ezGammaPanelBaseWidthM = mirroredWidth;
  track.add(panel);
}

function buildHole(feature: EzGammaFeature): THREE.Group {
  const [e, n, elev] = feature.geometry.coordinates;
  const [sx, sy, sz] = utmToScene(e, n, elev);
  const props = feature.properties;
  const hole = new THREE.Group();
  hole.name = `ez-gamma-${props.id}`;
  hole.position.set(sx, sy, sz);
  hole.userData.ezGammaHoleRoot = true;
  hole.userData.displayName = props.displayName ?? `${props.id} EZ Gamma`;
  hole.userData.holeId = props.id;
  hole.userData.image = props.image;

  const surveyDepthM = Math.max(1, clampNumber(props.surveyDepthM, 1));
  const loggedObM = clampNumber(props.loggedOverburdenM, surveyDepthM);
  const contact1M = props.interpretedOverburden1M;
  const contact2M = props.interpretedOverburden2M;
  const cpsMax = Math.max(1, clampNumber(props.gammaCpsMax, 140));
  const samples = Array.isArray(props.gammaSamples) ? props.gammaSamples : [];

  const collarMaterial = makeMaterial("#9ee4ac", 0.94);
  const stemMaterial = makeMaterial("#e7ddc7", 0.34, true);
  const overburdenMaterial = makeMaterial("#d2a35f", 0.42, true);
  const bedrockMaterial = makeMaterial("#75c878", 0.46);
  const contactMaterial = makeMaterial("#fff2bc", 0.86, true);
  const secondaryContactMaterial = makeMaterial("#e6d4a2", 0.55, true);

  const collar = new THREE.Mesh(
    new THREE.SphereGeometry(COLLAR_RADIUS_M, 18, 12),
    collarMaterial,
  );
  collar.name = "ez-gamma-collar";
  collar.renderOrder = CONTACT_RENDER_ORDER;
  collar.userData.displayName = hole.userData.displayName;
  collar.userData.kind = "ez-gamma-collar";
  collar.userData.ezGammaPart = "collar";
  collar.userData.ezGammaBaseRadiusM = COLLAR_RADIUS_M;
  hole.add(collar);

  addVerticalCylinder(
    hole,
    0,
    surveyDepthM,
    STEM_RADIUS_M,
    stemMaterial,
    "ez-gamma-survey-depth",
    "surveyTube",
  );
  addVerticalCylinder(
    hole,
    0,
    Math.min(surveyDepthM, loggedObM),
    STEM_RADIUS_M * 2.2,
    overburdenMaterial,
    "ez-gamma-logged-overburden",
    "loggedOverburden",
  );
  addVerticalCylinder(
    hole,
    Math.min(surveyDepthM, loggedObM),
    surveyDepthM,
    STEM_RADIUS_M * 1.7,
    bedrockMaterial,
    "ez-gamma-below-contact",
    "bedrockInterval",
  );
  addContactRing(
    hole,
    contact1M,
    CONTACT_RING_RADIUS_M,
    contactMaterial,
    "ez-gamma-interpreted-contact-1",
    1,
  );
  addContactRing(
    hole,
    contact2M,
    CONTACT_RING_RADIUS_M * 0.76,
    secondaryContactMaterial,
    "ez-gamma-interpreted-contact-2",
    2,
  );

  const pivot = new THREE.Group();
  pivot.name = "ez-gamma-camera-facing-pivot";
  pivot.userData.ezGammaBillboardPivot = true;
  pivot.userData.ezGammaTrackOffsetM = DEFAULT_TRACK_OFFSET_M;
  pivot.userData.ezGammaTrackWidthM = DEFAULT_TRACK_WIDTH_M;

  addTrackPanel(pivot, surveyDepthM);

  const addTraceSide = (side: 1 | -1) => {
    const track = new THREE.Group();
    track.name =
      side === 1 ? "ez-gamma-log-track-right" : "ez-gamma-log-track-left";
    track.position.x = DEFAULT_TRACK_OFFSET_M * side;
    track.userData.ezGammaTrackGroup = true;
    track.userData.ezGammaTrackSide = side;
    const red = makeCurve(samples, "runRedCps", cpsMax, "#f04a45", side);
    const blue = makeCurve(samples, "runBlueCps", cpsMax, "#3576ff", side);
    if (red) track.add(red);
    if (blue) track.add(blue);
    pivot.add(track);
  };

  addTraceSide(1);
  addTraceSide(-1);
  hole.add(pivot);

  return hole;
}

export async function loadEzGamma(url: string): Promise<THREE.Group> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const data = (await res.json()) as EzGammaCollection;

  const group = new THREE.Group();
  group.name = "ez-gamma-2024";
  group.userData.displayName = "2024 EZ Gamma surveys";

  for (const feature of data.features) {
    if (feature.geometry?.type !== "Point") continue;
    group.add(buildHole(feature));
  }

  debugLog(`[loadEzGamma] ${group.children.length} surveyed holes`);
  return group;
}
