import { useEffect } from "react";
import { useEditor } from "../EditorContext";
import { reorderArray } from "./reorder";
import { registerReorderGroup } from "./reorderRegistry";

// Binds the dev-mode reorder registry to the real editor dispatches. UI-only:
// reorders the editor catalog arrays for sidebar display; the scene/transition
// runtime resolves layers and overlays by id, so there is no render effect.
// Rendered only while dev mode is enabled (mounted inside the inspector portal).
export function DevModeReorderRegistration() {
  const { reorderLayer, reorderSceneOverlay, state } = useEditor();
  const selectedPageId =
    typeof state.selectedPageId === "string" ? state.selectedPageId : null;

  useEffect(() => {
    registerReorderGroup({
      key: "layers",
      kind: "data",
      label: "Layers",
      commit: (commit) =>
        reorderLayer(
          reorderArray(commit.orderedIds, commit.fromIndex, commit.toIndex),
        ),
    });
    registerReorderGroup({
      key: "scene-overlays",
      kind: "data",
      label: "Scene overlays",
      commit: (commit) => {
        if (!selectedPageId) return;
        reorderSceneOverlay(
          selectedPageId,
          reorderArray(commit.orderedIds, commit.fromIndex, commit.toIndex),
        );
      },
    });
  }, [reorderLayer, reorderSceneOverlay, selectedPageId]);

  return null;
}
