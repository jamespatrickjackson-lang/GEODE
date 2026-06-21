import type { WebGLRenderer, WebGLRenderTarget } from "three";

// Float / high-bit-depth still encoders for the capture pipeline. The capture
// composer renders to a HalfFloat target (see scene.ts renderCaptureFloatTarget);
// these helpers turn that target into EXR (HalfFloat) or 16-bit PNG output, with
// an optional log transfer for grading latitude. Kept dependency-light (three +
// fast-png are imported dynamically) so the still exporter's 8-bit path is not
// burdened when float capture is unused.

// Optional log transfer: normalized log2-stops about mid-gray (0.18) across
// [-8, +6] stops -> [0, 1]. Compresses scene-linear HDR range into the channel so
// 16-bit/EXR output carries grading latitude; monotonic and invertible. Applied
// to RGB only; alpha is left linear.
export const CAPTURE_LOG_MIN_STOP = -8;
export const CAPTURE_LOG_MAX_STOP = 6;
export const CAPTURE_LOG_PIVOT = 0.18;
const CAPTURE_LOG_RANGE = CAPTURE_LOG_MAX_STOP - CAPTURE_LOG_MIN_STOP;

export function captureLogEncode(value: number): number {
  const v = Math.max(value, 1e-6) / CAPTURE_LOG_PIVOT;
  const stops = Math.log2(v);
  const n = (stops - CAPTURE_LOG_MIN_STOP) / CAPTURE_LOG_RANGE;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function applyCaptureLogTransfer(rgba: Float32Array): void {
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = captureLogEncode(rgba[i]);
    rgba[i + 1] = captureLogEncode(rgba[i + 1]);
    rgba[i + 2] = captureLogEncode(rgba[i + 2]);
    // rgba[i + 3] (alpha) left unchanged.
  }
}

// Read the HalfFloat capture target back as linear float RGBA, row-flipped from
// WebGL bottom-left origin to top-down image order.
export function readCaptureFloatPixels(
  renderer: WebGLRenderer,
  renderTarget: WebGLRenderTarget,
): { data: Float32Array; width: number; height: number } {
  const width = renderTarget.width;
  const height = renderTarget.height;
  const raw = new Float32Array(width * height * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, raw);
  const data = new Float32Array(width * height * 4);
  const rowLen = width * 4;
  for (let y = 0; y < height; y += 1) {
    const src = (height - y - 1) * rowLen;
    data.set(raw.subarray(src, src + rowLen), y * rowLen);
  }
  return { data, width, height };
}

function toUint8ArrayBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  // Normalize to a plain ArrayBuffer-backed view so it is a valid BlobPart
  // regardless of the source's ArrayBufferLike generic.
  if (bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0) {
    return bytes as Uint8Array<ArrayBuffer>;
  }
  return new Uint8Array(bytes) as Uint8Array<ArrayBuffer>;
}

// EXR (HalfFloat). Linear path uses EXRExporter's renderer+target form (it reads
// the target back internally). The log path reads the pixels, transforms, and
// re-encodes from a HalfFloat DataTexture.
export async function encodeCaptureExr(
  renderer: WebGLRenderer,
  renderTarget: WebGLRenderTarget,
  options: { log?: boolean } = {},
): Promise<Blob> {
  const { EXRExporter } = await import(
    "three/examples/jsm/exporters/EXRExporter.js"
  );
  const exporter = new EXRExporter();
  if (!options.log) {
    const data = await exporter.parse(renderer, renderTarget);
    return new Blob([toUint8ArrayBlobPart(data)], { type: "image/x-exr" });
  }
  const THREE = await import("three");
  const { data, width, height } = readCaptureFloatPixels(renderer, renderTarget);
  applyCaptureLogTransfer(data);
  const half = new Uint16Array(width * height * 4);
  for (let i = 0; i < data.length; i += 1) {
    half[i] = THREE.DataUtils.toHalfFloat(data[i]);
  }
  const texture = new THREE.DataTexture(
    half,
    width,
    height,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  texture.needsUpdate = true;
  const out = await exporter.parse(texture, { type: THREE.HalfFloatType });
  texture.dispose();
  return new Blob([toUint8ArrayBlobPart(out)], { type: "image/x-exr" });
}

// 16-bit PNG via fast-png. Reads the float target, optional log transfer, then
// quantizes to 16-bit integer RGBA.
export async function encodeCapturePng16(
  renderer: WebGLRenderer,
  renderTarget: WebGLRenderTarget,
  options: { log?: boolean } = {},
): Promise<Blob> {
  const { encode } = await import("fast-png");
  const { data, width, height } = readCaptureFloatPixels(renderer, renderTarget);
  if (options.log) applyCaptureLogTransfer(data);
  const u16 = quantizeFloatToUint16(data);
  const png = encode({ width, height, depth: 16, channels: 4, data: u16 });
  return new Blob([toUint8ArrayBlobPart(png)], { type: "image/png" });
}

export function quantizeFloatToUint16(data: Float32Array): Uint16Array {
  const u16 = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    const v = data[i];
    u16[i] = v <= 0 ? 0 : v >= 1 ? 65535 : Math.round(v * 65535);
  }
  return u16;
}
