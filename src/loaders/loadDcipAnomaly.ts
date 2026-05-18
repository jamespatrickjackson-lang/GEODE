import * as THREE from "three";
import { utmToScene } from "../constants";
import { getHeightSampler } from "../scene/heightSampler";

interface DcipAnomalySpec {
  displayName: string;
  centerUtm: [number, number];
  halfAxes: [number, number];
  rotationDeg: number;
  color: number;
}

const RADIAL_SEGMENTS = 24;
const ANGULAR_SEGMENTS = 128;
const FILL_RAISE_M = 8;

// Draft placement from the Vizsla Figure 2/3 source imagery and the
// previous Great Plains chargeability stub. Replace these numbers when a
// digitized DCIP polygon or chargeability grid is available.
const MEGATON_DCIP_SPEC: DcipAnomalySpec = {
  displayName: "Megaton DCIP anomaly (figure-derived draft)",
  centerUtm: [613600, 5787800],
  halfAxes: [1150, 900],
  rotationDeg: -10,
  color: 0xff8a2e,
};

function rotateLocal(
  spec: DcipAnomalySpec,
  localX: number,
  localY: number,
): [number, number] {
  const rot = THREE.MathUtils.degToRad(spec.rotationDeg);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return [
    spec.centerUtm[0] + localX * cos - localY * sin,
    spec.centerUtm[1] + localX * sin + localY * cos,
  ];
}

async function buildAnomalyGroup(
  spec: DcipAnomalySpec,
): Promise<THREE.Group> {
  const sample = await getHeightSampler();
  const group = new THREE.Group();
  group.name = "megaton-dcip-anomaly";

  const positions: number[] = [];
  const indices: number[] = [];

  const [centerSx, centerSy, centerSz] = utmToScene(
    spec.centerUtm[0],
    spec.centerUtm[1],
    sample(spec.centerUtm[0], spec.centerUtm[1]) + FILL_RAISE_M,
  );
  positions.push(centerSx, centerSy, centerSz);

  const labelAnchor = new THREE.Object3D();
  labelAnchor.name = "megaton-dcip-label-anchor";
  labelAnchor.position.set(centerSx, centerSy, centerSz);
  labelAnchor.userData.displayName = spec.displayName;
  labelAnchor.userData.labelAnchor = true;
  group.add(labelAnchor);

  const vertexIndex = (ring: number, segment: number) =>
    1 + (ring - 1) * ANGULAR_SEGMENTS +
    ((segment + ANGULAR_SEGMENTS) % ANGULAR_SEGMENTS);

  for (let ring = 1; ring <= RADIAL_SEGMENTS; ring++) {
    const radius = ring / RADIAL_SEGMENTS;
    for (let segment = 0; segment < ANGULAR_SEGMENTS; segment++) {
      const theta = (segment / ANGULAR_SEGMENTS) * Math.PI * 2;
      const localX = Math.cos(theta) * spec.halfAxes[0] * radius;
      const localY = Math.sin(theta) * spec.halfAxes[1] * radius;
      const [utmX, utmY] = rotateLocal(spec, localX, localY);
      const z = sample(utmX, utmY) + FILL_RAISE_M;
      const [sx, sy, sz] = utmToScene(utmX, utmY, z);
      positions.push(sx, sy, sz);
    }
  }

  for (let segment = 0; segment < ANGULAR_SEGMENTS; segment++) {
    indices.push(0, vertexIndex(1, segment), vertexIndex(1, segment + 1));
  }
  for (let ring = 2; ring <= RADIAL_SEGMENTS; ring++) {
    for (let segment = 0; segment < ANGULAR_SEGMENTS; segment++) {
      const innerA = vertexIndex(ring - 1, segment);
      const innerB = vertexIndex(ring - 1, segment + 1);
      const outerA = vertexIndex(ring, segment);
      const outerB = vertexIndex(ring, segment + 1);
      indices.push(innerA, outerA, innerB, innerB, outerA, outerB);
    }
  }

  const fillGeom = new THREE.BufferGeometry();
  fillGeom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  fillGeom.setIndex(indices);
  fillGeom.computeVertexNormals();

  const fillMat = new THREE.MeshBasicMaterial({
    color: spec.color,
    transparent: true,
    opacity: 0.42,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  fillMat.fog = true;
  fillMat.userData.forceTransparent = true;
  fillMat.polygonOffset = true;
  fillMat.polygonOffsetFactor = -1;
  fillMat.polygonOffsetUnits = -1;

  const fill = new THREE.Mesh(fillGeom, fillMat);
  fill.renderOrder = 3;
  fill.userData.displayName = spec.displayName;
  group.add(fill);

  return group;
}

export function loadMegatonDcipAnomaly(): Promise<THREE.Group> {
  return buildAnomalyGroup(MEGATON_DCIP_SPEC);
}
