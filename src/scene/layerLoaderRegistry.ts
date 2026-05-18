import type * as THREE from "three";
import type { ProjectLayerSpec } from "../pages/types";
import type { SceneManager } from "./SceneManager";

export type LayerLoadContext = {
  spec: ProjectLayerSpec;
  manager: SceneManager;
  group: THREE.Group;
  onLoaded: (obj: THREE.Object3D) => void;
  resolveDataPath: (path: string) => string;
  files: Record<string, string>;
};

export type LayerLoaderHandler = {
  id: string;
  matches: (spec: ProjectLayerSpec, context: LayerLoadContext) => boolean;
  load: (context: LayerLoadContext) => Promise<void> | void;
};

export function createLayerLoaderRegistry(
  handlers: readonly LayerLoaderHandler[],
) {
  const orderedHandlers = Object.freeze([...handlers]);

  return {
    handlers: orderedHandlers,
    find(context: LayerLoadContext): LayerLoaderHandler | undefined {
      return orderedHandlers.find((handler) =>
        handler.matches(context.spec, context),
      );
    },
    load(context: LayerLoadContext): boolean {
      const handler = this.find(context);
      if (!handler) return false;
      void handler.load(context);
      return true;
    },
  };
}
