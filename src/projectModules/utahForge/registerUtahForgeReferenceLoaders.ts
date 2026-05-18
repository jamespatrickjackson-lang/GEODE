import type * as THREE from "three";
import type { LayerLoaderHandler } from "../../scene/layerLoaderRegistry";

type ReferenceStageFactory = (label: string) => THREE.Object3D;

export function registerUtahForgeReferenceLoaders(
  loadReferenceStage: ReferenceStageFactory,
): LayerLoaderHandler[] {
  return [
    {
      id: "utah-forge-reference-stage",
      matches: (spec) => spec.id === "utah-forge-reference-stage",
      load: (context) =>
        context.onLoaded(loadReferenceStage("Utah FORGE reference stage")),
    },
  ];
}
