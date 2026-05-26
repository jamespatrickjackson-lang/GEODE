import * as THREE from "three";
import { edgeTable, triTable } from "three/examples/jsm/objects/MarchingCubes.js";

type Vec3 = [number, number, number];

interface RuntimeMarchingCubesBounds {
  min: Vec3;
  max: Vec3;
}

interface RuntimeMarchingCubesOptions {
  volume: Uint8Array;
  mask: Uint8Array;
  dimensions: Vec3;
  bounds: RuntimeMarchingCubesBounds;
  sourceRange: [number, number];
  thresholdLog10: number;
  comparison: "<=" | ">=";
}

const EDGE_TABLE = edgeTable as unknown as ArrayLike<number>;
const TRI_TABLE = triTable as unknown as ArrayLike<number>;

const CORNER_OFFSETS: Vec3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
];

const EDGE_CORNERS = [
  [0, 1],
  [1, 3],
  [2, 3],
  [0, 2],
  [4, 5],
  [5, 7],
  [6, 7],
  [4, 6],
  [0, 4],
  [1, 5],
  [3, 7],
  [2, 6],
] as const;

function volumeIndex(x: number, y: number, z: number, dimensions: Vec3): number {
  const [nx, ny] = dimensions;
  return z * nx * ny + y * nx + x;
}

function centerCoordinate(min: number, max: number, count: number, index: number): number {
  return min + ((max - min) * (index + 0.5)) / count;
}

function cornerPosition(
  bounds: RuntimeMarchingCubesBounds,
  dimensions: Vec3,
  x: number,
  y: number,
  z: number,
  offset: Vec3,
): Vec3 {
  const [ox, oy, oz] = offset;
  const [nx, ny, nz] = dimensions;
  return [
    centerCoordinate(bounds.min[0], bounds.max[0], nx, x + ox),
    centerCoordinate(bounds.min[1], bounds.max[1], ny, y + oy),
    centerCoordinate(bounds.min[2], bounds.max[2], nz, z + oz),
  ];
}

function decodeLog10(value: number, [sourceMin, sourceMax]: [number, number]): number {
  return sourceMin + (value / 255) * (sourceMax - sourceMin);
}

function transformedValue(value: number, comparison: "<=" | ">="): number {
  return comparison === ">=" ? -value : value;
}

function interpolateVertex(
  p1: Vec3,
  p2: Vec3,
  v1: number,
  v2: number,
  isoValue: number,
): Vec3 {
  const denominator = v2 - v1;
  const t =
    Math.abs(denominator) < 1e-12
      ? 0.5
      : Math.max(0, Math.min(1, (isoValue - v1) / denominator));
  return [
    p1[0] + (p2[0] - p1[0]) * t,
    p1[1] + (p2[1] - p1[1]) * t,
    p1[2] + (p2[2] - p1[2]) * t,
  ];
}

export function extractRuntimeMarchingCubesGeometry({
  volume,
  mask,
  dimensions,
  bounds,
  sourceRange,
  thresholdLog10,
  comparison,
}: RuntimeMarchingCubesOptions): THREE.BufferGeometry | null {
  const [nx, ny, nz] = dimensions;
  const isoValue = comparison === ">=" ? -thresholdLog10 : thresholdLog10;
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let z = 0; z < nz - 1; z += 1) {
    for (let y = 0; y < ny - 1; y += 1) {
      for (let x = 0; x < nx - 1; x += 1) {
        const cubeValues = new Array<number>(8);
        const cubePositions = new Array<Vec3>(8);
        let masked = false;
        for (let corner = 0; corner < 8; corner += 1) {
          const [ox, oy, oz] = CORNER_OFFSETS[corner];
          const index = volumeIndex(x + ox, y + oy, z + oz, dimensions);
          if (mask[index] === 0) {
            masked = true;
            break;
          }
          cubeValues[corner] = transformedValue(
            decodeLog10(volume[index], sourceRange),
            comparison,
          );
          cubePositions[corner] = cornerPosition(
            bounds,
            dimensions,
            x,
            y,
            z,
            CORNER_OFFSETS[corner],
          );
        }
        if (masked) continue;

        let cubeIndex = 0;
        if (cubeValues[0] < isoValue) cubeIndex |= 1;
        if (cubeValues[1] < isoValue) cubeIndex |= 2;
        if (cubeValues[2] < isoValue) cubeIndex |= 8;
        if (cubeValues[3] < isoValue) cubeIndex |= 4;
        if (cubeValues[4] < isoValue) cubeIndex |= 16;
        if (cubeValues[5] < isoValue) cubeIndex |= 32;
        if (cubeValues[6] < isoValue) cubeIndex |= 128;
        if (cubeValues[7] < isoValue) cubeIndex |= 64;

        const bits = EDGE_TABLE[cubeIndex];
        if (bits === 0) continue;

        const edgeVertices = new Array<Vec3>(12);
        for (let edge = 0; edge < 12; edge += 1) {
          if ((bits & (1 << edge)) === 0) continue;
          const [a, b] = EDGE_CORNERS[edge];
          edgeVertices[edge] = interpolateVertex(
            cubePositions[a],
            cubePositions[b],
            cubeValues[a],
            cubeValues[b],
            isoValue,
          );
        }

        const tableOffset = cubeIndex * 16;
        for (let i = 0; TRI_TABLE[tableOffset + i] !== -1; i += 3) {
          const vertexStart = vertices.length / 3;
          for (let j = 0; j < 3; j += 1) {
            const edge = TRI_TABLE[tableOffset + i + j];
            const vertex = edgeVertices[edge];
            vertices.push(vertex[0], vertex[1], vertex[2]);
          }
          indices.push(vertexStart, vertexStart + 1, vertexStart + 2);
        }
      }
    }
  }

  if (vertices.length === 0 || indices.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
