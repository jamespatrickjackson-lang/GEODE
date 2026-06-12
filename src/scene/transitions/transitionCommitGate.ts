export type TransitionCommitPhase =
  | "terminal-before-commit"
  | "final-commit"
  | "duplicate-target-assertion"
  | "overlay-end-application"
  | "editor-deferred-reapply"
  | "tween-completion"
  | "post-commit-graph-check";

export type TransitionCommitCoverage = "known" | "unknown";

export interface TransitionCommitChannelSnapshot {
  channelClass?: string;
  value?: unknown;
  coverage?: TransitionCommitCoverage;
}

export interface TransitionCommitGraphEntity {
  entityKey: string;
  representationKey?: string | null;
  presenceState?: string | null;
  visible?: boolean;
  readinessState?: string | null;
  derivedFromEntityKey?: string | null;
  dependencyState?: string | null;
  channels?: Readonly<Record<string, TransitionCommitChannelSnapshot | unknown>>;
}

export interface TransitionCommitGraph {
  entities: readonly TransitionCommitGraphEntity[];
}

export interface TransitionVisibleDelta {
  entityKey: string;
  property: "presence" | "visibility" | "representation" | "channel";
  channelKey: string | null;
  phase: "terminal-target" | "committed-target";
  terminalValue?: unknown;
  targetValue?: unknown;
  committedValue?: unknown;
}

export interface TransitionCommitGraphComparison {
  terminalGraphEntityCount: number;
  targetGraphEntityCount: number;
  committedGraphEntityCount: number;
  visibleDeltaCount: number;
  visibleDeltas: TransitionVisibleDelta[];
  unresolvedCoverage: string[];
}

export interface TransitionCommitTrace {
  transitionId: string;
  phase: TransitionCommitPhase;
  owner: string;
  attemptedBy: string;
  allowed: boolean;
  suppressed: boolean;
  reason: string;
  terminalGraphEntityCount: number;
  targetGraphEntityCount: number;
  resolvedTargetGraphEntityCount: number;
  committedGraphEntityCount: number;
  visibleDeltaCount: number;
  visibleDeltas: TransitionVisibleDelta[];
  unresolvedCoverage: string[];
}

export interface TransitionCommitGateState {
  transitionId: string;
  sourcePageId: string | null;
  targetPageId: string | null;
  sourcePageIndex?: number | null;
  targetPageIndex?: number | null;
  projectSlug?: string | null;
  route?: string | null;
  fixtureName?: string | null;
  toolLabel?: string | null;
  commitOwner: string;
  commitPhase: TransitionCommitPhase | null;
  hasFinalized: boolean;
  finalizedAt: number | null;
  suppressedDuplicateAssertions: number;
  commitTraces: TransitionCommitTrace[];
}

export interface TransitionCommitGateInput {
  transitionId: string;
  sourcePageId?: string | null;
  targetPageId?: string | null;
  sourcePageIndex?: number | null;
  targetPageIndex?: number | null;
  projectSlug?: string | null;
  route?: string | null;
  fixtureName?: string | null;
  toolLabel?: string | null;
  commitOwner?: string;
}

export interface TransitionCommitAttempt {
  phase: TransitionCommitPhase;
  attemptedBy: string;
  terminalTransitionGraph?: TransitionCommitGraph | null;
  resolvedTargetGraph?: TransitionCommitGraph | null;
  committedGraph?: TransitionCommitGraph | null;
  nowMs?: number;
  reason?: string;
}

export interface TransitionCommitGate {
  state: TransitionCommitGateState;
  recordCommitAttempt(attempt: TransitionCommitAttempt): TransitionCommitTrace;
}

export function reapplyReasonBypassesPostCommitSuppression(
  reason: string,
): boolean {
  return (
    reason === "async-layer-resolve" || reason === "editor-deferred-flush"
  );
}

interface NormalizedChannel {
  channelClass: string | null;
  value: unknown;
  coverage: TransitionCommitCoverage;
}

const TARGET_ASSERTION_PHASES = new Set<TransitionCommitPhase>([
  "final-commit",
  "duplicate-target-assertion",
  "overlay-end-application",
  "editor-deferred-reapply",
  "tween-completion",
]);

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function stableValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`)
    .join(",")}}`;
}

function valuesMatch(left: unknown, right: unknown, tolerance: number): boolean {
  if (
    typeof left === "number" &&
    Number.isFinite(left) &&
    typeof right === "number" &&
    Number.isFinite(right)
  ) {
    return Math.abs(left - right) <= tolerance;
  }
  return stableValue(left) === stableValue(right);
}

function visibleValue(entity: TransitionCommitGraphEntity | undefined): boolean {
  if (!entity) return false;
  if (typeof entity.visible === "boolean") return entity.visible;
  return entity.presenceState === "visible" || entity.presenceState === "ready";
}

function entityMap(
  graph: TransitionCommitGraph | null | undefined,
): Map<string, TransitionCommitGraphEntity> {
  const map = new Map<string, TransitionCommitGraphEntity>();
  for (const entity of graph?.entities ?? []) {
    map.set(entity.entityKey, entity);
  }
  return map;
}

function normalizeChannel(value: unknown): NormalizedChannel {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ("value" in value || "coverage" in value || "channelClass" in value)
  ) {
    const snapshot = value as TransitionCommitChannelSnapshot;
    return {
      channelClass: snapshot.channelClass ?? null,
      value: snapshot.value,
      coverage: snapshot.coverage ?? "known",
    };
  }
  return {
    channelClass: null,
    value,
    coverage: "known",
  };
}

function channelMap(
  entity: TransitionCommitGraphEntity | undefined,
): Map<string, NormalizedChannel> {
  const map = new Map<string, NormalizedChannel>();
  for (const [key, value] of Object.entries(entity?.channels ?? {})) {
    map.set(key, normalizeChannel(value));
  }
  return map;
}

function addCoverage(
  unresolvedCoverage: string[],
  graphName: string,
  entityKey: string,
  channelKey: string,
): void {
  unresolvedCoverage.push(`${graphName}:${entityKey}:${channelKey}`);
}

function compareEntityToTarget(input: {
  phase: "terminal-target" | "committed-target";
  graphName: "terminal" | "committed";
  actual: TransitionCommitGraphEntity | undefined;
  target: TransitionCommitGraphEntity | undefined;
  entityKey: string;
  visibleDeltas: TransitionVisibleDelta[];
  unresolvedCoverage: string[];
  tolerance: number;
}): void {
  const {
    actual,
    target,
    entityKey,
    phase,
    graphName,
    visibleDeltas,
    unresolvedCoverage,
    tolerance,
  } = input;
  if (!actual || !target) {
    visibleDeltas.push({
      entityKey,
      property: "presence",
      channelKey: null,
      phase,
      terminalValue: phase === "terminal-target" ? actual?.presenceState : undefined,
      committedValue:
        phase === "committed-target" ? actual?.presenceState : undefined,
      targetValue: target?.presenceState,
    });
    return;
  }
  if (visibleValue(actual) !== visibleValue(target)) {
    visibleDeltas.push({
      entityKey,
      property: "visibility",
      channelKey: null,
      phase,
      terminalValue: phase === "terminal-target" ? visibleValue(actual) : undefined,
      committedValue:
        phase === "committed-target" ? visibleValue(actual) : undefined,
      targetValue: visibleValue(target),
    });
  }
  if ((actual.representationKey ?? null) !== (target.representationKey ?? null)) {
    visibleDeltas.push({
      entityKey,
      property: "representation",
      channelKey: null,
      phase,
      terminalValue:
        phase === "terminal-target" ? actual.representationKey ?? null : undefined,
      committedValue:
        phase === "committed-target" ? actual.representationKey ?? null : undefined,
      targetValue: target.representationKey ?? null,
    });
  }
  const actualChannels = channelMap(actual);
  const targetChannels = channelMap(target);
  const channelKeys = new Set<string>([
    ...actualChannels.keys(),
    ...targetChannels.keys(),
  ]);
  for (const channelKey of channelKeys) {
    const actualChannel = actualChannels.get(channelKey);
    const targetChannel = targetChannels.get(channelKey);
    if (!actualChannel || actualChannel.coverage === "unknown") {
      addCoverage(unresolvedCoverage, graphName, entityKey, channelKey);
      continue;
    }
    if (!targetChannel || targetChannel.coverage === "unknown") {
      addCoverage(unresolvedCoverage, "target", entityKey, channelKey);
      continue;
    }
    if (!valuesMatch(actualChannel.value, targetChannel.value, tolerance)) {
      visibleDeltas.push({
        entityKey,
        property: "channel",
        channelKey,
        phase,
        terminalValue:
          phase === "terminal-target" ? actualChannel.value : undefined,
        committedValue:
          phase === "committed-target" ? actualChannel.value : undefined,
        targetValue: targetChannel.value,
      });
    }
  }
}

export function compareTransitionCommitGraphs(input: {
  terminalTransitionGraph?: TransitionCommitGraph | null;
  resolvedTargetGraph?: TransitionCommitGraph | null;
  committedGraph?: TransitionCommitGraph | null;
  tolerance?: number;
}): TransitionCommitGraphComparison {
  const tolerance = input.tolerance ?? 0.001;
  const terminalMap = entityMap(input.terminalTransitionGraph);
  const targetMap = entityMap(input.resolvedTargetGraph);
  const committedMap = entityMap(input.committedGraph);
  const entityKeys = new Set<string>([
    ...terminalMap.keys(),
    ...targetMap.keys(),
    ...committedMap.keys(),
  ]);
  const visibleDeltas: TransitionVisibleDelta[] = [];
  const unresolvedCoverage: string[] = [];
  for (const entityKey of Array.from(entityKeys).sort()) {
    const target = targetMap.get(entityKey);
    if (input.terminalTransitionGraph) {
      compareEntityToTarget({
        phase: "terminal-target",
        graphName: "terminal",
        actual: terminalMap.get(entityKey),
        target,
        entityKey,
        visibleDeltas,
        unresolvedCoverage,
        tolerance,
      });
    }
    if (input.committedGraph) {
      compareEntityToTarget({
        phase: "committed-target",
        graphName: "committed",
        actual: committedMap.get(entityKey),
        target,
        entityKey,
        visibleDeltas,
        unresolvedCoverage,
        tolerance,
      });
    }
  }
  return {
    terminalGraphEntityCount: input.terminalTransitionGraph?.entities.length ?? 0,
    targetGraphEntityCount: input.resolvedTargetGraph?.entities.length ?? 0,
    committedGraphEntityCount: input.committedGraph?.entities.length ?? 0,
    visibleDeltaCount: visibleDeltas.length,
    visibleDeltas,
    unresolvedCoverage,
  };
}

function traceForAttempt(
  state: TransitionCommitGateState,
  attempt: TransitionCommitAttempt,
  allowed: boolean,
  suppressed: boolean,
  reason: string,
): TransitionCommitTrace {
  const comparison = compareTransitionCommitGraphs({
    terminalTransitionGraph: attempt.terminalTransitionGraph,
    resolvedTargetGraph: attempt.resolvedTargetGraph,
    committedGraph: attempt.committedGraph,
  });
  return {
    transitionId: state.transitionId,
    phase: attempt.phase,
    owner: state.commitOwner,
    attemptedBy: attempt.attemptedBy,
    allowed,
    suppressed,
    reason,
    terminalGraphEntityCount: comparison.terminalGraphEntityCount,
    targetGraphEntityCount: comparison.targetGraphEntityCount,
    resolvedTargetGraphEntityCount: comparison.targetGraphEntityCount,
    committedGraphEntityCount: comparison.committedGraphEntityCount,
    visibleDeltaCount: comparison.visibleDeltaCount,
    visibleDeltas: comparison.visibleDeltas,
    unresolvedCoverage: comparison.unresolvedCoverage,
  };
}

export function createTransitionCommitGate(
  input: TransitionCommitGateInput,
): TransitionCommitGate {
  const state: TransitionCommitGateState = {
    transitionId: input.transitionId,
    sourcePageId: input.sourcePageId ?? null,
    targetPageId: input.targetPageId ?? null,
    sourcePageIndex: input.sourcePageIndex ?? null,
    targetPageIndex: input.targetPageIndex ?? null,
    projectSlug: input.projectSlug ?? null,
    route: input.route ?? null,
    fixtureName: input.fixtureName ?? null,
    toolLabel: input.toolLabel ?? null,
    commitOwner: input.commitOwner ?? "SceneManager",
    commitPhase: null,
    hasFinalized: false,
    finalizedAt: null,
    suppressedDuplicateAssertions: 0,
    commitTraces: [],
  };

  return {
    state,
    recordCommitAttempt(attempt: TransitionCommitAttempt): TransitionCommitTrace {
      return recordTransitionCommitAttempt(state, attempt);
    },
  };
}

export function recordTransitionCommitAttempt(
  state: TransitionCommitGateState,
  attempt: TransitionCommitAttempt,
): TransitionCommitTrace {
  const phase = attempt.phase;
  const suppress = state.hasFinalized && TARGET_ASSERTION_PHASES.has(phase);
  const allowed = !suppress;
  const suppressed = suppress;
  const reason =
    attempt.reason ??
    (suppressed
      ? `transition already finalized by ${state.commitOwner}`
      : phase === "final-commit"
        ? "final commit owner accepted target assertion"
        : "transition commit observation recorded");
  if (suppressed) {
    state.suppressedDuplicateAssertions += 1;
  }
  if (allowed && phase === "final-commit" && !state.hasFinalized) {
    state.hasFinalized = true;
    state.finalizedAt = attempt.nowMs ?? nowMs();
  }
  state.commitPhase = phase;
  const trace = traceForAttempt(state, attempt, allowed, suppressed, reason);
  state.commitTraces.push(trace);
  return trace;
}

export function transitionCommitGraphFromAssignmentTraces(
  traces: readonly {
    entityKey: string;
    sourcePresence?: string | null;
    targetPresence?: string | null;
    sourceReadiness?: string | null;
    targetReadiness?: string | null;
    sourceRepresentation?: string | null;
    targetRepresentation?: string | null;
    changedChannels?: readonly {
      key: string;
      channelClass: string;
      sourceValue?: unknown;
      targetValue?: unknown;
    }[];
    derivedFromEntityKey?: string | null;
    dependencyPolicy?: string | null;
  }[],
  side: "source" | "target",
): TransitionCommitGraph {
  return {
    entities: traces.map((trace) => ({
      entityKey: trace.entityKey,
      representationKey:
        side === "source"
          ? trace.sourceRepresentation ?? null
          : trace.targetRepresentation ?? null,
      presenceState:
        side === "source"
          ? trace.sourcePresence ?? null
          : trace.targetPresence ?? null,
      visible:
        (side === "source" ? trace.sourcePresence : trace.targetPresence) ===
        "visible",
      readinessState:
        side === "source"
          ? trace.sourceReadiness ?? null
          : trace.targetReadiness ?? null,
      derivedFromEntityKey: trace.derivedFromEntityKey ?? null,
      dependencyState: trace.dependencyPolicy ?? null,
      channels: Object.fromEntries(
        (trace.changedChannels ?? []).map((channel) => [
          channel.key,
          {
            channelClass: channel.channelClass,
            value:
              side === "source" ? channel.sourceValue : channel.targetValue,
            coverage: "known",
          },
        ]),
      ),
    })),
  };
}
