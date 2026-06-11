import type {
  CaptureVideoEncodeProgress,
  FfmpegFrameSequenceRuntime,
  FfmpegFrameSequenceRuntimeExecOptions,
} from "./frameSequenceVideoEncoder";

export interface BrowserFfmpegProgressEvent {
  progress?: number;
  time?: number;
  timeMs?: number;
  message?: string;
}

export interface BrowserFfmpegLogEvent {
  type?: string;
  message?: string;
}

export interface BrowserFfmpegInstance {
  load(options?: unknown, runtimeOptions?: { signal?: AbortSignal }): Promise<unknown>;
  writeFile(
    path: string,
    data: Uint8Array,
    runtimeOptions?: { signal?: AbortSignal },
  ): Promise<unknown>;
  exec(
    args: string[],
    timeout?: number,
    runtimeOptions?: { signal?: AbortSignal },
  ): Promise<unknown>;
  readFile(
    path: string,
    encoding?: string,
    runtimeOptions?: { signal?: AbortSignal },
  ): Promise<unknown>;
  deleteFile?(path: string, runtimeOptions?: { signal?: AbortSignal }): Promise<unknown>;
  createDir?(path: string, runtimeOptions?: { signal?: AbortSignal }): Promise<unknown>;
  on?(
    event: "progress" | "log",
    handler: (event: BrowserFfmpegProgressEvent | BrowserFfmpegLogEvent) => void,
  ): void;
  off?(
    event: "progress" | "log",
    handler: (event: BrowserFfmpegProgressEvent | BrowserFfmpegLogEvent) => void,
  ): void;
  terminate?(): void;
}

export interface BrowserFfmpegModule {
  FFmpeg?: new () => BrowserFfmpegInstance;
  default?: {
    FFmpeg?: new () => BrowserFfmpegInstance;
  };
}

declare global {
  interface Window {
    __captureDirectorFfmpegModule?:
      | BrowserFfmpegModule
      | (() => BrowserFfmpegModule | Promise<BrowserFfmpegModule>);
  }
}

export interface BrowserFfmpegRuntimeOptions {
  ffmpeg?: BrowserFfmpegInstance;
  loadModule?: () => Promise<BrowserFfmpegModule>;
  loadOptions?: BrowserFfmpegLoadOptions;
  signal?: AbortSignal;
  skipLoad?: boolean;
}

export interface BrowserFfmpegLoadOptions {
  coreURL: string;
  wasmURL: string;
  workerURL?: string;
}

const FFMPEG_CORE_ASSET_BASE_PATH = "/runtime/ffmpeg/";
const FFMPEG_CORE_JS_PATH = "/runtime/ffmpeg/ffmpeg-core.js";
const FFMPEG_CORE_WASM_PATH = "/runtime/ffmpeg/ffmpeg-core.wasm";
const FFMPEG_CORE_WORKER_PATH = "/runtime/ffmpeg/ffmpeg-core.worker.js";
const FFMPEG_CORE_JS_FILENAME = "ffmpeg-core.js";
const FFMPEG_CORE_WASM_FILENAME = "ffmpeg-core.wasm";
const FFMPEG_CORE_WORKER_FILENAME = "ffmpeg-core.worker.js";

export interface BrowserFfmpegRuntimeHandle {
  runtime: FfmpegFrameSequenceRuntime;
  dispose(): void;
}

export function hasBrowserFfmpegFrameSequenceRuntimePrerequisites(): boolean {
  return typeof Uint8Array !== "undefined" && typeof Blob !== "undefined";
}

export function captureFfmpegCoreAssetUrls(
  basePath = FFMPEG_CORE_ASSET_BASE_PATH,
): BrowserFfmpegLoadOptions {
  const documentBase =
    typeof document !== "undefined" && document.baseURI
      ? document.baseURI
      : typeof window !== "undefined"
        ? window.location.href
        : "http://localhost/";
  if (basePath === FFMPEG_CORE_ASSET_BASE_PATH) {
    return {
      coreURL: new URL(FFMPEG_CORE_JS_PATH, documentBase).href,
      wasmURL: new URL(FFMPEG_CORE_WASM_PATH, documentBase).href,
      workerURL: new URL(FFMPEG_CORE_WORKER_PATH, documentBase).href,
    };
  }
  const baseUrl = new URL(basePath, documentBase);
  return {
    coreURL: new URL(FFMPEG_CORE_JS_FILENAME, baseUrl).href,
    wasmURL: new URL(FFMPEG_CORE_WASM_FILENAME, baseUrl).href,
    workerURL: new URL(FFMPEG_CORE_WORKER_FILENAME, baseUrl).href,
  };
}

export function defaultBrowserFfmpegLoadOptions(): BrowserFfmpegLoadOptions {
  return captureFfmpegCoreAssetUrls("/runtime/ffmpeg/");
}

function captureDirectorTestSeamsAllowed(): boolean {
  const env = (import.meta as ImportMeta & {
    env?: { DEV?: boolean; MODE?: string };
  }).env;
  if (env?.DEV || env?.MODE === "test") return true;
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1"
  );
}

export async function loadBrowserFfmpegModule(): Promise<BrowserFfmpegModule> {
  const override =
    typeof window !== "undefined" && captureDirectorTestSeamsAllowed()
      ? window.__captureDirectorFfmpegModule
      : null;
  if (override) {
    return typeof override === "function" ? await override() : override;
  }
  return import("@ffmpeg/ffmpeg") as Promise<BrowserFfmpegModule>;
}

function createFfmpegFromModule(module: BrowserFfmpegModule): BrowserFfmpegInstance {
  const FfmpegConstructor = module.FFmpeg ?? module.default?.FFmpeg;
  if (typeof FfmpegConstructor !== "function") {
    throw new Error("Browser FFmpeg module did not expose an FFmpeg constructor.");
  }
  return new FfmpegConstructor();
}

function normalizeReadFileData(path: string, data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error(`Browser FFmpeg readFile did not return bytes for ${path}.`);
}

function normalizeProgressEvent(
  event: BrowserFfmpegProgressEvent,
): CaptureVideoEncodeProgress {
  const rawProgress =
    typeof event.progress === "number" && Number.isFinite(event.progress)
      ? event.progress
      : undefined;
  return {
    phase: "encoding",
    ...(rawProgress === undefined ? {} : { ffmpegProgress: rawProgress }),
    ...(typeof event.time === "number" && Number.isFinite(event.time)
      ? { ffmpegTimeSeconds: event.time }
      : typeof event.timeMs === "number" && Number.isFinite(event.timeMs)
        ? { ffmpegTimeSeconds: event.timeMs / 1000 }
        : {}),
    ...(typeof event.message === "string" && event.message
      ? { message: event.message }
      : {}),
  };
}

function normalizeLogEvent(event: BrowserFfmpegLogEvent): CaptureVideoEncodeProgress {
  return {
    phase: "encoding",
    ...(typeof event.message === "string" && event.message
      ? {
          log: event.message,
          message: event.message,
        }
      : {}),
  };
}

// FFmpeg core runs on an Emscripten MEMFS where `writeFile` does not create
// missing parent directories. Frame encoders write into virtual subdirectories
// (e.g. `/geosee-capture/frame-000000.png`), so the directory must be created
// first or the write fails with "FS error". Returns each ancestor directory of
// a file path, shallowest first, excluding the root.
function ancestorDirectories(path: string): string[] {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  segments.pop(); // drop the filename
  const directories: string[] = [];
  let current = "";
  for (const segment of segments) {
    current += `/${segment}`;
    directories.push(current);
  }
  return directories;
}

export function createBrowserFfmpegFrameSequenceRuntime(
  options: BrowserFfmpegRuntimeOptions = {},
): BrowserFfmpegRuntimeHandle {
  let disposed = false;
  const ensuredDirectories = new Set<string>();
  let ffmpeg: BrowserFfmpegInstance | null = options.ffmpeg ?? null;
  let ffmpegPromise: Promise<BrowserFfmpegInstance> | null = null;

  function runtimeOptions(): { signal?: AbortSignal } | undefined {
    return options.signal ? { signal: options.signal } : undefined;
  }

  function assertActive(): void {
    if (disposed) {
      throw new Error("Browser FFmpeg runtime has been disposed.");
    }
  }

  async function resolveFfmpeg(): Promise<BrowserFfmpegInstance> {
    assertActive();
    if (!ffmpegPromise) {
      ffmpegPromise = (async () => {
        const instance =
          ffmpeg ??
          createFfmpegFromModule(
            await (options.loadModule ?? loadBrowserFfmpegModule)(),
          );
        ffmpeg = instance;
        if (!options.skipLoad) {
          await ffmpeg.load(
            options.loadOptions ?? defaultBrowserFfmpegLoadOptions(),
            runtimeOptions(),
          );
        }
        return ffmpeg;
      })().catch((error) => {
        ffmpegPromise = null;
        throw error;
      });
    }
    return ffmpegPromise;
  }

  async function ensureParentDirectories(
    activeFfmpeg: BrowserFfmpegInstance,
    path: string,
  ): Promise<void> {
    if (!activeFfmpeg.createDir) return;
    for (const directory of ancestorDirectories(path)) {
      if (ensuredDirectories.has(directory)) continue;
      try {
        await activeFfmpeg.createDir(directory, runtimeOptions());
      } catch {
        // The directory already exists, which MEMFS reports as an error.
      }
      ensuredDirectories.add(directory);
    }
  }

  const runtime: FfmpegFrameSequenceRuntime = {
    async writeFile(path, data) {
      const activeFfmpeg = await resolveFfmpeg();
      await ensureParentDirectories(activeFfmpeg, path);
      await activeFfmpeg.writeFile(path, data, runtimeOptions());
    },
    async exec(args, execOptions?: FfmpegFrameSequenceRuntimeExecOptions) {
      const activeFfmpeg = await resolveFfmpeg();
      const onProgress = execOptions?.onProgress;
      const progressHandler = (event: BrowserFfmpegProgressEvent | BrowserFfmpegLogEvent) => {
        onProgress?.(normalizeProgressEvent(event as BrowserFfmpegProgressEvent));
      };
      const logHandler = (event: BrowserFfmpegProgressEvent | BrowserFfmpegLogEvent) => {
        onProgress?.(normalizeLogEvent(event as BrowserFfmpegLogEvent));
      };
      activeFfmpeg.on?.("progress", progressHandler);
      activeFfmpeg.on?.("log", logHandler);
      try {
        const code = await activeFfmpeg.exec(
          args,
          execOptions?.timeoutMs,
          runtimeOptions(),
        );
        if (typeof code === "number" && code !== 0) {
          throw new Error(`FFmpeg exited with code ${code}.`);
        }
      } finally {
        activeFfmpeg.off?.("progress", progressHandler);
        activeFfmpeg.off?.("log", logHandler);
      }
    },
    async readFile(path) {
      const activeFfmpeg = await resolveFfmpeg();
      return normalizeReadFileData(
        path,
        await activeFfmpeg.readFile(path, undefined, runtimeOptions()),
      );
    },
    async deleteFile(path) {
      const activeFfmpeg = await resolveFfmpeg();
      await activeFfmpeg.deleteFile?.(path, runtimeOptions());
    },
  };

  return {
    runtime,
    dispose() {
      if (disposed) return;
      disposed = true;
      ffmpeg?.terminate?.();
    },
  };
}
