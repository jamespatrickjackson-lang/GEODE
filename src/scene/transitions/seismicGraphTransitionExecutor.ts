import {
  evaluateTransitionExecutionPlan,
  type TransitionEntityOperation,
  type TransitionExecutionPlan,
} from "./transitionExecutionPlan";
import {
  applyTransitionEntityOpacityFrames,
  type TransitionEntityOpacityObject,
} from "./transitionEntityOpacityExecutor";

// Phase 4 of the transition execution layer (TRD-013 / DEC-152). The seismic
// derived-entity graph is the first fully migrated consumer. The classifier
// gives each seismic object/figure/survey/comparison entity a stable identity
// and an execution mode; this executor turns the `seismic-entity` plan
// operations into per-entity transition opacity and applies it to the
// trace-header-tagged meshes, composed with product-owned shader opacity.
//
// Only survey-geometry and figure-annotation entities are faded here: they are
// independent sub-trees that previously crossfaded the whole seismic layer when
// toggled. Section/volume/comparison continuity stays with the existing layer
// opacity envelope, so same-product sections stay continuous across pages.
//
// This module is THREE-free so it unit-transpiles in isolation; the runtime tick
// reaches scene objects structurally through the SceneManager host.

export type SeismicEntityObjectKind =
  | "section"
  | "figure-annotation"
  | "survey-geometry"
  | "comparison"
  | "unknown";

export const SEISMIC_ENTITY_FADE_OBJECT_KINDS: ReadonlySet<SeismicEntityObjectKind> =
  new Set<SeismicEntityObjectKind>(["survey-geometry", "figure-annotation"]);

export function seismicEntityObjectKind(
  representationKey: string | null,
): SeismicEntityObjectKind {
  switch (representationKey) {
    case "seismic:survey-geometry":
      return "survey-geometry";
    case "seismic:figure-annotation":
      return "figure-annotation";
    case "seismic:comparison":
      return "comparison";
    case "seismic:2d-section-line":
    case "seismic:3d-section-plane":
    case "seismic:3d-volume":
      return "section";
    default:
      return "unknown";
  }
}

export interface SeismicEntityTransitionFrame {
  entityKey: string;
  parentLayerId: string | null;
  objectKind: SeismicEntityObjectKind;
  opacityFactor: number;
  done: boolean;
}

function isSeismicEntityOperation(operation: TransitionEntityOperation): boolean {
  return operation.executorKind === "seismic-entity";
}

// Per-entity transition opacity factors for the seismic fade kinds. Section and
// comparison entities are excluded: their continuity is owned by the layer
// opacity envelope, so forcing a per-entity factor here would double-fade them.
export function planSeismicEntityFrames(
  plan: TransitionExecutionPlan,
  nowMs: number,
): SeismicEntityTransitionFrame[] {
  const operationsByKey = new Map<string, TransitionEntityOperation>();
  for (const operation of plan.operations) {
    if (isSeismicEntityOperation(operation)) {
      operationsByKey.set(operation.entityKey, operation);
    }
  }
  if (operationsByKey.size === 0) return [];
  const frames = evaluateTransitionExecutionPlan(plan, nowMs);
  const result: SeismicEntityTransitionFrame[] = [];
  for (const frame of frames) {
    const operation = operationsByKey.get(frame.entityKey);
    if (!operation) continue;
    const objectKind = seismicEntityObjectKind(operation.representationKey);
    if (!SEISMIC_ENTITY_FADE_OBJECT_KINDS.has(objectKind)) continue;
    let opacityFactor: number;
    switch (frame.executionMode) {
      case "enter":
        opacityFactor = frame.enteringOpacityFactor;
        break;
      case "exit":
        opacityFactor = frame.exitingOpacityFactor;
        break;
      case "crossfade":
        opacityFactor = frame.crossfadeTargetAlpha;
        break;
      case "hold-source":
        opacityFactor =
          operation.sourcePresence === "visible" ||
          operation.sourcePresence === "ready"
            ? 1
            : 0;
        break;
      default:
        // preserve-interpolate: no entity opacity write is needed. The layer
        // envelope owns any parent fade for continuously present entities.
        continue;
    }
    result.push({
      entityKey: frame.entityKey,
      parentLayerId: operation.parentLayerId,
      objectKind,
      opacityFactor,
      done: frame.done,
    });
  }
  return result;
}

// Whether the seismic graph executor has any work for the current transition.
export function planHasSeismicFadeEntities(
  plan: TransitionExecutionPlan,
): boolean {
  return plan.operations.some(
    (operation) =>
      isSeismicEntityOperation(operation) &&
      SEISMIC_ENTITY_FADE_OBJECT_KINDS.has(
        seismicEntityObjectKind(operation.representationKey),
      ) &&
      (operation.executionMode === "enter" ||
        operation.executionMode === "exit" ||
        operation.executionMode === "crossfade"),
  );
}

// Per-frame runtime apply. Fades survey-geometry and figure-annotation sub-trees
// to their planned transition opacity, composed with product opacity by
// the generic entity-opacity executor. The final transition commit reapplies
// the seismic style, restoring exact target opacities, so any in-flight factor
// is transient and self-healing. Typed `this: any` to match the SceneManager
// impl convention where private members are reached structurally.
export function tickSeismicGraphTransitionImpl(
  this: any,
  nowMs: number,
): void {
  const plan = this.activeSceneTransitionContext?.executionPlan ?? null;
  if (!plan) {
    this.seismicGraphTransitionActiveEntities.clear();
    return;
  }
  const frames = planSeismicEntityFrames(plan, nowMs);
  if (frames.length === 0) {
    this.seismicGraphTransitionActiveEntities.clear();
    return;
  }
  const root = this.seismicGraphTransitionRoot() as TransitionEntityOpacityObject | null;
  if (!root) return;
  for (const frame of frames) {
    if (frame.done) {
      this.seismicGraphTransitionActiveEntities.delete(frame.entityKey);
    } else {
      this.seismicGraphTransitionActiveEntities.add(frame.entityKey);
    }
  }
  applyTransitionEntityOpacityFrames(root, frames, {
    parentOpacityForLayer: (layerId) =>
      typeof this.transitionFrameOpacityForLayer === "function"
        ? this.transitionFrameOpacityForLayer(layerId)
        : 1,
  });
}
