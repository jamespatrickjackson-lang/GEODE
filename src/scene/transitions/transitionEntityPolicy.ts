export type TransitionPresenceState =
  | "absent"
  | "dormant"
  | "hidden"
  | "loading"
  | "visible"
  | "ready"
  | "unavailable";

export type TransitionReadinessState =
  | "ready"
  | "loading"
  | "unready"
  | "unavailable";

export type TransitionChannelClass =
  | "presence"
  | "continuous-scalar"
  | "color-material"
  | "spatial-transform"
  | "geometry-parameter"
  | "discrete-categorical"
  | "representation"
  | "runtime-control"
  | "readiness";

export type TransitionChannelCapability =
  | "interpolate"
  | "discrete-commit"
  | "crossfade"
  | "hold"
  | "none";

export type TransitionAssignmentKind =
  | "skip"
  | "preserve-interpolate"
  | "enter"
  | "exit"
  | "crossfade"
  | "hold-until-ready"
  | "discrete-commit";

export type TransitionRepresentationCompatibility =
  | "compatible"
  | "incompatible"
  | "unknown";

export type TransitionStateOrigin =
  | "live-runtime"
  | "persisted-effective"
  | "adapter-derived"
  | "unknown";

export type TransitionDependencyPolicy =
  | "independent"
  | "follow-source"
  | "promoted";

export type TransitionExecutionMode =
  | "none"
  | "interpolate-channels"
  | "enter"
  | "exit"
  | "crossfade"
  | "hold-source"
  | "commit-discrete";

export type TransitionFinalCommitPolicy = "visually-idempotent-target";

export interface TransitionChannel {
  key: string;
  ownerKey?: string;
  ownerPriority?: number;
  channelClass: TransitionChannelClass;
  capability: TransitionChannelCapability;
  value: unknown;
}

export interface TransitionRenderEntity {
  entityKey: string;
  representationKey: string;
  presenceState: TransitionPresenceState;
  readinessState: TransitionReadinessState;
  derivedFromEntityKey?: string;
  dependencyPolicy?: TransitionDependencyPolicy;
  channels?: readonly TransitionChannel[];
  sourceStateOrigin?: TransitionStateOrigin;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface TransitionChannelDiff {
  key: string;
  channelClass: TransitionChannelClass;
  capability: TransitionChannelCapability;
  ownerKey: string | null;
  ownerPriority: number;
  sourceOwnerKey: string | null;
  targetOwnerKey: string | null;
  sourceValue: unknown;
  targetValue: unknown;
}

export interface TransitionEntityAssignment {
  entityKey: string;
  sourceEntityKey: string | null;
  targetEntityKey: string | null;
  sourcePresence: TransitionPresenceState | null;
  targetPresence: TransitionPresenceState | null;
  sourceReadiness: TransitionReadinessState | null;
  targetReadiness: TransitionReadinessState | null;
  sourceRepresentation: string | null;
  targetRepresentation: string | null;
  compatibility: TransitionRepresentationCompatibility;
  derivedFromEntityKey: string | null;
  dependencyPolicy: TransitionDependencyPolicy;
  changedChannels: TransitionChannelDiff[];
  assignment: TransitionAssignmentKind;
  executionMode: TransitionExecutionMode;
  finalCommitPolicy: TransitionFinalCommitPolicy;
  fallbackReason: string | null;
  traceReasons: string[];
  sourceStateOrigin: TransitionStateOrigin;
}

export interface TransitionEntityPairInput {
  source?: TransitionRenderEntity;
  target?: TransitionRenderEntity;
  compatibility?: TransitionRepresentationCompatibility;
}

export interface TransitionRenderGraphInput {
  source: readonly TransitionRenderEntity[];
  target: readonly TransitionRenderEntity[];
}

function isRenderable(entity: TransitionRenderEntity | undefined): boolean {
  return (
    entity?.presenceState === "visible" || entity?.presenceState === "ready"
  );
}

function isReady(entity: TransitionRenderEntity | undefined): boolean {
  return entity?.readinessState === "ready";
}

function compatibilityForPair(
  source: TransitionRenderEntity | undefined,
  target: TransitionRenderEntity | undefined,
  override: TransitionRepresentationCompatibility | undefined,
): TransitionRepresentationCompatibility {
  if (override) return override;
  if (!source || !target) return "unknown";
  return source.representationKey === target.representationKey
    ? "compatible"
    : "incompatible";
}

function stableValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`)
    .join(",")}}`;
}

function channelMap(
  entity: TransitionRenderEntity | undefined,
): Map<string, TransitionChannel> {
  const map = new Map<string, TransitionChannel>();
  for (const channel of entity?.channels ?? []) {
    const current = map.get(channel.key);
    const currentPriority = current?.ownerPriority ?? 0;
    const nextPriority = channel.ownerPriority ?? 0;
    if (!current || nextPriority >= currentPriority) {
      map.set(channel.key, channel);
    }
  }
  return map;
}

function diffChannels(
  source: TransitionRenderEntity | undefined,
  target: TransitionRenderEntity | undefined,
): TransitionChannelDiff[] {
  const sourceChannels = channelMap(source);
  const targetChannels = channelMap(target);
  const keys = new Set([...sourceChannels.keys(), ...targetChannels.keys()]);
  const diffs: TransitionChannelDiff[] = [];
  for (const key of Array.from(keys).sort()) {
    const sourceChannel = sourceChannels.get(key);
    const targetChannel = targetChannels.get(key);
    const sourceValue = sourceChannel?.value;
    const targetValue = targetChannel?.value;
    if (stableValue(sourceValue) === stableValue(targetValue)) continue;
    const channel = targetChannel ?? sourceChannel;
    if (!channel) continue;
    diffs.push({
      key,
      channelClass: channel.channelClass,
      capability: channel.capability,
      ownerKey: channel.ownerKey ?? null,
      ownerPriority: channel.ownerPriority ?? 0,
      sourceOwnerKey: sourceChannel?.ownerKey ?? null,
      targetOwnerKey: targetChannel?.ownerKey ?? null,
      sourceValue,
      targetValue,
    });
  }
  return diffs;
}

function fallbackForChangedChannels(
  changedChannels: readonly TransitionChannelDiff[],
): TransitionAssignmentKind | null {
  if (changedChannels.some((channel) => channel.capability === "crossfade")) {
    return "crossfade";
  }
  // DEC-163: color-material channels commit discretely, but they ride the
  // final commit rather than demoting the entity - an interpolable sibling
  // channel (scalar ramp) must keep its preserve-interpolate assignment.
  // A color-only change has nothing to interpolate and commits discretely.
  const hasInterpolableChange = changedChannels.some(
    (channel) => channel.capability === "interpolate",
  );
  if (
    changedChannels.some(
      (channel) =>
        channel.capability === "discrete-commit" &&
        (channel.channelClass !== "color-material" || !hasInterpolableChange),
    )
  ) {
    return "discrete-commit";
  }
  if (changedChannels.some((channel) => channel.capability === "hold")) {
    return "hold-until-ready";
  }
  return null;
}

function dependencyPolicyForPair(
  source: TransitionRenderEntity | undefined,
  target: TransitionRenderEntity | undefined,
): TransitionDependencyPolicy {
  const explicit = target?.dependencyPolicy ?? source?.dependencyPolicy;
  if (explicit) return explicit;
  return target?.derivedFromEntityKey || source?.derivedFromEntityKey
    ? "follow-source"
    : "independent";
}

function entityDependencyKey(
  source: TransitionRenderEntity | undefined,
  target: TransitionRenderEntity | undefined,
): string | null {
  return target?.derivedFromEntityKey ?? source?.derivedFromEntityKey ?? null;
}

function executionModeForAssignment(
  assignment: TransitionAssignmentKind,
): TransitionExecutionMode {
  switch (assignment) {
    case "skip":
      return "none";
    case "preserve-interpolate":
      return "interpolate-channels";
    case "enter":
      return "enter";
    case "exit":
      return "exit";
    case "crossfade":
      return "crossfade";
    case "hold-until-ready":
      return "hold-source";
    case "discrete-commit":
      return "commit-discrete";
  }
}

function traceReasonsForAssignment(input: {
  assignment: TransitionAssignmentKind;
  compatibility: TransitionRepresentationCompatibility;
  fallbackReason: string | null;
  changedChannels: readonly TransitionChannelDiff[];
  derivedFromEntityKey: string | null;
  dependencyPolicy: TransitionDependencyPolicy;
}): string[] {
  const reasons = [`assignment:${input.assignment}`];
  reasons.push(`compatibility:${input.compatibility}`);
  if (input.fallbackReason) reasons.push(input.fallbackReason);
  if (input.changedChannels.length > 0) {
    reasons.push(
      `changed-channels:${input.changedChannels
        .map((channel) => channel.key)
        .join(",")}`,
    );
  }
  if (input.derivedFromEntityKey) {
    reasons.push(
      `derived:${input.dependencyPolicy}:${input.derivedFromEntityKey}`,
    );
  }
  return reasons;
}

export function classifyTransitionEntityPair(
  input: TransitionEntityPairInput,
): TransitionEntityAssignment {
  const { source, target } = input;
  const entityKey = target?.entityKey ?? source?.entityKey ?? "unknown";
  const sourceVisible = isRenderable(source);
  const targetVisible = isRenderable(target);
  const compatibility = compatibilityForPair(
    source,
    target,
    input.compatibility,
  );
  const changedChannels = diffChannels(source, target);
  const sourceStateOrigin = source?.sourceStateOrigin ?? "unknown";
  const derivedFromEntityKey =
    target?.derivedFromEntityKey ?? source?.derivedFromEntityKey ?? null;
  const dependencyPolicy = dependencyPolicyForPair(source, target);

  let assignment: TransitionAssignmentKind;
  let fallbackReason: string | null = null;

  if (!sourceVisible && !targetVisible) {
    assignment = "skip";
  } else if (targetVisible && target && !isReady(target)) {
    assignment = "hold-until-ready";
    fallbackReason = "target representation is not ready";
  } else if (sourceVisible && !targetVisible) {
    assignment = "exit";
  } else if (!sourceVisible && targetVisible) {
    assignment = "enter";
  } else if (compatibility === "incompatible") {
    assignment = "crossfade";
    fallbackReason = "representations are incompatible";
  } else if (compatibility === "unknown") {
    assignment = "crossfade";
    fallbackReason = "representation compatibility is unknown";
  } else {
    const channelFallback = fallbackForChangedChannels(changedChannels);
    assignment = channelFallback ?? "preserve-interpolate";
    if (channelFallback) {
      fallbackReason = "one or more changed channels require fallback";
    }
  }
  const executionMode = executionModeForAssignment(assignment);
  const traceReasons = traceReasonsForAssignment({
    assignment,
    compatibility,
    fallbackReason,
    changedChannels,
    derivedFromEntityKey,
    dependencyPolicy,
  });

  return {
    entityKey,
    sourceEntityKey: source?.entityKey ?? null,
    targetEntityKey: target?.entityKey ?? null,
    sourcePresence: source?.presenceState ?? null,
    targetPresence: target?.presenceState ?? null,
    sourceReadiness: source?.readinessState ?? null,
    targetReadiness: target?.readinessState ?? null,
    sourceRepresentation: source?.representationKey ?? null,
    targetRepresentation: target?.representationKey ?? null,
    compatibility,
    derivedFromEntityKey,
    dependencyPolicy,
    changedChannels,
    assignment,
    executionMode,
    finalCommitPolicy: "visually-idempotent-target",
    fallbackReason,
    traceReasons,
    sourceStateOrigin,
  };
}

export function classifyTransitionRenderGraphs(
  input: TransitionRenderGraphInput,
): TransitionEntityAssignment[] {
  const sourceByKey = new Map(input.source.map((entity) => [entity.entityKey, entity]));
  const targetByKey = new Map(input.target.map((entity) => [entity.entityKey, entity]));
  const dependencyByKey = new Map<string, string | null>();
  const entityKeys = Array.from(
    new Set([...sourceByKey.keys(), ...targetByKey.keys()]),
  ).sort();
  for (const entityKey of entityKeys) {
    dependencyByKey.set(
      entityKey,
      entityDependencyKey(sourceByKey.get(entityKey), targetByKey.get(entityKey)),
    );
  }
  const depthForEntity = (
    entityKey: string,
    visited: ReadonlySet<string> = new Set(),
  ): number => {
    const parentKey = dependencyByKey.get(entityKey);
    if (!parentKey || visited.has(parentKey)) return 0;
    return (
      1 +
      depthForEntity(parentKey, new Set<string>([...visited, entityKey]))
    );
  };
  return entityKeys
    .map((entityKey) =>
      classifyTransitionEntityPair({
        source: sourceByKey.get(entityKey),
        target: targetByKey.get(entityKey),
      }),
    )
    .sort((left, right) => {
      const depthDelta =
        depthForEntity(left.entityKey) - depthForEntity(right.entityKey);
      if (depthDelta !== 0) return depthDelta;
      return left.entityKey.localeCompare(right.entityKey);
    });
}
