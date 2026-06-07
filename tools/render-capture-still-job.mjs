import { readFileSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const JOB_SCHEMA = "CaptureStillRenderJobV1";
const TILE_RESULT_SCHEMA = "CaptureStillTileRenderResultV1";
const DIAGNOSTICS_SCHEMA = "CaptureStillRenderJobDiagnosticsV1";
const DEFAULT_TARGET_WIDTH = 7680;
const DEFAULT_TARGET_HEIGHT = 4320;
const DEFAULT_TILE_WIDTH = 1920;
const DEFAULT_TILE_HEIGHT = 1080;
const RGBA_BYTES_PER_PIXEL = 4;

function usageDiagnostics() {
  return {
    schema: DIAGNOSTICS_SCHEMA,
    status: "error",
    error:
      "Usage: node tools/render-capture-still-job.mjs --self-test | --job <job.json> --out <output.png|output.webp|output.jpg> [--synthetic] [--app-url <url>] [--diagnostics <path>]",
    modes: ["--self-test", "--job <job.json> --out <output>"],
  };
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function normalizeStillType(value, outputPath) {
  if (value === "png" || value === "webp" || value === "jpeg") return value;
  const extension = extname(outputPath || "").toLowerCase();
  if (extension === ".webp") return "webp";
  if (extension === ".jpg" || extension === ".jpeg") return "jpeg";
  return "png";
}

function normalizeJob(rawJob, outputPath = "") {
  if (!rawJob || typeof rawJob !== "object" || Array.isArray(rawJob)) {
    throw new Error("job must be an object");
  }
  if (rawJob.schema !== JOB_SCHEMA) {
    throw new Error(`job.schema must be ${JOB_SCHEMA}`);
  }
  if (rawJob.version !== 1) {
    throw new Error("job.version must be 1");
  }

  const still = rawJob.still ?? {};
  const tile = rawJob.tile ?? {};
  const recipe = rawJob.recipe ?? {};
  const type = normalizeStillType(still.type, outputPath);
  if (recipe.mode === "full-ui" || recipe.mode === "off") {
    throw new Error(`recipe.mode ${recipe.mode} is not supported by external still jobs`);
  }
  if (recipe.supersampleScale !== 1) {
    throw new Error("recipe.supersampleScale must be 1");
  }
  if (tile.overlapPixels !== 0) {
    throw new Error("tile.overlapPixels must be 0");
  }

  return {
    schema: JOB_SCHEMA,
    version: 1,
    jobId: typeof rawJob.jobId === "string" ? rawJob.jobId : "unnamed-still-job",
    projectSlug:
      typeof rawJob.projectSlug === "string" && rawJob.projectSlug.length > 0
        ? rawJob.projectSlug
        : recipe.projectSlug ?? "geosee",
    pageId: typeof rawJob.pageId === "string" ? rawJob.pageId : recipe.pageId ?? null,
    app: {
      url:
        typeof rawJob.app?.url === "string" && rawJob.app.url.length > 0
          ? rawJob.app.url
          : `http://127.0.0.1:5173/?project=${encodeURIComponent(
              recipe.projectSlug ?? "geosee",
            )}`,
      projectSlug:
        typeof rawJob.app?.projectSlug === "string"
          ? rawJob.app.projectSlug
          : recipe.projectSlug ?? "geosee",
    },
    recipe,
    still: {
      width: positiveInteger(still.width, "still.width"),
      height: positiveInteger(still.height, "still.height"),
      type,
      quality:
        typeof still.quality === "number" && Number.isFinite(still.quality)
          ? Math.max(0.01, Math.min(1, still.quality))
          : undefined,
      filename:
        typeof still.filename === "string" && still.filename.length > 0
          ? still.filename
          : `geosee-external-still.${type === "jpeg" ? "jpg" : type}`,
    },
    tile: {
      width: positiveInteger(tile.width, "tile.width"),
      height: positiveInteger(tile.height, "tile.height"),
      overlapPixels: 0,
    },
    fidelity: rawJob.fidelity,
    failureReason:
      typeof rawJob.failureReason === "string" ? rawJob.failureReason : "",
    createdAt:
      typeof rawJob.createdAt === "string"
        ? rawJob.createdAt
        : new Date().toISOString(),
  };
}

export function createSelfTestJob() {
  return normalizeJob({
    schema: JOB_SCHEMA,
    version: 1,
    jobId: "self-test-7680x4320",
    projectSlug: "self-test",
    pageId: "self-test-page",
    app: {
      url: "synthetic://self-test",
      projectSlug: "self-test",
    },
    recipe: {
      version: 1,
      projectSlug: "self-test",
      pageId: "self-test-page",
      mode: "scene-only",
      resolution: { width: DEFAULT_TARGET_WIDTH, height: DEFAULT_TARGET_HEIGHT, label: "8K" },
      fps: 30,
      durationSeconds: 0.1,
      camera: null,
      cameraKeyframes: [],
      layerVisibility: {},
      layerStyles: {},
      environmentState: null,
      visualPreset: null,
      supersampleScale: 1,
      qualityPreset: "render-8k",
      renderFidelity: "max-detail-render",
      createdAt: "2026-06-06T00:00:00.000Z",
      captureScope: "current-page",
      pageRangeStartId: null,
      pageRangeEndId: null,
      pageRangeTiming: "authored",
      equalHoldSeconds: null,
    },
    still: {
      width: DEFAULT_TARGET_WIDTH,
      height: DEFAULT_TARGET_HEIGHT,
      type: "png",
      filename: "self-test.png",
    },
    tile: {
      width: DEFAULT_TILE_WIDTH,
      height: DEFAULT_TILE_HEIGHT,
      overlapPixels: 0,
    },
    fidelity: "max-detail-render",
    failureReason: "self-test",
    createdAt: "2026-06-06T00:00:00.000Z",
  });
}

export function computeTilePlan(jobInput) {
  const job = normalizeJob(jobInput);
  const targetWidth = job.still.width;
  const targetHeight = job.still.height;
  const tileWidth = job.tile.width;
  const tileHeight = job.tile.height;
  const columns = Math.ceil(targetWidth / tileWidth);
  const rows = Math.ceil(targetHeight / tileHeight);
  const xBreaks = [];
  const yBreaks = [];
  const tiles = [];

  for (let column = 0; column <= columns; column += 1) {
    xBreaks.push(Math.min(column * tileWidth, targetWidth));
  }
  for (let row = 0; row <= rows; row += 1) {
    yBreaks.push(Math.min(row * tileHeight, targetHeight));
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = xBreaks[column];
      const y = yBreaks[row];
      const width = xBreaks[column + 1] - x;
      const height = yBreaks[row + 1] - y;
      tiles.push({
        id: `tile-r${String(row).padStart(2, "0")}-c${String(column).padStart(2, "0")}`,
        row,
        column,
        x,
        y,
        width,
        height,
        bufferByteLength: width * height * RGBA_BYTES_PER_PIXEL,
      });
    }
  }

  const totalPixels = tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0);

  return {
    schema: "CaptureStillTilePlanV1",
    jobId: job.jobId,
    target: {
      width: targetWidth,
      height: targetHeight,
      type: job.still.type,
      quality: job.still.quality,
    },
    tileSize: {
      width: tileWidth,
      height: tileHeight,
    },
    grid: {
      columns,
      rows,
      tileCount: tiles.length,
      xBreaks,
      yBreaks,
    },
    totalPixels,
    totalBufferByteLength: totalPixels * RGBA_BYTES_PER_PIXEL,
    exactCoverage: totalPixels === targetWidth * targetHeight,
    tiles,
  };
}

export function validateExactTilePlan(plan) {
  if (plan.totalPixels !== plan.target.width * plan.target.height) {
    throw new Error("tile plan pixel count does not match target dimensions");
  }
  if (!plan.exactCoverage) {
    throw new Error("tile plan does not report exact coverage");
  }

  for (let row = 0; row < plan.grid.rows; row += 1) {
    const rowTiles = plan.tiles.filter((tile) => tile.row === row);
    const rowWidth = rowTiles.reduce((sum, tile) => sum + tile.width, 0);
    if (rowWidth !== plan.target.width) {
      throw new Error(`tile row ${row} width ${rowWidth} does not match target width`);
    }
  }

  for (let column = 0; column < plan.grid.columns; column += 1) {
    const columnTiles = plan.tiles.filter((tile) => tile.column === column);
    const columnHeight = columnTiles.reduce((sum, tile) => sum + tile.height, 0);
    if (columnHeight !== plan.target.height) {
      throw new Error(
        `tile column ${column} height ${columnHeight} does not match target height`,
      );
    }
  }

  return true;
}

function checksum(buffer) {
  let value = 2166136261;
  for (const byte of buffer) {
    value ^= byte;
    value = Math.imul(value, 16777619) >>> 0;
  }
  return value;
}

function renderSyntheticRgba(tile) {
  const buffer = Buffer.alloc(tile.bufferByteLength);
  for (let y = 0; y < tile.height; y += 1) {
    for (let x = 0; x < tile.width; x += 1) {
      const index = (y * tile.width + x) * RGBA_BYTES_PER_PIXEL;
      buffer[index] = (tile.x + x) & 255;
      buffer[index + 1] = (tile.y + y) & 255;
      buffer[index + 2] = (tile.column * 37 + tile.row * 61 + 113) & 255;
      buffer[index + 3] = 255;
    }
  }
  return buffer;
}

async function renderSyntheticTile(tile) {
  const raw = renderSyntheticRgba(tile);
  const image = await sharp(raw, {
    raw: { width: tile.width, height: tile.height, channels: 4 },
  })
    .png()
    .toBuffer();
  return {
    schema: TILE_RESULT_SCHEMA,
    tileId: tile.id,
    width: tile.width,
    height: tile.height,
    x: tile.x,
    y: tile.y,
    imageType: "png",
    imageBase64: image.toString("base64"),
    byteLength: image.byteLength,
    diagnostics: {
      projectionOffset: {
        fullWidth: 0,
        fullHeight: 0,
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
      },
      frameIndex: 0,
      timeSeconds: 0,
      maxDetail: true,
      overlayComposited: false,
    },
  };
}

async function renderAppTiles({ job, plan, appUrl }) {
  const browser = await chromium.launch({ headless: true });
  const rendered = [];
  try {
    const page = await browser.newPage({
      viewport: {
        width: Math.min(job.tile.width, 1920),
        height: Math.min(job.tile.height, 1080),
      },
    });
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => typeof window.__geoseeCaptureStillRenderer?.renderTile === "function",
      null,
      { timeout: 120_000 },
    );
    const capabilities = await page.evaluate(() =>
      window.__geoseeCaptureStillRenderer.capabilities(),
    );
    for (const tile of plan.tiles) {
      const result = await page.evaluate(
        async ({ currentJob, currentTile }) =>
          window.__geoseeCaptureStillRenderer.renderTile(currentJob, currentTile),
        { currentJob: job, currentTile: tile },
      );
      rendered.push(validateTileResult(result, tile));
    }
    return { tiles: rendered, capabilities };
  } finally {
    await browser.close();
  }
}

function validateTileResult(result, tile) {
  if (!result || typeof result !== "object") {
    throw new Error(`tile ${tile.id} returned no result`);
  }
  if (result.schema !== TILE_RESULT_SCHEMA) {
    throw new Error(`tile ${tile.id} schema must be ${TILE_RESULT_SCHEMA}`);
  }
  if (
    result.tileId !== tile.id ||
    result.width !== tile.width ||
    result.height !== tile.height ||
    result.x !== tile.x ||
    result.y !== tile.y
  ) {
    throw new Error(`tile ${tile.id} metadata does not match the tile plan`);
  }
  const buffer = Buffer.from(result.imageBase64, "base64");
  if (buffer.byteLength === 0) {
    throw new Error(`tile ${tile.id} produced zero bytes`);
  }
  return {
    tile,
    buffer,
    byteLength: buffer.byteLength,
    checksum: checksum(buffer),
    diagnostics: result.diagnostics,
  };
}

async function encodeFinalImage({ job, plan, renderedTiles, outputPath }) {
  const composites = renderedTiles.map((entry) => ({
    input: entry.buffer,
    left: entry.tile.x,
    top: entry.tile.y,
  }));
  let pipeline = sharp({
    create: {
      width: plan.target.width,
      height: plan.target.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  }).composite(composites);

  if (job.still.type === "webp") {
    pipeline = pipeline.webp({ quality: Math.round((job.still.quality ?? 0.9) * 100) });
  } else if (job.still.type === "jpeg") {
    pipeline = pipeline.jpeg({ quality: Math.round((job.still.quality ?? 0.92) * 100) });
  } else {
    pipeline = pipeline.png();
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await pipeline.toFile(outputPath);
}

async function validateFinalOutput(outputPath, job) {
  const metadata = await sharp(outputPath).metadata();
  const info = await stat(outputPath);
  if (info.size <= 0) {
    throw new Error("final output is zero bytes");
  }
  if (metadata.width !== job.still.width || metadata.height !== job.still.height) {
    throw new Error(
      `final output dimensions ${metadata.width}x${metadata.height} do not match ${job.still.width}x${job.still.height}`,
    );
  }
  return {
    path: outputPath,
    byteLength: info.size,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
  };
}

async function writeDiagnostics(path, diagnostics) {
  if (!path) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
}

async function runRenderJob({
  jobPath,
  outputPath,
  synthetic,
  appUrlOverride,
  diagnosticsPath,
}) {
  const job = normalizeJob(JSON.parse(readFileSync(jobPath, "utf8")), outputPath);
  const plan = computeTilePlan(job);
  validateExactTilePlan(plan);
  const appUrl = appUrlOverride || job.app.url;
  const startedAt = new Date().toISOString();
  const rendered = synthetic
    ? {
        tiles: await Promise.all(
          plan.tiles.map(async (tile) => validateTileResult(await renderSyntheticTile(tile), tile)),
        ),
        capabilities: { synthetic: true, supportsViewOffsetTiles: true },
      }
    : await renderAppTiles({ job, plan, appUrl });

  await encodeFinalImage({
    job,
    plan,
    renderedTiles: rendered.tiles,
    outputPath,
  });
  const finalOutput = await validateFinalOutput(outputPath, job);
  const diagnostics = {
    schema: DIAGNOSTICS_SCHEMA,
    status: "pass",
    mode: synthetic ? "synthetic-job" : "headless-app-job",
    startedAt,
    completedAt: new Date().toISOString(),
    job,
    appUrl,
    tilePlan: plan,
    browserCapabilities: rendered.capabilities,
    tiles: rendered.tiles.map((entry) => ({
      id: entry.tile.id,
      x: entry.tile.x,
      y: entry.tile.y,
      width: entry.tile.width,
      height: entry.tile.height,
      byteLength: entry.byteLength,
      checksum: entry.checksum,
      diagnostics: entry.diagnostics,
    })),
    finalOutput,
  };
  await writeDiagnostics(diagnosticsPath ?? `${outputPath}.capture-diagnostics.json`, diagnostics);
  return diagnostics;
}

export async function runSelfTest() {
  const dir = await mkdir(new URL("../.tmp/", import.meta.url), { recursive: true });
  void dir;
  const outputPath = fileURLToPath(new URL("../.tmp/capture-still-self-test.png", import.meta.url));
  const job = createSelfTestJob();
  const jobPath = fileURLToPath(new URL("../.tmp/capture-still-self-test-job.json", import.meta.url));
  await writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");
  return runRenderJob({
    jobPath,
    outputPath,
    synthetic: true,
    appUrlOverride: null,
    diagnosticsPath: `${outputPath}.capture-diagnostics.json`,
  });
}

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--self-test") {
    return { mode: "self-test" };
  }
  const args = {
    mode: "usage",
    jobPath: null,
    outputPath: null,
    synthetic: false,
    appUrlOverride: null,
    diagnosticsPath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--job") {
      args.jobPath = argv[++index];
    } else if (arg === "--out") {
      args.outputPath = argv[++index];
    } else if (arg === "--synthetic") {
      args.synthetic = true;
    } else if (arg === "--app-url") {
      args.appUrlOverride = argv[++index];
    } else if (arg === "--diagnostics") {
      args.diagnosticsPath = argv[++index];
    } else {
      return { mode: "usage" };
    }
  }
  if (args.jobPath && args.outputPath) {
    args.mode = "job";
  }
  return args;
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.mode === "self-test") return runSelfTest();
  if (args.mode === "job") {
    return runRenderJob(args);
  }
  return usageDiagnostics();
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  let diagnostics;
  let exitCode = 0;
  try {
    diagnostics = await runCli();
    if (diagnostics.status === "error") exitCode = 1;
  } catch (error) {
    diagnostics = {
      schema: DIAGNOSTICS_SCHEMA,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
    exitCode = 1;
  }
  process.stdout.write(`${JSON.stringify(diagnostics, null, 2)}\n`);
  process.exitCode = exitCode;
}
