export type CaptureStillImageType = "png" | "webp" | "jpeg";

export interface CaptureStillSaveOptions {
  type: CaptureStillImageType;
  quality?: number;
}

export interface CaptureStillSaveValidationResult {
  valid: boolean;
  errors: string[];
}

interface SaveFileWritable {
  write(blob: Blob): Promise<void> | void;
  close(): Promise<void> | void;
}

interface SaveFileHandle {
  createWritable(): Promise<SaveFileWritable>;
}

type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<SaveFileHandle>;

export interface SaveCaptureStillBlobOptions {
  blob: Blob;
  filename: string;
  type: CaptureStillImageType;
  picker?: SaveFilePicker | null;
}

export type SaveCaptureStillBlobResult =
  | { status: "saved" }
  | { status: "unavailable" }
  | { status: "cancelled" };

const CAPTURE_STILL_MIME_TYPES: Record<CaptureStillImageType, string> = {
  png: "image/png",
  webp: "image/webp",
  jpeg: "image/jpeg",
};

const CAPTURE_STILL_EXTENSIONS: Record<CaptureStillImageType, string> = {
  png: "png",
  webp: "webp",
  jpeg: "jpg",
};

export function captureStillMimeType(type: CaptureStillImageType): string {
  return CAPTURE_STILL_MIME_TYPES[type] ?? CAPTURE_STILL_MIME_TYPES.png;
}

export function captureStillExtension(type: CaptureStillImageType): string {
  return CAPTURE_STILL_EXTENSIONS[type] ?? CAPTURE_STILL_EXTENSIONS.png;
}

export function normalizeCaptureStillQuality(
  type: CaptureStillImageType,
  quality: number | undefined,
): number | undefined {
  if (type === "png") return undefined;
  const fallback = type === "jpeg" ? 0.92 : 0.9;
  const candidate =
    typeof quality === "number" && Number.isFinite(quality) ? quality : fallback;
  return Math.max(0.01, Math.min(1, candidate));
}

export function validateCaptureStillSaveOptions(
  options: Partial<CaptureStillSaveOptions>,
): CaptureStillSaveValidationResult {
  const errors: string[] = [];
  if (
    options.type !== "png" &&
    options.type !== "webp" &&
    options.type !== "jpeg"
  ) {
    errors.push("Screen Capture type must be PNG, WebP, or JPEG.");
  }
  if (
    options.type !== "png" &&
    (typeof options.quality !== "number" ||
      !Number.isFinite(options.quality) ||
      options.quality < 0.01 ||
      options.quality > 1)
  ) {
    errors.push("Screen Capture quality must be between 0.01 and 1.");
  }
  return { valid: errors.length === 0, errors };
}

export function captureStillFilename(
  basename: string,
  type: CaptureStillImageType,
): string {
  const safeBase = basename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeBase || "geosee-screen-capture"}.${captureStillExtension(type)}`;
}

function defaultSaveFilePicker(): SaveFilePicker | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as Window & { showSaveFilePicker?: SaveFilePicker })
    .showSaveFilePicker;
  return typeof candidate === "function" ? candidate.bind(window) : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function saveCaptureStillBlobWithPicker({
  blob,
  filename,
  type,
  picker = defaultSaveFilePicker(),
}: SaveCaptureStillBlobOptions): Promise<SaveCaptureStillBlobResult> {
  if (!picker) return { status: "unavailable" };
  try {
    const mimeType = captureStillMimeType(type);
    const extension = captureStillExtension(type);
    const handle = await picker({
      suggestedName: filename,
      types: [
        {
          description: `${type.toUpperCase()} image`,
          accept: {
            [mimeType]: [`.${extension}`],
          },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { status: "saved" };
  } catch (error) {
    if (isAbortError(error)) return { status: "cancelled" };
    throw error;
  }
}
