import type * as THREE from "three";
import type { LayerLoaderHandler } from "../../scene/layerLoaderRegistry";

type ReferenceStageFactory = (label: string) => THREE.Object3D;

export function registerBaseGuiLoaders(
  loadReferenceStage: ReferenceStageFactory,
): LayerLoaderHandler[] {
  return [
    {
      id: "base-gui-reference-stage",
      matches: (spec) => spec.id === "base-gui-reference-stage",
      load: (context) =>
        context.onLoaded(loadReferenceStage("Base GUI reference stage")),
    },
  ];
}
