import type { Plugin, ViteDevServer } from "vite";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  basename,
  dirname,
  isAbsolute,
  normalize,
  posix,
  relative,
  resolve,
  sep,
} from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createFinalScrollHandoffManifest,
  createPendingScrollHandoffManifest,
  validateScrollHandoffManifest,
  validateScrollRecordRequest,
  type CaptureScrollRecordRequestV1,
  type ScrollHandoffPackageV1,
} from "./scroll-package-contract";

// Dev-only authoring write endpoint. Decision #022.
//
// Three endpoints, all under /api/:
//   POST /api/write-file   { path, content, encoding? }  -> 204
//   POST /api/write-batch  { files: [{ path, content, encoding? }] } -> 204
//   POST /api/read-file    { path }                       -> 200 with content
//   POST /api/copy-file    { from, to }                    -> 204
//   POST /api/delete-file  { path }                       -> 204
//
// path is project-root-relative. Hard validation:
//   - reject absolute paths
//   - reject any segment ".." or that resolves outside projects/
//   - reject existing symlinks (defense-in-depth: lstat before any write)
//   - reject existing non-regular-file (directories, sockets, etc.)
//
// This plugin runs only in dev. `vite build` does NOT include it, so the
// shipped static artifact has no write capability. End clients cannot reach
// these endpoints because they only ever see the published build.

const ALLOWED_PREFIX = "projects/";
const DEFAULT_SCROLL_PACKAGE_OUTPUT_DIR = ".tmp/capture-scroll-outputs";

interface WriteBody {
  path: string;
  content: string;
  encoding?: "utf8" | "base64";
  expectedContent?: string | null;
}

interface WriteBatchBody {
  files: WriteBody[];
}

interface ReadBody {
  path: string;
}

interface CopyBody {
  from: string;
  to: string;
}

interface DeleteBody {
  path: string;
}

interface ConvertBrandingAssetBody {
  sourcePath: string;
  outputPath: string;
  sourceFormat?: string;
}

type CaptureVideoRunStatus =
  | "queued"
  | "preparing"
  | "rendering"
  | "encoding"
  | "complete"
  | "failed"
  | "cancelled";

interface CaptureVideoRenderBody {
  job: unknown;
  outputFilename?: string;
  synthetic?: boolean;
}

interface CaptureVideoRunBody {
  runId: string;
}

interface CaptureVideoRunRecord {
  runId: string;
  status: CaptureVideoRunStatus;
  phase: CaptureVideoRunStatus;
  startedAt: string;
  completedAt?: string | null;
  outputFilename: string;
  outputPath: string;
  outputUrl: string | null;
  diagnosticsPath: string;
  jobPath: string;
  stdout: string;
  stderr: string;
  error?: string | null;
  exitCode?: number | null;
  child?: Pick<ChildProcess, "kill">;
  renderedFrames?: number;
  totalFrames?: number | null;
  renderer?: string | null;
  superscale?: number | null;
  masterPath?: string | null;
  masterUrl?: string | null;
  frameSequenceDir?: string | null;
}

interface CaptureScrollPackageRenderBody {
  request: unknown;
  manifest?: unknown;
  renderJob: unknown;
  synthetic?: boolean;
}

interface CaptureScrollPackageRunBody {
  runId: string;
}

interface CaptureScrollPackageRunRecord {
  runId: string;
  status: CaptureVideoRunStatus | "finalizing";
  phase: CaptureVideoRunStatus | "finalizing";
  startedAt: string;
  completedAt?: string | null;
  packageName: string;
  packagePath: string;
  manifestPath: string;
  manifestUrl: string | null;
  outputUrl: string | null;
  diagnosticsPath: string;
  jobPath: string;
  request: CaptureScrollRecordRequestV1;
  manifest: ScrollHandoffPackageV1;
  renderJob: any;
  stdout: string;
  stderr: string;
  error?: string | null;
  exitCode?: number | null;
  child?: Pick<ChildProcess, "kill">;
  renderedFrames?: number;
  totalFrames?: number | null;
  renderer?: string | null;
  superscale?: number | null;
  mediaPath?: string | null;
  mediaUrl?: string | null;
  mediaRelativePath?: string | null;
  frameSequenceDir?: string | null;
  warnings?: string[];
}

function badRequest(res: ServerResponse, msg: string, status = 400) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ error: msg }));
}

function ok(res: ServerResponse, body?: unknown) {
  if (body === undefined) {
    res.statusCode = 204;
    res.end();
    return;
  }
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw) as T;
}

/**
 * Validate a project-relative path and return its absolute resolution.
 * Throws on any rule violation.
 */
function resolveSafePath(projectRoot: string, requested: string): string {
  if (typeof requested !== "string" || requested.length === 0) {
    throw new Error("path required");
  }
  if (isAbsolute(requested)) {
    throw new Error("path must be relative to project root");
  }
  // Normalize both with POSIX semantics (the API contract uses forward
  // slashes) before checking the prefix.
  const posixNormalized = posix.normalize(requested.replace(/\\/g, "/"));
  if (posixNormalized.startsWith("..") || posixNormalized.includes("/../")) {
    throw new Error("path escapes project root");
  }
  if (!posixNormalized.startsWith(ALLOWED_PREFIX)) {
    throw new Error(`path must start with "${ALLOWED_PREFIX}"`);
  }

  // Convert to OS-native form for fs operations.
  const native = normalize(posixNormalized);
  const absolute = resolve(projectRoot, native);

  // Final containment check: the resolved absolute path must still live
  // inside the project root + allowed prefix. Guards against rare cases
  // where path manipulation slips past earlier checks (e.g. via Unicode
  // tricks the normalizer doesn't catch).
  const allowedRoot = resolve(projectRoot, ALLOWED_PREFIX);
  if (!absolute.startsWith(allowedRoot + sep) && absolute !== allowedRoot) {
    throw new Error("resolved path escapes projects/");
  }
  return absolute;
}

/**
 * If the path exists, refuse to operate on it unless it is a regular file.
 * Symlinks, directories, FIFOs, and sockets are all rejected here.
 */
async function refuseUnlessRegularOrMissing(absolute: string): Promise<void> {
  try {
    const st = await fs.lstat(absolute);
    if (!st.isFile()) {
      throw new Error(
        `refusing to write: existing path is not a regular file ` +
          `(symlink/dir/etc): ${absolute}`,
      );
    }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return; // OK -- new file
    throw e;
  }
}

async function readExpectedComparableContent(
  absolute: string,
): Promise<string | null> {
  try {
    await refuseUnlessRegularOrMissing(absolute);
    return await fs.readFile(absolute, "utf8");
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function assertExpectedContent(
  requestedPath: string,
  absolute: string,
  expectedContent: string | null | undefined,
): Promise<void> {
  if (expectedContent === undefined) return;
  const currentContent = await readExpectedComparableContent(absolute);
  if (currentContent !== expectedContent) {
    throw new Error(
      `write conflict: ${requestedPath} changed on disk since the editor loaded it; reload the project before saving.`,
    );
  }
}

async function runAssetTool(
  command: string,
  args: string[],
): Promise<void> {
  const result = await new Promise<{
    code: number | null;
    error?: NodeJS.ErrnoException;
    stderr: string;
  }>((resolveRun) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      resolveRun({ code: null, error, stderr });
    });
    child.on("close", (code) => {
      resolveRun({ code, stderr });
    });
  });

  if (result.error) {
    throw new Error(
      `${command} unavailable: ${result.error.message || result.error.code}`,
    );
  }
  if (result.code !== 0) {
    throw new Error(
      `${command} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }
}

async function convertBrandingAsset(
  projectRoot: string,
  body: ConvertBrandingAssetBody,
): Promise<{ outputPath: string }> {
  const sourceAbs = resolveSafePath(projectRoot, body.sourcePath);
  const outputAbs = resolveSafePath(projectRoot, body.outputPath);
  const sourceStats = await fs.lstat(sourceAbs);
  if (!sourceStats.isFile()) throw new Error("sourcePath is not a regular file");
  await refuseUnlessRegularOrMissing(outputAbs);
  await fs.mkdir(dirname(outputAbs), { recursive: true });

  const sourceFormat =
    (typeof body.sourceFormat === "string" ? body.sourceFormat : "")
      .trim()
      .toLowerCase()
      .replace(/^\./, "") ||
    (sourceAbs.toLowerCase().endsWith(".eps")
      ? "eps"
      : sourceAbs.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : "");
  if (!outputAbs.toLowerCase().endsWith(".png")) {
    throw new Error("outputPath must be a .png file");
  }

  await fs.rm(outputAbs, { force: true });
  if (sourceFormat === "pdf") {
    const prefix = outputAbs.slice(0, -4);
    await runAssetTool("pdftoppm", [
      "-f",
      "1",
      "-l",
      "1",
      "-png",
      "-singlefile",
      sourceAbs,
      prefix,
    ]);
  } else if (sourceFormat === "eps") {
    await runAssetTool("magick", [
      "-density",
      "300",
      sourceAbs,
      "-background",
      "none",
      "-alpha",
      "on",
      outputAbs,
    ]);
  } else {
    throw new Error("sourceFormat must be pdf or eps");
  }

  const outputStats = await fs.lstat(outputAbs).catch(() => null);
  if (!outputStats?.isFile()) {
    throw new Error("conversion completed but did not create output");
  }
  return { outputPath: body.outputPath };
}

function safeVideoOutputFilename(job: any, requested?: string): string {
  const format = job?.video?.format === "webm" ? "webm" : "mp4";
  const raw = basename(
    typeof requested === "string" && requested.trim()
      ? requested.trim()
      : typeof job?.video?.filename === "string" && job.video.filename.trim()
        ? job.video.filename.trim()
        : `geosee-capture-video.${format}`,
  );
  const stripped = raw
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${stripped || "geosee-capture-video"}.${format}`;
}

function validateLocalCaptureVideoJob(job: any): string[] {
  const errors: string[] = [];
  if (!job || typeof job !== "object" || Array.isArray(job)) {
    return ["job must be an object"];
  }
  if (job.schema !== "CaptureVideoRenderJobV1") {
    errors.push("job.schema must be CaptureVideoRenderJobV1");
  }
  if (job.version !== 1) {
    errors.push("job.version must be 1");
  }
  if (job.fidelity !== "max-detail-render") {
    errors.push("job.fidelity must be max-detail-render");
  }
  if (!job.recipe || typeof job.recipe !== "object") {
    errors.push("job.recipe is required");
  } else {
    if (job.recipe.mode === "full-ui" || job.recipe.mode === "off") {
      errors.push("job.recipe.mode must be a scene marketing mode");
    }
    if (job.recipe.supersampleScale !== 1) {
      errors.push("job.recipe.supersampleScale must be 1");
    }
  }
  if (!job.video || typeof job.video !== "object") {
    errors.push("job.video is required");
  } else {
    for (const field of ["width", "height", "fps", "totalFrames"] as const) {
      if (!Number.isInteger(job.video[field]) || job.video[field] <= 0) {
        errors.push(`job.video.${field} must be a positive integer`);
      }
    }
    if (job.video.format !== "mp4" && job.video.format !== "webm") {
      errors.push("job.video.format must be mp4 or webm");
    }
  }
  return errors;
}

function captureVideoRunPublicStatus(
  run: CaptureVideoRunRecord,
): Omit<CaptureVideoRunRecord, "child" | "stdout" | "stderr" | "jobPath"> & {
  elapsedSeconds: number;
} {
  const elapsedSeconds = Math.max(
    0,
    Math.floor(
      ((run.completedAt ? Date.parse(run.completedAt) : Date.now()) -
        Date.parse(run.startedAt)) /
        1000,
    ),
  );
  return {
    runId: run.runId,
    status: run.status,
    phase: run.phase,
    startedAt: run.startedAt,
    completedAt: run.completedAt ?? null,
    outputFilename: run.outputFilename,
    outputPath: run.outputPath,
    outputUrl: run.outputUrl,
    diagnosticsPath: run.diagnosticsPath,
    error: run.error ?? null,
    exitCode: run.exitCode ?? null,
    elapsedSeconds,
    renderedFrames: run.renderedFrames ?? 0,
    totalFrames: run.totalFrames ?? null,
    renderer: run.renderer ?? null,
    superscale: run.superscale ?? null,
    masterUrl: run.masterUrl ?? null,
    masterPath: run.masterPath ?? null,
    frameSequenceDir: run.frameSequenceDir ?? null,
  };
}

function captureScrollPackageRunPublicStatus(
  run: CaptureScrollPackageRunRecord,
): Omit<
  CaptureScrollPackageRunRecord,
  "child" | "stdout" | "stderr" | "jobPath" | "request" | "manifest" | "renderJob"
> & {
  elapsedSeconds: number;
} {
  const elapsedSeconds = Math.max(
    0,
    Math.floor(
      ((run.completedAt ? Date.parse(run.completedAt) : Date.now()) -
        Date.parse(run.startedAt)) /
        1000,
    ),
  );
  return {
    runId: run.runId,
    status: run.status,
    phase: run.phase,
    startedAt: run.startedAt,
    completedAt: run.completedAt ?? null,
    packageName: run.packageName,
    packagePath: run.packagePath,
    manifestPath: run.manifestPath,
    manifestUrl: run.manifestUrl,
    outputUrl: run.outputUrl,
    diagnosticsPath: run.diagnosticsPath,
    error: run.error ?? null,
    exitCode: run.exitCode ?? null,
    elapsedSeconds,
    renderedFrames: run.renderedFrames ?? 0,
    totalFrames: run.totalFrames ?? null,
    renderer: run.renderer ?? null,
    superscale: run.superscale ?? null,
    mediaPath: run.mediaPath ?? null,
    mediaUrl: run.mediaUrl ?? null,
    frameSequenceDir: run.frameSequenceDir ?? null,
    warnings: run.warnings ?? [],
  };
}

function pathIsInside(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function resolveContainedRelativePath(projectRoot: string, requested: string): string {
  if (typeof requested !== "string" || requested.trim().length === 0) {
    throw new Error("path is required");
  }
  const normalized = normalize(requested).replace(/\\/g, "/");
  if (isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error("path must be relative and stay inside the project root");
  }
  const abs = resolve(projectRoot, normalized);
  if (!pathIsInside(projectRoot, abs)) {
    throw new Error("path resolves outside the project root");
  }
  return abs;
}

function packageRelativePath(value: string): string {
  const normalized = normalize(value).replace(/\\/g, "/");
  if (
    normalized.length === 0 ||
    isAbsolute(normalized) ||
    normalized.split("/").includes("..") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized)
  ) {
    throw new Error("package path must be package-relative");
  }
  return normalized;
}

function scrollMediaRelativePath(request: CaptureScrollRecordRequestV1): string | null {
  if (request.format === "png-sequence") return null;
  if (request.format === "webm") return "media/scroll-master.webm";
  if (request.format === "scroll-friendly-video") return "media/scroll-friendly.mp4";
  return "media/scroll-master.mp4";
}

async function countCompletedFrames(frameDir: string): Promise<number> {
  const entries = await fs.readdir(frameDir).catch(() => []);
  return entries.filter((entry) => /^frame-\d{6}\.png$/i.test(entry)).length;
}

function frameRelativePath(frameIndex: number): string {
  return `frames/frame-${String(frameIndex).padStart(6, "0")}.png`;
}

async function createScrollPosters(
  packageDir: string,
  request: CaptureScrollRecordRequestV1,
): Promise<ScrollHandoffPackageV1["posters"]> {
  const frames = [
    ["first", request.frameRange.startFrame],
    [
      "middle",
      Math.floor((request.frameRange.startFrame + request.frameRange.endFrame) / 2),
    ],
    ["last", request.frameRange.endFrame],
  ] as const;
  const posters: ScrollHandoffPackageV1["posters"] = [];
  await fs.mkdir(resolve(packageDir, "posters"), { recursive: true });
  for (const [anchorId, frame] of frames) {
    const source = resolve(packageDir, frameRelativePath(frame));
    const stats = await fs.lstat(source).catch(() => null);
    if (!stats?.isFile()) continue;
    const path = `posters/${anchorId}-frame-${String(frame).padStart(6, "0")}.png`;
    await fs.copyFile(source, resolve(packageDir, path));
    posters.push({ anchorId, frame, path });
  }
  return posters;
}

async function writeScrollManifest(
  run: CaptureScrollPackageRunRecord,
  manifest: ScrollHandoffPackageV1,
): Promise<void> {
  const validation = validateScrollHandoffManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid scroll manifest: ${validation.errors.join(" ")}`);
  }
  run.manifest = manifest;
  await fs.writeFile(run.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function writeScrollDiagnostics(
  run: CaptureScrollPackageRunRecord,
  status: CaptureScrollPackageRunRecord["status"],
  error?: string | null,
): Promise<void> {
  const diagnostics = {
    schema: "ScrollPackageRenderDiagnosticsV1",
    status,
    runId: run.runId,
    packageName: run.packageName,
    packagePath: run.packagePath,
    request: run.request,
    renderJob: run.renderJob,
    manifestPath: run.manifestPath,
    mediaPath: run.mediaPath ?? null,
    frameSequenceDir: run.frameSequenceDir ?? null,
    renderedFrames: run.renderedFrames ?? 0,
    totalFrames: run.totalFrames ?? null,
    renderer: run.renderer ?? null,
    superscale: run.superscale ?? null,
    error: error ?? run.error ?? null,
    stdout: run.stdout.slice(-4000),
    stderr: run.stderr.slice(-4000),
  };
  await fs.mkdir(dirname(run.diagnosticsPath), { recursive: true });
  await fs.writeFile(run.diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
}

// The external render tool prints `@progress {json}` lines per phase/frame.
// Translate them into live run-record fields the Capture Director polls.
function applyCaptureVideoProgress(run: CaptureVideoRunRecord, payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const p = payload as {
    phase?: string;
    renderedFrames?: number;
    totalFrames?: number;
    renderer?: string;
    render?: { superscale?: number };
    software?: boolean;
  };
  if (typeof p.renderedFrames === "number") run.renderedFrames = p.renderedFrames;
  if (typeof p.totalFrames === "number") run.totalFrames = p.totalFrames;
  if (typeof p.renderer === "string") run.renderer = p.renderer;
  if (p.render && typeof p.render.superscale === "number") {
    run.superscale = p.render.superscale;
  }
  if (run.status === "cancelled" || run.status === "complete") return;
  if (p.phase === "encode") {
    run.phase = "encoding";
    run.status = "encoding";
  } else if (p.phase === "render" || p.phase === "gpu" || p.phase === "prepare") {
    run.phase = "rendering";
    run.status = "rendering";
  }
}

async function startCaptureVideoRun({
  projectRoot,
  runs,
  body,
}: {
  projectRoot: string;
  runs: Map<string, CaptureVideoRunRecord>;
  body: CaptureVideoRenderBody;
}): Promise<CaptureVideoRunRecord> {
  const job = body.job as any;
  const errors = validateLocalCaptureVideoJob(job);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const runId = randomUUID();
  const outputFilename = safeVideoOutputFilename(job, body.outputFilename);
  const jobsDir = resolve(projectRoot, ".tmp", "capture-video-jobs");
  const outputDir = resolve(projectRoot, ".tmp", "capture-video-outputs");
  await fs.mkdir(jobsDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  const jobPath = resolve(jobsDir, `${runId}.json`);
  const outputPath = resolve(outputDir, `${runId}-${outputFilename}`);
  const diagnosticsPath = `${outputPath}.capture-diagnostics.json`;
  await fs.writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");

  const masterPath = `${outputPath.replace(/\.[^.]+$/, "")}.master.mov`;
  const run: CaptureVideoRunRecord = {
    runId,
    status: "preparing",
    phase: "preparing",
    startedAt: new Date().toISOString(),
    completedAt: null,
    outputFilename,
    outputPath,
    outputUrl: `/api/capture/video-output?runId=${encodeURIComponent(runId)}`,
    diagnosticsPath,
    jobPath,
    stdout: "",
    stderr: "",
    totalFrames:
      typeof job?.video?.totalFrames === "number" ? job.video.totalFrames : undefined,
    renderedFrames: 0,
    masterPath,
    masterUrl: `/api/capture/video-output?runId=${encodeURIComponent(runId)}&variant=master`,
  };
  runs.set(runId, run);

  const args = [
    "tools/render-capture-video-job.mjs",
    "--job",
    jobPath,
    "--out",
    outputPath,
    "--diagnostics",
    diagnosticsPath,
  ];
  if (typeof job?.app?.url === "string" && job.app.url.length > 0) {
    args.push("--app-url", job.app.url);
  }
  if (body.synthetic === true) {
    args.push("--synthetic");
  }

  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  run.child = child;
  run.status = "rendering";
  run.phase = "rendering";

  let stdoutLineBuffer = "";
  child.stdout.on("data", (chunk) => {
    const text = String(chunk);
    run.stdout += text;
    stdoutLineBuffer += text;
    let newlineIndex = stdoutLineBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = stdoutLineBuffer.slice(0, newlineIndex);
      stdoutLineBuffer = stdoutLineBuffer.slice(newlineIndex + 1);
      const marker = line.indexOf("@progress ");
      if (marker >= 0) {
        try {
          applyCaptureVideoProgress(run, JSON.parse(line.slice(marker + 10)));
        } catch {
          // Ignore a malformed progress line.
        }
      }
      newlineIndex = stdoutLineBuffer.indexOf("\n");
    }
  });
  child.stderr.on("data", (chunk) => {
    run.stderr += String(chunk);
    const text = String(chunk);
    if (/frame=\s*\d+/i.test(text)) {
      run.phase = "encoding";
      run.status = "encoding";
    }
  });
  child.on("error", (error: NodeJS.ErrnoException) => {
    run.status = "failed";
    run.phase = "failed";
    run.error = error.message || error.code || "failed to start renderer";
    run.completedAt = new Date().toISOString();
    run.child = undefined;
  });
  child.on("close", async (code) => {
    run.exitCode = code;
    run.completedAt = new Date().toISOString();
    run.child = undefined;
    if (run.status === "cancelled") return;
    if (code !== 0) {
      run.status = "failed";
      run.phase = "failed";
      run.error =
        run.stderr.trim() ||
        run.stdout.trim() ||
        `external video renderer exited with code ${code}`;
      return;
    }
    try {
      const stats = await fs.lstat(outputPath);
      if (!stats.isFile() || stats.size <= 0) {
        throw new Error("external video renderer completed without a non-empty output file");
      }
      run.status = "complete";
      run.phase = "complete";
      run.error = null;
      run.renderedFrames = run.totalFrames ?? run.renderedFrames;
      try {
        const diag = JSON.parse(await fs.readFile(diagnosticsPath, "utf8"));
        if (typeof diag?.frameSequenceDir === "string") {
          run.frameSequenceDir = diag.frameSequenceDir;
        }
        if (typeof diag?.gpu?.renderer === "string") run.renderer = diag.gpu.renderer;
        if (typeof diag?.supersample === "number") run.superscale = diag.supersample;
      } catch {
        // Diagnostics are best-effort enrichment; absence is not fatal.
      }
      const masterStats = run.masterPath
        ? await fs.lstat(run.masterPath).catch(() => null)
        : null;
      if (!masterStats?.isFile() || masterStats.size <= 0) {
        run.masterUrl = null;
      }
    } catch (error) {
      run.status = "failed";
      run.phase = "failed";
      run.error = error instanceof Error ? error.message : String(error);
    }
  });

  return run;
}

async function startCaptureScrollPackageRun({
  projectRoot,
  runs,
  body,
}: {
  projectRoot: string;
  runs: Map<string, CaptureScrollPackageRunRecord>;
  body: CaptureScrollPackageRenderBody;
}): Promise<CaptureScrollPackageRunRecord> {
  const requestValidation = validateScrollRecordRequest(body.request);
  if (!requestValidation.valid) {
    throw new Error(requestValidation.errors.join("; "));
  }
  const request = body.request as CaptureScrollRecordRequestV1;
  const manifest =
    body.manifest && validateScrollHandoffManifest(body.manifest).valid
      ? (body.manifest as ScrollHandoffPackageV1)
      : createPendingScrollHandoffManifest(request);
  const renderJob = body.renderJob as any;
  const renderFormat = request.format === "webm" ? "webm" : "mp4";
  const scrollRenderJob = {
    ...renderJob,
    video: {
      ...renderJob?.video,
      format: renderFormat,
      fps: request.timeline.fps,
      totalFrames: request.frameRange.totalFrames,
      durationSeconds: request.frameRange.totalFrames / request.timeline.fps,
      sourceFrameStart: request.frameRange.startFrame,
      sourceFrameEnd: request.frameRange.endFrame,
      encodingProfile:
        request.format === "scroll-friendly-video"
          ? "scroll-friendly-video"
          : undefined,
    },
  };
  const renderErrors = validateLocalCaptureVideoJob(scrollRenderJob);
  if (renderErrors.length > 0) {
    throw new Error(renderErrors.join("; "));
  }

  const runId = randomUUID();
  const destinationDir = resolveContainedRelativePath(
    projectRoot,
    request.destination || DEFAULT_SCROLL_PACKAGE_OUTPUT_DIR,
  );
  const packageDir = resolve(destinationDir, request.packageName);
  if (!pathIsInside(destinationDir, packageDir)) {
    throw new Error("scroll package path escapes destination");
  }
  if (request.cleanRender) {
    await fs.rm(packageDir, { recursive: true, force: true });
  }
  await fs.mkdir(resolve(packageDir, "media"), { recursive: true });
  await fs.mkdir(resolve(packageDir, "frames"), { recursive: true });
  await fs.mkdir(resolve(packageDir, "diagnostics"), { recursive: true });
  const jobsDir = resolve(projectRoot, ".tmp", "capture-scroll-package-jobs");
  await fs.mkdir(jobsDir, { recursive: true });

  const mediaRelativePath = scrollMediaRelativePath(request);
  const mediaPath = mediaRelativePath ? resolve(packageDir, mediaRelativePath) : null;
  const manifestPath = resolve(packageDir, "scroll-manifest.json");
  const diagnosticsPath = resolve(packageDir, "diagnostics", `${request.packageName}.json`);
  const jobPath = resolve(jobsDir, `${runId}.json`);
  const frameDir = resolve(packageDir, "frames");
  const manifestUrl =
    `/api/capture/scroll-package-output?runId=${encodeURIComponent(runId)}` +
    "&variant=manifest";
  const mediaUrl = mediaRelativePath
    ? `/api/capture/scroll-package-output?runId=${encodeURIComponent(runId)}` +
      `&variant=media&path=${encodeURIComponent(mediaRelativePath)}`
    : null;

  await fs.writeFile(jobPath, `${JSON.stringify(scrollRenderJob, null, 2)}\n`, "utf8");
  await fs.writeFile(
    resolve(packageDir, "diagnostics", "scroll-request.json"),
    `${JSON.stringify(request, null, 2)}\n`,
    "utf8",
  );

  const run: CaptureScrollPackageRunRecord = {
    runId,
    status: "preparing",
    phase: "preparing",
    startedAt: new Date().toISOString(),
    completedAt: null,
    packageName: request.packageName,
    packagePath: packageDir,
    manifestPath,
    manifestUrl,
    outputUrl: mediaUrl ?? manifestUrl,
    diagnosticsPath,
    jobPath,
    request,
    manifest,
    renderJob: scrollRenderJob,
    stdout: "",
    stderr: "",
    totalFrames: request.frameRange.totalFrames,
    renderedFrames: 0,
    mediaPath,
    mediaUrl,
    mediaRelativePath,
    frameSequenceDir: frameDir,
    warnings: [],
  };
  runs.set(runId, run);
  await writeScrollManifest(run, manifest);
  await writeScrollDiagnostics(run, "preparing");

  const args = [
    "tools/render-capture-video-job.mjs",
    "--job",
    jobPath,
    "--diagnostics",
    diagnosticsPath,
    "--frame-dir",
    frameDir,
  ];
  if (mediaPath) {
    args.push("--out", mediaPath);
  }
  if (request.format === "png-sequence") {
    args.push("--frames-only");
  }
  if (typeof scrollRenderJob?.app?.url === "string" && scrollRenderJob.app.url.length > 0) {
    args.push("--app-url", scrollRenderJob.app.url);
  }
  if (body.synthetic === true) {
    args.push("--synthetic");
  }
  args.push("--master", "none");

  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  run.child = child;
  run.status = "rendering";
  run.phase = "rendering";

  let stdoutLineBuffer = "";
  child.stdout.on("data", (chunk) => {
    const text = String(chunk);
    run.stdout += text;
    stdoutLineBuffer += text;
    let newlineIndex = stdoutLineBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = stdoutLineBuffer.slice(0, newlineIndex);
      stdoutLineBuffer = stdoutLineBuffer.slice(newlineIndex + 1);
      const marker = line.indexOf("@progress ");
      if (marker >= 0) {
        try {
          applyCaptureVideoProgress(
            run as unknown as CaptureVideoRunRecord,
            JSON.parse(line.slice(marker + 10)),
          );
        } catch {
          // Ignore malformed progress from renderer stdout.
        }
      }
      newlineIndex = stdoutLineBuffer.indexOf("\n");
    }
  });
  child.stderr.on("data", (chunk) => {
    run.stderr += String(chunk);
    const text = String(chunk);
    if (/frame=\s*\d+/i.test(text) && run.status !== "cancelled") {
      run.phase = "encoding";
      run.status = "encoding";
    }
  });
  child.on("error", async (error: NodeJS.ErrnoException) => {
    run.status = "failed";
    run.phase = "failed";
    run.error = error.message || error.code || "failed to start renderer";
    run.completedAt = new Date().toISOString();
    run.child = undefined;
    const frameCount = await countCompletedFrames(frameDir);
    run.renderedFrames = frameCount;
    const failedManifest = createFinalScrollHandoffManifest({
      manifest: run.manifest,
      status: "failed",
      frames: { directory: "frames", pattern: "frame-%06d.png", count: frameCount },
      diagnosticsPath: `diagnostics/${request.packageName}.json`,
      warnings: [run.error],
    });
    await writeScrollDiagnostics(run, "failed", run.error);
    await writeScrollManifest(run, failedManifest);
  });
  child.on("close", async (code) => {
    run.exitCode = code;
    run.completedAt = new Date().toISOString();
    run.child = undefined;
    if (run.status === "cancelled") return;

    const frameCount = await countCompletedFrames(frameDir);
    run.renderedFrames = frameCount;
    if (code !== 0) {
      run.status = "failed";
      run.phase = "failed";
      run.error =
        run.stderr.trim() ||
        run.stdout.trim() ||
        `scroll package renderer exited with code ${code}`;
      const failedManifest = createFinalScrollHandoffManifest({
        manifest: run.manifest,
        status: "failed",
        frames: { directory: "frames", pattern: "frame-%06d.png", count: frameCount },
        diagnosticsPath: `diagnostics/${request.packageName}.json`,
        warnings: [run.error],
      });
      await writeScrollDiagnostics(run, "failed", run.error);
      await writeScrollManifest(run, failedManifest);
      return;
    }

    try {
      const mediaStats = mediaPath ? await fs.lstat(mediaPath).catch(() => null) : null;
      if (mediaPath && (!mediaStats?.isFile() || mediaStats.size <= 0)) {
        throw new Error("scroll package renderer completed without media output");
      }
      const posters = await createScrollPosters(packageDir, request);
      run.status = "complete";
      run.phase = "complete";
      run.error = null;
      run.renderedFrames = request.frameRange.totalFrames;
      const completeManifest = createFinalScrollHandoffManifest({
        manifest: run.manifest,
        status: "complete",
        media:
          mediaRelativePath && mediaStats?.isFile()
            ? [
                {
                  role:
                    request.format === "webm"
                      ? "delivery"
                      : request.format === "scroll-friendly-video"
                        ? "scroll-friendly"
                        : "primary",
                  path: mediaRelativePath,
                  mimeType: request.format === "webm" ? "video/webm" : "video/mp4",
                  byteLength: mediaStats.size,
                },
              ]
            : [],
        frames: {
          directory: "frames",
          pattern: "frame-%06d.png",
          count: frameCount,
        },
        posters,
        contactSheetPath: null,
        diagnosticsPath: `diagnostics/${request.packageName}.json`,
        warnings: run.warnings,
      });
      await writeScrollDiagnostics(run, "complete");
      await writeScrollManifest(run, completeManifest);
    } catch (error) {
      run.status = "failed";
      run.phase = "failed";
      run.error = error instanceof Error ? error.message : String(error);
      const failedManifest = createFinalScrollHandoffManifest({
        manifest: run.manifest,
        status: "failed",
        frames: { directory: "frames", pattern: "frame-%06d.png", count: frameCount },
        diagnosticsPath: `diagnostics/${request.packageName}.json`,
        warnings: [run.error],
      });
      await writeScrollDiagnostics(run, "failed", run.error);
      await writeScrollManifest(run, failedManifest);
    }
  });

  return run;
}

export function authorWritePlugin(): Plugin {
  return {
    name: "author-write",
    apply: "serve", // dev only -- not present in `vite build` output
    configureServer(server: ViteDevServer) {
      const projectRoot = server.config.root;
      const captureVideoRuns = new Map<string, CaptureVideoRunRecord>();
      const captureScrollPackageRuns = new Map<string, CaptureScrollPackageRunRecord>();

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";

        // GET /projects/<...> -- read-only static serve from the project tree.
        // Used by the OverlayDisplay so image refs in markdown (./img.jpg ->
        // /projects/woodjam/overlays/<id>/img.jpg) resolve in dev. Same path
        // validation as the write endpoints (must normalize under projects/,
        // refuse non-regular files).
        //
        // CRITICAL: skip any request with a query string. Vite uses query
        // params (?import, ?raw, ?url, ?t=, etc.) to mark its own internal
        // transforms of source modules -- including JSON glob imports that
        // loadPages.ts depends on. Letting those fall through to next()
        // hands them back to Vite to transform properly.
        if (
          req.method === "GET" &&
          url.startsWith("/projects/") &&
          !url.includes("?")
        ) {
          try {
            const cleanUrl = url.split("#")[0];
            const requested = decodeURIComponent(cleanUrl.replace(/^\//, ""));
            const abs = resolveSafePath(projectRoot, requested);
            const st = await fs.lstat(abs).catch(() => null);
            if (!st || !st.isFile()) {
              res.statusCode = 404;
              res.end();
              return;
            }
            const buf = await fs.readFile(abs);
            const ext = abs.toLowerCase().split(".").pop() ?? "";
            const mimeMap: Record<string, string> = {
              png: "image/png",
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              gif: "image/gif",
              webp: "image/webp",
              svg: "image/svg+xml",
              pdf: "application/pdf",
              eps: "application/postscript",
              md: "text/markdown",
              json: "application/json",
            };
            res.setHeader(
              "content-type",
              mimeMap[ext] ?? "application/octet-stream",
            );
            res.statusCode = 200;
            res.end(buf);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            res.statusCode = 400;
            res.end(JSON.stringify({ error: msg }));
          }
          return;
        }

        if (req.method === "GET" && url.startsWith("/api/capture/video-output")) {
          try {
            const parsedUrl = new URL(url, "http://127.0.0.1");
            const runId = parsedUrl.searchParams.get("runId") ?? "";
            const variant = parsedUrl.searchParams.get("variant") ?? "playable";
            const run = captureVideoRuns.get(runId);
            if (!run) {
              badRequest(res, "unknown capture video run", 404);
              return;
            }
            if (run.status !== "complete") {
              badRequest(res, "capture video run is not complete", 409);
              return;
            }
            const isMaster = variant === "master";
            const servePath = isMaster ? run.masterPath ?? "" : run.outputPath;
            const stats = servePath ? await fs.lstat(servePath).catch(() => null) : null;
            if (!stats?.isFile() || stats.size <= 0) {
              badRequest(res, `capture video ${variant} output is missing`, 404);
              return;
            }
            const downloadName = isMaster
              ? run.outputFilename.replace(/\.[^.]+$/, "") + ".master.mov"
              : run.outputFilename;
            const contentType = isMaster
              ? "video/quicktime"
              : run.outputFilename.toLowerCase().endsWith(".webm")
                ? "video/webm"
                : "video/mp4";
            res.statusCode = 200;
            res.setHeader("content-type", contentType);
            res.setHeader(
              "content-disposition",
              `attachment; filename="${downloadName.replace(/"/g, "")}"`,
            );
            res.end(await fs.readFile(servePath));
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            badRequest(res, msg, 400);
          }
          return;
        }

        if (req.method === "GET" && url.startsWith("/api/capture/scroll-package-output")) {
          try {
            const parsedUrl = new URL(url, "http://127.0.0.1");
            const runId = parsedUrl.searchParams.get("runId") ?? "";
            const variant = parsedUrl.searchParams.get("variant") ?? "manifest";
            const run = captureScrollPackageRuns.get(runId);
            if (!run) {
              badRequest(res, "unknown scroll package run", 404);
              return;
            }
            let servePath = "";
            let downloadName = "";
            let contentType = "application/octet-stream";
            if (variant === "manifest" || variant === "package") {
              servePath = run.manifestPath;
              downloadName = "scroll-manifest.json";
              contentType = "application/json";
            } else if (variant === "diagnostics") {
              servePath = run.diagnosticsPath;
              downloadName = basename(run.diagnosticsPath);
              contentType = "application/json";
            } else if (variant === "media") {
              if (run.status !== "complete") {
                badRequest(res, "scroll package media is not complete", 409);
                return;
              }
              const requestedPath = parsedUrl.searchParams.get("path") ?? "";
              const relativePath = requestedPath
                ? packageRelativePath(requestedPath)
                : packageRelativePath(run.mediaRelativePath ?? "");
              servePath = resolve(run.packagePath, relativePath);
              if (!pathIsInside(run.packagePath, servePath)) {
                throw new Error("media path escapes package");
              }
              downloadName = basename(servePath);
              contentType = downloadName.toLowerCase().endsWith(".webm")
                ? "video/webm"
                : "video/mp4";
            } else if (variant === "frame") {
              const relativePath = packageRelativePath(
                parsedUrl.searchParams.get("path") ?? "",
              );
              servePath = resolve(run.packagePath, relativePath);
              if (!pathIsInside(run.packagePath, servePath)) {
                throw new Error("frame path escapes package");
              }
              downloadName = basename(servePath);
              contentType = "image/png";
            } else {
              badRequest(res, "unsupported scroll package output variant", 400);
              return;
            }
            const stats = servePath ? await fs.lstat(servePath).catch(() => null) : null;
            if (!stats?.isFile() || stats.size <= 0) {
              badRequest(res, "scroll package output is missing", 404);
              return;
            }
            res.statusCode = 200;
            res.setHeader("content-type", contentType);
            res.setHeader(
              "content-disposition",
              `attachment; filename="${downloadName.replace(/"/g, "")}"`,
            );
            res.end(await fs.readFile(servePath));
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            badRequest(res, msg, 400);
          }
          return;
        }

        if (!url.startsWith("/api/")) return next();
        if (req.method !== "POST") {
          badRequest(res, "method not allowed", 405);
          return;
        }

        try {
          if (url === "/api/capture/video-renderer-availability") {
            ok(res, { available: true });
            return;
          }

          if (url === "/api/capture/render-video") {
            const body = await readJsonBody<CaptureVideoRenderBody>(req);
            const run = await startCaptureVideoRun({
              projectRoot,
              runs: captureVideoRuns,
              body,
            });
            ok(res, captureVideoRunPublicStatus(run));
            return;
          }

          if (url === "/api/capture/video-status") {
            const body = await readJsonBody<CaptureVideoRunBody>(req);
            const run = captureVideoRuns.get(body.runId);
            if (!run) {
              badRequest(res, "unknown capture video run", 404);
              return;
            }
            ok(res, captureVideoRunPublicStatus(run));
            return;
          }

          if (url === "/api/capture/cancel-video") {
            const body = await readJsonBody<CaptureVideoRunBody>(req);
            const run = captureVideoRuns.get(body.runId);
            if (!run) {
              badRequest(res, "unknown capture video run", 404);
              return;
            }
            if (run.child && run.status !== "complete") {
              run.status = "cancelled";
              run.phase = "cancelled";
              run.completedAt = new Date().toISOString();
              run.child.kill();
              await Promise.allSettled([
                fs.rm(run.outputPath, { force: true }),
                fs.rm(run.diagnosticsPath, { force: true }),
              ]);
            }
            ok(res, captureVideoRunPublicStatus(run));
            return;
          }

          if (url === "/api/capture/scroll-package/availability") {
            ok(res, { available: true });
            return;
          }

          if (url === "/api/capture/scroll-package/start") {
            const body = await readJsonBody<CaptureScrollPackageRenderBody>(req);
            const run = await startCaptureScrollPackageRun({
              projectRoot,
              runs: captureScrollPackageRuns,
              body,
            });
            ok(res, captureScrollPackageRunPublicStatus(run));
            return;
          }

          if (url === "/api/capture/scroll-package/status") {
            const body = await readJsonBody<CaptureScrollPackageRunBody>(req);
            const run = captureScrollPackageRuns.get(body.runId);
            if (!run) {
              badRequest(res, "unknown scroll package run", 404);
              return;
            }
            ok(res, captureScrollPackageRunPublicStatus(run));
            return;
          }

          if (url === "/api/capture/scroll-package/cancel") {
            const body = await readJsonBody<CaptureScrollPackageRunBody>(req);
            const run = captureScrollPackageRuns.get(body.runId);
            if (!run) {
              badRequest(res, "unknown scroll package run", 404);
              return;
            }
            if (run.child && run.status !== "complete") {
              run.status = "cancelled";
              run.phase = "cancelled";
              run.completedAt = new Date().toISOString();
              run.child.kill();
              run.child = undefined;
              const frameCount = await countCompletedFrames(resolve(run.packagePath, "frames"));
              run.renderedFrames = frameCount;
              const cancelledManifest = createFinalScrollHandoffManifest({
                manifest: run.manifest,
                status: "cancelled",
                frames: {
                  directory: "frames",
                  pattern: "frame-%06d.png",
                  count: frameCount,
                },
                diagnosticsPath: `diagnostics/${run.request.packageName}.json`,
                warnings: ["cancelled by user"],
              });
              await writeScrollDiagnostics(run, "cancelled", "cancelled by user");
              await writeScrollManifest(run, cancelledManifest);
            }
            ok(res, captureScrollPackageRunPublicStatus(run));
            return;
          }

          if (url === "/api/write-file") {
            const body = await readJsonBody<WriteBody>(req);
            const abs = resolveSafePath(projectRoot, body.path);
            await refuseUnlessRegularOrMissing(abs);
            await assertExpectedContent(body.path, abs, body.expectedContent);
            await fs.mkdir(dirname(abs), { recursive: true });
            const buf =
              body.encoding === "base64"
                ? Buffer.from(body.content, "base64")
                : Buffer.from(body.content, "utf8");
            await fs.writeFile(abs, buf);
            ok(res);
            return;
          }

          if (url === "/api/write-batch") {
            const body = await readJsonBody<WriteBatchBody>(req);
            const files = Array.isArray(body.files) ? body.files : [];
            if (files.length === 0) {
              ok(res);
              return;
            }

            const batchId = `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`;
            const prepared: Array<{
              target: string;
              temp: string;
              content: Buffer;
            }> = [];
            try {
              for (const [index, file] of files.entries()) {
                const target = resolveSafePath(projectRoot, file.path);
                await refuseUnlessRegularOrMissing(target);
                await assertExpectedContent(
                  file.path,
                  target,
                  file.expectedContent,
                );
                const temp = `${target}.geosee-${batchId}-${index}.tmp`;
                await refuseUnlessRegularOrMissing(temp);
                prepared.push({
                  target,
                  temp,
                  content:
                    file.encoding === "base64"
                      ? Buffer.from(file.content, "base64")
                      : Buffer.from(file.content, "utf8"),
                });
              }

              for (const item of prepared) {
                await fs.mkdir(dirname(item.target), { recursive: true });
                await fs.writeFile(item.temp, item.content);
              }
              for (const item of prepared) {
                await fs.rename(item.temp, item.target);
              }
            } catch (e) {
              await Promise.allSettled(
                prepared.map((item) => fs.unlink(item.temp)),
              );
              throw e;
            }
            ok(res);
            return;
          }

          if (url === "/api/read-file") {
            const body = await readJsonBody<ReadBody>(req);
            const abs = resolveSafePath(projectRoot, body.path);
            try {
              const st = await fs.lstat(abs);
              if (!st.isFile()) {
                badRequest(res, "not a regular file");
                return;
              }
              const content = await fs.readFile(abs, "utf8");
              ok(res, { content });
            } catch (e: unknown) {
              if ((e as NodeJS.ErrnoException).code === "ENOENT") {
                ok(res, { content: null });
                return;
              }
              throw e;
            }
            return;
          }

          if (url === "/api/copy-file") {
            const body = await readJsonBody<CopyBody>(req);
            const from = resolveSafePath(projectRoot, body.from);
            const to = resolveSafePath(projectRoot, body.to);
            await refuseUnlessRegularOrMissing(from);
            await refuseUnlessRegularOrMissing(to);
            await fs.mkdir(dirname(to), { recursive: true });
            await fs.copyFile(from, to);
            ok(res);
            return;
          }

          if (url === "/api/delete-file") {
            const body = await readJsonBody<DeleteBody>(req);
            const abs = resolveSafePath(projectRoot, body.path);
            await refuseUnlessRegularOrMissing(abs); // refuses if not a regular file
            try {
              await fs.unlink(abs);
            } catch (e: unknown) {
              if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
            }
            ok(res);
            return;
          }

          if (url === "/api/convert-branding-asset") {
            const body = await readJsonBody<ConvertBrandingAssetBody>(req);
            ok(res, await convertBrandingAsset(projectRoot, body));
            return;
          }

          badRequest(res, "unknown endpoint", 404);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          // eslint-disable-next-line no-console
          console.error(`[author-write] ${url} failed:`, msg);
          badRequest(res, msg, 400);
        }
      });
    },
  };
}
