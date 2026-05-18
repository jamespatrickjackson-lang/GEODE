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
const DEFAULT_STATION_PATH = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "stations",
  "mt_stations.geojson",
);
const DEFAULT_OUTPUT_DIR = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "resistivity_model",
  "volume",
  "stations",
);

function parseArgs(argv) {
  const options = {
    inputZip: DEFAULT_INPUT_ZIP,
    stationPath: DEFAULT_STATION_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--input" && value) {
      options.inputZip = path.resolve(value);
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

function round(value, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseScalar(text, key) {
  const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*([^\\r\\n]+)`, "im"));
  return match ? match[1].trim().replace(/^"|"$/g, "") : null;
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

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "geosee-utah-forge-mt-qc-"));
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

function parseSpectraBlocks(text) {
  const blocks = [];
  const pattern =
    /^>\s*SPECTRA\b[^\r\n]*FREQ\s*=\s*([-+0-9.eE]+)[^\r\n]*(?:AVGT\s*=\s*([-+0-9.eE]+))?[^\r\n]*(?:AVGF\s*=\s*([-+0-9.eE]+))?[^\r\n]*(?:\/\/\s*(\d+))?/gim;
  let match = pattern.exec(text);
  while (match) {
    const frequency = Number.parseFloat(match[1]);
    const avgt = Number.parseFloat(match[2] ?? "NaN");
    const avgf = Number.parseFloat(match[3] ?? "NaN");
    const rowCount = Number.parseInt(match[4] ?? "0", 10);
    blocks.push({
      frequencyHz: frequency,
      avgt: Number.isFinite(avgt) ? avgt : null,
      avgf: Number.isFinite(avgf) ? avgf : null,
      rowCount: Number.isFinite(rowCount) ? rowCount : null,
    });
    match = pattern.exec(text);
  }
  return blocks.filter((block) => Number.isFinite(block.frequencyHz));
}

function directResponseSections(text) {
  const sections = [];
  const candidates = [
    { key: "apparentResistivity", pattern: /^>\s*(RHO|RHOXY|RHOYX|RHOXX|RHOYY)\b/im },
    { key: "phase", pattern: /^>\s*(PHS|PHSXY|PHSYX|PHSXX|PHSYY|PHASE)\b/im },
    { key: "impedance", pattern: /^>\s*(ZXX|ZXY|ZYX|ZYY|ZROT|Z)\b/im },
    { key: "tipper", pattern: /^>\s*(TX|TY|TIPPER|TROT)\b/im },
  ];
  for (const candidate of candidates) {
    if (candidate.pattern.test(text)) sections.push(candidate.key);
  }
  return sections;
}

function parseEdiFile(text, filePath, extractedRoot) {
  const fileName = path.basename(filePath);
  const baseName = fileName.replace(/\.edi$/i, "");
  const isBvv = /_bvv$/i.test(baseName);
  const stationId = baseName.replace(/_bvv$/i, "");
  const spectra = parseSpectraBlocks(text);
  const frequencies = spectra.map((block) => block.frequencyHz).sort((a, b) => a - b);
  const directSections = directResponseSections(text);
  const relativePath = path.relative(extractedRoot, filePath).replaceAll("\\", "/");
  const nfReq = Number.parseInt(parseScalar(text, "NFREQ") ?? "0", 10);
  const maxBlocks = Number.parseInt(parseScalar(text, "MAXBLKS") ?? "0", 10);
  const dataId = parseScalar(text, "DATAID") ?? stationId;

  return {
    stationId,
    variant: isBvv ? "bvv" : "standard",
    fileName,
    relativePath,
    dataId,
    nfReq: Number.isFinite(nfReq) && nfReq > 0 ? nfReq : null,
    maxBlocks: Number.isFinite(maxBlocks) && maxBlocks > 0 ? maxBlocks : null,
    spectraBlockCount: spectra.length,
    spectraRowCount: spectra.reduce((sum, block) => sum + (block.rowCount ?? 0), 0),
    frequencyHzMin: frequencies.length > 0 ? frequencies[0] : null,
    frequencyHzMax: frequencies.length > 0 ? frequencies[frequencies.length - 1] : null,
    frequencyHzMedian:
      frequencies.length > 0 ? frequencies[Math.floor((frequencies.length - 1) / 2)] : null,
    avgfRange: valueRange(spectra.map((block) => block.avgf)),
    avgtRange: valueRange(spectra.map((block) => block.avgt)),
    directResponseSections: directSections,
    responseCurvesAvailable: directSections.includes("apparentResistivity") &&
      directSections.includes("phase"),
  };
}

function valueRange(values) {
  const clean = values.filter(Number.isFinite);
  if (clean.length === 0) return null;
  return [Math.min(...clean), Math.max(...clean)];
}

function stationLookup(collection) {
  const lookup = new Map();
  for (const feature of collection.features ?? []) {
    const stationId = feature?.properties?.stationId ?? feature?.properties?.id ?? feature?.id;
    if (typeof stationId !== "string") continue;
    lookup.set(stationId, feature);
  }
  return lookup;
}

function groupRecords(records, stations) {
  const byStation = new Map();
  for (const record of records) {
    if (!byStation.has(record.stationId)) byStation.set(record.stationId, []);
    byStation.get(record.stationId).push(record);
  }
  return [...byStation.entries()]
    .map(([stationId, variants]) => {
      const stationFeature = stations.get(stationId);
      const variantList = variants.sort((a, b) => a.variant.localeCompare(b.variant));
      const frequencies = variantList
        .flatMap((variant) => [variant.frequencyHzMin, variant.frequencyHzMax])
        .filter(Number.isFinite);
      const directSections = [...new Set(variantList.flatMap((variant) => variant.directResponseSections))];
      const selected = variantList.find((variant) => variant.variant === "standard") ?? variantList[0];
      return {
        stationId,
        displayName: stationFeature?.properties?.displayName ?? `MT station ${stationId}`,
        selectedVariant: selected.variant,
        variants: variantList,
        coordinates: {
          scene: stationFeature?.properties?.sceneCoordinates ?? null,
          sourceUtm: stationFeature?.properties?.sourceUtm ?? null,
          sourceCoordinates: stationFeature?.properties?.sourceCoordinates ?? null,
        },
        qc: {
          variantCount: variantList.length,
          spectraBlockCount: variantList.reduce((sum, variant) => sum + variant.spectraBlockCount, 0),
          spectraRowCount: variantList.reduce((sum, variant) => sum + variant.spectraRowCount, 0),
          frequencyHzMin: frequencies.length > 0 ? round(Math.min(...frequencies), 9) : null,
          frequencyHzMax: frequencies.length > 0 ? round(Math.max(...frequencies), 9) : null,
          directResponseSections,
          responseCurvesAvailable:
            directSections.includes("apparentResistivity") && directSections.includes("phase"),
          responseCurveStatus:
            directSections.includes("apparentResistivity") && directSections.includes("phase")
              ? "apparent resistivity and phase sections are directly available in source EDI"
              : "curves unavailable from source EDI; spectra metadata parsed, but apparent resistivity/phase curves are not derived in this pass",
        },
      };
    })
    .sort((a, b) => a.stationId.localeCompare(b.stationId));
}

async function main() {
  const options = parseArgs(process.argv);
  const stationGeojson = JSON.parse(await readFile(options.stationPath, "utf8"));
  const stationMap = stationLookup(stationGeojson);
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

    const stations = groupRecords(records, stationMap);
    const responseAvailableCount = stations.filter(
      (station) => station.qc.responseCurvesAvailable,
    ).length;
    const spectraStations = stations.filter((station) => station.qc.spectraBlockCount > 0).length;
    const allFrequencies = stations
      .flatMap((station) => [station.qc.frequencyHzMin, station.qc.frequencyHzMax])
      .filter(Number.isFinite);
    const payload = {
      schema: "geosee.mt-station-qc.v1",
      label: "Utah FORGE Phase 3 MT station response / QC summary",
      project: "utah-forge",
      area: "utah_forge_phase_3",
      dataset: "electrical_resistivity",
      generatedDate: DERIVED_DATE,
      source: {
        archive: path.relative(process.cwd(), options.inputZip).replaceAll("\\", "/"),
        stationGeojson: path.relative(process.cwd(), options.stationPath).replaceAll("\\", "/"),
        sourceFormat: "EDI",
      },
      stationCount: stations.length,
      ediFileCount: records.length,
      spectraStations,
      responseCurveStations: responseAvailableCount,
      frequencyHzRange:
        allFrequencies.length > 0
          ? [round(Math.min(...allFrequencies), 9), round(Math.max(...allFrequencies), 9)]
          : null,
      responseCurvePolicy:
        "Apparent resistivity/phase charts are exposed only when directly present in source EDI response sections; raw spectra are not converted into derived response curves in this pass.",
      stations,
      caveats: [
        "Station locations are measured/source parsed from EDI headers.",
        "QC values summarize source metadata and spectra blocks; they are not an interpretation.",
        "Apparent resistivity/phase curves are marked unavailable when not directly present in the EDI source.",
      ],
    };

    await mkdir(options.outputDir, { recursive: true });
    await writeFile(
      path.join(options.outputDir, "mt_station_response_qc.json"),
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8",
    );
    console.log(`Wrote MT station QC for ${stations.length} stations.`);
    console.log(
      path.relative(process.cwd(), path.join(options.outputDir, "mt_station_response_qc.json")),
    );
  } finally {
    if (extractedRoot) {
      await rm(extractedRoot, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
