import type { WebGLRenderer, WebGLRenderTarget } from "three";
import { DataUtils } from "three";

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

// Thrown when the float readback/encode cannot allocate (e.g. 8K RGBA float is
// ~530 MB before the Uint16 copy + encode). Surfaced to the user as a clean error
// instead of an OOM crash.
export class CaptureFloatMemoryError extends Error {
  constructor(width: number, height: number, cause?: unknown) {
    super(
      `16-bit/EXR capture ran out of memory at ${width}x${height}. ` +
        `Use 8-bit PNG/WebP for very large sizes.`,
    );
    this.name = "CaptureFloatMemoryError";
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

// Soft budget: above this the readback + Uint16 copy + JS encode get heavy. With
// supersample forced to 1x for float, the worst case is native 8K.
const CAPTURE_FLOAT_PIXEL_WARN_BUDGET = 7680 * 4320;

// Read the HalfFloat capture target back as raw HALF bits (Uint16), row-flipped
// from WebGL bottom-left origin to top-down image order. Reading a HalfFloat RT as
// FLOAT (Float32Array) returns all zeros on common drivers (incl. ANGLE/SwiftShader)
// — which silently produced transparent-black EXR/PNG output — so the readback uses
// the RT's native HALF format. EXR consumes these half bits directly; png16 / log
// convert to float.
export function readCaptureFloatHalf(
  renderer: WebGLRenderer,
  renderTarget: WebGLRenderTarget,
): { half: Uint16Array<ArrayBuffer>; width: number; height: number } {
  const width = renderTarget.width;
  const height = renderTarget.height;
  if (width * height > CAPTURE_FLOAT_PIXEL_WARN_BUDGET) {
    console.warn(
      `[captureFloatStill] large float readback (${width}x${height}); ` +
        `this allocates ~${Math.round((width * height * 4 * 2) / 1e6)} MB.`,
    );
  }
  try {
    const raw = new Uint16Array(width * height * 4);
    // The RT is HalfFloat: a Uint16Array reads the native HALF bits. three types
    // the buffer param as BufferSource, so cast to the exact param type (runtime
    // behaviour is driven by the array's element type, which is correct here).
    renderer.readRenderTargetPixels(
      renderTarget,
      0,
      0,
      width,
      height,
      raw as unknown as Parameters<WebGLRenderer["readRenderTargetPixels"]>[5],
    );
    const half = new Uint16Array(width * height * 4);
    const rowLen = width * 4;
    for (let y = 0; y < height; y += 1) {
      const src = (height - y - 1) * rowLen;
      half.set(raw.subarray(src, src + rowLen), y * rowLen);
    }
    // Force opaque alpha. The composer target's alpha is not guaranteed to be 1,
    // and a 0 alpha makes the float still fully transparent (the 8-bit path uses
    // an alpha:false canvas, so it is always opaque). Stills are opaque plates.
    const HALF_ONE = DataUtils.toHalfFloat(1);
    for (let i = 3; i < half.length; i += 4) {
      half[i] = HALF_ONE;
    }
    return { half, width, height };
  } catch (error) {
    throw new CaptureFloatMemoryError(width, height, error);
  }
}

// Read the HalfFloat capture target back as linear float RGBA (via the HALF read +
// half->float conversion), row-flipped to top-down image order.
export function readCaptureFloatPixels(
  renderer: WebGLRenderer,
  renderTarget: WebGLRenderTarget,
): { data: Float32Array; width: number; height: number } {
  const { half, width, height } = readCaptureFloatHalf(renderer, renderTarget);
  const data = new Float32Array(half.length);
  for (let i = 0; i < half.length; i += 1) {
    data[i] = DataUtils.fromHalfFloat(half[i]);
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

// EXR (HalfFloat). Encodes from a HalfFloat DataTexture built from the native HALF
// readback (the renderer+target form reads the RT as FLOAT, which returns zeros on
// common drivers). For the log path the half bits are converted to float, log-
// encoded, and re-quantized to half.
export async function encodeCaptureExr(
  renderer: WebGLRenderer,
  renderTarget: WebGLRenderTarget,
  options: { log?: boolean } = {},
): Promise<Blob> {
  const { EXRExporter } = await import(
    "three/examples/jsm/exporters/EXRExporter.js"
  );
  const THREE = await import("three");
  const { half, width, height } = readCaptureFloatHalf(renderer, renderTarget);
  if (options.log) {
    for (let i = 0; i < half.length; i += 1) {
      // RGB only (channel 3 = alpha, left as-is).
      if (i % 4 !== 3) {
        half[i] = DataUtils.toHalfFloat(
          captureLogEncode(DataUtils.fromHalfFloat(half[i])),
        );
      }
    }
  }
  const texture = new THREE.DataTexture(
    half,
    width,
    height,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  texture.needsUpdate = true;
  const exporter = new EXRExporter();
  const out = await exporter.parse(texture, { type: THREE.HalfFloatType });
  texture.dispose();
  return new Blob([toUint8ArrayBlobPart(out)], { type: "image/x-exr" });
}

export interface CaptureFloatOverlay {
  data: ArrayLike<number>; // RGBA8, top-down, length width*height*4
  width: number;
  height: number;
}

// Straight alpha-composite an 8-bit display overlay (title/page chrome) over the
// display-referred float pixels. 16-bit PNG is a display deliverable, so it
// carries the overlay; EXR stays clean. No-op if dimensions mismatch.
export function compositeOverlayOntoFloat(
  rgba: Float32Array,
  width: number,
  height: number,
  overlay: CaptureFloatOverlay,
): void {
  if (overlay.width !== width || overlay.height !== height) return;
  const o = overlay.data;
  const count = width * height;
  for (let i = 0; i < count; i += 1) {
    const a = (Number(o[i * 4 + 3]) || 0) / 255;
    if (a <= 0) continue;
    const ia = 1 - a;
    rgba[i * 4] = rgba[i * 4] * ia + (Number(o[i * 4]) / 255) * a;
    rgba[i * 4 + 1] = rgba[i * 4 + 1] * ia + (Number(o[i * 4 + 1]) / 255) * a;
    rgba[i * 4 + 2] = rgba[i * 4 + 2] * ia + (Number(o[i * 4 + 2]) / 255) * a;
    // Output alpha stays opaque.
  }
}

// 16-bit PNG via fast-png. Reads the float target, optional log transfer, optional
// overlay composite, then quantizes to 16-bit integer RGBA.
export async function encodeCapturePng16(
  renderer: WebGLRenderer,
  renderTarget: WebGLRenderTarget,
  options: { log?: boolean; overlay?: CaptureFloatOverlay } = {},
): Promise<Blob> {
  const { encode } = await import("fast-png");
  const { data, width, height } = readCaptureFloatPixels(renderer, renderTarget);
  if (options.log) applyCaptureLogTransfer(data);
  if (options.overlay) {
    compositeOverlayOntoFloat(data, width, height, options.overlay);
  }
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
