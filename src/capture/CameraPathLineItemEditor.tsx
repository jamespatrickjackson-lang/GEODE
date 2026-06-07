import type { CSSProperties } from "react";
import type {
  CaptureCameraPathLookModeV2,
  CaptureCameraPathNodeKindV2,
  CaptureCameraPathNodeV2,
} from "./captureCameraPathV2";
import type {
  CaptureCameraPathContinuityV3,
  CaptureCameraPathNodeV3,
  CaptureCameraPathSplineCouplingV3,
  CaptureCameraPathSplineHandleModeV3,
  CaptureCameraPathSplineHandleSideV3,
} from "./captureCameraPathV3";

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr)",
  gap: 8,
  width: "100%",
  padding: 8,
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.055)",
};

const selectedRowStyle: CSSProperties = {
  ...rowStyle,
  border: "1px solid rgba(120,218,196,0.48)",
  background: "rgba(120,218,196,0.11)",
};

const numberStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(245,248,250,0.9)",
  fontWeight: 760,
  fontVariantNumeric: "tabular-nums",
};

const contentStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const rowControlsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
};

const labelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  color: "rgba(220,228,232,0.76)",
  whiteSpace: "nowrap",
};

const fieldStyle: CSSProperties = {
  height: 28,
  minWidth: 72,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.94)",
  padding: "0 8px",
  fontSize: 12,
};

const buttonStyle: CSSProperties = {
  height: 28,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.94)",
  padding: "0 9px",
  fontWeight: 680,
  fontSize: 12,
  cursor: "pointer",
};

const summaryStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  color: "rgba(220,228,232,0.62)",
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
};

function compactVec(value: [number, number, number] | undefined): string {
  if (!value) return "unset";
  return value.map((part) => part.toFixed(1)).join(", ");
}

export function CameraPathLineItemEditor({
  index,
  node,
  v3Node,
  selected,
  compatibilityIds,
  onDelete,
  onEnabledChange,
  onHiddenChange,
  onHoldChange,
  onJump,
  onKindChange,
  onLookModeChange,
  onPickFocus,
  onSelect,
  onSplineContinuityChange,
  onSplineCouplingChange,
  onSplineHandleLengthChange,
  onSplineHandleModeChange,
  onUpdatePose,
}: {
  index: number;
  node: CaptureCameraPathNodeV2;
  v3Node?: CaptureCameraPathNodeV3 | null;
  selected: boolean;
  compatibilityIds?: boolean;
  onSelect(id: string): void;
  onEnabledChange(id: string, enabled: boolean): void;
  onHiddenChange(id: string, hidden: boolean): void;
  onKindChange(id: string, kind: CaptureCameraPathNodeKindV2): void;
  onHoldChange(id: string, seconds: number): void;
  onLookModeChange(id: string, mode: CaptureCameraPathLookModeV2): void;
  onSplineCouplingChange?(
    id: string,
    coupling: CaptureCameraPathSplineCouplingV3,
  ): void;
  onSplineHandleModeChange?(
    id: string,
    mode: CaptureCameraPathSplineHandleModeV3,
  ): void;
  onSplineContinuityChange?(
    id: string,
    continuity: CaptureCameraPathContinuityV3,
  ): void;
  onSplineHandleLengthChange?(
    id: string,
    side: CaptureCameraPathSplineHandleSideV3,
    length: number | "auto",
  ): void;
  onPickFocus(id: string): void;
  onJump(id: string): void;
  onUpdatePose(id: string): void;
  onDelete(id: string): void;
}) {
  const displayNumber = String(index).padStart(2, "0");
  const enabled = node.enabled !== false;
  const hidden = node.hidden === true;
  const splineControls = v3Node?.splineControls;
  const handleLengthValue = (side: CaptureCameraPathSplineHandleSideV3) => {
    const value = splineControls?.[side].length ?? "auto";
    return value === "auto" ? "auto" : String(Number(value.toFixed(3)));
  };
  const parseHandleLength = (value: string): number | "auto" => {
    if (value.trim().toLowerCase() === "auto") return "auto";
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.max(0, numberValue) : "auto";
  };
  return (
    <div
      data-testid="capture-path-row"
      data-node-id={node.id}
      style={selected ? selectedRowStyle : rowStyle}
      onClick={() => onSelect(node.id)}
    >
      <span data-testid="capture-path-row-number" style={numberStyle}>
        {displayNumber}
      </span>
      <div style={contentStyle}>
        <div style={rowControlsStyle}>
          <label style={labelStyle}>
            <input
              data-testid="capture-path-row-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(event) => onEnabledChange(node.id, event.currentTarget.checked)}
            />
            <span>Active</span>
          </label>
          <label style={labelStyle}>
            <input
              data-testid="capture-path-row-hidden"
              type="checkbox"
              checked={!hidden}
              onChange={(event) => onHiddenChange(node.id, !event.currentTarget.checked)}
            />
            <span>Show</span>
          </label>
          <label style={labelStyle}>
            <span>Kind</span>
            <select
              data-testid={compatibilityIds ? "capture-path-node-kind" : undefined}
              value={node.kind}
              onChange={(event) =>
                onKindChange(node.id, event.currentTarget.value as CaptureCameraPathNodeKindV2)
              }
              style={fieldStyle}
            >
              <option data-testid="capture-path-keyframe-node" value="keyframe">
                Keyframe
              </option>
              <option data-testid="capture-path-transition-node" value="transition">
                Transition
              </option>
            </select>
          </label>
          <label style={labelStyle}>
            <span>Hold</span>
            <input
              data-testid={compatibilityIds ? "capture-path-keyframe-hold-time" : undefined}
              type="number"
              min={0}
              max={600}
              step={0.1}
              disabled={node.kind === "transition"}
              value={node.kind === "transition" ? 0 : node.holdSecondsAfter}
              onChange={(event) => onHoldChange(node.id, Number(event.currentTarget.value))}
              style={{ ...fieldStyle, width: 66, minWidth: 66 }}
            />
          </label>
          <label style={labelStyle}>
            <span>Look</span>
            <select
              data-testid={compatibilityIds ? "capture-path-look-mode" : undefined}
              value={node.lookMode}
              onChange={(event) =>
                onLookModeChange(node.id, event.currentTarget.value as CaptureCameraPathLookModeV2)
              }
              style={fieldStyle}
            >
              <option value="free-direction">Free direction</option>
              <option value="follow-path-tangent">Follow path</option>
              <option value="focus-point-lock">Focus point</option>
            </select>
          </label>
          <button
            data-testid={compatibilityIds ? "capture-path-focus-binding" : undefined}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPickFocus(node.id);
            }}
            style={buttonStyle}
          >
            Pick Focus
          </button>
        </div>
        {splineControls && (
          <div style={rowControlsStyle} onClick={(event) => event.stopPropagation()}>
            <label style={labelStyle}>
              <span>Spline</span>
              <select
                data-testid={compatibilityIds ? "capture-path-node-spline-mode" : undefined}
                value={splineControls.handleMode}
                onChange={(event) =>
                  onSplineHandleModeChange?.(
                    node.id,
                    event.currentTarget.value as CaptureCameraPathSplineHandleModeV3,
                  )
                }
                style={fieldStyle}
              >
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
                <option value="vector">Vector</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span>Coupling</span>
              <select
                data-testid={compatibilityIds ? "capture-path-node-spline-coupling" : undefined}
                value={splineControls.coupling}
                onChange={(event) =>
                  onSplineCouplingChange?.(
                    node.id,
                    event.currentTarget.value as CaptureCameraPathSplineCouplingV3,
                  )
                }
                style={fieldStyle}
              >
                <option value="tangent">Tangent</option>
                <option value="non-tangent">Non-tangent</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span>G</span>
              <select
                data-testid={compatibilityIds ? "capture-path-node-spline-continuity" : undefined}
                value={splineControls.continuity}
                onChange={(event) =>
                  onSplineContinuityChange?.(
                    node.id,
                    event.currentTarget.value as CaptureCameraPathContinuityV3,
                  )
                }
                style={fieldStyle}
              >
                <option value="G0">G0</option>
                <option value="G1">G1</option>
                <option value="G2">G2</option>
                <option value="G3">G3</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span>In</span>
              <input
                data-testid={compatibilityIds ? "capture-path-node-spline-in" : undefined}
                type="text"
                value={handleLengthValue("in")}
                onChange={(event) =>
                  onSplineHandleLengthChange?.(
                    node.id,
                    "in",
                    parseHandleLength(event.currentTarget.value),
                  )
                }
                style={{ ...fieldStyle, width: 60, minWidth: 60 }}
              />
            </label>
            <label style={labelStyle}>
              <span>Out</span>
              <input
                data-testid={compatibilityIds ? "capture-path-node-spline-out" : undefined}
                type="text"
                value={handleLengthValue("out")}
                onChange={(event) =>
                  onSplineHandleLengthChange?.(
                    node.id,
                    "out",
                    parseHandleLength(event.currentTarget.value),
                  )
                }
                style={{ ...fieldStyle, width: 60, minWidth: 60 }}
              />
            </label>
          </div>
        )}
        <div style={rowControlsStyle}>
          <button data-testid="capture-path-row-jump" type="button" onClick={() => onJump(node.id)} style={buttonStyle}>
            Jump
          </button>
          <button data-testid="capture-path-row-set-current" type="button" onClick={() => onUpdatePose(node.id)} style={buttonStyle}>
            Set From Current
          </button>
          <button data-testid="capture-path-row-delete" type="button" onClick={() => onDelete(node.id)} style={buttonStyle}>
            Delete
          </button>
        </div>
        <div style={summaryStyle}>
          <span>pos {compactVec(node.position)}</span>
          <span>target {compactVec(node.target)}</span>
          {node.focusPointId ? <span data-testid="capture-path-focus-point">focus {node.focusPointId}</span> : null}
        </div>
      </div>
    </div>
  );
}
