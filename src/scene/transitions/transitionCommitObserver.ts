import type { TransitionCommitGraph } from "./transitionCommitGate";

/**
 * Renderer-adapter measurements. Opacity is null when no material can be sampled;
 * never substitute an authored, target or effective-style value.
 */
export interface TransitionObservedLayer {
  attached: boolean;
  visible: boolean;
  opacity: number | null;
}

/**
 * Observe only channels with an independent scene-root read. Entity keys and
 * requested channel keys provide a comparison schema, NOT observed values.
 * Derived roots, representation, readiness, scalar/MT/seismic/Section ISO and
 * clipping channels remain explicitly unobservable until owned adapters exist.
 */
export function observeTransitionCommitGraph(
  expected: TransitionCommitGraph,
  readLayer: (layerId: string) => TransitionObservedLayer | null,
): TransitionCommitGraph {
  return {
    entities: expected.entities.map((entity) => {
      // A parent layer is directly addressable as a SceneManager layer group.
      // Derived/product/section entity keys are not equivalent to parent roots.
      const parentKey = /^layer:([^:]+)$/.exec(entity.entityKey);
      const measured = parentKey ? readLayer(parentKey[1]) : null;
      const opacity = measured?.opacity;
      const opacityKnown =
        measured !== null &&
        measured !== undefined &&
        typeof opacity === "number" &&
        Number.isFinite(opacity);

      return {
        entityKey: entity.entityKey,
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
        channels: Object.fromEntries(
          Object.keys(entity.channels ?? {}).map((key) => [
            key,
            key === "opacity" && opacityKnown
              ? { value: opacity, coverage: "known" }
              : { coverage: "unknown" },
          ]),
        ),
      };
    }),
  };
}
