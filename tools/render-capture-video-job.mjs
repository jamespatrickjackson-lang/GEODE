import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const JOB_SCHEMA = "CaptureVideoRenderJobV1";
const STILL_JOB_SCHEMA = "CaptureStillRenderJobV1";
const TILE_RESULT_SCHEMA = "CaptureStillTileRenderResultV1";
const DIAGNOSTICS_SCHEMA = "CaptureVideoRenderJobDiagnosticsV1";
const DEFAULT_TILE_WIDTH = 1920;
const DEFAULT_TILE_HEIGHT = 1080;
const RGBA_BYTES_PER_PIXEL = 4;
const DEFAULT_SUPERSCALE = 2;
const MAX_SUPERSCALE = 4;
// Tile cap. A 16384 max-texture GPU can take 4096-8192 tiles, which cuts the
// number of slow base64 bridge transfers at 8K + supersampling. Opt in with
// --tile; the default keeps the proven 1920x1080 tile.
const MAX_TILE_PX = 8192;

// ANGLE/D3D11 reaches the discrete GPU in headless Chromium on Windows; without
// these flags Chromium falls back to the SwiftShader software rasterizer
// (~20s/frame and lower max texture size).
const GPU_LAUNCH_ARGS = [
  "--use-gl=angle",
  "--use-angle=d3d11",
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--enable-gpu-rasterization",
  "--enable-zero-copy",
];
const SOFTWARE_RENDERER_PATTERN = /swiftshader|software|llvmpipe|basic render/i;

function clampSuperscale(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_SUPERSCALE, n);
}

function usageDiagnostics() {
  return {
    schema: DIAGNOSTICS_SCHEMA,
    status: "error",
    error:
      "Usage: node tools/render-capture-video-job.mjs --job <job.json> --out <output.mp4|output.webm> [--synthetic] [--app-url <url>] [--diagnostics <path>] [--frame-dir <dir>] [--frames-only] [--reuse-frames] [--superscale <1-4>] [--no-gpu] [--allow-software] [--master prores4444|none] [--no-keep-frames]",
    modes: ["--job <job.json> --out <output>"],
  };
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function normalizeFormat(value, outputPath) {
  if (value === "mp4" || value === "webm") return value;
  const extension = extname(outputPath || "").toLowerCase();
  if (extension === ".webm") return "webm";
  return "mp4";
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
  const recipe = rawJob.recipe ?? {};
  const video = rawJob.video ?? {};
  if (recipe.mode === "full-ui" || recipe.mode === "off") {
    throw new Error(`recipe.mode ${recipe.mode} is not supported by external video jobs`);
  }
  if (recipe.supersampleScale !== 1) {
    throw new Error("recipe.supersampleScale must be 1");
  }
  const format = normalizeFormat(video.format, outputPath);
  const width = positiveInteger(video.width, "video.width");
  const height = positiveInteger(video.height, "video.height");
  const fps = positiveInteger(video.fps, "video.fps");
  const totalFrames = positiveInteger(video.totalFrames, "video.totalFrames");
  const sourceFrameStart =
    Number.isInteger(video.sourceFrameStart) && video.sourceFrameStart >= 0
      ? video.sourceFrameStart
      : 0;
  const sourceFrameEnd =
    Number.isInteger(video.sourceFrameEnd) && video.sourceFrameEnd >= sourceFrameStart
      ? video.sourceFrameEnd
      : sourceFrameStart + totalFrames - 1;
  if (
    !Number.isFinite(video.durationSeconds) ||
    Number(video.durationSeconds) <= 0
  ) {
    throw new Error("video.durationSeconds must be greater than zero");
  }
  if (width !== recipe.resolution?.width || height !== recipe.resolution?.height) {
    throw new Error("video dimensions must match recipe resolution");
  }
  // Both the H.264 and VP9 encode paths below output yuv420p, which requires
  // even dimensions. Reject odd sizes here with a clear message instead of
  // letting ffmpeg fail mid-encode. Mirrors the browser encoder guard.
  if (width % 2 !== 0 || height % 2 !== 0) {
    throw new Error("video.width and video.height must be even for yuv420p output");
  }

  return {
    schema: JOB_SCHEMA,
    version: 1,
    jobId: typeof rawJob.jobId === "string" ? rawJob.jobId : "unnamed-video-job",
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
    video: {
      width,
      height,
      format,
      fps,
      durationSeconds: Number(video.durationSeconds),
      totalFrames,
      sourceFrameStart,
      sourceFrameEnd,
      encodingProfile:
        video.encodingProfile === "scroll-friendly-video"
          ? "scroll-friendly-video"
          : undefined,
      filename:
        typeof video.filename === "string" && video.filename.length > 0
          ? video.filename
          : `geosee-external-video.${format}`,
    },
    fidelity: rawJob.fidelity,
    createdAt:
      typeof rawJob.createdAt === "string"
        ? rawJob.createdAt
        : new Date().toISOString(),
  };
}

function computeTilePlan(jobInput, superscale = 1, tilePx = 0) {
  const job = typeof jobInput?.schema === "string" ? jobInput : normalizeJob(jobInput);
  const scale = clampSuperscale(superscale);
  const targetWidth = job.video.width;
  const targetHeight = job.video.height;
  // The scene is rendered at the supersampled resolution, then resolved down to
  // the delivery resolution with a Lanczos filter (true SSAA). Tiles cover the
  // supersampled frame so no single GPU surface needs to be enormous. Larger
  // tiles (GPU-bound) cut the number of slow base64 bridge transfers per frame;
  // tilePx clamps to the GPU max texture size on capable hardware.
  const renderWidth = targetWidth * scale;
  const renderHeight = targetHeight * scale;
  const tileLimit =
    Number.isFinite(tilePx) && tilePx >= 256 ? Math.min(tilePx, MAX_TILE_PX) : 0;
  const tileWidth = Math.min(tileLimit || DEFAULT_TILE_WIDTH, renderWidth);
  const tileHeight = Math.min(tileLimit || DEFAULT_TILE_HEIGHT, renderHeight);
  const columns = Math.ceil(renderWidth / tileWidth);
  const rows = Math.ceil(renderHeight / tileHeight);
  const tiles = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * tileWidth;
      const y = row * tileHeight;
      const width = Math.min(tileWidth, renderWidth - x);
      const height = Math.min(tileHeight, renderHeight - y);
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

  return {
    schema: "CaptureVideoTilePlanV1",
    jobId: job.jobId,
    target: {
      width: targetWidth,
      height: targetHeight,
      format: job.video.format,
    },
    render: { width: renderWidth, height: renderHeight, superscale: scale },
    tileSize: { width: tileWidth, height: tileHeight },
    grid: { columns, rows, tileCount: tiles.length },
    tiles,
  };
}

function checksum(buffer) {
  let value = 2166136261;
  for (const byte of buffer) {
    value ^= byte;
    value = Math.imul(value, 16777619) >>> 0;
  }
  return value;
}

function framePath(frameDir, frameIndex) {
  return join(frameDir, `frame-${String(frameIndex).padStart(6, "0")}.png`);
}

function frameInputStartNumber(job) {
  return Number.isInteger(job.video.sourceFrameStart) && job.video.sourceFrameStart >= 0
    ? job.video.sourceFrameStart
    : 0;
}

function stillJobForFrame(job, plan) {
  // The app renders the scene at the supersampled resolution; the still job's
  // full width/height drive the per-tile projection offset, so they must be the
  // render dimensions, not the delivery dimensions.
  return {
    schema: STILL_JOB_SCHEMA,
    version: 1,
    jobId: `${job.jobId}-frame`,
    projectSlug: job.projectSlug,
    pageId: job.pageId,
    app: job.app,
    recipe: job.recipe,
    still: {
      width: plan.render.width,
      height: plan.render.height,
      type: "png",
      filename: `${job.jobId}-frame.png`,
    },
    tile: {
      width: plan.tileSize.width,
      height: plan.tileSize.height,
      overlapPixels: 0,
    },
    fidelity: "max-detail-render",
    failureReason: "external video frame render",
    createdAt: job.createdAt,
  };
}

function renderSyntheticRgba(tile, frameIndex) {
  const buffer = Buffer.alloc(tile.bufferByteLength);
  for (let y = 0; y < tile.height; y += 1) {
    for (let x = 0; x < tile.width; x += 1) {
      const index = (y * tile.width + x) * RGBA_BYTES_PER_PIXEL;
      buffer[index] = (tile.x + x + frameIndex * 11) & 255;
      buffer[index + 1] = (tile.y + y + frameIndex * 17) & 255;
      buffer[index + 2] = (tile.column * 37 + tile.row * 61 + 113) & 255;
      buffer[index + 3] = 255;
    }
  }
  return buffer;
}

async function renderSyntheticTile(tile, frameIndex) {
  const raw = renderSyntheticRgba(tile, frameIndex);
  return sharp(raw, {
    raw: { width: tile.width, height: tile.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

function validateTileResult(result, tile, frameIndex) {
  if (!result || typeof result !== "object") {
    throw new Error(`frame ${frameIndex} tile ${tile.id} returned no result`);
  }
  if (result.schema !== TILE_RESULT_SCHEMA) {
    throw new Error(`frame ${frameIndex} tile ${tile.id} schema must be ${TILE_RESULT_SCHEMA}`);
  }
  if (
    result.tileId !== tile.id ||
    result.width !== tile.width ||
    result.height !== tile.height ||
    result.x !== tile.x ||
    result.y !== tile.y
  ) {
    throw new Error(`frame ${frameIndex} tile ${tile.id} metadata does not match the tile plan`);
  }
  const buffer = Buffer.from(result.imageBase64, "base64");
  if (buffer.byteLength === 0) {
    throw new Error(`frame ${frameIndex} tile ${tile.id} produced zero bytes`);
  }
  return {
    tile,
    buffer,
    byteLength: buffer.byteLength,
    checksum: checksum(buffer),
    diagnostics: result.diagnostics,
  };
}

async function stitchFrame({ job, plan, renderedTiles, outputPath }) {
  const composites = renderedTiles.map((entry) => ({
    input: entry.buffer,
    left: entry.tile.x,
    top: entry.tile.y,
  }));
  const stitched = sharp({
    create: {
      width: plan.render.width,
      height: plan.render.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  }).composite(composites);

  if (plan.render.superscale > 1) {
    // Resolve the supersampled frame down to delivery resolution. Lanczos3 is a
    // high-quality reconstruction filter; this is the antialiasing/detail win.
    const supersampled = await stitched.png().toBuffer();
    await sharp(supersampled)
      .resize(plan.target.width, plan.target.height, {
        kernel: "lanczos3",
        fit: "fill",
      })
      .png()
      .toFile(outputPath);
  } else {
    await stitched.png().toFile(outputPath);
  }

  const metadata = await sharp(outputPath).metadata();
  if (metadata.width !== job.video.width || metadata.height !== job.video.height) {
    throw new Error(`frame dimensions do not match ${job.video.width}x${job.video.height}`);
  }
}

async function renderSyntheticFrame({ job, plan, frameIndex, outputPath }) {
  const renderedTiles = await Promise.all(
    plan.tiles.map(async (tile) => ({
      tile,
      buffer: await renderSyntheticTile(tile, frameIndex),
      byteLength: 0,
      checksum: 0,
      diagnostics: {
        frameIndex,
        timeSeconds: frameIndex / job.video.fps,
        maxDetail: true,
        synthetic: true,
      },
    })),
  );
  renderedTiles.forEach((entry) => {
    entry.byteLength = entry.buffer.byteLength;
    entry.checksum = checksum(entry.buffer);
  });
  await stitchFrame({ job, plan, renderedTiles, outputPath });
  return renderedTiles;
}

async function renderAppFrame({ page, job, plan, frameIndex, outputPath }) {
  const stillJob = stillJobForFrame(job, plan);
  const renderedTiles = [];
  for (const tile of plan.tiles) {
    const result = await page.evaluate(
      async ({ currentJob, currentTile, currentFrameIndex }) =>
        window.__geoseeCaptureStillRenderer.renderTile(
          currentJob,
          currentTile,
          currentFrameIndex,
        ),
      { currentJob: stillJob, currentTile: tile, currentFrameIndex: frameIndex },
    );
    renderedTiles.push(validateTileResult(result, tile, frameIndex));
  }
  await stitchFrame({ job, plan, renderedTiles, outputPath });
  return renderedTiles;
}

async function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const module = await import("ffmpeg-static");
    if (typeof module.default === "string" && module.default.length > 0) {
      return module.default;
    }
  } catch {
    // Fall through to PATH.
  }
  return "ffmpeg";
}

function frameInputArgs({ job, frameDir }) {
  return [
    "-hide_banner",
    "-y",
    "-framerate",
    String(job.video.fps),
    "-start_number",
    String(frameInputStartNumber(job)),
    "-i",
    join(frameDir, "frame-%06d.png"),
    "-an",
  ];
}

// Primary playable deliverable: near-transparent H.264 8-bit yuv420p (mp4, plays
// everywhere) or high-quality VP9 (webm). CRF is much tighter than the old
// preview defaults.
function playableVideoArgs({ job, frameDir, outputPath }) {
  const base = frameInputArgs({ job, frameDir });
  if (job.video.format === "webm") {
    return [
      ...base,
      "-c:v", "libvpx-vp9",
      "-b:v", "0",
      "-crf", "18",
      "-deadline", "best",
      "-row-mt", "1",
      "-pix_fmt", "yuv420p",
      outputPath,
    ];
  }
  return [
    ...base,
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "12",
    ...(job.video.encodingProfile === "scroll-friendly-video"
      ? ["-g", "5", "-keyint_min", "5", "-sc_threshold", "0"]
      : []),
    ...(job.video.encodingProfile === "scroll-friendly-video"
      ? ["-metadata", "geosee_profile=dense-keyframes"]
      : []),
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath,
  ];
}

// "Best" master: ProRes 4444, 10-bit 4:4:4, no chroma subsampling. qscale 4 is
// near-lossless. Container is .mov.
function proresMasterArgs({ job, frameDir, outputPath }) {
  return [
    ...frameInputArgs({ job, frameDir }),
    "-c:v", "prores_ks",
    "-profile:v", "4444",
    "-pix_fmt", "yuv444p10le",
    "-qscale:v", "4",
    "-vendor", "apl0",
    outputPath,
  ];
}

async function runFfmpeg({ ffmpegPath, args, outputPath, label }) {
  await mkdir(dirname(outputPath), { recursive: true });
  const startedAt = Date.now();
  const result = await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ code, stderr });
      } else {
        rejectPromise(
          new Error(`ffmpeg (${label}) exited with code ${code}: ${stderr.slice(-1000)}`),
        );
      }
    });
  });
  const info = await stat(outputPath);
  if (info.size <= 0) {
    throw new Error(`ffmpeg (${label}) produced a zero-byte file`);
  }
  return {
    label,
    outputPath,
    args,
    byteLength: info.size,
    elapsedMs: Date.now() - startedAt,
    stderr: result.stderr.slice(-2000),
  };
}

async function writeDiagnostics(path, diagnostics) {
  if (!path) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
}

function emitProgress(payload) {
  // Single-line marker the dev-server plugin parses for live frame progress.
  process.stdout.write(`@progress ${JSON.stringify(payload)}\n`);
}

function masterOutputPath(outputPath) {
  const ext = extname(outputPath);
  const base = ext ? outputPath.slice(0, -ext.length) : outputPath;
  return `${base}.master.mov`;
}

async function readGpuInfo(page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!gl) return { webgl: false };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      webgl: true,
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    };
  });
}

async function runRenderJob({
  jobPath,
  outputPath,
  synthetic,
  appUrlOverride,
  diagnosticsPath,
  keepFrames = true,
  frameDirOverride = null,
  framesOnly = false,
  reuseFrames = false,
  superscale = DEFAULT_SUPERSCALE,
  gpu = true,
  allowSoftware = false,
  master = "prores4444",
  tilePx = 0,
}) {
  const job = normalizeJob(JSON.parse(readFileSync(jobPath, "utf8")), outputPath);
  const plan = computeTilePlan(job, superscale, tilePx);
  const appUrl = appUrlOverride || job.app.url;
  const startedAt = new Date().toISOString();
  const frameRoot = frameDirOverride
    ? resolve(dirname(frameDirOverride))
    : resolve(".tmp", `capture-video-${job.jobId}-${Date.now()}`);
  const frameDir = frameDirOverride ? resolve(frameDirOverride) : join(frameRoot, "frames");
  await mkdir(frameDir, { recursive: true });
  const frameDiagnostics = [];
  let browser = null;
  let page = null;
  let capabilities = synthetic ? { synthetic: true } : null;
  let gpuInfo = null;

  emitProgress({
    phase: "prepare",
    totalFrames: job.video.totalFrames,
    delivery: plan.target,
    render: plan.render,
    tiles: plan.grid.tileCount,
  });

  let reusedFrameCount = 0;
  try {
    if (reuseFrames) {
      const existingFrames = (await readdir(frameDir).catch(() => [])).filter((entry) =>
        /^frame-\d{6}\.png$/i.test(entry),
      );
      if (existingFrames.length === 0) {
        throw new Error(
          "--reuse-frames requires pre-rendered frames in --frame-dir",
        );
      }
      reusedFrameCount = existingFrames.length;
      emitProgress({
        phase: "prepare",
        totalFrames: job.video.totalFrames,
        reuseFrames: true,
        renderedFrames: reusedFrameCount,
      });
    } else if (!synthetic) {
      browser = await chromium.launch({
        headless: true,
        args: gpu ? GPU_LAUNCH_ARGS : [],
      });
      page = await browser.newPage({
        viewport: { width: plan.tileSize.width, height: plan.tileSize.height },
      });
      gpuInfo = await readGpuInfo(page);
      const software = SOFTWARE_RENDERER_PATTERN.test(gpuInfo?.renderer || "");
      if (gpu && software && !allowSoftware) {
        throw new Error(
          `GPU did not engage (renderer: "${gpuInfo?.renderer}"). The render would fall back to ` +
            `software rasterization. Pass --allow-software to proceed anyway.`,
        );
      }
      emitProgress({ phase: "gpu", renderer: gpuInfo?.renderer, software });
      await page.goto(appUrl, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => typeof window.__geoseeCaptureStillRenderer?.renderTile === "function",
        null,
        { timeout: 120_000 },
      );
      capabilities = await page.evaluate(() =>
        window.__geoseeCaptureStillRenderer.capabilities(),
      );
    }

    if (!reuseFrames)
      for (let frameOffset = 0; frameOffset < job.video.totalFrames; frameOffset += 1) {
      const actualFrameIndex = frameInputStartNumber(job) + frameOffset;
      const outputFramePath = framePath(frameDir, actualFrameIndex);
      const renderedTiles = synthetic
        ? await renderSyntheticFrame({
            job,
            plan,
            frameIndex: actualFrameIndex,
            outputPath: outputFramePath,
          })
        : await renderAppFrame({
            page,
            job,
            plan,
            frameIndex: actualFrameIndex,
            outputPath: outputFramePath,
          });
      const info = await stat(outputFramePath);
      if (info.size <= 0) {
        throw new Error(`frame ${frameIndex} produced zero bytes`);
      }
      frameDiagnostics.push({
        frameIndex: actualFrameIndex,
        frameOffset,
        timeSeconds: actualFrameIndex / job.video.fps,
        path: outputFramePath,
        byteLength: info.size,
        tileCount: renderedTiles.length,
      });
      emitProgress({
        phase: "render",
        frameIndex: actualFrameIndex,
        frameOffset,
        renderedFrames: frameOffset + 1,
        totalFrames: job.video.totalFrames,
      });
    }

    if (framesOnly) {
      const diagnostics = {
        schema: DIAGNOSTICS_SCHEMA,
        status: "pass",
        mode: synthetic ? "synthetic-job" : "headless-app-job",
        outputMode: "frames-only",
        startedAt,
        completedAt: new Date().toISOString(),
        job,
        appUrl,
        tilePlan: plan,
        supersample: plan.render.superscale,
        gpu: gpuInfo,
        browserCapabilities: capabilities,
        frameCount: frameDiagnostics.length,
        outputs: [],
        playableOutput: null,
        masterOutput: null,
        frameSequenceDir: frameDir,
        finalOutput: null,
      };
      await writeDiagnostics(
        diagnosticsPath ?? join(frameRoot, "capture-diagnostics.json"),
        diagnostics,
      );
      emitProgress({ phase: "complete", totalFrames: job.video.totalFrames });
      return diagnostics;
    }

    emitProgress({ phase: "encode", totalFrames: job.video.totalFrames });
    const ffmpegPath = await resolveFfmpegPath();
    const outputs = [];
    outputs.push(
      await runFfmpeg({
        ffmpegPath,
        args: playableVideoArgs({ job, frameDir, outputPath }),
        outputPath,
        label: "playable",
      }),
    );
    let masterPath = null;
    if (master && master !== "none") {
      masterPath = masterOutputPath(outputPath);
      outputs.push(
        await runFfmpeg({
          ffmpegPath,
          args: proresMasterArgs({ job, frameDir, outputPath: masterPath }),
          outputPath: masterPath,
          label: "prores-master",
        }),
      );
    }

    const diagnostics = {
      schema: DIAGNOSTICS_SCHEMA,
      status: "pass",
      mode: synthetic ? "synthetic-job" : "headless-app-job",
      startedAt,
      completedAt: new Date().toISOString(),
      job,
      appUrl,
      tilePlan: plan,
      supersample: plan.render.superscale,
      gpu: gpuInfo,
      browserCapabilities: capabilities,
      frameCount: reuseFrames ? reusedFrameCount : frameDiagnostics.length,
      outputs,
      playableOutput: outputPath,
      masterOutput: masterPath,
      frameSequenceDir: keepFrames ? frameDir : null,
      finalOutput: { path: outputPath, byteLength: outputs[0].byteLength },
    };
    await writeDiagnostics(
      diagnosticsPath ?? `${outputPath}.capture-diagnostics.json`,
      diagnostics,
    );
    emitProgress({ phase: "complete", totalFrames: job.video.totalFrames });
    return diagnostics;
  } finally {
    if (browser) await browser.close();
    if (!keepFrames && !reuseFrames) {
      await rm(frameRoot, { recursive: true, force: true });
    }
  }
}

function parseArgs(argv) {
  const args = {
    mode: "usage",
    jobPath: null,
    outputPath: null,
    synthetic: false,
    appUrlOverride: null,
    diagnosticsPath: null,
    keepFrames: true,
    frameDirOverride: null,
    framesOnly: false,
    reuseFrames: false,
    superscale: DEFAULT_SUPERSCALE,
    gpu: true,
    allowSoftware: false,
    master: "prores4444",
    tilePx: 0,
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
    } else if (arg === "--frame-dir") {
      args.frameDirOverride = argv[++index];
    } else if (arg === "--frames-only") {
      args.framesOnly = true;
    } else if (arg === "--reuse-frames") {
      args.reuseFrames = true;
    } else if (arg === "--keep-frames") {
      args.keepFrames = true;
    } else if (arg === "--no-keep-frames") {
      args.keepFrames = false;
    } else if (arg === "--superscale") {
      args.superscale = clampSuperscale(argv[++index]);
    } else if (arg === "--tile") {
      args.tilePx = Math.round(Number(argv[++index])) || 0;
    } else if (arg === "--gpu") {
      args.gpu = true;
    } else if (arg === "--no-gpu") {
      args.gpu = false;
    } else if (arg === "--allow-software") {
      args.allowSoftware = true;
    } else if (arg === "--master") {
      args.master = argv[++index];
    } else if (arg === "--no-master") {
      args.master = "none";
    } else {
      return { mode: "usage" };
    }
  }
  if (args.jobPath && (args.outputPath || args.framesOnly)) {
    args.mode = "job";
  }
  return args;
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
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
