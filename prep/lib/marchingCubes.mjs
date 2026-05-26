import { edgeTable, triTable } from "three/examples/jsm/objects/MarchingCubes.js";

const CORNER_OFFSETS = [
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
];

function volumeIndex(x, y, z, dimensions) {
  const [nx, ny] = dimensions;
  return z * nx * ny + y * nx + x;
}

function centerCoordinate(min, max, count, index) {
  return min + ((max - min) * (index + 0.5)) / count;
}

function cornerPosition(bounds, dimensions, x, y, z, offset) {
  const [ox, oy, oz] = offset;
  const [nx, ny, nz] = dimensions;
  return [
    centerCoordinate(bounds.minX, bounds.maxX, nx, x + ox),
    centerCoordinate(bounds.minY, bounds.maxY, ny, y + oy),
    centerCoordinate(bounds.minZ, bounds.maxZ, nz, z + oz),
  ];
}

function interpolateVertex(p1, p2, v1, v2, isoValue) {
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

function transformedValue(value, comparison) {
  return comparison === ">=" ? -value : value;
}

function weldMeshVertices({ vertices, colors, scalarValues, indices }) {
  const keyToIndex = new Map();
  const remap = new Array(vertices.length / 3);
  const weldedVertices = [];
  const weldedColors = [];
  const weldedScalarValues = [];

  for (let i = 0; i < vertices.length / 3; i += 1) {
    const x = vertices[i * 3];
    const y = vertices[i * 3 + 1];
    const z = vertices[i * 3 + 2];
    const key = `${x}|${y}|${z}`;
    let nextIndex = keyToIndex.get(key);
    if (nextIndex === undefined) {
      nextIndex = weldedVertices.length / 3;
      keyToIndex.set(key, nextIndex);
      weldedVertices.push(x, y, z);
      weldedColors.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
      weldedScalarValues.push(scalarValues[i]);
    }
    remap[i] = nextIndex;
  }

  const weldedIndices = [];
  let removedDegenerateTriangleCount = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = remap[indices[i]];
    const b = remap[indices[i + 1]];
    const c = remap[indices[i + 2]];
    if (a === b || b === c || a === c) {
      removedDegenerateTriangleCount += 1;
      continue;
    }
    weldedIndices.push(a, b, c);
  }

  return {
    vertices: weldedVertices,
    colors: weldedColors,
    scalarValues: weldedScalarValues,
    indices: weldedIndices,
    stats: {
      inputVertexCount: vertices.length / 3,
      weldedVertexCount: weldedVertices.length / 3,
      inputTriangleCount: indices.length / 3,
      weldedTriangleCount: weldedIndices.length / 3,
      removedDegenerateTriangleCount,
    },
  };
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function smoothMeshVertices({ vertices, indices, round }) {
  const vertexCount = vertices.length / 3;
  const adjacency = Array.from({ length: vertexCount }, () => new Set());
  const edgeUseCounts = new Map();

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    adjacency[a].add(b);
    adjacency[a].add(c);
    adjacency[b].add(a);
    adjacency[b].add(c);
    adjacency[c].add(a);
    adjacency[c].add(b);
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = edgeKey(u, v);
      edgeUseCounts.set(key, (edgeUseCounts.get(key) ?? 0) + 1);
    }
  }

  const boundaryVertices = new Set();
  for (const [key, count] of edgeUseCounts) {
    if (count !== 1) continue;
    const [a, b] = key.split(":").map(Number);
    boundaryVertices.add(a);
    boundaryVertices.add(b);
  }

  const lambda = 0.15;
  const mu = -0.16;
  const iterations = 2;
  let current = vertices.slice();
  const passFactors = Array.from({ length: iterations }, () => [
    lambda,
    mu,
  ]).flat();

  for (const factor of passFactors) {
    const next = current.slice();
    for (let i = 0; i < vertexCount; i += 1) {
      if (boundaryVertices.has(i) || adjacency[i].size === 0) continue;
      let avgX = 0;
      let avgY = 0;
      let avgZ = 0;
      for (const neighbor of adjacency[i]) {
        avgX += current[neighbor * 3];
        avgY += current[neighbor * 3 + 1];
        avgZ += current[neighbor * 3 + 2];
      }
      const count = adjacency[i].size;
      avgX /= count;
      avgY /= count;
      avgZ /= count;
      next[i * 3] = current[i * 3] + (avgX - current[i * 3]) * factor;
      next[i * 3 + 1] =
        current[i * 3 + 1] + (avgY - current[i * 3 + 1]) * factor;
      next[i * 3 + 2] =
        current[i * 3 + 2] + (avgZ - current[i * 3 + 2]) * factor;
    }
    current = next;
  }

  return {
    vertices: current.map((value) => round(value, 2)),
    stats: {
      method: "taubin-laplacian",
      iterations,
      lambda,
      mu,
      boundaryVertexCount: boundaryVertices.size,
      smoothedVertexCount: vertexCount - boundaryVertices.size,
    },
  };
}

export function extractMaskAwareMarchingCubes({
  values,
  mask,
  dimensions,
  bounds,
  thresholdLog10,
  comparison,
  color,
  round,
}) {
  const [nx, ny, nz] = dimensions;
  const isoValue = comparison === ">=" ? -thresholdLog10 : thresholdLog10;
  const vertices = [];
  const colors = [];
  const scalarValues = [];
  const indices = [];
  let visitedCubeCount = 0;
  let skippedMaskedCubeCount = 0;
  let activeCubeCount = 0;

  for (let z = 0; z < nz - 1; z += 1) {
    for (let y = 0; y < ny - 1; y += 1) {
      for (let x = 0; x < nx - 1; x += 1) {
        visitedCubeCount += 1;
        const cubeValues = new Array(8);
        const cubePositions = new Array(8);
        let masked = false;
        for (let corner = 0; corner < 8; corner += 1) {
          const [ox, oy, oz] = CORNER_OFFSETS[corner];
          const index = volumeIndex(x + ox, y + oy, z + oz, dimensions);
          if (mask[index] === 0 || !Number.isFinite(values[index])) {
            masked = true;
            break;
          }
          cubeValues[corner] = transformedValue(values[index], comparison);
          cubePositions[corner] = cornerPosition(
            bounds,
            dimensions,
            x,
            y,
            z,
            CORNER_OFFSETS[corner],
          );
        }
        if (masked) {
          skippedMaskedCubeCount += 1;
          continue;
        }

        let cubeIndex = 0;
        if (cubeValues[0] < isoValue) cubeIndex |= 1;
        if (cubeValues[1] < isoValue) cubeIndex |= 2;
        if (cubeValues[2] < isoValue) cubeIndex |= 8;
        if (cubeValues[3] < isoValue) cubeIndex |= 4;
        if (cubeValues[4] < isoValue) cubeIndex |= 16;
        if (cubeValues[5] < isoValue) cubeIndex |= 32;
        if (cubeValues[6] < isoValue) cubeIndex |= 128;
        if (cubeValues[7] < isoValue) cubeIndex |= 64;

        const bits = edgeTable[cubeIndex];
        if (bits === 0) continue;
        activeCubeCount += 1;

        const edgeVertices = new Array(12);
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
        for (let i = 0; triTable[tableOffset + i] !== -1; i += 3) {
          const vertexStart = vertices.length / 3;
          for (let j = 0; j < 3; j += 1) {
            const edge = triTable[tableOffset + i + j];
            const vertex = edgeVertices[edge];
            vertices.push(
              round(vertex[0], 2),
              round(vertex[1], 2),
              round(vertex[2], 2),
            );
            colors.push(color[0], color[1], color[2]);
            scalarValues.push(round(thresholdLog10, 6));
          }
          indices.push(vertexStart, vertexStart + 1, vertexStart + 2);
        }
      }
    }
  }

  const welded = weldMeshVertices({ vertices, colors, scalarValues, indices });
  const smoothed = smoothMeshVertices({
    vertices: welded.vertices,
    indices: welded.indices,
    round,
  });

  return {
    vertices: smoothed.vertices,
    colors: welded.colors,
    scalarValues: welded.scalarValues,
    indices: welded.indices,
    stats: {
      visitedCubeCount,
      skippedMaskedCubeCount,
      activeCubeCount,
      triangleCount: welded.indices.length / 3,
      vertexCount: welded.vertices.length / 3,
      welding: welded.stats,
      smoothing: smoothed.stats,
    },
  };
}
