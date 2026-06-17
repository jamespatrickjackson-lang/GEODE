import type { CSSProperties } from "react";
import type { CaptureCameraPathSegmentV2 } from "./captureCameraPathV2";
import type {
  CaptureCameraPathBezierSegmentV3,
  CaptureCameraPathContinuityV3,
  CaptureCameraPathLensModeV3,
  CaptureCameraPathSegmentV3,
  CaptureCameraPathTimeCurveModeV3,
  CaptureCameraPathTimeCurveV3,
} from "./captureCameraPathV3";

const rootStyle: CSSProperties = {
  width: "calc(100% - 42px)",
  marginLeft: 42,
  padding: "7px 8px",
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.038)",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 7,
};

const selectedStyle: CSSProperties = {
  ...rootStyle,
  borderColor: "rgba(147,197,253,0.42)",
  background: "rgba(147,197,253,0.08)",
};

const labelTextStyle: CSSProperties = {
  color: "rgba(236,242,246,0.82)",
  fontSize: 11,
  fontWeight: 760,
  textTransform: "uppercase",
};

const labelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  color: "rgba(220,228,232,0.74)",
  whiteSpace: "nowrap",
};

const fieldStyle: CSSProperties = {
  height: 28,
  minWidth: 66,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.94)",
  padding: "0 8px",
  fontSize: 12,
};

const pendingFieldStyle: CSSProperties = {
  ...fieldStyle,
  opacity: 0.56,
};

const transitionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
};

const transitionSectionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
  paddingTop: 6,
  borderTop: "1px solid rgba(255,255,255,0.075)",
};

const sectionTitleStyle: CSSProperties = {
  color: "rgba(236,242,246,0.78)",
  fontSize: 10,
  fontWeight: 760,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const narrowNumberStyle: CSSProperties = {
  ...pendingFieldStyle,
  width: 58,
  minWidth: 58,
  paddingRight: 8,
};

export function CameraPathTransitionEditor({
  displayIndex,
  fromIndex,
  onDurationChange,
  onEasingChange,
  onEnabledChange,
  onHiddenChange,
  onSelect,
  onAutoHandlesChange,
  onBiasChange,
  onContinuityChange,
  onEquationSelectedChange,
  onInfluenceChange,
  onLensModeChange,
  onDollyStrengthChange,
  onTensionChange,
  onTimeCurveChange,
  segment,
  selected,
  toIndex,
  v3Segment,
  lensMode,
  dollyZoomStrength = 0,
  fairingDiagnostics,
}: {
  displayIndex: number;
  fromIndex: number;
  toIndex: number;
  segment: CaptureCameraPathSegmentV2;
  v3Segment?: CaptureCameraPathSegmentV3 | null;
  fairingDiagnostics?: CaptureCameraPathBezierSegmentV3["diagnostics"] | null;
  selected: boolean;
  onSelect(id: string): void;
  onEnabledChange(id: string, enabled: boolean): void;
  onHiddenChange(id: string, hidden: boolean): void;
  onDurationChange(id: string, seconds: number): void;
  onEasingChange(id: string, easing: "linear" | "ease-in-out"): void;
  onTimeCurveChange?(id: string, curve: CaptureCameraPathTimeCurveV3): void;
  onContinuityChange?(id: string, continuity: CaptureCameraPathContinuityV3): void;
  onTensionChange?(id: string, tension: number): void;
  onBiasChange?(id: string, bias: number): void;
  onInfluenceChange?(id: string, edge: "from" | "to", influence: number | "auto"): void;
  onAutoHandlesChange?(id: string, autoHandles: boolean): void;
  onEquationSelectedChange?(id: string, selected: boolean): void;
  lensMode?: CaptureCameraPathLensModeV3;
  dollyZoomStrength?: number;
  onLensModeChange?(id: string, mode: CaptureCameraPathLensModeV3): void;
  onDollyStrengthChange?(id: string, strength: number): void;
}) {
  const enabled = segment.enabled !== false;
  const hidden = segment.hidden === true;
  const fairing = v3Segment?.pathFairing ?? {
    continuity: "G1" as const,
    tension: 0.35,
    bias: 0,
    fromInfluenceOut: "auto" as const,
    toInfluenceIn: "auto" as const,
    autoHandles: true,
  };
  const v3ControlsEnabled = !!v3Segment;
  const influenceInputValue = (value: number | "auto") =>
    value === "auto" ? "auto" : String(value);
  const parseInfluence = (value: string): number | "auto" => {
    if (value.trim().toLowerCase() === "auto") return "auto";
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.max(0, numberValue) : "auto";
  };
  const setTimeCurveMode = (mode: CaptureCameraPathTimeCurveModeV3) => {
    onTimeCurveChange?.(segment.id, {
      mode,
      ...(mode === "custom-ramp"
        ? {
            ramp: [
              { t: 0, value: 0 },
              { t: 0.5, value: 0.5 },
              { t: 1, value: 1 },
            ],
          }
        : {}),
    });
  };
  const guardApplied =
    !!fairingDiagnostics &&
    (fairingDiagnostics.fallbackApplied ||
      fairingDiagnostics.derivativeGuardApplied ||
      fairingDiagnostics.envelopeGuardApplied ||
      fairingDiagnostics.loopbackGuardApplied ||
      fairingDiagnostics.effectiveContinuity !== fairingDiagnostics.requestedContinuity);
  const guardLabel = fairingDiagnostics
    ? `Gx guard ${fairingDiagnostics.requestedContinuity} -> ${fairingDiagnostics.effectiveContinuity}`
    : "";
  return (
    <div
      data-testid="capture-path-transition"
      data-segment-id={segment.id}
      style={selected ? selectedStyle : rootStyle}
      onClick={() => onSelect(segment.id)}
    >
      <div style={transitionHeaderStyle}>
        <span data-testid="capture-path-transition-label" style={labelTextStyle}>
          Transition {String(fromIndex).padStart(2, "0")} -&gt; {String(toIndex).padStart(2, "0")}
        </span>
        <label style={labelStyle} onClick={(event) => event.stopPropagation()}>
          <input
            data-testid="capture-path-transition-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(segment.id, event.currentTarget.checked)}
          />
          <span>Active</span>
        </label>
        <label style={labelStyle} onClick={(event) => event.stopPropagation()}>
          <input
            data-testid="capture-path-transition-hidden"
            type="checkbox"
            checked={!hidden}
            onChange={(event) => onHiddenChange(segment.id, !event.currentTarget.checked)}
          />
          <span>Show</span>
        </label>
        <span style={{ color: "rgba(220,228,232,0.58)", fontSize: 11 }}>
          {displayIndex}
        </span>
      </div>
      <div style={transitionSectionStyle} onClick={(event) => event.stopPropagation()}>
        <span style={sectionTitleStyle}>Timing</span>
        <label style={labelStyle}>
          <span>Duration</span>
          <input
            data-testid="capture-path-transition-duration"
            data-capture-legacy-id="capture-path-segment-transition-time"
            type="number"
            min={0}
            max={600}
            step={0.1}
            value={segment.transitionSeconds}
            onChange={(event) => onDurationChange(segment.id, Number(event.currentTarget.value))}
            style={{ ...fieldStyle, width: 68, minWidth: 68 }}
          />
        </label>
        <label style={labelStyle}>
          <span>Easing</span>
          <select
            data-testid="capture-path-transition-easing"
            value="linear"
            onChange={(event) =>
              onEasingChange(segment.id, event.currentTarget.value as "linear")
            }
            style={fieldStyle}
          >
            <option value="linear">Linear</option>
          </select>
        </label>
        <label style={labelStyle}>
          <span>Curve</span>
          <select
            data-testid="capture-path-time-curve"
            value="linear"
            onChange={(event) => setTimeCurveMode(event.currentTarget.value as CaptureCameraPathTimeCurveModeV3)}
            style={fieldStyle}
          >
            <option value="linear">Linear</option>
          </select>
        </label>
      </div>
      <div style={transitionSectionStyle} onClick={(event) => event.stopPropagation()}>
        <span style={sectionTitleStyle}>Path Shape</span>
        <label style={labelStyle}>
          <span>Continuity</span>
          <select
            data-testid="capture-path-continuity"
            value={fairing.continuity}
            disabled={!v3ControlsEnabled}
            onChange={(event) =>
              onContinuityChange?.(
                segment.id,
                event.currentTarget.value as CaptureCameraPathContinuityV3,
              )
            }
            style={v3ControlsEnabled ? fieldStyle : pendingFieldStyle}
          >
            <option value="G0">G0 position</option>
            <option value="G1">G1 tangent</option>
            <option value="G2">G2 curvature</option>
            <option value="G3">G3 flow</option>
          </select>
        </label>
        <label style={labelStyle}>
          <span>Tension</span>
          <input
            data-testid="capture-path-tension"
            type="number"
            min={-1}
            max={1}
            step={0.05}
            value={fairing.tension}
            disabled={!v3ControlsEnabled}
            onChange={(event) => onTensionChange?.(segment.id, Number(event.currentTarget.value))}
            style={v3ControlsEnabled ? { ...fieldStyle, width: 58, minWidth: 58 } : narrowNumberStyle}
          />
        </label>
        <label style={labelStyle}>
          <span>Bias</span>
          <input
            data-testid="capture-path-bias"
            type="number"
            min={-1}
            max={1}
            step={0.05}
            value={fairing.bias}
            disabled={!v3ControlsEnabled}
            onChange={(event) => onBiasChange?.(segment.id, Number(event.currentTarget.value))}
            style={v3ControlsEnabled ? { ...fieldStyle, width: 58, minWidth: 58 } : narrowNumberStyle}
          />
        </label>
        <label style={labelStyle}>
          <span>Gd out</span>
          <input
            data-testid="capture-path-gd-out"
            type="text"
            value={influenceInputValue(fairing.fromInfluenceOut)}
            disabled={!v3ControlsEnabled || fairing.autoHandles}
            onChange={(event) =>
              onInfluenceChange?.(segment.id, "from", parseInfluence(event.currentTarget.value))
            }
            style={v3ControlsEnabled ? { ...fieldStyle, width: 58, minWidth: 58 } : narrowNumberStyle}
          />
        </label>
        <label style={labelStyle}>
          <span>Gd in</span>
          <input
            data-testid="capture-path-gd-in"
            type="text"
            value={influenceInputValue(fairing.toInfluenceIn)}
            disabled={!v3ControlsEnabled || fairing.autoHandles}
            onChange={(event) =>
              onInfluenceChange?.(segment.id, "to", parseInfluence(event.currentTarget.value))
            }
            style={v3ControlsEnabled ? { ...fieldStyle, width: 58, minWidth: 58 } : narrowNumberStyle}
          />
        </label>
        {guardApplied && (
          <span
            data-testid="capture-path-gx-warning"
            title={fairingDiagnostics?.warnings.join(" ")}
            style={{
              color: "rgba(252,211,77,0.94)",
              fontSize: 11,
              fontWeight: 720,
            }}
          >
            {guardLabel}
          </span>
        )}
      </div>
      <div style={transitionSectionStyle} onClick={(event) => event.stopPropagation()}>
        <span style={sectionTitleStyle}>Aim</span>
        <label style={labelStyle}>
          <span>Lens</span>
          <select
            data-testid="capture-path-lens-mode"
            value={lensMode ?? "fixed-fov"}
            disabled={!v3ControlsEnabled}
            aria-label="Lens mode"
            onChange={(event) =>
              onLensModeChange?.(
                segment.id,
                event.currentTarget.value as CaptureCameraPathLensModeV3,
              )
            }
            style={v3ControlsEnabled ? fieldStyle : pendingFieldStyle}
          >
            <option value="fixed-fov">Fixed FOV</option>
            <option value="maintain-focus-size">Focus size</option>
            <option value="dolly-zoom">Dolly zoom</option>
          </select>
        </label>
        <label style={labelStyle}>
          <span>Dolly</span>
          <input
            data-testid="capture-path-dolly-strength"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={dollyZoomStrength}
            disabled={!v3ControlsEnabled}
            aria-label="Dolly strength"
            onChange={(event) =>
              onDollyStrengthChange?.(segment.id, Number(event.currentTarget.value))
            }
            style={v3ControlsEnabled ? { ...fieldStyle, width: 58, minWidth: 58 } : narrowNumberStyle}
          />
        </label>
      </div>
      <div style={transitionSectionStyle} onClick={(event) => event.stopPropagation()}>
        <span style={sectionTitleStyle}>Overlay</span>
        <label style={labelStyle}>
          <input
            data-testid="capture-path-auto-handles"
            type="checkbox"
            checked={fairing.autoHandles}
            disabled={!v3ControlsEnabled}
            onChange={(event) =>
              onAutoHandlesChange?.(segment.id, event.currentTarget.checked)
            }
          />
          <span>Auto handles</span>
        </label>
        <label style={labelStyle}>
          <input
            data-testid="capture-path-equation-selected"
            type="checkbox"
            checked={selected}
            disabled={!v3ControlsEnabled}
            onChange={(event) =>
              onEquationSelectedChange?.(segment.id, event.currentTarget.checked)
            }
          />
          <span>Selected equation</span>
        </label>
      </div>
    </div>
  );
}
