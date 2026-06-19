// Dependency-free decision helpers for the headless capture render job. Extracted
// so the GPU/software-fallback and FFmpeg-path precedence logic can be unit tested
// without launching Chromium or importing ffmpeg-static.

// Chromium reports these renderer strings when it falls back to software
// rasterization (SwiftShader / llvmpipe / "basic render") instead of the GPU.
export const SOFTWARE_RENDERER_PATTERN = /swiftshader|software|llvmpipe|basic render/i;

// Decide whether a render should proceed given the detected GPU renderer.
// `gpu` is whether GPU launch flags were requested; `allowSoftware` overrides a
// software-fallback rejection. Returns the software flag, whether to reject, and
// the rejection reason (null when not rejected).
export function evaluateRenderGpu(gpuInfo, { gpu = true, allowSoftware = false } = {}) {
  const renderer = (gpuInfo && typeof gpuInfo.renderer === "string"
    ? gpuInfo.renderer
    : "");
  const software = SOFTWARE_RENDERER_PATTERN.test(renderer);
  const reject = Boolean(gpu && software && !allowSoftware);
  return {
    software,
    reject,
    reason: reject
      ? `GPU did not engage (renderer: "${renderer}"). The render would fall back to ` +
        `software rasterization. Pass --allow-software to proceed anyway.`
      : null,
  };
}

// Pure FFmpeg path chooser: FFMPEG_PATH env wins, then the ffmpeg-static path,
// then the PATH fallback ("ffmpeg"). Wired by resolveFfmpegPath with the real
// sources; isolated here so precedence is testable without env leakage.
export function chooseFfmpegPath({
  envPath = null,
  staticPath = null,
  pathFallback = "ffmpeg",
} = {}) {
  if (typeof envPath === "string" && envPath.length > 0) return envPath;
  if (typeof staticPath === "string" && staticPath.length > 0) return staticPath;
  return pathFallback;
}
