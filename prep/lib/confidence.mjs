// R10: confidence-masking + uncertainty feathering (modality-generic).
//
// A per-voxel confidence channel (0..1) gates surface extraction and feathers
// the surface opacity across the low-confidence falloff, so iso-surfaces are
// never rendered into unreliable/unconstrained voxels and the margins fade
// rather than fake a hard edge. This module is the generic core: a confidence
// provider for the MT data-support case plus binary 3D morphology and
// connected-component island removal used to clean the speckled fringe. The
// medical track (CT/MRI/OCT) reuses the same morphology + feather with a
// different provider (see docs/dev-context/Confidence-Masking-And-Uncertainty.md).
//
// Grid index order matches the volume products: x-fastest, then y, then z
// (idx = z*nx*ny + y*nx + x).

export function smoothstep(edge0, edge1, x) {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  let t = (x - edge0) / (edge1 - edge0);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}

function percentileOf(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = Float64Array.from(values).sort();
  const i = Math.max(
    0,
    Math.min(sorted.length - 1, Math.round((sorted.length - 1) * fraction)),
  );
  return sorted[i];
}

// MT confidence = normalized local data-support coverage. `blurredCounts` is the
// Gaussian-blurred binned sample density the reconstruction already computes;
// where support is dense the inversion is well constrained, where it thins out
// (sparse stations / model margins) confidence falls toward zero. Normalized
// over [minWeight, p90(support)] so a few very dense voxels do not crush the
// scale. Designed to be swapped for a true inversion sensitivity / resolution /
// DOI field when a source provides one.
export function mtDataSupportConfidence({
  blurredCounts,
  occupiedMask,
  minWeight,
  highPercentile = 0.9,
}) {
  const n = blurredCounts.length;
  const confidence = new Float32Array(n);
  const support = [];
  for (let i = 0; i < n; i += 1) {
    if (occupiedMask[i] !== 0 && blurredCounts[i] > minWeight) {
      support.push(blurredCounts[i]);
    }
  }
  const high = Math.max(minWeight + 1e-6, percentileOf(support, highPercentile));
  const span = Math.max(1e-9, high - minWeight);
  for (let i = 0; i < n; i += 1) {
    if (occupiedMask[i] === 0) {
      confidence[i] = 0;
      continue;
    }
    let c = (blurredCounts[i] - minWeight) / span;
    if (c < 0) c = 0;
    else if (c > 1) c = 1;
    confidence[i] = c;
  }
  return confidence;
}

// Feather-first confidence (DEC-181 rework): keep the full model and fade ONLY
// the sparsest `featherPercentile` of occupied voxels by data support. The bulk
// (>= the percentile support threshold) stays fully solid (alpha 1); the
// sparsest rind ramps 1 → 0 toward the reconstruction support floor. This does
// not clip extent — a smoothness-regularized inversion resolves its interior
// even where MT sampling is modest, so only the genuine outer rind is faded.
export function supportFeatherAlphaField({
  blurredCounts,
  occupiedMask,
  minWeight,
  featherPercentile = 0.05,
}) {
  const n = blurredCounts.length;
  const alpha = new Float32Array(n);
  const support = [];
  for (let i = 0; i < n; i += 1) {
    if (occupiedMask[i] !== 0 && blurredCounts[i] > minWeight) {
      support.push(blurredCounts[i]);
    }
  }
  const threshold = Math.max(minWeight + 1e-6, percentileOf(support, featherPercentile));
  let featheredVoxelCount = 0;
  for (let i = 0; i < n; i += 1) {
    if (occupiedMask[i] === 0) {
      alpha[i] = 0;
      continue;
    }
    const a = smoothstep(minWeight, threshold, blurredCounts[i]);
    alpha[i] = a;
    if (a < 1) featheredVoxelCount += 1;
  }
  return { alpha, supportThreshold: threshold, supportFloor: minWeight, featheredVoxelCount };
}

function neighborMorphPass(src, dimensions, dilate) {
  const [nx, ny, nz] = dimensions;
  const slab = nx * ny;
  const out = new Uint8Array(src.length);
  for (let z = 0; z < nz; z += 1) {
    for (let y = 0; y < ny; y += 1) {
      for (let x = 0; x < nx; x += 1) {
        const idx = z * slab + y * nx + x;
        const self = src[idx] > 0 ? 1 : 0;
        let result = self;
        // 6-neighborhood. Erode: keep only if self AND all in-bounds neighbors
        // are set (out-of-bounds treated as background → erodes at borders).
        // Dilate: set if self OR any in-bounds neighbor is set.
        if (dilate) {
          if (!self) {
            if (
              (x > 0 && src[idx - 1] > 0) ||
              (x < nx - 1 && src[idx + 1] > 0) ||
              (y > 0 && src[idx - nx] > 0) ||
              (y < ny - 1 && src[idx + nx] > 0) ||
              (z > 0 && src[idx - slab] > 0) ||
              (z < nz - 1 && src[idx + slab] > 0)
            ) {
              result = 1;
            }
          }
        } else if (self) {
          if (
            x === 0 ||
            x === nx - 1 ||
            y === 0 ||
            y === ny - 1 ||
            z === 0 ||
            z === nz - 1 ||
            src[idx - 1] === 0 ||
            src[idx + 1] === 0 ||
            src[idx - nx] === 0 ||
            src[idx + nx] === 0 ||
            src[idx - slab] === 0 ||
            src[idx + slab] === 0
          ) {
            result = 0;
          }
        }
        out[idx] = result;
      }
    }
  }
  return out;
}

export function erode3d(mask, dimensions, radius = 1) {
  let cur = mask;
  for (let i = 0; i < radius; i += 1) cur = neighborMorphPass(cur, dimensions, false);
  return cur;
}

export function dilate3d(mask, dimensions, radius = 1) {
  let cur = mask;
  for (let i = 0; i < radius; i += 1) cur = neighborMorphPass(cur, dimensions, true);
  return cur;
}

// OPEN = erode then dilate: removes speckle and thin spurs without growing the
// body. CLOSE = dilate then erode: fills small interior pinholes.
export function open3d(mask, dimensions, radius = 1) {
  return dilate3d(erode3d(mask, dimensions, radius), dimensions, radius);
}

export function close3d(mask, dimensions, radius = 1) {
  return erode3d(dilate3d(mask, dimensions, radius), dimensions, radius);
}

// Drop 6-connected components smaller than minVoxels (isolated speckle islands).
export function removeSmallComponents3d(mask, dimensions, minVoxels) {
  const [nx, ny, nz] = dimensions;
  const slab = nx * ny;
  const out = Uint8Array.from(mask);
  const labels = new Int32Array(mask.length).fill(0);
  const stack = new Int32Array(mask.length);
  let removedComponents = 0;
  let removedVoxels = 0;
  let label = 0;
  for (let start = 0; start < mask.length; start += 1) {
    if (out[start] === 0 || labels[start] !== 0) continue;
    label += 1;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = label;
    const members = [];
    while (sp > 0) {
      const idx = stack[--sp];
      members.push(idx);
      const x = idx % nx;
      const y = ((idx - x) / nx) % ny;
      const z = Math.floor(idx / slab);
      if (x > 0 && out[idx - 1] && labels[idx - 1] === 0) { labels[idx - 1] = label; stack[sp++] = idx - 1; }
      if (x < nx - 1 && out[idx + 1] && labels[idx + 1] === 0) { labels[idx + 1] = label; stack[sp++] = idx + 1; }
      if (y > 0 && out[idx - nx] && labels[idx - nx] === 0) { labels[idx - nx] = label; stack[sp++] = idx - nx; }
      if (y < ny - 1 && out[idx + nx] && labels[idx + nx] === 0) { labels[idx + nx] = label; stack[sp++] = idx + nx; }
      if (z > 0 && out[idx - slab] && labels[idx - slab] === 0) { labels[idx - slab] = label; stack[sp++] = idx - slab; }
      if (z < nz - 1 && out[idx + slab] && labels[idx + slab] === 0) { labels[idx + slab] = label; stack[sp++] = idx + slab; }
    }
    if (members.length < minVoxels) {
      removedComponents += 1;
      removedVoxels += members.length;
      for (const idx of members) out[idx] = 0;
    }
  }
  return { mask: out, removedComponents, removedVoxels };
}

// Build the cleaned surface support mask from the confidence field:
//   clip at clipLow → OPEN (despeckle) → island removal → optional CLOSE.
// Returns the cleaned binary mask plus cleanup stats for provenance.
export function buildCleanedSurfaceMask({
  confidence,
  dimensions,
  clipLow,
  openRadius = 1,
  closeRadius = 0,
  minIslandVoxels = 8,
}) {
  const hard = new Uint8Array(confidence.length);
  let hardCount = 0;
  for (let i = 0; i < confidence.length; i += 1) {
    if (confidence[i] >= clipLow) {
      hard[i] = 1;
      hardCount += 1;
    }
  }
  const opened = openRadius > 0 ? open3d(hard, dimensions, openRadius) : hard;
  const { mask: despeckled, removedComponents, removedVoxels } =
    removeSmallComponents3d(opened, dimensions, minIslandVoxels);
  const cleaned =
    closeRadius > 0 ? close3d(despeckled, dimensions, closeRadius) : despeckled;
  let cleanCount = 0;
  for (let i = 0; i < cleaned.length; i += 1) if (cleaned[i]) cleanCount += 1;
  return {
    mask: cleaned,
    stats: {
      clipLow,
      openRadius,
      closeRadius,
      minIslandVoxels,
      hardVoxelCount: hardCount,
      cleanedVoxelCount: cleanCount,
      removedComponents,
      removedVoxels,
    },
  };
}
