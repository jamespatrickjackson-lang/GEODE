import type { TransitionCommitGraph, TransitionCommitGraphEntity } from "./transitionCommitGate";

/** CPU-side adapter readings. "cpu-material-proxy" is never a GPU/composed opacity receipt. */
export interface TransitionObservedLayer {
  attached: boolean;
  visible: boolean;
  opacity: number | null;
  opacityMeasurement?: "direct" | "cpu-material-proxy";
}

/** Minimal structural Three.js Object3D shape; compare against the ACTIVE scene identity. */
export interface SceneRootLike {
  parent: SceneRootLike | null;
  visible: boolean;
}

export function observeSceneRootHierarchy(
  root: SceneRootLike,
  activeScene: SceneRootLike,
): { attached: boolean; visible: boolean } {
  const visited = new Set<SceneRootLike>();
  let current: SceneRootLike | null = root;
  let visible = true;
  while (current && !visited.has(current)) {
    visible = visible && current.visible;
    if (current === activeScene) {
      return { attached: true, visible };
    }
    visited.add(current);
    current = current.parent;
  }
  // Still registered, detached, cyclic, or attached to a different scene.
  return { attached: false, visible: false };
}

function observedEntity(
  entityKey: string,
  channels: Readonly<Record<string, unknown>>,
  measured: TransitionObservedLayer | null,
): TransitionCommitGraphEntity {
  const opacity = measured?.opacity;
  const finiteOpacity = typeof opacity === "number" && Number.isFinite(opacity);
  const proxy = measured?.opacityMeasurement === "cpu-material-proxy";
  const opacityKnown = !!measured?.attached && finiteOpacity && !proxy;
  return {
    entityKey,
    ...(measured
      ? {
          presenceState: !measured.attached
            ? "absent"
            : measured.visible
              ? "visible"
              : "hidden",
          visible: measured.attached && measured.visible,
        }
      : {}),
    presenceCoverage: measured ? "known" : "unknown",
    visibilityCoverage: measured ? "known" : "unknown",
    representationCoverage: "unknown",
    readinessCoverage: "unknown",
    // The numeric proxy is diagnostic CPU material evidence, NOT composed draw opacity.
    ...(proxy
      ? {
          opacityCompositionCoverage: "unknown" as const,
          ...(finiteOpacity ? { observedCpuMaterialOpacity: opacity } : {}),
        }
      : {}),
    channels: Object.fromEntries(
      Object.keys(channels).map((key) => [
        key,
        key === "opacity" && opacityKnown
          ? { value: opacity, coverage: "known" }
          : { coverage: "unknown" },
      ]),
    ),
  };
}

/**
 * Expected entities/keys form a schema only, never a source of measured values.
 * Additional registered physical layer roots can be detected, but this inventory
 * cannot enumerate arbitrary renderer-owned children, derived roots or GPU pixels.
 */
export function observeTransitionCommitGraph(
  expected: TransitionCommitGraph,
  readLayer: (layerId: string) => TransitionObservedLayer | null,
  listRegisteredLayerIds?: () => Iterable<string>,
): TransitionCommitGraph {
  const expectedLayerIds = new Set<string>();
  const entities = expected.entities.map((entity) => {
    // Do not interpret derived/product/section identities as their parent layer root.
    const parentKey = /^layer:([^:]+)$/.exec(entity.entityKey);
    if (parentKey) expectedLayerIds.add(parentKey[1]);
    return observedEntity(
      entity.entityKey,
      entity.channels ?? {},
      parentKey ? readLayer(parentKey[1]) : null,
    );
  });
  const seen = new Set(expectedLayerIds);
  for (const layerId of listRegisteredLayerIds?.() ?? []) {
    if (seen.has(layerId)) continue;
    seen.add(layerId);
    const measured = readLayer(layerId);
    if (!measured?.attached || !measured.visible) continue;
    // Unexpected physically visible registered roots are not projected targets.
    entities.push(observedEntity(`layer:${layerId}`, {}, measured));
  }
  return {
    entities,
    // Non-registered/derived scene objects and actual GPU output remain outside this scan.
    inventoryCoverage: "unknown",
  };
}
