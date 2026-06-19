// Dependency-free shaping of the public capture-video run status returned by the
// dev endpoint. Extracted so the status fields (incl. the additive
// `diagnosticsMissing`) and the elapsed-time math are unit testable without the
// Vite plugin / child-process machinery.

export interface CaptureVideoRunStatusInput {
  runId: string;
  status: string;
  phase: string;
  startedAt: string;
  completedAt?: string | null;
  outputFilename: string;
  outputPath: string;
  outputUrl: string | null;
  diagnosticsPath: string;
  error?: string | null;
  exitCode?: number | null;
  renderedFrames?: number;
  totalFrames?: number | null;
  renderer?: string | null;
  superscale?: number | null;
  masterPath?: string | null;
  masterUrl?: string | null;
  frameSequenceDir?: string | null;
  // Set true once the run's diagnostics file has been read and folded into the
  // record; absent/false means diagnostics were never enriched.
  diagnosticsEnriched?: boolean;
}

export interface CaptureVideoRunPublicStatus {
  runId: string;
  status: string;
  phase: string;
  startedAt: string;
  completedAt: string | null;
  outputFilename: string;
  outputPath: string;
  outputUrl: string | null;
  diagnosticsPath: string;
  error: string | null;
  exitCode: number | null;
  elapsedSeconds: number;
  renderedFrames: number;
  totalFrames: number | null;
  renderer: string | null;
  superscale: number | null;
  masterUrl: string | null;
  masterPath: string | null;
  frameSequenceDir: string | null;
  diagnosticsMissing: boolean;
}

export function captureVideoRunElapsedSeconds(
  run: Pick<CaptureVideoRunStatusInput, "startedAt" | "completedAt">,
  now: number = Date.now(),
): number {
  const end = run.completedAt ? Date.parse(run.completedAt) : now;
  return Math.max(0, Math.floor((end - Date.parse(run.startedAt)) / 1000));
}

export function captureVideoRunPublicStatus(
  run: CaptureVideoRunStatusInput,
  now: number = Date.now(),
): CaptureVideoRunPublicStatus {
  return {
    runId: run.runId,
    status: run.status,
    phase: run.phase,
    startedAt: run.startedAt,
    completedAt: run.completedAt ?? null,
    outputFilename: run.outputFilename,
    outputPath: run.outputPath,
    outputUrl: run.outputUrl,
    diagnosticsPath: run.diagnosticsPath,
    error: run.error ?? null,
    exitCode: run.exitCode ?? null,
    elapsedSeconds: captureVideoRunElapsedSeconds(run, now),
    renderedFrames: run.renderedFrames ?? 0,
    totalFrames: run.totalFrames ?? null,
    renderer: run.renderer ?? null,
    superscale: run.superscale ?? null,
    masterUrl: run.masterUrl ?? null,
    masterPath: run.masterPath ?? null,
    frameSequenceDir: run.frameSequenceDir ?? null,
    diagnosticsMissing: run.diagnosticsEnriched !== true,
  };
}
