import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fromFile } from "geotiff";
import {
  ROOT,
  SHAHBAZI_CITATION,
  SHAHBAZI_DERIVED_DATE,
  SHAHBAZI_PROCESSED_DIR,
  SHAHBAZI_RAW_DIR,
  numberFromEnv,
} from "./shahbazi_config.mjs";

const execFileAsync = promisify(execFile);

const RAW_DIR = SHAHBAZI_RAW_DIR;
const PROCESSED_DIR = SHAHBAZI_PROCESSED_DIR;
const OUTPUT_DIR = path.join(PROCESSED_DIR, "photo_overlay_preview");

const REFINED_EOPS = path.join(RAW_DIR, "RefinedEOPs.txt");
const REFINED_IOPS = path.join(RAW_DIR, "RefinedIOPs.txt");
const RAW_IMAGES_DIR = path.join(RAW_DIR, "RawImages");
const TLS_PROVENANCE = path.join(PROCESSED_DIR, "tls_preview_points.provenance.json");
const OUTER_SURFACE = path.join(PROCESSED_DIR, "outer_surface_mesh_preview.json");
const TLS_SURFACE = path.join(PROCESSED_DIR, "tls_surface_mesh_preview.json");
const MANIFEST_OUTPUT = path.join(OUTPUT_DIR, "photo_overlay_manifest.json");
const PROVENANCE_OUTPUT = path.join(OUTPUT_DIR, "photo_overlay_manifest.provenance.json");

const CREATED_DATE = SHAHBAZI_DERIVED_DATE;
const PREVIEW_WIDTH_PX = numberFromEnv(
  "GEOSEE_SHAHBAZI_PHOTO_PREVIEW_WIDTH_PX",
  768,
);
const GRID_COLS = Math.round(
  numberFromEnv("GEOSEE_SHAHBAZI_PHOTO_GRID_COLS", 13),
);
const GRID_ROWS = Math.round(
  numberFromEnv("GEOSEE_SHAHBAZI_PHOTO_GRID_ROWS", 9),
);
const MAX_PHOTOS = Math.round(
  numberFromEnv("GEOSEE_SHAHBAZI_PHOTO_MAX_PHOTOS", 6),
);
const CANDIDATE_SAMPLE_COLS = Math.round(
  numberFromEnv("GEOSEE_SHAHBAZI_PHOTO_CANDIDATE_SAMPLE_COLS", 5),
);
const CANDIDATE_SAMPLE_ROWS = Math.round(
  numberFromEnv("GEOSEE_SHAHBAZI_PHOTO_CANDIDATE_SAMPLE_ROWS", 4),
);
const MIN_HIT_RATIO = numberFromEnv(
  "GEOSEE_SHAHBAZI_PHOTO_MIN_HIT_RATIO",
  0.72,
);
const MIN_IMAGE_ID_SPACING = numberFromEnv(
  "GEOSEE_SHAHBAZI_PHOTO_MIN_IMAGE_ID_SPACING",
  10,
);

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function parseIops(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const [rawKey, rawValue] = trimmed.split("=");
    const keys = rawKey.split(",").map((value) => value.trim());
    const values = rawValue.split(",").map((value) => Number(value.trim()));
    for (let i = 0; i < keys.length; i += 1) {
      result[keys[i]] = values[i];
    }
  }
  for (const key of ["s", "w", "h", "xp", "yp", "f"]) {
    if (!Number.isFinite(result[key])) {
      throw new Error(`RefinedIOPs.txt is missing numeric key ${key}.`);
    }
  }
  return result;
}

function parseEopLine(line, lineNumber) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 7) return null;
  const row = {
    imageId: Number(parts[0]),
    x: Number(parts[1]),
    y: Number(parts[2]),
    z: Number(parts[3]),
    omega: Number(parts[4]),
    phi: Number(parts[5]),
    kappa: Number(parts[6]),
  };
  if (Object.values(row).some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid RefinedEOPs row at line ${lineNumber}: ${line}`);
  }
  return row;
}

function parseEops(text) {
  return text
    .split(/\r?\n/)
    .map((line, index) => parseEopLine(line, index + 1))
    .filter(Boolean)
    .sort((a, b) => a.imageId - b.imageId);
}

function readSceneTransform(tlsProvenance) {
  const bounds = tlsProvenance.processing?.sourceBounds;
  const transform = tlsProvenance.processing?.sceneTransform;
  if (!bounds?.min || !bounds?.max || !transform) {
    throw new Error("TLS provenance is missing sourceBounds or sceneTransform.");
  }
  return {
    center: [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ],
    minZ: bounds.min[2],
    horizontalScale: transform.horizontalScale ?? 1,
    verticalScale: transform.verticalScale ?? 1,
    zLiftMeters: transform.zLiftMeters ?? 115,
  };
}

function sourceToScene(source, transform) {
  return [
    (source[0] - transform.center[0]) * transform.horizontalScale,
    (source[1] - transform.center[1]) * transform.horizontalScale,
    (source[2] - transform.minZ) * transform.verticalScale + transform.zLiftMeters,
  ];
}

function rotationX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

function rotationY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

function rotationZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

function multiplyMatrix(a, b) {
  return a.map((row) =>
    b[0].map((_, columnIndex) =>
      row.reduce((sum, value, rowIndex) => sum + value * b[rowIndex][columnIndex], 0),
    ),
  );
}

function applyMatrix(matrix, vector) {
  return matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index], 0),
  );
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  if (length <= 0) return [0, 0, -1];
  return vector.map((value) => value / length);
}

function rotationForEop(row) {
  return multiplyMatrix(
    multiplyMatrix(rotationZ(degToRad(row.kappa)), rotationY(degToRad(row.phi))),
    rotationX(degToRad(row.omega)),
  );
}

function rayForImageUv(row, iops, transform, u, v) {
  const halfWidthMm = (iops.w * iops.s) / 2;
  const halfHeightMm = (iops.h * iops.s) / 2;
  const left = -halfWidthMm - iops.xp;
  const right = halfWidthMm - iops.xp;
  const top = halfHeightMm - iops.yp;
  const bottom = -halfHeightMm - iops.yp;
  const cameraRay = [
    left + u * (right - left),
    top + v * (bottom - top),
    -iops.f,
  ];
  const worldRay = normalize(applyMatrix(rotationForEop(row), cameraRay));
  const origin = sourceToScene([row.x, row.y, row.z], transform);
  const direction = normalize([
    worldRay[0] * transform.horizontalScale,
    worldRay[1] * transform.horizontalScale,
    worldRay[2] * transform.verticalScale,
  ]);
  return { origin, direction };
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function intersectTriangle(origin, direction, a, b, c) {
  const edge1 = subtract(b, a);
  const edge2 = subtract(c, a);
  const h = cross(direction, edge2);
  const det = dot(edge1, h);
  if (Math.abs(det) < 1e-8) return null;
  const invDet = 1 / det;
  const s = subtract(origin, a);
  const u = invDet * dot(s, h);
  if (u < 0 || u > 1) return null;
  const q = cross(s, edge1);
  const v = invDet * dot(direction, q);
  if (v < 0 || u + v > 1) return null;
  const t = invDet * dot(edge2, q);
  if (t <= 0) return null;
  return t;
}

function meshTriangles(mesh, sourceName) {
  const triangles = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ai = mesh.indices[i] * 3;
    const bi = mesh.indices[i + 1] * 3;
    const ci = mesh.indices[i + 2] * 3;
    const a = [mesh.vertices[ai], mesh.vertices[ai + 1], mesh.vertices[ai + 2]];
    const b = [mesh.vertices[bi], mesh.vertices[bi + 1], mesh.vertices[bi + 2]];
    const c = [mesh.vertices[ci], mesh.vertices[ci + 1], mesh.vertices[ci + 2]];
    triangles.push({ a, b, c, sourceName });
  }
  return triangles;
}

function raycastSurface(origin, direction, triangles) {
  let best = null;
  for (const tri of triangles) {
    const t = intersectTriangle(origin, direction, tri.a, tri.b, tri.c);
    if (t === null) continue;
    if (best === null || t < best.t) {
      best = { t, sourceName: tri.sourceName };
    }
  }
  if (!best) return null;
  return {
    point: [
      origin[0] + direction[0] * best.t,
      origin[1] + direction[1] * best.t,
      origin[2] + direction[2] * best.t,
    ],
    sourceName: best.sourceName,
  };
}

function polygonArea2d(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) / 2;
}

function pointAt(vertices, index) {
  const offset = index * 3;
  return [vertices[offset], vertices[offset + 1], vertices[offset + 2]];
}

function pushCameraFacingTriangle(indices, vertices, cameraOrigin, a, b, c) {
  const pa = pointAt(vertices, a);
  const pb = pointAt(vertices, b);
  const pc = pointAt(vertices, c);
  const normal = cross(subtract(pb, pa), subtract(pc, pa));
  const centroid = [
    (pa[0] + pb[0] + pc[0]) / 3,
    (pa[1] + pb[1] + pc[1]) / 3,
    (pa[2] + pb[2] + pc[2]) / 3,
  ];
  const toCamera = subtract(cameraOrigin, centroid);
  if (dot(normal, toCamera) >= 0) {
    indices.push(a, b, c);
    return false;
  }
  indices.push(a, c, b);
  return true;
}

function buildProjectionGrid(row, iops, transform, triangles, gridCols, gridRows) {
  const vertices = [];
  const uvs = [];
  const hits = [];
  const surfaceHits = new Map();
  const cameraOrigin = sourceToScene([row.x, row.y, row.z], transform);

  for (let y = 0; y < gridRows; y += 1) {
    const v = gridRows === 1 ? 0 : y / (gridRows - 1);
    for (let x = 0; x < gridCols; x += 1) {
      const u = gridCols === 1 ? 0 : x / (gridCols - 1);
      const { origin, direction } = rayForImageUv(row, iops, transform, u, v);
      const hit = raycastSurface(origin, direction, triangles);
      hits.push(hit);
      if (hit) {
        vertices.push(...hit.point.map((value) => round(value, 3)));
        uvs.push(round(u, 5), round(1 - v, 5));
        surfaceHits.set(hit.sourceName, (surfaceHits.get(hit.sourceName) ?? 0) + 1);
      } else {
        vertices.push(0, 0, 0);
        uvs.push(round(u, 5), round(1 - v, 5));
      }
    }
  }

  const indices = [];
  let flippedTriangleCount = 0;
  for (let y = 0; y < gridRows - 1; y += 1) {
    for (let x = 0; x < gridCols - 1; x += 1) {
      const a = y * gridCols + x;
      const b = a + 1;
      const c = a + gridCols;
      const d = c + 1;
      if (!hits[a] || !hits[b] || !hits[c] || !hits[d]) continue;
      if (pushCameraFacingTriangle(indices, vertices, cameraOrigin, a, b, c)) {
        flippedTriangleCount += 1;
      }
      if (pushCameraFacingTriangle(indices, vertices, cameraOrigin, b, d, c)) {
        flippedTriangleCount += 1;
      }
    }
  }

  const cornerHits = [
    hits[0],
    hits[gridCols - 1],
    hits[gridRows * gridCols - 1],
    hits[(gridRows - 1) * gridCols],
  ].filter(Boolean);
  const footprintAreaM2 =
    cornerHits.length === 4
      ? polygonArea2d(cornerHits.map((hit) => hit.point))
      : 0;

  return {
    vertices,
    uvs,
    indices,
    hitCount: hits.filter(Boolean).length,
    sampleCount: hits.length,
    hitRatio: hits.filter(Boolean).length / hits.length,
    footprintAreaM2,
    surfaceHits: Object.fromEntries(surfaceHits),
    frontFacePolicy: "uav-camera-facing",
    flippedTriangleCount,
  };
}

function candidateScore(row, iops, transform, triangles) {
  const grid = buildProjectionGrid(
    row,
    iops,
    transform,
    triangles,
    CANDIDATE_SAMPLE_COLS,
    CANDIDATE_SAMPLE_ROWS,
  );
  return {
    imageId: row.imageId,
    hitRatio: grid.hitRatio,
    hitCount: grid.hitCount,
    footprintAreaM2: grid.footprintAreaM2,
    score: grid.hitRatio * Math.sqrt(Math.max(1, grid.footprintAreaM2)),
  };
}

function chooseRows(eops, scores) {
  const scoreById = new Map(scores.map((score) => [score.imageId, score]));
  const candidates = eops
    .map((row) => ({ row, score: scoreById.get(row.imageId) }))
    .filter(
      (entry) =>
        entry.score &&
        entry.score.hitRatio >= MIN_HIT_RATIO &&
        entry.score.footprintAreaM2 > 12,
    )
    .sort((a, b) => b.score.score - a.score.score);

  const selected = [];
  for (const candidate of candidates) {
    if (
      selected.some(
        (entry) =>
          Math.abs(entry.row.imageId - candidate.row.imageId) <
          MIN_IMAGE_ID_SPACING,
      )
    ) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= MAX_PHOTOS) break;
  }

  return selected.sort((a, b) => a.row.imageId - b.row.imageId);
}

function writeBmp24(width, height, rgb) {
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowStride * height;
  const fileSize = 54 + pixelBytes;
  const buffer = Buffer.alloc(fileSize);
  buffer.write("BM", 0, "ascii");
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelBytes, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);

  for (let y = 0; y < height; y += 1) {
    const srcY = height - 1 - y;
    const dstRow = 54 + y * rowStride;
    for (let x = 0; x < width; x += 1) {
      const src = (srcY * width + x) * 3;
      const dst = dstRow + x * 3;
      buffer[dst] = rgb[src + 2];
      buffer[dst + 1] = rgb[src + 1];
      buffer[dst + 2] = rgb[src];
    }
  }
  return buffer;
}

function clampByte(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

async function writeImagePreview(imageId, iops) {
  const imageName = `${String(imageId).padStart(3, "0")}.tiff`;
  const sourcePath = path.join(RAW_IMAGES_DIR, imageName);
  const tiff = await fromFile(sourcePath);
  const image = await tiff.getImage();
  const sourceWidth = image.getWidth();
  const sourceHeight = image.getHeight();
  const previewHeight = Math.round((PREVIEW_WIDTH_PX * sourceHeight) / sourceWidth);
  const raster = await image.readRasters({
    width: PREVIEW_WIDTH_PX,
    height: previewHeight,
    interleave: true,
    resampleMethod: "bilinear",
  });
  const samplesPerPixel = Math.max(1, raster.length / (PREVIEW_WIDTH_PX * previewHeight));
  const rgb = Buffer.alloc(PREVIEW_WIDTH_PX * previewHeight * 3);
  for (let i = 0, o = 0; i < raster.length; i += samplesPerPixel, o += 3) {
    rgb[o] = clampByte(raster[i]);
    rgb[o + 1] = clampByte(raster[i + 1] ?? raster[i]);
    rgb[o + 2] = clampByte(raster[i + 2] ?? raster[i]);
  }

  const outputStem = String(imageId).padStart(3, "0");
  const bmpName = `${outputStem}.bmp`;
  const pngName = `${outputStem}.png`;
  const bmpPath = path.join(OUTPUT_DIR, bmpName);
  const pngPath = path.join(OUTPUT_DIR, pngName);
  await writeFile(bmpPath, writeBmp24(PREVIEW_WIDTH_PX, previewHeight, rgb));
  let textureName = bmpName;
  try {
    await execFileAsync("magick", [bmpPath, pngPath]);
    textureName = pngName;
  } catch (error) {
    console.warn(
      `ImageMagick PNG conversion failed for ${bmpName}; falling back to BMP texture.`,
      error,
    );
  }
  return {
    sourceImage: imageName,
    texture: textureName,
    sourceSizePx: [sourceWidth, sourceHeight],
    previewSizePx: [PREVIEW_WIDTH_PX, previewHeight],
    cameraModelSizePx: [iops.w, iops.h],
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const [eopsText, iopsText, tlsProvenanceText, outerText, tlsText] =
    await Promise.all([
      readFile(REFINED_EOPS, "utf8"),
      readFile(REFINED_IOPS, "utf8"),
      readFile(TLS_PROVENANCE, "utf8"),
      readFile(OUTER_SURFACE, "utf8"),
      readFile(TLS_SURFACE, "utf8"),
    ]);

  const eops = parseEops(eopsText);
  const iops = parseIops(iopsText);
  const transform = readSceneTransform(JSON.parse(tlsProvenanceText));
  const outerMesh = JSON.parse(outerText);
  const tlsMesh = JSON.parse(tlsText);
  const triangles = [
    ...meshTriangles(outerMesh, "outer_surface_mesh_preview"),
    ...meshTriangles(tlsMesh, "tls_surface_mesh_preview"),
  ];

  const scores = eops.map((row) => candidateScore(row, iops, transform, triangles));
  const selected = chooseRows(eops, scores);
  if (selected.length === 0) {
    throw new Error("No Shahbazi photos produced enough surface hits for overlay preview.");
  }

  const photos = [];
  for (const { row, score } of selected) {
    const imagePreview = await writeImagePreview(row.imageId, iops);
    const projection = buildProjectionGrid(row, iops, transform, triangles, GRID_COLS, GRID_ROWS);
    photos.push({
      id: `shahbazi-photo-${String(row.imageId).padStart(3, "0")}`,
      imageId: row.imageId,
      label: `Shahbazi projected image ${String(row.imageId).padStart(3, "0")}`,
      ...imagePreview,
      camera: {
        sourcePosition: [row.x, row.y, row.z].map((value) => round(value, 3)),
        scenePosition: sourceToScene([row.x, row.y, row.z], transform).map((value) =>
          round(value, 3),
        ),
        omega: row.omega,
        phi: row.phi,
        kappa: row.kappa,
      },
      projection: {
        gridCols: GRID_COLS,
        gridRows: GRID_ROWS,
        vertices: projection.vertices,
        uvs: projection.uvs,
        indices: projection.indices,
        hitCount: projection.hitCount,
        sampleCount: projection.sampleCount,
        hitRatio: round(projection.hitRatio, 4),
        footprintAreaM2: round(projection.footprintAreaM2, 2),
        surfaceHits: projection.surfaceHits,
        frontFacePolicy: projection.frontFacePolicy,
        flippedTriangleCount: projection.flippedTriangleCount,
      },
      candidateScore: {
        hitRatio: round(score.hitRatio, 4),
        hitCount: score.hitCount,
        footprintAreaM2: round(score.footprintAreaM2, 2),
        score: round(score.score, 4),
      },
    });
  }

  const manifest = {
    schema: "geosee.photo-overlay-preview.v1",
    label: "Shahbazi projected image preview",
    createdDate: CREATED_DATE,
    source: {
      rawImageFolder:
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/RawImages",
      eops: "projects/case-study-b/data/raw/shahbazi_gravel_pit/RefinedEOPs.txt",
      iops: "projects/case-study-b/data/raw/shahbazi_gravel_pit/RefinedIOPs.txt",
      surfaces: [
        "projects/case-study-b/data/processed/shahbazi_gravel_pit/outer_surface_mesh_preview.json",
        "projects/case-study-b/data/processed/shahbazi_gravel_pit/tls_surface_mesh_preview.json",
      ],
      citation: SHAHBAZI_CITATION,
    },
    cameraModel: {
      pixelSizeMm: iops.s,
      imageWidthPx: iops.w,
      imageHeightPx: iops.h,
      principalPointOffsetMm: [iops.xp, iops.yp],
      focalLengthMm: iops.f,
    },
    processing: {
      method:
        "Selected high-overlap UAV images, downsampled them to browser-safe PNG previews, and ray-projected an image grid against the current separate Shahbazi outer and TLS surface preview meshes.",
      selectedImageIds: photos.map((photo) => photo.imageId),
      previewWidthPx: PREVIEW_WIDTH_PX,
      projectionGrid: [GRID_COLS, GRID_ROWS],
      orientationConvention:
        "Preview uses Rz(kappa) * Ry(phi) * Rx(omega), negative camera Z as forward. This matches the current camera-frustum preview convention and remains an approximate display pass.",
      candidatePolicy: {
        maxPhotos: MAX_PHOTOS,
        minHitRatio: MIN_HIT_RATIO,
        minImageIdSpacing: MIN_IMAGE_ID_SPACING,
      },
      renderPolicy:
        "Texture meshes are projected onto existing preview surface geometry. This is a visual overlay preview, not an orthomosaic or final photogrammetric texture.",
      triangleWinding:
        "camera-facing; the UAV/camera side is the front face for projected image meshes",
    },
    photos,
  };

  const provenance = {
    schema: "geosee.provenance.v1",
    artifact: "photo_overlay_manifest.json",
    artifactType: "projected-uav-image-overlay-preview",
    projectSlug: "case-study-b",
    createdDate: CREATED_DATE,
    source: manifest.source,
    processing: manifest.processing,
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "This is a first-pass browser preview using selected downsampled UAV images and the current preview surfaces. It is not an orthomosaic and should be checked visually against camera/frustum alignment before use in a formal demo.",
    },
  };

  await Promise.all([
    writeFile(MANIFEST_OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(PROVENANCE_OUTPUT, `${JSON.stringify(provenance, null, 2)}\n`, "utf8"),
  ]);

  console.log(
    `Wrote ${photos.length} projected image overlays (${photos
      .map((photo) => String(photo.imageId).padStart(3, "0"))
      .join(", ")}) to ${path.relative(ROOT, OUTPUT_DIR)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
