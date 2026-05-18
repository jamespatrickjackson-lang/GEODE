import * as THREE from "three";

interface ZoneSpec {
  id: string;
  label: string;
  center: [number, number, number];
  radiusX: number;
  radiusY: number;
  rotationDeg?: number;
  color: string;
  labelKind?: "area" | "anomaly" | "siteElement";
}

// The Shahbazi UAV block covers roughly 150 x 200 m, and the TLS sub-zone
// preview spans about 50 x 83 m. Keep the procedural fallback in that same
// metric neighbourhood so real data does not read as accidentally tiny.
const SURFACE_WIDTH_M = 220;
const SURFACE_HEIGHT_M = 170;
const SURFACE_SEGMENTS_X = 88;
const SURFACE_SEGMENTS_Y = 68;
const CONTEXT_GROUND_WIDTH_M = 720;
const CONTEXT_GROUND_HEIGHT_M = 560;
const CONTEXT_GROUND_CLEARANCE_M = 14;

const ZONES: ZoneSpec[] = [
  {
    id: "bench-walkthrough",
    label: "Bench Walkthrough",
    center: [0, 0, 116],
    radiusX: 36,
    radiusY: 17,
    rotationDeg: -12,
    color: "#75c7ff",
    labelKind: "area",
  },
  {
    id: "ore-grade-hotspot",
    label: "Ore-Grade Hotspot",
    center: [42, -30, 122],
    radiusX: 18,
    radiusY: 12,
    rotationDeg: 24,
    color: "#ff5f78",
    labelKind: "anomaly",
  },
  {
    id: "stockpile-volume-zone",
    label: "Stockpile / Volume Zone",
    center: [60, 36, 119],
    radiusX: 22,
    radiusY: 13,
    rotationDeg: -18,
    color: "#7bd88f",
    labelKind: "area",
  },
  {
    id: "slope-stability-anomaly",
    label: "Slope Stability Anomaly",
    center: [-46, -28, 128],
    radiusX: 22,
    radiusY: 13,
    rotationDeg: 18,
    color: "#ff8a4c",
    labelKind: "anomaly",
  },
  {
    id: "restoration-preview",
    label: "Restoration Preview",
    center: [-58, 48, 113],
    radiusX: 28,
    radiusY: 16,
    rotationDeg: 8,
    color: "#b6e89e",
    labelKind: "area",
  },
  {
    id: "public-viewpoint",
    label: "Public Viewpoint / Viewshed",
    center: [82, -62, 132],
    radiusX: 24,
    radiusY: 16,
    rotationDeg: -32,
    color: "#cdbbff",
    labelKind: "siteElement",
  },
];

function surfaceHeight(x: number, y: number): number {
  const broad = 5.5 * Math.sin(x / 46) + 3.5 * Math.cos(y / 38);
  const bench = 3.4 * Math.sin((x + y * 0.35) / 18);
  const pit = -17 * Math.exp(-((x + 7) ** 2) / 3600 - (y ** 2) / 2100);
  return 116 + broad + bench + pit;
}

function makeSurface(): THREE.Mesh {
  const geom = new THREE.PlaneGeometry(
    SURFACE_WIDTH_M,
    SURFACE_HEIGHT_M,
    SURFACE_SEGMENTS_X,
    SURFACE_SEGMENTS_Y,
  );
  const pos = geom.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, surfaceHeight(x, y));
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    color: "#8a7e68",
    roughness: 0.92,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  mat.userData.preserveMaterialColor = true;

  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = "case-study-b-demo-surface";
  mesh.receiveShadow = false;
  return mesh;
}

function cloneGroundMaterial(surface: THREE.Mesh): THREE.Material {
  const source = Array.isArray(surface.material)
    ? surface.material[0]
    : surface.material;
  const material = source.clone();
  material.userData = { ...source.userData };
  return material;
}

function sampleSurfacePerimeterLow(): number {
  let low = Number.POSITIVE_INFINITY;
  const samples = 36;
  const x0 = -SURFACE_WIDTH_M / 2;
  const x1 = SURFACE_WIDTH_M / 2;
  const y0 = -SURFACE_HEIGHT_M / 2;
  const y1 = SURFACE_HEIGHT_M / 2;
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const x = THREE.MathUtils.lerp(x0, x1, t);
    const y = THREE.MathUtils.lerp(y0, y1, t);
    low = Math.min(
      low,
      surfaceHeight(x, y0),
      surfaceHeight(x, y1),
      surfaceHeight(x0, y),
      surfaceHeight(x1, y),
    );
  }
  return low;
}

function makeSurroundingGround(surface: THREE.Mesh): THREE.Mesh {
  const outerX = CONTEXT_GROUND_WIDTH_M / 2;
  const outerY = CONTEXT_GROUND_HEIGHT_M / 2;
  const innerX = SURFACE_WIDTH_M / 2 + CONTEXT_GROUND_CLEARANCE_M;
  const innerY = SURFACE_HEIGHT_M / 2 + CONTEXT_GROUND_CLEARANCE_M;

  const shape = new THREE.Shape();
  shape.moveTo(-outerX, -outerY);
  shape.lineTo(outerX, -outerY);
  shape.lineTo(outerX, outerY);
  shape.lineTo(-outerX, outerY);
  shape.lineTo(-outerX, -outerY);

  const hole = new THREE.Path();
  hole.moveTo(-innerX, -innerY);
  hole.lineTo(-innerX, innerY);
  hole.lineTo(innerX, innerY);
  hole.lineTo(innerX, -innerY);
  hole.lineTo(-innerX, -innerY);
  shape.holes.push(hole);

  const geom = new THREE.ShapeGeometry(shape);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  const mesh = new THREE.Mesh(geom, cloneGroundMaterial(surface));
  mesh.name = "case-study-b-demo-surrounding-ground";
  mesh.position.z = sampleSurfacePerimeterLow() - 1.5;
  mesh.receiveShadow = false;
  return mesh;
}

function makeSurfaceGrid(): THREE.LineSegments {
  const lines: number[] = [];
  const step = 20;
  const x0 = -SURFACE_WIDTH_M / 2;
  const x1 = SURFACE_WIDTH_M / 2;
  const y0 = -SURFACE_HEIGHT_M / 2;
  const y1 = SURFACE_HEIGHT_M / 2;
  for (let x = x0; x <= x1; x += step) {
    lines.push(x, y0, surfaceHeight(x, y0) + 2, x, y1, surfaceHeight(x, y1) + 2);
  }
  for (let y = y0; y <= y1; y += step) {
    lines.push(x0, y, surfaceHeight(x0, y) + 2, x1, y, surfaceHeight(x1, y) + 2);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const mat = new THREE.LineBasicMaterial({
    color: "#d7d1c7",
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  mat.userData.preserveMaterialColor = true;
  mat.userData.forceTransparent = true;
  mat.userData.preserveMaterialOpacity = true;
  const grid = new THREE.LineSegments(geom, mat);
  grid.name = "case-study-b-demo-grid";
  grid.renderOrder = 1;
  return grid;
}

function makeZone(zone: ZoneSpec): THREE.Group {
  const root = new THREE.Group();
  root.name = zone.id;
  root.userData.demoZoneId = zone.id;
  root.userData.demoZoneLabel = zone.label;
  const [cx, cy, cz] = zone.center;
  root.position.set(cx, cy, cz);
  root.rotation.z = THREE.MathUtils.degToRad(zone.rotationDeg ?? 0);

  const shape = new THREE.Shape();
  shape.absellipse(0, 0, zone.radiusX, zone.radiusY, 0, Math.PI * 2, false, 0);
  const fillGeom = new THREE.ShapeGeometry(shape, 80);
  const fillMat = new THREE.MeshBasicMaterial({
    color: zone.color,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  fillMat.userData.preserveMaterialColor = true;
  fillMat.userData.forceTransparent = true;
  fillMat.userData.preserveMaterialOpacity = true;
  const fill = new THREE.Mesh(fillGeom, fillMat);
  fill.name = `${zone.id}-fill`;
  fill.renderOrder = 5;
  fill.userData.displayName = zone.label;
  fill.userData.demoZoneId = zone.id;
  root.add(fill);

  const points: number[] = [];
  const steps = 128;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    points.push(Math.cos(t) * zone.radiusX, Math.sin(t) * zone.radiusY, 1.2);
  }
  const outlineGeom = new THREE.BufferGeometry();
  outlineGeom.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const outlineMat = new THREE.LineBasicMaterial({
    color: zone.color,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  outlineMat.userData.preserveMaterialColor = true;
  outlineMat.userData.forceTransparent = true;
  outlineMat.userData.preserveMaterialOpacity = true;
  const outline = new THREE.Line(outlineGeom, outlineMat);
  outline.name = `${zone.id}-outline`;
  outline.renderOrder = 6;
  outline.userData.demoZoneId = zone.id;
  root.add(outline);

  const markerMat = new THREE.MeshBasicMaterial({
    color: zone.color,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  markerMat.userData.preserveMaterialColor = true;
  markerMat.userData.forceTransparent = true;
  markerMat.userData.preserveMaterialOpacity = true;
  const marker = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 12), markerMat);
  marker.position.set(0, 0, 5.5);
  marker.name = `${zone.id}-label-anchor`;
  marker.renderOrder = 7;
  marker.userData.displayName = zone.label;
  marker.userData.demoZoneId = zone.id;
  marker.userData.demoZoneLabelAnchor = true;
  marker.userData.labelAnchor = true;
  marker.userData.labelKind = zone.labelKind ?? "area";
  root.add(marker);

  return root;
}

function makeHaulRoute(): THREE.Line {
  const route: Array<[number, number]> = [
    [-92, 64],
    [-58, 48],
    [-28, 18],
    [0, 0],
    [28, 14],
    [60, 36],
    [94, 58],
  ];
  const points: number[] = [];
  for (const [x, y] of route) {
    points.push(x, y, surfaceHeight(x, y) + 2.4);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const mat = new THREE.LineBasicMaterial({
    color: "#ffb24a",
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  mat.userData.preserveMaterialColor = true;
  mat.userData.forceTransparent = true;
  mat.userData.preserveMaterialOpacity = true;
  const line = new THREE.Line(geom, mat);
  line.name = "case-study-b-demo-haul-route";
  line.renderOrder = 4;
  return line;
}

function makeDrillTraces(): THREE.LineSegments {
  const collars: Array<[number, number, number, number, number, number]> = [
    [34, -26, 133, 29, -31, 78],
    [42, -30, 134, 38, -35, 72],
    [52, -37, 132, 47, -39, 82],
    [30, -38, 131, 25, -42, 86],
  ];
  const segments: number[] = [];
  for (const [x0, y0, z0, x1, y1, z1] of collars) {
    segments.push(x0, y0, z0, x1, y1, z1);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
  const mat = new THREE.LineBasicMaterial({
    color: "#f8d06b",
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  mat.userData.preserveMaterialColor = true;
  mat.userData.forceTransparent = true;
  mat.userData.preserveMaterialOpacity = true;
  const lines = new THREE.LineSegments(geom, mat);
  lines.name = "case-study-b-demo-drill-traces";
  lines.renderOrder = 7;
  return lines;
}

function makeRunoffLines(): THREE.LineSegments {
  const channels: Array<Array<[number, number]>> = [
    [
      [-52, -18],
      [-36, -6],
      [-12, 8],
      [16, 24],
    ],
    [
      [-68, 44],
      [-52, -18],
      [-38, -3],
      [-18, 10],
    ],
    [
      [-66, 44],
      [-48, 39],
      [-30, 30],
      [-8, 20],
    ],
    [
      [8, 18],
      [28, 30],
      [52, 46],
      [78, 58],
    ],
  ];
  const segments: number[] = [];
  for (const channel of channels) {
    for (let i = 0; i < channel.length - 1; i += 1) {
      const [x0, y0] = channel[i];
      const [x1, y1] = channel[i + 1];
      segments.push(
        x0,
        y0,
        surfaceHeight(x0, y0) + 3,
        x1,
        y1,
        surfaceHeight(x1, y1) + 3,
      );
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
  const mat = new THREE.LineBasicMaterial({
    color: "#4fb6ff",
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
  });
  mat.userData.preserveMaterialColor = true;
  mat.userData.forceTransparent = true;
  mat.userData.preserveMaterialOpacity = true;
  const lines = new THREE.LineSegments(geom, mat);
  lines.name = "case-study-b-demo-runoff-lines";
  lines.renderOrder = 6;
  return lines;
}

function makeBenchLines(): THREE.LineSegments {
  const segments: number[] = [];
  for (let i = -4; i <= 4; i++) {
    const y = i * 7;
    const x0 = -45 + Math.abs(i) * 2.5;
    const x1 = 45 - Math.abs(i) * 3;
    segments.push(
      x0,
      y,
      surfaceHeight(x0, y) + 2.8,
      x1,
      y + 3,
      surfaceHeight(x1, y + 3) + 2.8,
    );
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
  const mat = new THREE.LineBasicMaterial({
    color: "#dcefff",
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  mat.userData.preserveMaterialColor = true;
  mat.userData.forceTransparent = true;
  mat.userData.preserveMaterialOpacity = true;
  const lines = new THREE.LineSegments(geom, mat);
  lines.name = "case-study-b-demo-bench-lines";
  lines.renderOrder = 4;
  return lines;
}

export async function loadDemoQuarry(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = "case-study-b-demo-shell";
  group.userData.demoShell = true;

  const surface = makeSurface();
  group.add(makeSurroundingGround(surface));
  group.add(surface);
  group.add(makeSurfaceGrid());
  group.add(makeHaulRoute());
  group.add(makeDrillTraces());
  group.add(makeRunoffLines());
  group.add(makeBenchLines());
  for (const zone of ZONES) {
    group.add(makeZone(zone));
  }

  return group;
}
