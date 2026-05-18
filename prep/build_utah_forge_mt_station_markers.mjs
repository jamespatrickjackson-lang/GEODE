import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  DERIVED_DATE,
  UTAH_FORGE_PHASE3_MT_CLIENT_ROOT,
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
} from "./utah_forge_config.mjs";

const DEFAULT_INPUT_ZIP = path.join(
  UTAH_FORGE_PHASE3_MT_CLIENT_ROOT,
  "mt_edis",
  "FORGE_MT_190812_EDIs.zip",
);
const DEFAULT_TRANSFORM_PATH = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "intake",
  "crs_transform.json",
);
const DEFAULT_OUTPUT_DIR = path.join(UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT, "stations");

const NAD83_GRS80 = {
  a: 6378137.0,
  invF: 298.257222101,
  zone: 12,
  centralMeridianDeg: -111,
  k0: 0.9996,
  falseEasting: 500000,
  falseNorthing: 0,
};

function parseArgs(argv) {
  const options = {
    inputZip: DEFAULT_INPUT_ZIP,
    transformPath: DEFAULT_TRANSFORM_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--input" && value) {
      options.inputZip = path.resolve(value);
      index += 1;
    } else if (arg === "--transform" && value) {
      options.transformPath = path.resolve(value);
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

function parseScalar(text, key) {
  const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*([^\\r\\n]+)`, "im"));
  return match ? match[1].trim() : null;
}

function parseDms(value, isLongitude = false) {
  if (!value) return null;
  const clean = value.trim().replace(/[<>]/g, "");
  const parts = clean.split(/[:\s]+/).filter(Boolean);
  if (parts.length === 0) return null;

  const first = Number(parts[0]);
  const sign = first < 0 ? -1 : 1;
  const degrees = Math.abs(first);
  const minutes = parts.length > 1 ? Math.abs(Number(parts[1])) : 0;
  const seconds = parts.length > 2 ? Math.abs(Number(parts[2])) : 0;
  if (![degrees, minutes, seconds].every(Number.isFinite)) return null;

  let decimal = sign * (degrees + minutes / 60 + seconds / 3600);
  if (isLongitude && decimal > 0) {
    decimal *= -1;
  }
  return decimal;
}

function latLonToUtm12N(latDeg, lonDeg) {
  const { a, invF, centralMeridianDeg, k0, falseEasting, falseNorthing } = NAD83_GRS80;
  const f = 1 / invF;
  const e2 = f * (2 - f);
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const ep2 = e2 / (1 - e2);

  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const lon0 = (centralMeridianDeg * Math.PI) / 180;

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);

  const nu = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = ep2 * cosLat * cosLat;
  const aa = cosLat * (lon - lon0);

  const meridionalArc =
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * lat -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * lat) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * lat) -
      ((35 * e6) / 3072) * Math.sin(6 * lat));

  const easting =
    falseEasting +
    k0 *
      nu *
      (aa +
        ((1 - t + c) * aa ** 3) / 6 +
        ((5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * aa ** 5) / 120);
  const northing =
    falseNorthing +
    k0 *
      (meridionalArc +
        nu *
          tanLat *
          ((aa ** 2) / 2 +
            ((5 - t + 9 * c + 4 * c ** 2) * aa ** 4) / 24 +
            ((61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * aa ** 6) / 720));

  return { easting, northing };
}

async function collectFiles(root, predicate) {
  const results = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (predicate(fullPath)) {
        results.push(fullPath);
      }
    }
  }
  await walk(root);
  return results.sort((a, b) => a.localeCompare(b));
}

async function extractZip(inputZip) {
  const zipInfo = await stat(inputZip).catch(() => null);
  if (!zipInfo?.isFile()) {
    throw new Error(`Input archive not found: ${inputZip}`);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "geosee-utah-forge-edi-"));
  const result = spawnSync("tar", ["-xf", inputZip, "-C", tempDir], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    await rm(tempDir, { recursive: true, force: true });
    throw new Error(
      `Could not extract ${inputZip} with tar.\n${result.stderr || result.stdout || ""}`,
    );
  }
  return tempDir;
}

function parseEdiFile(text, filePath, extractedRoot) {
  const fileName = path.basename(filePath);
  const baseName = fileName.replace(/\.edi$/i, "");
  const isBvv = /_bvv$/i.test(baseName);
  const stationId = baseName.replace(/_bvv$/i, "");
  const latitude = parseDms(parseScalar(text, "LAT"), false);
  const longitude = parseDms(parseScalar(text, "LONG"), true);
  const elevation = Number.parseFloat(parseScalar(text, "ELEV") ?? "0");

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`Missing or invalid LAT/LONG in ${filePath}`);
  }

  const { easting, northing } = latLonToUtm12N(latitude, longitude);
  const relativePath = path.relative(extractedRoot, filePath).replaceAll("\\", "/");

  return {
    stationId,
    variant: isBvv ? "bvv" : "standard",
    fileName,
    relativePath,
    dataId: parseScalar(text, "DATAID")?.replace(/^"|"$/g, "") ?? stationId,
    datum: parseScalar(text, "DATUM") ?? "NAD83",
    latitude,
    longitude,
    elevation: Number.isFinite(elevation) ? elevation : 0,
    easting,
    northing,
  };
}

function groupStations(records) {
  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record.stationId)) {
      groups.set(record.stationId, []);
    }
    groups.get(record.stationId).push(record);
  }
  return [...groups.entries()]
    .map(([stationId, variants]) => ({
      stationId,
      variants: variants.sort((a, b) => a.variant.localeCompare(b.variant)),
      selected:
        variants.find((variant) => variant.variant === "standard") ??
        variants.find((variant) => variant.variant === "bvv") ??
        variants[0],
    }))
    .sort((a, b) => a.stationId.localeCompare(b.stationId));
}

function buildBounds(values) {
  const initial = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  return values.reduce((bounds, value) => {
    bounds.minX = Math.min(bounds.minX, value.x);
    bounds.maxX = Math.max(bounds.maxX, value.x);
    bounds.minY = Math.min(bounds.minY, value.y);
    bounds.maxY = Math.max(bounds.maxY, value.y);
    bounds.minZ = Math.min(bounds.minZ, value.z);
    bounds.maxZ = Math.max(bounds.maxZ, value.z);
    return bounds;
  }, initial);
}

function readOrigin(transform) {
  const origin =
    transform?.scene_transform?.scene_origin_utm ??
    transform?.sceneOriginUtm ??
    transform?.scene_origin_utm;
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

async function main() {
  const options = parseArgs(process.argv);
  const transform = JSON.parse(await readFile(options.transformPath, "utf8"));
  const origin = readOrigin(transform);
  let extractedRoot = null;

  try {
    extractedRoot = await extractZip(options.inputZip);
    const ediFiles = await collectFiles(extractedRoot, (filePath) => /\.edi$/i.test(filePath));
    if (ediFiles.length === 0) {
      throw new Error(`No EDI files found in ${options.inputZip}`);
    }

    const records = [];
    for (const ediFile of ediFiles) {
      const text = await readFile(ediFile, "utf8");
      records.push(parseEdiFile(text, ediFile, extractedRoot));
    }

    const stationGroups = groupStations(records);
    const scenePoints = stationGroups.map(({ selected }) => ({
      x: selected.easting - origin.easting_m,
      y: selected.northing - origin.northing_m,
      z: selected.elevation - origin.elevation_m,
    }));
    const sceneBounds = buildBounds(scenePoints);
    const utmBounds = buildBounds(
      stationGroups.map(({ selected }) => ({
        x: selected.easting,
        y: selected.northing,
        z: selected.elevation,
      })),
    );

    const features = stationGroups.map(({ stationId, selected, variants }, index) => {
      const localX = selected.easting - origin.easting_m;
      const localY = selected.northing - origin.northing_m;
      const localZ = selected.elevation - origin.elevation_m;
      return {
        type: "Feature",
        id: stationId,
        geometry: {
          type: "Point",
          coordinates: [round(localX), round(localY), round(localZ)],
        },
        properties: {
          id: stationId,
          displayName: `MT station ${stationId}`,
          stationId,
          pointIndex: index,
          sourceRole: "mt_station",
          classification: "measured",
          provenanceClass: "measured",
          selectedVariant: selected.variant,
          variantCount: variants.length,
          variants: variants.map((variant) => ({
            variant: variant.variant,
            fileName: variant.fileName,
            relativePath: variant.relativePath,
            dataId: variant.dataId,
          })),
          sourceCoordinates: {
            latitude_deg: round(selected.latitude, 8),
            longitude_deg: round(selected.longitude, 8),
            elevation_m: round(selected.elevation),
            datum: selected.datum,
          },
          sourceUtm: {
            epsg: "EPSG:26912",
            easting_m: round(selected.easting),
            northing_m: round(selected.northing),
            elevation_m: round(selected.elevation),
          },
          sceneCoordinates: {
            x_m: round(localX),
            y_m: round(localY),
            z_m: round(localZ),
          },
        },
      };
    });

    const featureCollection = {
      type: "FeatureCollection",
      name: "Utah FORGE Phase 3 MT stations",
      properties: {
        schema: "geosee.point-markers.geojson.v1",
        classification: "measured",
        sourceDataset: "Utah FORGE Phase 3 MT EDI station files",
        sourceArchive: path.relative(process.cwd(), options.inputZip).replaceAll("\\", "/"),
        sourceCrs: "EPSG:4269 geographic NAD83 in EDI, converted to EPSG:26912 NAD83 UTM Zone 12N",
        sceneCrs: "local meters, X east, Y north, Z up",
        sceneOriginUtm: origin,
        stationCount: stationGroups.length,
        ediFileCount: records.length,
        generatedDate: DERIVED_DATE,
        visualMarkerRadiusM: 900,
        visualLabelLiftM: 1200,
        boundsUtm: {
          minEasting_m: round(utmBounds.minX),
          maxEasting_m: round(utmBounds.maxX),
          minNorthing_m: round(utmBounds.minY),
          maxNorthing_m: round(utmBounds.maxY),
          minElevation_m: round(utmBounds.minZ),
          maxElevation_m: round(utmBounds.maxZ),
        },
        boundsScene: {
          minX_m: round(sceneBounds.minX),
          maxX_m: round(sceneBounds.maxX),
          minY_m: round(sceneBounds.minY),
          maxY_m: round(sceneBounds.maxY),
          minZ_m: round(sceneBounds.minZ),
          maxZ_m: round(sceneBounds.maxZ),
        },
      },
      features,
    };

    const provenance = {
      artifact: "mt_stations.geojson",
      classification: "measured",
      source: {
        project: "Utah FORGE",
        dataset: "GDR submission 1255 MT EDI archive",
        sourceArchive: path.relative(process.cwd(), options.inputZip).replaceAll("\\", "/"),
        sourceArchiveNote: "Delivered source/client file retained under client_preprocessed.",
      },
      transform: {
        sourceCrs: "EDI LAT/LONG interpreted as NAD83 geographic coordinates",
        outputCrs: "EPSG:26912 NAD83 UTM Zone 12N",
        sceneOriginUtm: origin,
        localAxes: "X east, Y north, Z up",
        verticalExaggeration: 1,
        cropApplied: false,
      },
      processing: {
        script: "prep/build_utah_forge_mt_station_markers.mjs",
        generatedDate: DERIVED_DATE,
        selectedVariantRule: "standard EDI per station preferred; _bvv retained as variant metadata",
        stationCount: stationGroups.length,
        ediFileCount: records.length,
      },
      output: {
        geojson: path
          .relative(process.cwd(), path.join(options.outputDir, "mt_stations.geojson"))
          .replaceAll("\\", "/"),
        provenance: path
          .relative(process.cwd(), path.join(options.outputDir, "mt_stations.provenance.json"))
          .replaceAll("\\", "/"),
      },
      notes: [
        "This artifact is a station-marker layer only.",
        "It does not enable or interpret the resistivity inversion model.",
        "No data crop or vertical exaggeration is applied.",
      ],
    };

    await mkdir(options.outputDir, { recursive: true });
    await writeFile(
      path.join(options.outputDir, "mt_stations.geojson"),
      `${JSON.stringify(featureCollection, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(options.outputDir, "mt_stations.provenance.json"),
      `${JSON.stringify(provenance, null, 2)}\n`,
      "utf8",
    );

    console.log(`Wrote ${stationGroups.length} MT station markers.`);
    console.log(path.relative(process.cwd(), path.join(options.outputDir, "mt_stations.geojson")));
  } finally {
    if (extractedRoot) {
      await rm(extractedRoot, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
