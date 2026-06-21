import { useEffect } from "react";
import { useEditor } from "../EditorContext";
import { reorderArray } from "./reorder";
import { registerReorderGroup } from "./reorderRegistry";

// Binds the dev-mode reorder registry to the real editor dispatches. UI-only:
// reorders the editor catalog arrays for sidebar display; the scene/transition
// runtime resolves layers and overlays by id, so there is no render effect.
// Rendered only while dev mode is enabled (mounted inside the inspector portal).
export function DevModeReorderRegistration() {
  const { reorderLayer, reorderSceneOverlay } = useEditor();

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
      commit: (commit) =>
        reorderSceneOverlay(
          reorderArray(commit.orderedIds, commit.fromIndex, commit.toIndex),
        ),
    });
    // Phase 6: sidebar structure is JSX + manifest ordered; runtime cannot mutate
    // it. Emit a proposal (manifestId order) for a dev/agent to apply as a
    // manifest + source change. devModeReorderGuard.
    registerReorderGroup({
      key: "sidebar-structure",
      kind: "manifest-guarded",
      label: "Sidebar structure",
      propose: (commit) => {
        const order = reorderArray(
          commit.orderedIds,
          commit.fromIndex,
          commit.toIndex,
        );
        if (typeof console !== "undefined") {
          console.info("[dev-mode reorder] sidebar-structure proposal", {
            apply:
              "reorder editor-control-manifest.json entries + EditorRoot " +
              "<CollapsibleSection> JSX to this manifestId order; run " +
              "npm run check:editor-controls",
            order,
          });
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("devmode:reorder-proposal", { detail: { order } }),
          );
        }
      },
    });
  }, [reorderLayer, reorderSceneOverlay]);

  return null;
}
