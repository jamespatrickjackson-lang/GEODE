import type { EasingName } from "../../pages/types";
import type {
  TransitionAssignmentKind,
  TransitionChannelCapability,
  TransitionChannelClass,
  TransitionDependencyPolicy,
  TransitionEntityAssignment,
  TransitionExecutionMode,
  TransitionPresenceState,
  TransitionReadinessState,
} from "./transitionEntityPolicy";
import { easeProgress } from "./transitionEasing";

// The execution layer is an ownership/dispatch spine (TRD-013 / DEC-152). It
// turns classifier assignments into typed per-entity operations and advances
// them per frame. It does not reimplement interpolation math: each operation
// names an executor kind that a registered channel executor dispatches to an
// existing SceneManager kernel.

export type TransitionExecutorKind =
  | "layer-opacity"
  | "scalar-style"
  | "scene-section-mask"
  | "section-iso-root"
  | "seismic-entity"
  | "environment-scene"
  | "working-area"
  | "discrete-crossfade"
  | "enter"
  | "exit"
  | "none";

export interface TransitionOperationChannel {
  key: string;
  channelClass: TransitionChannelClass;
  capability: TransitionChannelCapability;
  sourceValue: unknown;
  targetValue: unknown;
}

export interface TransitionEntityOperation {
  entityKey: string;
  parentLayerId: string | null;
  representationKey: string | null;
  executorKind: TransitionExecutorKind;
  executionMode: TransitionExecutionMode;
  assignment: TransitionAssignmentKind;
  derivedFromEntityKey: string | null;
  dependencyPolicy: TransitionDependencyPolicy;
  holdUntilReady: boolean;
  durationMs: number;
  easing: EasingName;
  channels: TransitionOperationChannel[];
  sourcePresence: TransitionPresenceState | null;
  targetPresence: TransitionPresenceState | null;
  sourceReadiness: TransitionReadinessState | null;
  targetReadiness: TransitionReadinessState | null;
  traceReasons: string[];
}

export interface TransitionExecutionPlan {
  startMs: number;
  operations: TransitionEntityOperation[];
}

export interface TransitionEntityFrame {
  entityKey: string;
  executorKind: TransitionExecutorKind;
  executionMode: TransitionExecutionMode;
  progress: number;
  active: boolean;
  done: boolean;
  // Per-mode visual factors. enteringOpacityFactor ramps 0 -> 1 for enter,
  // exitingOpacityFactor ramps 1 -> 0 for exit, and the crossfade pair lets a
  // source root fade out while a target root fades in.
  enteringOpacityFactor: number;
  exitingOpacityFactor: number;
  crossfadeSourceAlpha: number;
  crossfadeTargetAlpha: number;
}

export interface TransitionExecutionPlanInput {
  assignments: readonly TransitionEntityAssignment[];
  startMs: number;
  durationMs: number;
  easing: EasingName;
  scalarStyleDurationMs?: number;
  scalarStyleEasing?: EasingName;
  // Phase-3 hook: protected/existing channels (layer opacity, scalar, scene
  // section, Section ISO) keep their curated trigger predicates by supplying an
  // executor kind here. Returning null falls back to the generic mapping, which
  // is what the seismic derived-entity graph uses.
  resolveExecutorKind?: (
    assignment: TransitionEntityAssignment,
  ) => TransitionExecutorKind | null;
}

function parentLayerIdFromEntityKey(entityKey: string): string | null {
  if (!entityKey.startsWith("layer:")) return null;
  const rest = entityKey.slice("layer:".length);
  const next = rest.indexOf(":");
  return next === -1 ? rest : rest.slice(0, next);
}

function representationFor(
  assignment: TransitionEntityAssignment,
): string | null {
  return assignment.targetRepresentation ?? assignment.sourceRepresentation;
}

function genericExecutorKind(
  assignment: TransitionEntityAssignment,
): TransitionExecutorKind {
  const rep = representationFor(assignment) ?? "";
  if (rep.startsWith("seismic:")) return "seismic-entity";
  if (rep.startsWith("derived:section-iso")) return "section-iso-root";
  if (
    rep.startsWith("derived:scene-section") ||
    rep === "derived:ground-trace" ||
    rep === "derived:axis-lines"
  ) {
    return "scene-section-mask";
  }
  switch (assignment.executionMode) {
    case "none":
      return "none";
    case "enter":
      return "enter";
    case "exit":
      return "exit";
    case "crossfade":
    case "commit-discrete":
      return "discrete-crossfade";
    case "hold-source":
      return "layer-opacity";
    case "interpolate-channels": {
      const scalarChanged = assignment.changedChannels.some(
        (channel) =>
          channel.channelClass === "continuous-scalar" &&
          channel.key !== "opacity",
      );
      return scalarChanged ? "scalar-style" : "layer-opacity";
    }
  }
}

function operationDuration(
  kind: TransitionExecutorKind,
  input: TransitionExecutionPlanInput,
): { durationMs: number; easing: EasingName } {
  if (kind === "scalar-style") {
    return {
      durationMs:
        typeof input.scalarStyleDurationMs === "number"
          ? input.scalarStyleDurationMs
          : input.durationMs,
      easing: input.scalarStyleEasing ?? input.easing,
    };
  }
  return { durationMs: input.durationMs, easing: input.easing };
}

export function buildTransitionExecutionPlan(
  input: TransitionExecutionPlanInput,
): TransitionExecutionPlan {
  const operations: TransitionEntityOperation[] = [];
  for (const assignment of input.assignments) {
    if (assignment.assignment === "skip") continue;
    const overridden = input.resolveExecutorKind?.(assignment) ?? null;
    const executorKind = overridden ?? genericExecutorKind(assignment);
    if (executorKind === "none") continue;
    const { durationMs, easing } = operationDuration(executorKind, input);
    operations.push({
      entityKey: assignment.entityKey,
      parentLayerId: parentLayerIdFromEntityKey(assignment.entityKey),
      representationKey: representationFor(assignment),
      executorKind,
      executionMode: assignment.executionMode,
      assignment: assignment.assignment,
      derivedFromEntityKey: assignment.derivedFromEntityKey,
      dependencyPolicy: assignment.dependencyPolicy,
      holdUntilReady: assignment.executionMode === "hold-source",
      durationMs,
      easing,
      channels: assignment.changedChannels.map((channel) => ({
        key: channel.key,
        channelClass: channel.channelClass,
        capability: channel.capability,
        sourceValue: channel.sourceValue,
        targetValue: channel.targetValue,
      })),
      sourcePresence: assignment.sourcePresence,
      targetPresence: assignment.targetPresence,
      sourceReadiness: assignment.sourceReadiness,
      targetReadiness: assignment.targetReadiness,
      traceReasons: assignment.traceReasons.slice(),
    });
  }
  return { startMs: input.startMs, operations };
}

function operationProgress(
  operation: TransitionEntityOperation,
  startMs: number,
  nowMs: number,
): { progress: number; done: boolean } {
  if (operation.durationMs <= 0) return { progress: 1, done: true };
  const raw = (nowMs - startMs) / operation.durationMs;
  const done = raw >= 1;
  const progress = done ? 1 : easeProgress(raw, operation.easing);
  return { progress, done };
}

export function evaluateTransitionExecutionPlan(
  plan: TransitionExecutionPlan,
  nowMs: number,
): TransitionEntityFrame[] {
  return plan.operations.map((operation) => {
    const { progress, done } = operationProgress(operation, plan.startMs, nowMs);
    // hold-until-ready keeps the source visible at full opacity and does not
    // ramp the target in until the operation is re-planned as enter.
    const holding = operation.holdUntilReady;
    const enteringOpacityFactor =
      operation.executionMode === "enter" ? (holding ? 0 : progress) : 1;
    const exitingOpacityFactor =
      operation.executionMode === "exit" ? 1 - progress : 1;
    const crossfade =
      operation.executorKind === "discrete-crossfade" ||
      operation.executorKind === "section-iso-root" ||
      operation.executionMode === "crossfade";
    const crossfadeSourceAlpha = crossfade ? 1 - progress : 1;
    const crossfadeTargetAlpha = crossfade ? progress : 1;
    return {
      entityKey: operation.entityKey,
      executorKind: operation.executorKind,
      executionMode: operation.executionMode,
      progress,
      active: !done,
      done,
      enteringOpacityFactor,
      exitingOpacityFactor,
      crossfadeSourceAlpha,
      crossfadeTargetAlpha,
    };
  });
}

export function transitionExecutionPlanComplete(
  plan: TransitionExecutionPlan,
  nowMs: number,
): boolean {
  return plan.operations.every(
    (operation) => operationProgress(operation, plan.startMs, nowMs).done,
  );
}
