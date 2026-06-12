import type {
  TransitionEntityOperation,
  TransitionExecutionPlan,
  TransitionExecutorKind,
} from "./transitionExecutionPlan";

// Phase 2 of the transition execution layer (TRD-013 / DEC-152). The registry
// is the dispatch table: it maps each executor kind a plan operation declares
// to the runtime mechanism (bucket) that materializes and ticks it. Buckets
// name existing SceneManager kernels; only `seismic-entity` is a new mechanism.
// This module is pure routing metadata so it can be unit-tested without THREE
// or SceneManager.

export type TransitionExecutorBucket =
  | "layer-opacity"
  | "scalar-style"
  | "scene-section"
  | "section-iso"
  | "snapshot-crossfade"
  | "seismic-entity"
  | "environment-scene"
  | "working-area"
  | "none";

export function executorBucketForKind(
  kind: TransitionExecutorKind,
): TransitionExecutorBucket {
  switch (kind) {
    case "layer-opacity":
    case "enter":
    case "exit":
      return "layer-opacity";
    case "scalar-style":
      return "scalar-style";
    case "scene-section-mask":
      return "scene-section";
    case "section-iso-root":
      return "section-iso";
    case "discrete-crossfade":
      return "snapshot-crossfade";
    case "seismic-entity":
      return "seismic-entity";
    case "environment-scene":
      return "environment-scene";
    case "working-area":
      return "working-area";
    case "none":
      return "none";
  }
}

// Deterministic per-frame application order. Mirrors the existing tickLayerTweens
// sequence so the migration preserves frame ordering: scene-section masks first
// (they set clip uniforms other layers read), then working-area focus, scalar
// style, layer opacity, snapshot crossfades, Section ISO roots, and finally the
// seismic entity executor. Background/fog runs in its own frame stage and is
// listed last for completeness.
export const TRANSITION_EXECUTOR_DISPATCH_ORDER: readonly TransitionExecutorBucket[] = [
  "scene-section",
  "working-area",
  "scalar-style",
  "layer-opacity",
  "snapshot-crossfade",
  "section-iso",
  "seismic-entity",
  "environment-scene",
];

export function transitionOperationBucket(
  operation: TransitionEntityOperation,
): TransitionExecutorBucket {
  return executorBucketForKind(operation.executorKind);
}

// Groups a plan's operations by runtime bucket. Phase 3 uses this to materialize
// the existing tween state from the plan instead of from the imperative
// shouldCrossfade* ladder; Phase 4's seismic executor consumes the
// `seismic-entity` bucket.
export function groupTransitionOperationsByBucket(
  plan: TransitionExecutionPlan,
): Map<TransitionExecutorBucket, TransitionEntityOperation[]> {
  const grouped = new Map<TransitionExecutorBucket, TransitionEntityOperation[]>();
  for (const operation of plan.operations) {
    const bucket = transitionOperationBucket(operation);
    if (bucket === "none") continue;
    const list = grouped.get(bucket);
    if (list) list.push(operation);
    else grouped.set(bucket, [operation]);
  }
  return grouped;
}

// Narrow SceneManager-facing surface the runtime executors call. Kept abstract
// here so Phase 3/4 can implement it against the concrete SceneManager without
// this module importing THREE. Each method wraps an existing kernel.
export interface TransitionExecutorContext {
  applyLayerOpacityFrame(layerId: string, opacity: number, envelope: number): void;
  seismicEntityOpacity(operation: TransitionEntityOperation, factor: number): void;
}
