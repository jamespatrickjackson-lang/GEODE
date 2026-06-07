import { vibrancyLabel } from "../../styles";
import { nestedControlRowStyle, nestedFieldLabelStyle } from "../../styleControls";
import type { SceneHandle } from "../../../scene";

export function ScalarPointDrawReadout({
  sceneHandle,
  layerId,
  inclusionMode,
}: {
  sceneHandle: SceneHandle;
  layerId: string;
  inclusionMode: "all-valid" | "thresholded";
}) {
  const group = sceneHandle.manager.getLayer(layerId);
  let sourceCount = 0;
  let drawnCount = 0;

  group?.traverse((object) => {
    const geometry = (
      object as {
        geometry?: {
          getAttribute?: (name: string) => { count?: number } | undefined;
          getIndex?: () => { count?: number } | null;
          userData?: Record<string, unknown>;
        };
      }
    ).geometry;
    const positionCount = geometry?.getAttribute?.("position")?.count;
    if (typeof positionCount !== "number" || positionCount <= 0) return;
    if (!geometry?.userData?.scalarValues) return;

    sourceCount += positionCount;
    const indexCount = geometry.getIndex?.()?.count;
    drawnCount += typeof indexCount === "number" ? indexCount : positionCount;
  });

  const hasPoints = sourceCount > 0;
  const allDrawn = hasPoints && sourceCount === drawnCount;

  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Render count</label>
      <span
        style={{
          flex: 1,
          color: allDrawn ? vibrancyLabel : "#ffbf6b",
          fontSize: 11,
          lineHeight: 1.35,
        }}
      >
        {hasPoints
          ? `Rendered ${drawnCount.toLocaleString()} / ${sourceCount.toLocaleString()} cells (${inclusionMode})`
          : `Waiting for resistivity cell tiles (${inclusionMode})`}
      </span>
    </div>
  );
}
