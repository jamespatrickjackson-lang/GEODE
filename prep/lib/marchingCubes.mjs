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

function smoothMeshVertices({
  vertices,
  indices,
  round,
  iterations = 8,
  pinBoundary = false,
}) {
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
  let current = vertices.slice();
  const passFactors = Array.from({ length: iterations }, () => [
    lambda,
    mu,
  ]).flat();

  for (const factor of passFactors) {
    const next = current.slice();
    for (let i = 0; i < vertexCount; i += 1) {
      if ((pinBoundary && boundaryVertices.has(i)) || adjacency[i].size === 0)
        continue;
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
      pinBoundary,
      boundaryVertexCount: boundaryVertices.size,
      smoothedVertexCount: pinBoundary
        ? vertexCount - boundaryVertices.size
        : vertexCount,
    },
  };
}

// One level of linear (1->4) triangle subdivision with shared edge midpoints,
// decoupled from the voxel grid. Geometry-only: midpoints are averages of
// in-surface vertices, so no resistivity value is fabricated. Per-surface color
// and scalar are uniform, so they are simply re-emitted at the new vertex count.
function subdivideMesh({ vertices, indices, color, scalarValue, round }) {
  const outVertices = vertices.slice();
  const midCache = new Map();
  const midpoint = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const cached = midCache.get(key);
    if (cached !== undefined) return cached;
    const index = outVertices.length / 3;
    outVertices.push(
      round((vertices[a * 3] + vertices[b * 3]) / 2, 2),
      round((vertices[a * 3 + 1] + vertices[b * 3 + 1]) / 2, 2),
      round((vertices[a * 3 + 2] + vertices[b * 3 + 2]) / 2, 2),
    );
    midCache.set(key, index);
    return index;
  };
  const outIndices = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    outIndices.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
  }
  const vertexCount = outVertices.length / 3;
  const outColors = new Array(vertexCount * 3);
  const outScalarValues = new Array(vertexCount);
  const roundedScalar = round(scalarValue, 6);
  for (let v = 0; v < vertexCount; v += 1) {
    outColors[v * 3] = color[0];
    outColors[v * 3 + 1] = color[1];
    outColors[v * 3 + 2] = color[2];
    outScalarValues[v] = roundedScalar;
  }
  return {
    vertices: outVertices,
    indices: outIndices,
    colors: outColors,
    scalarValues: outScalarValues,
    stats: {
      inputVertexCount: vertices.length / 3,
      subdividedVertexCount: vertexCount,
      inputTriangleCount: indices.length / 3,
      subdividedTriangleCount: outIndices.length / 3,
    },
  };
}

// Trilinear sample of the scalar field at continuous voxel coords, ignoring
// NaN/empty corners (renormalizing over valid weight). Returns NaN if no valid
// corner contributes.
function sampleFieldTrilinear(values, dimensions, fx, fy, fz) {
  const [nx, ny, nz] = dimensions;
  const cx = Math.max(0, Math.min(nx - 1, fx));
  const cy = Math.max(0, Math.min(ny - 1, fy));
  const cz = Math.max(0, Math.min(nz - 1, fz));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const z0 = Math.floor(cz);
  const x1 = Math.min(x0 + 1, nx - 1);
  const y1 = Math.min(y0 + 1, ny - 1);
  const z1 = Math.min(z0 + 1, nz - 1);
  const tx = cx - x0;
  const ty = cy - y0;
  const tz = cz - z0;
  const slab = nx * ny;
  const corners = [
    [x0, y0, z0, (1 - tx) * (1 - ty) * (1 - tz)],
    [x1, y0, z0, tx * (1 - ty) * (1 - tz)],
    [x0, y1, z0, (1 - tx) * ty * (1 - tz)],
    [x1, y1, z0, tx * ty * (1 - tz)],
    [x0, y0, z1, (1 - tx) * (1 - ty) * tz],
    [x1, y0, z1, tx * (1 - ty) * tz],
    [x0, y1, z1, (1 - tx) * ty * tz],
    [x1, y1, z1, tx * ty * tz],
  ];
  let sum = 0;
  let weight = 0;
  for (const [x, y, z, w] of corners) {
    const v = values[z * slab + y * nx + x];
    if (Number.isFinite(v)) {
      sum += v * w;
      weight += w;
    }
  }
  return weight > 1e-6 ? sum / weight : Number.NaN;
}

// Best-practice isosurface normals: the exact normal is the gradient of the
// scalar field, ∇f, sampled at each (final, smoothed) vertex. This is grid-
// independent and removes the lattice-aligned shading striation that
// geometry-derived (computeVertexNormals) normals bake in. Oriented outward by
// comparison: +∇f for `<=` shells, -∇f for `>=` shells.
function computeFieldGradientNormals({
  vertices,
  values,
  dimensions,
  bounds,
  comparison,
  round,
}) {
  const [nx, ny, nz] = dimensions;
  const spanX = Math.max(1e-9, bounds.maxX - bounds.minX);
  const spanY = Math.max(1e-9, bounds.maxY - bounds.minY);
  const spanZ = Math.max(1e-9, bounds.maxZ - bounds.minZ);
  const spacingX = spanX / nx;
  const spacingY = spanY / ny;
  const spacingZ = spanZ / nz;
  const sign = comparison === ">=" ? -1 : 1;
  const h = 0.75; // central-difference offset in voxel units
  const count = vertices.length / 3;
  const normals = new Array(vertices.length);
  for (let i = 0; i < count; i += 1) {
    const fx = ((vertices[i * 3] - bounds.minX) / spanX) * nx - 0.5;
    const fy = ((vertices[i * 3 + 1] - bounds.minY) / spanY) * ny - 0.5;
    const fz = ((vertices[i * 3 + 2] - bounds.minZ) / spanZ) * nz - 0.5;
    const gx =
      (sampleFieldTrilinear(values, dimensions, fx + h, fy, fz) -
        sampleFieldTrilinear(values, dimensions, fx - h, fy, fz)) /
      (2 * h * spacingX);
    const gy =
      (sampleFieldTrilinear(values, dimensions, fx, fy + h, fz) -
        sampleFieldTrilinear(values, dimensions, fx, fy - h, fz)) /
      (2 * h * spacingY);
    const gz =
      (sampleFieldTrilinear(values, dimensions, fx, fy, fz + h) -
        sampleFieldTrilinear(values, dimensions, fx, fy, fz - h)) /
      (2 * h * spacingZ);
    let nxv = sign * gx;
    let nyv = sign * gy;
    let nzv = sign * gz;
    let len = Math.hypot(nxv, nyv, nzv);
    if (!Number.isFinite(len) || len < 1e-9) {
      nxv = 0;
      nyv = 0;
      nzv = 1;
      len = 1;
    }
    normals[i * 3] = round(nxv / len, 4);
    normals[i * 3 + 1] = round(nyv / len, 4);
    normals[i * 3 + 2] = round(nzv / len, 4);
  }
  return normals;
}

// R10 (feather-first): per-vertex uncertainty feather. Sample the precomputed
// per-voxel feather alpha field (coarse grid, 0..1; 1 over the well-supported
// bulk, ramping to 0 across the sparsest support rind) at each final vertex.
// Grid-independent; the field shares the world bounds and carries 0 (not NaN)
// outside support so the trilinear sample is always finite. Uncertainty is
// communicated by fading opacity — geometry is never removed.
function computeVertexFeatherAlpha({ vertices, alphaField, dimensions, bounds, round }) {
  const [nx, ny, nz] = dimensions;
  const spanX = Math.max(1e-9, bounds.maxX - bounds.minX);
  const spanY = Math.max(1e-9, bounds.maxY - bounds.minY);
  const spanZ = Math.max(1e-9, bounds.maxZ - bounds.minZ);
  const count = vertices.length / 3;
  const alpha = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const fx = ((vertices[i * 3] - bounds.minX) / spanX) * nx - 0.5;
    const fy = ((vertices[i * 3 + 1] - bounds.minY) / spanY) * ny - 0.5;
    const fz = ((vertices[i * 3 + 2] - bounds.minZ) / spanZ) * nz - 0.5;
    let a = sampleFieldTrilinear(alphaField, dimensions, fx, fy, fz);
    if (!Number.isFinite(a) || a < 0) a = 0;
    else if (a > 1) a = 1;
    alpha[i] = round(a, 3);
  }
  return alpha;
}

// R1: higher-order reconstruction. Tricubic (Catmull-Rom) upsample of the
// reconstructed scalar field onto an N-times-finer grid, evaluated only where
// the data supports it (mask). Marching cubes on this smooth finer field
// removes the grid-aligned silhouette terracing of linear MC on the coarse grid
// — it replaces mesh subdivision with a principled field upsample, and is the
// reusable medical-grade resampling primitive. Catmull-Rom is clamped to the
// source range so it cannot fabricate out-of-range values (no overshoot).
export function supersampleFieldTricubic({
  values,
  mask,
  dimensions,
  factor,
  valueMin,
  valueMax,
}) {
  const [nx, ny, nz] = dimensions;
  const slab = nx * ny;
  const nxh = nx * factor;
  const nyh = ny * factor;
  const nzh = nz * factor;
  const slabH = nxh * nyh;
  const valuesHi = new Float32Array(nxh * nyh * nzh);
  const maskHi = new Uint8Array(nxh * nyh * nzh);
  let sum = 0;
  let cnt = 0;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (Number.isFinite(v)) {
      sum += v;
      cnt += 1;
    }
  }
  const fallback = cnt > 0 ? sum / cnt : (valueMin + valueMax) / 2;
  const clampX = (k) => (k < 0 ? 0 : k >= nx ? nx - 1 : k);
  const clampY = (k) => (k < 0 ? 0 : k >= ny ? ny - 1 : k);
  const clampZ = (k) => (k < 0 ? 0 : k >= nz ? nz - 1 : k);
  const coarse = (x, y, z) => {
    const v = values[clampZ(z) * slab + clampY(y) * nx + clampX(x)];
    return Number.isFinite(v) ? v : fallback;
  };
  const maskAt = (x, y, z) =>
    mask[clampZ(z) * slab + clampY(y) * nx + clampX(x)] > 0 ? 1 : 0;
  for (let iz = 0; iz < nzh; iz += 1) {
    const pz = (iz + 0.5) / factor - 0.5;
    const kz = Math.floor(pz);
    const tz = pz - kz;
    const wz0 = ((-0.5 * tz + 1.0) * tz - 0.5) * tz;
    const wz1 = (1.5 * tz - 2.5) * tz * tz + 1.0;
    const wz2 = ((-1.5 * tz + 2.0) * tz + 0.5) * tz;
    const wz3 = (0.5 * tz - 0.5) * tz * tz;
    for (let iy = 0; iy < nyh; iy += 1) {
      const py = (iy + 0.5) / factor - 0.5;
      const ky = Math.floor(py);
      const ty = py - ky;
      const wy0 = ((-0.5 * ty + 1.0) * ty - 0.5) * ty;
      const wy1 = (1.5 * ty - 2.5) * ty * ty + 1.0;
      const wy2 = ((-1.5 * ty + 2.0) * ty + 0.5) * ty;
      const wy3 = (0.5 * ty - 0.5) * ty * ty;
      for (let ix = 0; ix < nxh; ix += 1) {
        const px = (ix + 0.5) / factor - 0.5;
        const kx = Math.floor(px);
        const tx = px - kx;
        const hiIdx = iz * slabH + iy * nxh + ix;
        // Trilinear mask support at p; below 0.5 means no real data nearby.
        const m000 = maskAt(kx, ky, kz);
        const m100 = maskAt(kx + 1, ky, kz);
        const m010 = maskAt(kx, ky + 1, kz);
        const m110 = maskAt(kx + 1, ky + 1, kz);
        const m001 = maskAt(kx, ky, kz + 1);
        const m101 = maskAt(kx + 1, ky, kz + 1);
        const m011 = maskAt(kx, ky + 1, kz + 1);
        const m111 = maskAt(kx + 1, ky + 1, kz + 1);
        const mval =
          m000 * (1 - tx) * (1 - ty) * (1 - tz) +
          m100 * tx * (1 - ty) * (1 - tz) +
          m010 * (1 - tx) * ty * (1 - tz) +
          m110 * tx * ty * (1 - tz) +
          m001 * (1 - tx) * (1 - ty) * tz +
          m101 * tx * (1 - ty) * tz +
          m011 * (1 - tx) * ty * tz +
          m111 * tx * ty * tz;
        if (mval < 0.5) {
          valuesHi[hiIdx] = Number.NaN;
          maskHi[hiIdx] = 0;
          continue;
        }
        const wx0 = ((-0.5 * tx + 1.0) * tx - 0.5) * tx;
        const wx1 = (1.5 * tx - 2.5) * tx * tx + 1.0;
        const wx2 = ((-1.5 * tx + 2.0) * tx + 0.5) * tx;
        const wx3 = (0.5 * tx - 0.5) * tx * tx;
        let acc = 0;
        for (let dz = -1; dz <= 2; dz += 1) {
          const wz = dz === -1 ? wz0 : dz === 0 ? wz1 : dz === 1 ? wz2 : wz3;
          const zz = kz + dz;
          for (let dy = -1; dy <= 2; dy += 1) {
            const wyz =
              (dy === -1 ? wy0 : dy === 0 ? wy1 : dy === 1 ? wy2 : wy3) * wz;
            const yy = ky + dy;
            acc +=
              (coarse(kx - 1, yy, zz) * wx0 +
                coarse(kx, yy, zz) * wx1 +
                coarse(kx + 1, yy, zz) * wx2 +
                coarse(kx + 2, yy, zz) * wx3) *
              wyz;
          }
        }
        if (acc < valueMin) acc = valueMin;
        else if (acc > valueMax) acc = valueMax;
        valuesHi[hiIdx] = acc;
        maskHi[hiIdx] = 255;
      }
    }
  }
  return { values: valuesHi, mask: maskHi, dimensions: [nxh, nyh, nzh] };
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
  featherAlphaField = null,
  featherDimensions = null,
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

  // R1: marching on the tricubic-supersampled field already yields fine, smooth
  // geometry, so mesh subdivision is no longer used; a light Taubin pass
  // removes any remaining stair on near-tangent regions.
  const welded = weldMeshVertices({ vertices, colors, scalarValues, indices });
  const smoothed = smoothMeshVertices({
    vertices: welded.vertices,
    indices: welded.indices,
    round,
    iterations: 6,
    pinBoundary: false,
  });
  const normals = computeFieldGradientNormals({
    vertices: smoothed.vertices,
    values,
    dimensions,
    bounds,
    comparison,
    round,
  });
  // R10: per-vertex feather alpha sampled from the coarse alpha field (null when
  // not supplied → fully opaque downstream).
  const alpha =
    featherAlphaField && featherDimensions
      ? computeVertexFeatherAlpha({
          vertices: smoothed.vertices,
          alphaField: featherAlphaField,
          dimensions: featherDimensions,
          bounds,
          round,
        })
      : null;

  return {
    vertices: smoothed.vertices,
    normals,
    alpha,
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
      normalSource: "field-gradient",
      reconstruction: "tricubic-supersample",
      featherSource: alpha ? "per-vertex-confidence-smoothstep" : "none",
    },
  };
}
