import type { CaptureValidationResult } from "./captureTypes";

export type ScrollHandoffPackageStatus =
  | "complete"
  | "partial"
  | "cancelled"
  | "failed";

export interface ScrollHandoffPackageV1 {
  schema: "ScrollHandoffPackageV1";
  version: 1;
  packageId: string;
  status: ScrollHandoffPackageStatus;
  createdAt: string;
  outputProfileId: string;
  fps: number;
  durationSeconds: number;
  frameRange: { startFrame: number; endFrame: number; totalFrames: number };
  media: Array<{
    role: "primary" | "delivery" | "scroll-friendly";
    path: string;
    mimeType: string;
    byteLength?: number;
  }>;
  frames: { directory: string | null; pattern: string | null; count: number };
  posters: Array<{ anchorId: string; frame: number; path: string }>;
  contactSheetPath: string | null;
  sourceContract: Record<string, unknown>;
  diagnosticsPath: string | null;
  hashes: Array<{ path: string; sha256: string }>;
  warnings: string[];
}

export type CreateScrollHandoffManifestInput = Omit<
  ScrollHandoffPackageV1,
  | "schema"
  | "version"
  | "media"
  | "frames"
  | "posters"
  | "contactSheetPath"
  | "diagnosticsPath"
  | "hashes"
  | "warnings"
> &
  Partial<
    Pick<
      ScrollHandoffPackageV1,
      | "media"
      | "frames"
      | "posters"
      | "contactSheetPath"
      | "diagnosticsPath"
      | "hashes"
      | "warnings"
    >
  >;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isPackageRelativePath(value: unknown): value is string {
  if (!nonEmptyString(value)) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  if (/^[\\/]/.test(value)) return false;
  return !value.split(/[\\/]+/).includes("..");
}

function validateNullablePackagePath(
  value: unknown,
  label: string,
  errors: string[],
): void {
  if (value === null) return;
  if (!isPackageRelativePath(value)) {
    errors.push(`${label} must be package-relative.`);
  }
}

export function createScrollHandoffManifest(
  input: CreateScrollHandoffManifestInput,
): ScrollHandoffPackageV1 {
  return {
    media: [],
    frames: { directory: null, pattern: null, count: 0 },
    posters: [],
    contactSheetPath: null,
    diagnosticsPath: null,
    hashes: [],
    warnings: [],
    ...input,
    schema: "ScrollHandoffPackageV1",
    version: 1,
  };
}

export function validateScrollHandoffManifest(
  manifest: unknown,
): CaptureValidationResult {
  const errors: string[] = [];
  if (!isRecord(manifest)) {
    return { valid: false, errors: ["manifest must be an object."] };
  }

  if (manifest.schema !== "ScrollHandoffPackageV1") {
    errors.push("manifest.schema must be ScrollHandoffPackageV1.");
  }
  if (manifest.version !== 1) errors.push("manifest.version must be 1.");
  if (!nonEmptyString(manifest.packageId)) errors.push("manifest.packageId is required.");
  if (
    manifest.status !== "complete" &&
    manifest.status !== "partial" &&
    manifest.status !== "cancelled" &&
    manifest.status !== "failed"
  ) {
    errors.push("manifest.status must be complete, partial, cancelled, or failed.");
  }
  if (!nonEmptyString(manifest.createdAt) || Number.isNaN(Date.parse(manifest.createdAt))) {
    errors.push("manifest.createdAt must be an ISO date.");
  }
  if (!nonEmptyString(manifest.outputProfileId)) {
    errors.push("manifest.outputProfileId is required.");
  }
  if (typeof manifest.fps !== "number" || !Number.isFinite(manifest.fps) || manifest.fps <= 0) {
    errors.push("manifest.fps must be greater than zero.");
  }
  if (
    typeof manifest.durationSeconds !== "number" ||
    !Number.isFinite(manifest.durationSeconds) ||
    manifest.durationSeconds <= 0
  ) {
    errors.push("manifest.durationSeconds must be greater than zero.");
  }

  if (!isRecord(manifest.frameRange)) {
    errors.push("manifest.frameRange is required.");
  } else {
    const { startFrame, endFrame, totalFrames } = manifest.frameRange;
    if (!nonNegativeInteger(startFrame)) {
      errors.push("manifest.frameRange.startFrame must be a zero-based integer.");
    }
    if (!nonNegativeInteger(endFrame)) {
      errors.push("manifest.frameRange.endFrame must be a zero-based integer.");
    }
    if (!positiveInteger(totalFrames)) {
      errors.push("manifest.frameRange.totalFrames must be greater than zero.");
    }
    if (
      nonNegativeInteger(startFrame) &&
      nonNegativeInteger(endFrame) &&
      startFrame > endFrame
    ) {
      errors.push("manifest.frameRange.startFrame must be before or equal to endFrame.");
    }
    if (
      nonNegativeInteger(startFrame) &&
      nonNegativeInteger(endFrame) &&
      positiveInteger(totalFrames) &&
      totalFrames !== endFrame - startFrame + 1
    ) {
      errors.push("manifest.frameRange.totalFrames must match the inclusive frame range.");
    }
  }

  if (!Array.isArray(manifest.media)) {
    errors.push("manifest.media must be an array.");
  } else {
    manifest.media.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`manifest.media[${index}] must be an object.`);
        return;
      }
      if (
        item.role !== "primary" &&
        item.role !== "delivery" &&
        item.role !== "scroll-friendly"
      ) {
        errors.push(`manifest.media[${index}].role is not supported.`);
      }
      if (!isPackageRelativePath(item.path)) {
        errors.push(`manifest.media[${index}].path must be package-relative.`);
      }
      if (!nonEmptyString(item.mimeType)) {
        errors.push(`manifest.media[${index}].mimeType is required.`);
      }
      if (
        item.byteLength !== undefined &&
        !nonNegativeInteger(item.byteLength)
      ) {
        errors.push(`manifest.media[${index}].byteLength must be a non-negative integer.`);
      }
    });
  }

  if (!isRecord(manifest.frames)) {
    errors.push("manifest.frames is required.");
  } else {
    validateNullablePackagePath(manifest.frames.directory, "manifest.frames.directory", errors);
    validateNullablePackagePath(manifest.frames.pattern, "manifest.frames.pattern", errors);
    const frameCount = manifest.frames.count;
    if (!nonNegativeInteger(frameCount)) {
      errors.push("manifest.frames.count must be a non-negative integer.");
    }
    const hasFrameSequence =
      manifest.frames.directory !== null ||
      manifest.frames.pattern !== null ||
      (nonNegativeInteger(frameCount) && frameCount > 0);
    if (
      hasFrameSequence &&
      (!isPackageRelativePath(manifest.frames.directory) ||
        !isPackageRelativePath(manifest.frames.pattern) ||
        !positiveInteger(frameCount))
    ) {
      errors.push("manifest.frames must include directory, pattern, and count for a sequence.");
    }
  }

  if (!Array.isArray(manifest.posters)) {
    errors.push("manifest.posters must be an array.");
  } else {
    manifest.posters.forEach((poster, index) => {
      if (!isRecord(poster)) {
        errors.push(`manifest.posters[${index}] must be an object.`);
        return;
      }
      if (!nonEmptyString(poster.anchorId)) {
        errors.push(`manifest.posters[${index}].anchorId is required.`);
      }
      if (!nonNegativeInteger(poster.frame)) {
        errors.push(`manifest.posters[${index}].frame must be a zero-based integer.`);
      }
      if (!isPackageRelativePath(poster.path)) {
        errors.push(`manifest.posters[${index}].path must be package-relative.`);
      }
    });
  }

  validateNullablePackagePath(manifest.contactSheetPath, "manifest.contactSheetPath", errors);
  validateNullablePackagePath(manifest.diagnosticsPath, "manifest.diagnosticsPath", errors);

  if (!isRecord(manifest.sourceContract)) {
    errors.push("manifest.sourceContract must be an object.");
  }

  if (!Array.isArray(manifest.hashes)) {
    errors.push("manifest.hashes must be an array.");
  } else {
    manifest.hashes.forEach((hash, index) => {
      if (!isRecord(hash)) {
        errors.push(`manifest.hashes[${index}] must be an object.`);
        return;
      }
      if (!isPackageRelativePath(hash.path)) {
        errors.push(`manifest.hashes[${index}].path must be package-relative.`);
      }
      if (!nonEmptyString(hash.sha256)) {
        errors.push(`manifest.hashes[${index}].sha256 is required.`);
      }
    });
  }

  if (!Array.isArray(manifest.warnings)) {
    errors.push("manifest.warnings must be an array.");
  } else if (manifest.warnings.some((warning) => typeof warning !== "string")) {
    errors.push("manifest.warnings must contain only strings.");
  }

  if (manifest.status === "complete") {
    const mediaCount = Array.isArray(manifest.media) ? manifest.media.length : 0;
    const hasFrameSequence =
      isRecord(manifest.frames) &&
      isPackageRelativePath(manifest.frames.directory) &&
      isPackageRelativePath(manifest.frames.pattern) &&
      positiveInteger(manifest.frames.count);
    if (mediaCount === 0 && !hasFrameSequence) {
      errors.push("complete scroll handoff packages require media or a frame sequence.");
    }
  }

  return { valid: errors.length === 0, errors };
}
