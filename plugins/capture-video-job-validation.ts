// Validation for CaptureVideoRenderJobV1 jobs posted to the dev-only local
// renderer endpoints (Render Out / Render Path Video / scroll package). Extracted
// from the Vite plugin so it is dependency-free (no sharp/vite/node imports) and
// executably testable. The `superscale` budget check mirrors the browser-side
// validateExternalVideoRenderJob contract so the endpoint cannot be bypassed by a
// hand-authored job that skipped the browser validator (DEC-178, audit F-CD-003).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateLocalCaptureVideoJob(job: any): string[] {
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
    // Optional headless superscale (v1 extension; absent => 1). Reject an explicit
    // over-budget value here too, so the endpoint cannot be bypassed by a job that
    // skipped the browser-side validator (e.g. 8K + superscale 2 => 15360x8640).
    if (job.superscale !== undefined && job.superscale !== null) {
      const s = job.superscale;
      const w = Number(job.video.width);
      const h = Number(job.video.height);
      if (!Number.isInteger(s) || s < 1 || s > 4) {
        errors.push("job.superscale must be an integer between 1 and 4");
      } else if (
        Number.isInteger(w) &&
        Number.isInteger(h) &&
        (w * s > 7680 || h * s > 4320)
      ) {
        errors.push(
          `job.superscale ${s} exceeds the 7680x4320 render budget for ${w}x${h}`,
        );
      }
    }
  }
  return errors;
}
