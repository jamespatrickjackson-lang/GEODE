import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

import {
  DERIVED_DATE,
  UTAH_FORGE_PHASE3_MT_CLIENT_ROOT,
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
} from "./utah_forge_config.mjs";

const DEFAULT_INPUT_ZIP = path.join(
  UTAH_FORGE_PHASE3_MT_CLIENT_ROOT,
  "mt_model_cell_center_updated",
  "FORGE_MT_mdl17_cellcenter.zip",
);
const DEFAULT_ZIP_ENTRY = "FRG200614_mdl17_cellcenter.dat";
const DEFAULT_TRANSFORM_PATH = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "intake",
  "crs_transform.json",
);
const DEFAULT_STATS_PATH = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "resistivity_model",
  "model_stats.json",
);
const DEFAULT_STATION_PATH = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "stations",
  "mt_stations.geojson",
);
const DEFAULT_OUTPUT_DIR = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "resistivity_model",
  "slices",
);

const HORIZONTAL_SLICES = [
  { id: "horizontal_elev_1500m", label: "Horizontal MT slice +1500 m elevation", z: 1500, halfWindowM: 180 },
  { id: "horizontal_elev_0m", label: "Horizontal MT slice 0 m elevation", z: 0, halfWindowM: 450 },
  { id: "horizontal_elev_minus2500m", label: "Horizontal MT slice -2500 m elevation", z: -2500, halfWindowM: 850 },
  { id: "horizontal_elev_minus5000m", label: "Horizontal MT slice -5000 m elevation", z: -5000, halfWindowM: 1300 },
  { id: "horizontal_elev_minus10000m", label: "Horizontal MT slice -10000 m elevation", z: -10000, halfWindowM: 2600 },
  { id: "horizontal_elev_minus25000m", label: "Horizontal MT slice -25000 m elevation", z: -25000, halfWindowM: 6500 },
];

const HORIZONTAL_GRID = {
  columns: 126,
  rows: 104,
};

const VERTICAL_SECTION_GRID = {
  horizontalBins: 150,
  verticalBins: 136,
  halfWidthM: 4500,
};

function parseArgs(argv) {
  const options = {
    inputZip: DEFAULT_INPUT_ZIP,
    zipEntry: DEFAULT_ZIP_ENTRY,
    transformPath: DEFAULT_TRANSFORM_PATH,
    statsPath: DEFAULT_STATS_PATH,
    stationPath: DEFAULT_STATION_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--input" && value) {
      options.inputZip = path.resolve(value);
      index += 1;
    } else if (arg === "--entry" && value) {
      options.zipEntry = value;
      index += 1;
    } else if (arg === "--transform" && value) {
      options.transformPath = path.resolve(value);
      index += 1;
    } else if (arg === "--stats" && value) {
      options.statsPath = path.resolve(value);
      index += 1;
    } else if (arg === "--stations" && value) {
      options.stationPath = path.resolve(value);
      index += 1;
    } else if (arg === "--output" && value) {
      options.outputDir = path.resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return options;
}

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function readOrigin(transform) {
  const origin = transform?.scene_transform?.scene_origin_utm;
  if (
    !origin ||
    !Number.isFinite(origin.easting_m) ||
    !Number.isFinite(origin.northing_m) ||
    !Number.isFinite(origin.elevation_m)
  ) {
    throw new Error("crs_transform.json is missing scene_transform.scene_origin_utm.");
  }
  return origin;
}

function readSceneBounds(stats) {
  const x = stats?.sceneBounds?.x_m;
  const y = stats?.sceneBounds?.y_m;
  const z = stats?.sceneBounds?.z_m;
  if (
    !Array.isArray(x) ||
    !Array.isArray(y) ||
    !Array.isArray(z) ||
    x.length !== 2 ||
    y.length !== 2 ||
    z.length !== 2
  ) {
    throw new Error("model_stats.json is missing sceneBounds.");
  }
  return {
    minX: x[0],
    maxX: x[1],
    minY: y[0],
    maxY: y[1],
    minZ: z[0],
    maxZ: z[1],
  };
}

function makeBounds() {
  return {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
}

function includeBounds(bounds, x, y, z) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxY = Math.max(bounds.maxY, y);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxZ = Math.max(bounds.maxZ, z);
}

function bucketIndex(value, min, max, count) {
  if (value < min || value > max) return -1;
  const t = (value - min) / Math.max(1e-9, max - min);
  return Math.max(0, Math.min(count - 1, Math.floor(t * count)));
}

function makeGrid(width, height) {
  return {
    width,
    height,
    sums: new Float64Array(width * height),
    counts: new Uint32Array(width * height),
  };
}

function addGridValue(grid, xIndex, yIndex, value) {
  if (xIndex < 0 || yIndex < 0 || xIndex >= grid.width || yIndex >= grid.height) return;
  const index = yIndex * grid.width + xIndex;
  grid.sums[index] += value;
  grid.counts[index] += 1;
}

function averagedValues(grid) {
  const values = new Float64Array(grid.width * grid.height);
  values.fill(Number.NaN);
  for (let index = 0; index < values.length; index += 1) {
    if (grid.counts[index] > 0) {
      values[index] = grid.sums[index] / grid.counts[index];
    }
  }
  return values;
}

function fillSmallGridVoids(values, width, height, passes = 2) {
  let current = values;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float64Array(current);
    let filled = 0;
    for (let row = 1; row < height - 1; row += 1) {
      for (let col = 1; col < width - 1; col += 1) {
        const index = row * width + col;
        if (Number.isFinite(current[index])) continue;
        const neighbors = [
          current[index - 1],
          current[index + 1],
          current[index - width],
          current[index + width],
          current[index - width - 1],
          current[index - width + 1],
          current[index + width - 1],
          current[index + width + 1],
        ].filter(Number.isFinite);
        if (neighbors.length < 5) continue;
        next[index] = neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length;
        filled += 1;
      }
    }
    current = next;
    if (filled === 0) break;
  }
  return current;
}

function safeHexToRgb(hex) {
  const raw = hex.replace("#", "");
  const value = Number.parseInt(raw.length === 3
    ? raw.split("").map((char) => `${char}${char}`).join("")
    : raw, 16);
  if (!Number.isFinite(value)) return [1, 1, 1];
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function colorAt(value, stops) {
  if (value <= stops[0].value) return safeHexToRgb(stops[0].color);
  const last = stops[stops.length - 1];
  if (value >= last.value) return safeHexToRgb(last.color);
  for (let index = 1; index < stops.length; index += 1) {
    const high = stops[index];
    const low = stops[index - 1];
    if (value > high.value) continue;
    const t = Math.max(0, Math.min(1, (value - low.value) / Math.max(1e-9, high.value - low.value)));
    const a = safeHexToRgb(low.color);
    const b = safeHexToRgb(high.color);
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  }
  return safeHexToRgb(last.color);
}

function addGridMeshPart(mesh, part, values, stops) {
  const vertexIndexByGrid = new Int32Array(part.width * part.height);
  vertexIndexByGrid.fill(-1);
  const baseVertex = mesh.vertices.length / 3;
  let emittedVertices = 0;

  for (let row = 0; row < part.height; row += 1) {
    for (let col = 0; col < part.width; col += 1) {
      const gridIndex = row * part.width + col;
      const scalar = values[gridIndex];
      if (!Number.isFinite(scalar)) continue;
      const [x, y, z] = part.positionFor(col, row);
      mesh.vertices.push(round(x, 2), round(y, 2), round(z, 2));
      mesh.colors.push(...colorAt(scalar, stops).map((channel) => round(channel, 5)));
      mesh.scalarValues.push(round(scalar, 6));
      vertexIndexByGrid[gridIndex] = baseVertex + emittedVertices;
      emittedVertices += 1;
      includeBounds(mesh.bounds, x, y, z);
    }
  }

  const startIndexCount = mesh.indices.length;
  let triangles = 0;
  for (let row = 0; row < part.height - 1; row += 1) {
    for (let col = 0; col < part.width - 1; col += 1) {
      const a = vertexIndexByGrid[row * part.width + col];
      const b = vertexIndexByGrid[row * part.width + col + 1];
      const c = vertexIndexByGrid[(row + 1) * part.width + col];
      const d = vertexIndexByGrid[(row + 1) * part.width + col + 1];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      mesh.indices.push(a, b, c, b, d, c);
      triangles += 2;
    }
  }

  return {
    id: part.id,
    label: part.label,
    kind: part.kind,
    targetElevationM: part.targetElevationM,
    sectionLine: part.sectionLine,
    sourceWindow: part.sourceWindow,
    grid: {
      columns: part.width,
      rows: part.height,
      validCells: emittedVertices,
      triangles,
    },
    meshRange: {
      vertexStart: baseVertex,
      vertexCount: emittedVertices,
      indexStart: startIndexCount,
      indexCount: triangles * 3,
    },
  };
}

function stationCentroid(featureCollection) {
  const features = Array.isArray(featureCollection?.features)
    ? featureCollection.features
    : [];
  let xSum = 0;
  let ySum = 0;
  let count = 0;
  for (const feature of features) {
    const coordinates = feature?.geometry?.coordinates;
    if (
      Array.isArray(coordinates) &&
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1])
    ) {
      xSum += coordinates[0];
      ySum += coordinates[1];
      count += 1;
    }
  }
  return count > 0
    ? { x: xSum / count, y: ySum / count, count }
    : { x: 0, y: 0, count: 0 };
}

async function streamModelRows(inputZip, zipEntry, onRow) {
  const child = spawn("tar", ["-xOf", inputZip, zipEntry], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const rl = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;
    const northing = Number.parseFloat(parts[0]);
    const easting = Number.parseFloat(parts[1]);
    const elevation = Number.parseFloat(parts[2]);
    const resistivity = Number.parseFloat(parts[3]);
    if (
      !Number.isFinite(northing) ||
      !Number.isFinite(easting) ||
      !Number.isFinite(elevation) ||
      !Number.isFinite(resistivity)
    ) {
      continue;
    }
    onRow({ northing, easting, elevation, resistivity });
  }

  const exitCode = await new Promise((resolve) => {
    child.on("close", resolve);
  });
  if (exitCode !== 0) {
    throw new Error(`tar failed while reading ${zipEntry}: ${stderr}`);
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const transform = JSON.parse(await readFile(options.transformPath, "utf8"));
  const stats = JSON.parse(await readFile(options.statsPath, "utf8"));
  const stations = JSON.parse(await readFile(options.stationPath, "utf8"));
  const origin = readOrigin(transform);
  const sceneBounds = readSceneBounds(stats);
  const centroid = stationCentroid(stations);

  const displayMin = stats.log10Resistivity?.displayMin ?? 0;
  const displayMax = stats.log10Resistivity?.displayMax ?? 4;
  const displayMid = stats.log10Resistivity?.p50 ?? (displayMin + displayMax) * 0.5;
  const stops = [
    { value: round(displayMin, 6), color: "#2cc9ff", label: "low log resistivity" },
    { value: round(displayMid, 6), color: "#f8dd6d", label: "mid log resistivity" },
    { value: round(displayMax, 6), color: "#ff637a", label: "high log resistivity" },
  ];

  const horizontalParts = HORIZONTAL_SLICES.map((slice) => ({
    ...slice,
    kind: "horizontal-elevation-slice",
    width: HORIZONTAL_GRID.columns,
    height: HORIZONTAL_GRID.rows,
    grid: makeGrid(HORIZONTAL_GRID.columns, HORIZONTAL_GRID.rows),
  }));
  const verticalParts = [
    {
      id: "vertical_ew_station_centroid",
      label: "East-west MT resistivity section through station centroid",
      kind: "vertical-section",
      sectionLine: {
        orientation: "east-west",
        fixedY: round(centroid.y, 3),
        xMin: round(sceneBounds.minX, 3),
        xMax: round(sceneBounds.maxX, 3),
      },
      sourceWindow: {
        halfWidthM: VERTICAL_SECTION_GRID.halfWidthM,
        note: "Rows within this northing window are averaged into the authored section plane.",
      },
      width: VERTICAL_SECTION_GRID.horizontalBins,
      height: VERTICAL_SECTION_GRID.verticalBins,
      grid: makeGrid(VERTICAL_SECTION_GRID.horizontalBins, VERTICAL_SECTION_GRID.verticalBins),
    },
    {
      id: "vertical_ns_station_centroid",
      label: "North-south MT resistivity section through station centroid",
      kind: "vertical-section",
      sectionLine: {
        orientation: "north-south",
        fixedX: round(centroid.x, 3),
        yMin: round(sceneBounds.minY, 3),
        yMax: round(sceneBounds.maxY, 3),
      },
      sourceWindow: {
        halfWidthM: VERTICAL_SECTION_GRID.halfWidthM,
        note: "Rows within this easting window are averaged into the authored section plane.",
      },
      width: VERTICAL_SECTION_GRID.horizontalBins,
      height: VERTICAL_SECTION_GRID.verticalBins,
      grid: makeGrid(VERTICAL_SECTION_GRID.horizontalBins, VERTICAL_SECTION_GRID.verticalBins),
    },
  ];

  let rowCount = 0;
  let positiveRows = 0;
  let maskedRows = 0;

  await streamModelRows(options.inputZip, options.zipEntry, (row) => {
    rowCount += 1;
    if (row.resistivity <= 0) {
      maskedRows += 1;
      return;
    }
    positiveRows += 1;

    const x = row.easting - origin.easting_m;
    const y = row.northing - origin.northing_m;
    const z = row.elevation - origin.elevation_m;
    const logRho = Math.log10(row.resistivity);

    for (const part of horizontalParts) {
      if (Math.abs(z - part.z) > part.halfWindowM) continue;
      addGridValue(
        part.grid,
        bucketIndex(x, sceneBounds.minX, sceneBounds.maxX, part.width),
        bucketIndex(y, sceneBounds.minY, sceneBounds.maxY, part.height),
        logRho,
      );
    }

    const ew = verticalParts[0];
    if (Math.abs(y - centroid.y) <= VERTICAL_SECTION_GRID.halfWidthM) {
      addGridValue(
        ew.grid,
        bucketIndex(x, sceneBounds.minX, sceneBounds.maxX, ew.width),
        bucketIndex(z, sceneBounds.minZ, sceneBounds.maxZ, ew.height),
        logRho,
      );
    }

    const ns = verticalParts[1];
    if (Math.abs(x - centroid.x) <= VERTICAL_SECTION_GRID.halfWidthM) {
      addGridValue(
        ns.grid,
        bucketIndex(y, sceneBounds.minY, sceneBounds.maxY, ns.width),
        bucketIndex(z, sceneBounds.minZ, sceneBounds.maxZ, ns.height),
        logRho,
      );
    }
  });

  const mesh = {
    vertices: [],
    colors: [],
    scalarValues: [],
    indices: [],
    bounds: makeBounds(),
  };
  const sliceSummaries = [];

  const xStep = (sceneBounds.maxX - sceneBounds.minX) / HORIZONTAL_GRID.columns;
  const yStep = (sceneBounds.maxY - sceneBounds.minY) / HORIZONTAL_GRID.rows;
  for (const part of horizontalParts) {
    const values = fillSmallGridVoids(
      averagedValues(part.grid),
      part.width,
      part.height,
      2,
    );
    sliceSummaries.push(
      addGridMeshPart(
        mesh,
        {
          ...part,
          targetElevationM: part.z,
          sourceWindow: {
            halfWindowM: part.halfWindowM,
            note: "Rows inside this elevation window are averaged into the authored horizontal slice.",
          },
          positionFor: (col, row) => [
            sceneBounds.minX + (col + 0.5) * xStep,
            sceneBounds.minY + (row + 0.5) * yStep,
            part.z,
          ],
        },
        values,
        stops,
      ),
    );
  }

  const zStep = (sceneBounds.maxZ - sceneBounds.minZ) / VERTICAL_SECTION_GRID.verticalBins;
  const ewXStep = (sceneBounds.maxX - sceneBounds.minX) / VERTICAL_SECTION_GRID.horizontalBins;
  const nsYStep = (sceneBounds.maxY - sceneBounds.minY) / VERTICAL_SECTION_GRID.horizontalBins;
  for (const part of verticalParts) {
    const values = fillSmallGridVoids(
      averagedValues(part.grid),
      part.width,
      part.height,
      2,
    );
    const horizontalStep =
      part.sectionLine.orientation === "east-west" ? ewXStep : nsYStep;
    sliceSummaries.push(
      addGridMeshPart(
        mesh,
        {
          ...part,
          positionFor: (col, row) => {
            const horizontal = (part.sectionLine.orientation === "east-west"
              ? sceneBounds.minX
              : sceneBounds.minY) + (col + 0.5) * horizontalStep;
            const z = sceneBounds.minZ + (row + 0.5) * zStep;
            return part.sectionLine.orientation === "east-west"
              ? [horizontal, centroid.y, z]
              : [centroid.x, horizontal, z];
          },
        },
        values,
        stops,
      ),
    );
  }

  const relativeInput = path.relative(process.cwd(), options.inputZip).replaceAll("\\", "/");
  const meshPath = path.join(options.outputDir, "resistivity_slices_mesh_preview.json");
  const manifestPath = path.join(options.outputDir, "manifest.json");
  const legendPath = path.join(options.outputDir, "legend.json");
  const provenancePath = path.join(options.outputDir, "resistivity_slices.provenance.json");

  const meshPayload = {
    schema: "geosee.scalar-grid-mesh-preview.v1",
    label: "Utah FORGE Phase 3 MT resistivity slices",
    vertices: mesh.vertices,
    colors: mesh.colors,
    indices: mesh.indices,
    attributes: {
      scalarValues: mesh.scalarValues,
      scalar: {
        name: "log10 resistivity",
        unit: "log10(ohm-m)",
        min: round(stats.log10Resistivity?.min ?? displayMin, 6),
        max: round(stats.log10Resistivity?.max ?? displayMax, 6),
        displayMin: round(displayMin, 6),
        displayMax: round(displayMax, 6),
        colorStops: stops,
      },
    },
    material: {
      side: "double",
      note: "Slice planes are double-sided so authored sections are visible from both camera sides.",
    },
    source: {
      dataset: "Utah FORGE Phase 3 MT updated cell-center inversion model",
      sourceArchive: relativeInput,
      sourceEntry: options.zipEntry,
      classification: "source-derived inversion model",
      value: "log10 resistivity",
      unit: "log10(ohm-m)",
    },
    sceneBounds: {
      min: [round(mesh.bounds.minX, 2), round(mesh.bounds.minY, 2), round(mesh.bounds.minZ, 2)],
      max: [round(mesh.bounds.maxX, 2), round(mesh.bounds.maxY, 2), round(mesh.bounds.maxZ, 2)],
    },
    scenePlacement: {
      crs: "scene-local meters",
      sourceCrs: "EPSG:26912 NAD83 / UTM Zone 12N",
      axisConvention: "X east, Y north, Z up",
      sceneOriginUtm: origin,
      cropApplied: false,
      verticalExaggeration: 1,
    },
    processing: {
      script: "prep/build_utah_forge_mt_resistivity_slices.mjs",
      generatedDate: DERIVED_DATE,
      surfaceKind: "authored-resistivity-slice-preview",
      valueTransform: "log10(resistivity_ohm_m)",
      gridding: "source cell-center bin averaging with limited neighbor fill for small display voids",
      rowCount,
      positiveRows,
      maskedRows,
      slices: sliceSummaries,
    },
  };

  const manifest = {
    project: "utah-forge",
    area: "utah_forge_phase_3",
    dataset: "electrical_resistivity",
    artifact: "manifest.json",
    generatedDate: DERIVED_DATE,
    classification: "source-derived inversion model",
    source: {
      archive: relativeInput,
      entry: options.zipEntry,
      sourceRows: rowCount,
      positiveRows,
      maskedRows,
    },
    transform: {
      sourceCrs: "EPSG:26912 NAD83 / UTM Zone 12N",
      sceneOriginUtm: origin,
      localAxes: "X east, Y north, Z up",
      cropApplied: false,
      verticalExaggeration: 1,
    },
    outputs: {
      meshPreview: path.relative(process.cwd(), meshPath).replaceAll("\\", "/"),
      legend: path.relative(process.cwd(), legendPath).replaceAll("\\", "/"),
      provenance: path.relative(process.cwd(), provenancePath).replaceAll("\\", "/"),
    },
    slices: sliceSummaries,
    notes: [
      "These slices are authored presentation sections generated from the full source model bounds.",
      "No source model crop is applied.",
      "Vertical scale remains true 1:1 meters.",
      "Horizontal slices average source model rows inside a documented elevation window.",
      "Vertical sections average source model rows inside a documented lateral window through the MT station centroid.",
      "This is a display preview for GeoSee; the full model source is archived under C:/GeoSee/GeoSee_Archive.",
    ],
  };

  const legend = {
    title: "Utah FORGE Phase 3 MT resistivity",
    value: "log10 resistivity",
    unit: "log10(ohm-m)",
    sourceUnit: "ohm-m",
    generatedDate: DERIVED_DATE,
    displayRange: {
      min: round(displayMin, 6),
      mid: round(displayMid, 6),
      max: round(displayMax, 6),
      method: "2nd to 98th percentile range from model_stats.json, midpoint at median",
    },
    colorStops: stops,
    provenance: "source-derived inversion model from the updated Phase 3 MT cell-center model",
  };

  const provenance = {
    artifact: "resistivity_slices_mesh_preview.json",
    classification: "source-derived inversion model",
    source: {
      project: "Utah FORGE",
      dataset: "GDR submission 1255 updated MT model cell-center package",
      sourceArchive: relativeInput,
      sourceEntry: options.zipEntry,
      sourceArchiveNote:
        "Delivered source/client file is archived under C:/GeoSee/GeoSee_Archive; repo-relative path is retained as a historical provenance identifier.",
    },
    transform: manifest.transform,
    processing: meshPayload.processing,
    outputs: manifest.outputs,
    limitations: [
      "This is not an orthorectified or interpreted geological surface.",
      "Slice surfaces are display products derived from gridded/binned inversion cells.",
      "The sections should be used for communication and review before more advanced volume rendering.",
    ],
  };

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(meshPath, `${JSON.stringify(meshPayload)}\n`, "utf8");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(legendPath, `${JSON.stringify(legend, null, 2)}\n`, "utf8");
  await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");

  console.log(`Read ${rowCount} model rows.`);
  console.log(`Wrote ${mesh.vertices.length / 3} slice vertices and ${mesh.indices.length / 3} triangles.`);
  console.log(path.relative(process.cwd(), meshPath));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
