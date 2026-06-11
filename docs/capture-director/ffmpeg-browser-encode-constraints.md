# FFmpeg Browser Encode Constraints

Render Out and Convert-Preview-to-MP4 encode sub-4K video in the browser
through the `@ffmpeg/ffmpeg` WASM runtime. Three integration constraints are
load-bearing. Breaking any one stops every in-browser encode before a file is
produced, and the failures are silent or cryptic. Keep all three when touching
`vite.config.ts`, `src/capture/browserFfmpegRuntime.ts`, the FFmpeg core asset
serving, or the `@ffmpeg/*` dependency versions.

## 1. `@ffmpeg/ffmpeg` must stay out of the Vite dep optimizer

`@ffmpeg/ffmpeg` 0.12.x starts its class worker with
`new Worker(new URL("./worker.js", import.meta.url), { type: "module" })`.
Vite's esbuild dependency pre-bundler does not emit that worker file, so the
optimized graph points at a missing `node_modules/.vite/deps/worker.js` and
`ffmpeg.load()` never resolves. The encode hangs with no thrown error and no
console output.

- Guard: `optimizeDeps.exclude` in `vite.config.ts` must list `@ffmpeg/ffmpeg`.
- Symptom if removed: Render Out sits in "Encoding" forever; dev server logs
  `The file does not exist at ".vite/deps/worker.js?worker_file&type=module"`.

## 2. The served FFmpeg core must be the ESM build, not UMD

The class worker is a module worker (`type: "module"`) and loads the core with
dynamic `import()`. The UMD build (`@ffmpeg/core/dist/umd/`) is not an ES module
and cannot be imported that way.

- Guard: `FFMPEG_CORE_ASSET_DIR` in `vite.config.ts` must resolve
  `@ffmpeg/core/dist/esm/` (`ffmpeg-core.js`, `ffmpeg-core.wasm`). This is used
  by both the dev middleware and the production `closeBundle` copy.
- Symptom if reverted to UMD: `ffmpeg.load()` rejects with
  `failed to import ffmpeg-core.js`.
- Note: the single-threaded `@ffmpeg/core` ships no `ffmpeg-core.worker.js`;
  only the threaded `@ffmpeg/core-mt` does. Switching cores changes both the
  asset set and the cross-origin-isolation (COOP/COEP) requirements.

## 3. MEMFS parent directories must be created before `writeFile`

The FFmpeg core runs on an Emscripten MEMFS where `writeFile` does not create
missing parent directories. Frame encoders write into virtual subdirectories
(`/geosee-capture/frame-NNNNNN.png`, `/geosee-preview-transcode/...`), so the
directory must exist first.

- Guard: `createBrowserFfmpegFrameSequenceRuntime` in
  `src/capture/browserFfmpegRuntime.ts` creates each ancestor directory before
  `writeFile` (idempotent, tracked per runtime). Any new MEMFS write path
  inherits this automatically; do not write frames to a bare subdirectory from a
  runtime that lacks this guard.
- Symptom if removed: the first frame write throws `ErrnoError: FS error` and
  the encode aborts.

## Verification

A headless-browser probe is the cheapest end-to-end check: serve the app on a
scoped dev port, import `/src/capture/browserFfmpegRuntime.ts` in a same-origin
page, write a few canvas-generated PNG frames into `/geosee-capture/`, run an
`libx264 -pix_fmt yuv420p` encode, and read the output back. A non-empty MP4
exercises all three constraints. Source tests (`tests/tools/capture-director-*`)
and `tsc -b` do not catch any of the three, because each is a runtime/browser
integration concern, not a type or source-pattern concern.

## Routing reminder

Only renders at 4K or higher route to the external/local renderer
(`shouldDefaultToExternalVideoRenderJob`). Everything below 4K uses this browser
path, so these constraints govern the common case, not an edge case.
