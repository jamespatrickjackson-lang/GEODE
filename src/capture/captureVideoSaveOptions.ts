export type CaptureVideoFileType = "webm" | "mp4";

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

export interface SaveCaptureVideoBlobOptions {
  blob: Blob;
  filename: string;
  type: CaptureVideoFileType;
  picker?: SaveFilePicker | null;
}

export type SaveCaptureVideoBlobResult =
  | { status: "saved" }
  | { status: "unavailable" }
  | { status: "cancelled" };

const CAPTURE_VIDEO_MIME_TYPES: Record<CaptureVideoFileType, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
};

const CAPTURE_VIDEO_EXTENSIONS: Record<CaptureVideoFileType, string> = {
  mp4: "mp4",
  webm: "webm",
};

export function captureVideoMimeType(type: CaptureVideoFileType): string {
  return CAPTURE_VIDEO_MIME_TYPES[type] ?? CAPTURE_VIDEO_MIME_TYPES.webm;
}

export function captureVideoExtension(type: CaptureVideoFileType): string {
  return CAPTURE_VIDEO_EXTENSIONS[type] ?? CAPTURE_VIDEO_EXTENSIONS.webm;
}

export function captureVideoFilename(
  basename: string,
  type: CaptureVideoFileType,
): string {
  const safeBase = basename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeBase || "geosee-video"}.${captureVideoExtension(type)}`;
}

export function validateCaptureVideoBlob(blob: Blob, label = "video"): void {
  if (!blob || blob.size <= 0) {
    throw new Error(`${label} produced no video data.`);
  }
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

export async function saveCaptureVideoBlobWithPicker({
  blob,
  filename,
  type,
  picker = defaultSaveFilePicker(),
}: SaveCaptureVideoBlobOptions): Promise<SaveCaptureVideoBlobResult> {
  validateCaptureVideoBlob(blob, "Capture video");
  if (!picker) return { status: "unavailable" };
  try {
    const mimeType = captureVideoMimeType(type);
    const extension = captureVideoExtension(type);
    const handle = await picker({
      suggestedName: captureVideoFilename(filename, type),
      types: [
        {
          description: `${type.toUpperCase()} video`,
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
