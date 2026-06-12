import {
  classifyTransitionRenderGraphs,
  type TransitionAssignmentKind,
  type TransitionChannel,
  type TransitionChannelCapability,
  type TransitionChannelClass,
  type TransitionDependencyPolicy,
  type TransitionEntityAssignment,
  type TransitionExecutionMode,
  type TransitionPresenceState,
  type TransitionReadinessState,
  type TransitionRenderEntity,
  type TransitionRepresentationCompatibility,
  type TransitionStateOrigin,
} from "./transitionEntityPolicy";

type TransitionGraphChannelRecord = Readonly<Record<string, unknown>>;

interface TransitionRenderGraphChannelInputs {
  channelOwnerKey?: string;
  channelOwnerPriority?: number;
  scalarChannels?: TransitionGraphChannelRecord;
  colorChannels?: TransitionGraphChannelRecord;
  spatialChannels?: TransitionGraphChannelRecord;
  categoricalChannels?: TransitionGraphChannelRecord;
  crossfadeChannels?: TransitionGraphChannelRecord;
  unknownChannels?: TransitionGraphChannelRecord;
  channels?: readonly TransitionChannel[];
  metadata?: Readonly<Record<string, unknown>>;
}

export interface TransitionRenderGraphDerivedEntityState
  extends TransitionRenderGraphChannelInputs {
  entityKey: string;
  representationKey: string;
  presenceState: TransitionPresenceState;
  readinessState: TransitionReadinessState;
  derivedFromEntityKey?: string;
  dependencyPolicy?: TransitionDependencyPolicy;
  sourceStateOrigin?: TransitionStateOrigin;
}

export interface TransitionRenderGraphLayerState
  extends TransitionRenderGraphChannelInputs {
  layerId: string;
  entityKey?: string;
  representationKey: string;
  presenceState: TransitionPresenceState;
  readinessState: TransitionReadinessState;
  opacity?: number;
  opacityOwnerKey?: string;
  opacityOwnerPriority?: number;
  sourceStateOrigin?: TransitionStateOrigin;
  derivedFromEntityKey?: string;
  dependencyPolicy?: TransitionDependencyPolicy;
  derivedEntities?: readonly TransitionRenderGraphDerivedEntityState[];
}

export interface TransitionRenderGraphEvidence {
  sourcePageId?: string | null;
  targetPageId?: string | null;
  fixturePath?: string | null;
  observedCaseFamily?: string | null;
  reproductionRoute?: string | null;
}

export interface TransitionRenderGraphAdapterInput {
  sourceLayers: readonly TransitionRenderGraphLayerState[];
  targetLayers: readonly TransitionRenderGraphLayerState[];
  evidence?: TransitionRenderGraphEvidence;
}

export interface TransitionRenderGraphs {
  sourceGraph: TransitionRenderEntity[];
  targetGraph: TransitionRenderEntity[];
}

export interface TransitionAssignmentChannelTrace {
  key: string;
  channelClass: TransitionChannelClass;
  capability: TransitionChannelCapability;
  ownerKey: string | null;
  sourceValue: unknown;
  targetValue: unknown;
}

export interface TransitionAssignmentTrace {
  entityKey: string;
  sourcePresence: TransitionPresenceState | null;
  targetPresence: TransitionPresenceState | null;
  sourceReadiness: TransitionReadinessState | null;
  targetReadiness: TransitionReadinessState | null;
  sourceRepresentation: string | null;
  targetRepresentation: string | null;
  compatibility: TransitionRepresentationCompatibility;
  derivedFromEntityKey: string | null;
  dependencyPolicy: TransitionDependencyPolicy;
  changedChannels: TransitionAssignmentChannelTrace[];
  assignment: TransitionAssignmentKind;
  executionMode: TransitionExecutionMode;
  fallbackReason: string | null;
  traceReasons: string[];
}

export interface TransitionRenderGraphTrace extends TransitionRenderGraphs {
  assignments: TransitionEntityAssignment[];
  assignmentTraces: TransitionAssignmentTrace[];
  evidence: TransitionRenderGraphEvidence;
}

function opacityChannel(
  state: TransitionRenderGraphLayerState,
): TransitionChannel | null {
  if (typeof state.opacity !== "number" || !Number.isFinite(state.opacity)) {
    return null;
  }
  return {
    key: "opacity",
    ownerKey: state.opacityOwnerKey,
    ownerPriority: state.opacityOwnerPriority,
    channelClass: "continuous-scalar",
    capability: "interpolate",
    value: state.opacity,
  };
}

function channelsFromRecord(
  record: TransitionGraphChannelRecord | undefined,
  channelClass: TransitionChannelClass,
  capability: TransitionChannelCapability,
  ownerKey: string | undefined,
  ownerPriority: number | undefined,
): TransitionChannel[] {
  if (!record) return [];
  return Object.keys(record)
    .sort()
    .map((key) => ({
      key,
      ownerKey,
      ownerPriority,
      channelClass,
      capability,
      value: record[key],
    }));
}

function stateChannels(
  state: TransitionRenderGraphChannelInputs,
): TransitionChannel[] {
  return [
    ...channelsFromRecord(
      state.scalarChannels,
      "continuous-scalar",
      "interpolate",
      state.channelOwnerKey,
      state.channelOwnerPriority,
    ),
    ...channelsFromRecord(
      state.colorChannels,
      "color-material",
      "interpolate",
      state.channelOwnerKey,
      state.channelOwnerPriority,
    ),
    ...channelsFromRecord(
      state.spatialChannels,
      "spatial-transform",
      "interpolate",
      state.channelOwnerKey,
      state.channelOwnerPriority,
    ),
    ...channelsFromRecord(
      state.categoricalChannels,
      "discrete-categorical",
      "discrete-commit",
      state.channelOwnerKey,
      state.channelOwnerPriority,
    ),
    ...channelsFromRecord(
      state.crossfadeChannels,
      "representation",
      "crossfade",
      state.channelOwnerKey,
      state.channelOwnerPriority,
    ),
    ...channelsFromRecord(
      state.unknownChannels,
      "runtime-control",
      "none",
      state.channelOwnerKey,
      state.channelOwnerPriority,
    ),
    ...(state.channels ?? []),
  ];
}

function entityFromState(
  state: {
    entityKey: string;
    representationKey: string;
    presenceState: TransitionPresenceState;
    readinessState: TransitionReadinessState;
    derivedFromEntityKey?: string;
    dependencyPolicy?: TransitionDependencyPolicy;
    sourceStateOrigin?: TransitionStateOrigin;
    metadata?: Readonly<Record<string, unknown>>;
  } & TransitionRenderGraphChannelInputs,
): TransitionRenderEntity {
  return {
    entityKey: state.entityKey,
    representationKey: state.representationKey,
    presenceState: state.presenceState,
    readinessState: state.readinessState,
    derivedFromEntityKey: state.derivedFromEntityKey,
    dependencyPolicy: state.dependencyPolicy,
    channels: stateChannels(state),
    sourceStateOrigin: state.sourceStateOrigin,
    metadata: state.metadata,
  };
}

function entitiesFromLayerState(
  state: TransitionRenderGraphLayerState,
): TransitionRenderEntity[] {
  const opacity = opacityChannel(state);
  const entityKey = state.entityKey ?? `layer:${state.layerId}`;
  const parent = entityFromState({
    ...state,
    entityKey,
    channels: opacity ? [opacity, ...(state.channels ?? [])] : state.channels,
    representationKey: state.representationKey,
    metadata: {
      ...(state.metadata ?? {}),
      layerId: state.layerId,
    },
  });
  const derived = (state.derivedEntities ?? []).map((derivedState) =>
    entityFromState({
      ...derivedState,
      derivedFromEntityKey: derivedState.derivedFromEntityKey ?? entityKey,
      dependencyPolicy: derivedState.dependencyPolicy ?? "follow-source",
      channelOwnerKey: derivedState.channelOwnerKey ?? state.channelOwnerKey,
      channelOwnerPriority:
        derivedState.channelOwnerPriority ?? state.channelOwnerPriority,
      sourceStateOrigin: derivedState.sourceStateOrigin ?? state.sourceStateOrigin,
      metadata: {
        ...(derivedState.metadata ?? {}),
        parentLayerId: state.layerId,
      },
    }),
  );
  return [parent, ...derived];
}

export function buildTransitionRenderGraphs(
  input: TransitionRenderGraphAdapterInput,
): TransitionRenderGraphs {
  return {
    sourceGraph: input.sourceLayers.flatMap(entitiesFromLayerState),
    targetGraph: input.targetLayers.flatMap(entitiesFromLayerState),
  };
}

export function traceFromTransitionAssignment(
  assignment: TransitionEntityAssignment,
): TransitionAssignmentTrace {
  return {
    entityKey: assignment.entityKey,
    sourcePresence: assignment.sourcePresence,
    targetPresence: assignment.targetPresence,
    sourceReadiness: assignment.sourceReadiness,
    targetReadiness: assignment.targetReadiness,
    sourceRepresentation: assignment.sourceRepresentation,
    targetRepresentation: assignment.targetRepresentation,
    compatibility: assignment.compatibility,
    derivedFromEntityKey: assignment.derivedFromEntityKey,
    dependencyPolicy: assignment.dependencyPolicy,
    changedChannels: assignment.changedChannels.map((channel) => ({
      key: channel.key,
      channelClass: channel.channelClass,
      capability: channel.capability,
      ownerKey: channel.ownerKey,
      sourceValue: channel.sourceValue,
      targetValue: channel.targetValue,
    })),
    assignment: assignment.assignment,
    executionMode: assignment.executionMode,
    fallbackReason: assignment.fallbackReason,
    traceReasons: assignment.traceReasons.slice(),
  };
}

export function buildTransitionRenderGraphTrace(
  input: TransitionRenderGraphAdapterInput,
): TransitionRenderGraphTrace {
  const graphs = buildTransitionRenderGraphs(input);
  const assignments = classifyTransitionRenderGraphs({
    source: graphs.sourceGraph,
    target: graphs.targetGraph,
  });
  return {
    ...graphs,
    assignments,
    assignmentTraces: assignments.map(traceFromTransitionAssignment),
    evidence: { ...(input.evidence ?? {}) },
  };
}
