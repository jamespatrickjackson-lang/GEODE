// On-disk artifacts a capture video run may have written. Used by the
// `cancel-video` cleanup so a cancelled run leaves no partial output, diagnostics,
// or ProRes master behind (audit F-CD-005). Dependency-free so it is executably
// testable without the Vite plugin's runtime imports.

export interface CaptureVideoRunArtifacts {
  outputPath?: string | null;
  diagnosticsPath?: string | null;
  masterPath?: string | null;
}

export function captureVideoRunArtifactPaths(
  run: CaptureVideoRunArtifacts,
): string[] {
  return [run.outputPath, run.diagnosticsPath, run.masterPath].filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  );
}
