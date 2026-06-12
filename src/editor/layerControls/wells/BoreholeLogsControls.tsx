import type React from "react";
import type { EditableStyle, PresentationPage } from "../../../pages/types";
import {
  editorDarkSelectStyle,
  EnvSelectRow,
  LayerBooleanStyleControl,
  LayerNumberStyleControl,
  detailsContentStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  styleNumber,
  type LayerStyleSetter,
  type PageStyleClearer,
  type PageStyleSetter,
} from "../../styleControls";
import { panelStyles } from "../../styles";

const WELL_OPTIONS = [
  { value: "all", label: "All wells" },
  { value: "16A(78)-32", label: "16A(78)-32" },
  { value: "16B(78)-32", label: "16B(78)-32" },
  { value: "58-32", label: "58-32" },
  { value: "68-32", label: "68-32" },
  { value: "78-32", label: "78-32" },
] as const;

const TRACKS = [
  { key: "gamma", label: "GR" },
  { key: "resistivity", label: "Resistivity" },
  { key: "lithology", label: "Lithology" },
] as const;

function activeWell(style: EditableStyle): string {
  return typeof style.boreholeLogActiveWell === "string"
    ? style.boreholeLogActiveWell
    : "all";
}

function trackSelection(style: EditableStyle) {
  const selection = style.boreholeLogTrackSelection;
  return {
    gamma: selection?.gamma !== false,
    resistivity: selection?.resistivity !== false,
    lithology: selection?.lithology !== false,
  };
}

function TrackSelectionRow({
  style,
  disabled,
  onChange,
}: {
  style: EditableStyle;
  disabled: boolean;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const selection = trackSelection(style);
  return (
    <div
      style={nestedControlRowStyle}
      data-dev-source="src/editor/layerControls/wells/BoreholeLogsControls.tsx"
      data-dev-control="borehole-logs.track-selection"
    >
      <label style={nestedFieldLabelStyle}>Tracks</label>
      <div style={trackButtonGroupStyle}>
        {TRACKS.map((track) => (
          <label key={track.key} style={trackToggleStyle}>
            <input
              type="checkbox"
              checked={selection[track.key]}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  boreholeLogTrackSelection: {
                    ...selection,
                    [track.key]: event.target.checked,
                  },
                })
              }
            />
            <span>{track.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function PageActiveWellRow({
  value,
  disabled,
  onSet,
  onToggleOverride,
}: {
  value: string;
  disabled: boolean;
  onSet: (value: string) => void;
  onToggleOverride?: (enabled: boolean) => void;
}) {
  return (
    <div
      style={nestedControlRowStyle}
      data-dev-source="src/editor/layerControls/wells/BoreholeLogsControls.tsx"
      data-dev-control="borehole-logs.active-well"
    >
      <label style={nestedFieldLabelStyle}>Active well</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onSet(event.target.value)}
        style={{
          ...editorDarkSelectStyle,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {WELL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        type="checkbox"
        checked={!disabled}
        onChange={(event) => onToggleOverride?.(event.target.checked)}
        title="Override environment borehole log controls for this page"
      />
    </div>
  );
}

export function boreholeLogPatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    boreholeLogActiveWell: activeWell(style),
    boreholeLogTrackSelection: trackSelection(style),
    boreholeLogTrackOffsetM: styleNumber(style, "boreholeLogTrackOffsetM", 24),
    boreholeLogTrackWidthM: styleNumber(style, "boreholeLogTrackWidthM", 36),
    boreholeLogGammaScaleApi: styleNumber(style, "boreholeLogGammaScaleApi", 150),
    boreholeLogResistivityMinOhmM: styleNumber(
      style,
      "boreholeLogResistivityMinOhmM",
      1,
    ),
    boreholeLogResistivityMaxOhmM: styleNumber(
      style,
      "boreholeLogResistivityMaxOhmM",
      1000,
    ),
    boreholeLogCurveFillCutoff: styleNumber(style, "boreholeLogCurveFillCutoff", 0),
    boreholeLogCurveOpacity: styleNumber(style, "boreholeLogCurveOpacity", 0.92),
    boreholeLogCurveLineWidthPx: styleNumber(
      style,
      "boreholeLogCurveLineWidthPx",
      2.6,
    ),
    boreholeLogDepthMinFt: styleNumber(style, "boreholeLogDepthMinFt", 0),
    boreholeLogDepthMaxFt: styleNumber(style, "boreholeLogDepthMaxFt", 30000),
    boreholeLogVerticalExaggeration: styleNumber(
      style,
      "boreholeLogVerticalExaggeration",
      1,
    ),
    boreholeLogLithologyOpacity: styleNumber(
      style,
      "boreholeLogLithologyOpacity",
      0.72,
    ),
    boreholeLogLithologyWidthPx: styleNumber(style, "boreholeLogLithologyWidthPx", 12),
    boreholeLogProvenanceVisible: style.boreholeLogProvenanceVisible !== false,
    boreholeLogReadoutVisible: style.boreholeLogReadoutVisible !== false,
  };
}

export function BoreholeLogsControls({
  style,
  disabled = false,
  isEnv,
  currentPage,
  layerId,
  onToggleOverride,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
}: {
  style: EditableStyle;
  disabled?: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  onToggleOverride?: (enabled: boolean) => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const controlsDisabled = disabled || (!isEnv && !currentPage);
  const patch = (next: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, next);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, next);
    }
  };
  return (
    <details style={nestedDetailsStyle} open>
      <summary style={panelStyles.summary}>Borehole Logs</summary>
      <div style={detailsContentStyle}>
        {isEnv ? (
          <EnvSelectRow
            label="Active well"
            value={activeWell(style)}
            options={WELL_OPTIONS}
            testId="borehole-logs-active-well"
            disabled={controlsDisabled}
            onChange={(value) => patch({ boreholeLogActiveWell: value })}
          />
        ) : currentPage ? (
          <PageActiveWellRow
            value={activeWell(style)}
            disabled={controlsDisabled}
            onSet={(value) => patch({ boreholeLogActiveWell: value })}
            onToggleOverride={onToggleOverride}
          />
        ) : null}

        <TrackSelectionRow style={style} disabled={controlsDisabled} onChange={patch} />

        <LayerNumberStyleControl
          label="Lane base offset"
          field="boreholeLogTrackOffsetM"
          fallback={24}
          min={0}
          max={220}
          step={2}
          decimals={0}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-track-offset"
        />
        <LayerNumberStyleControl
          label="Amplitude width"
          field="boreholeLogTrackWidthM"
          fallback={36}
          min={1}
          max={120}
          step={2}
          decimals={0}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-track-width"
        />
        <LayerNumberStyleControl
          label="GR scale (API)"
          field="boreholeLogGammaScaleApi"
          fallback={150}
          min={1}
          max={1000}
          step={5}
          decimals={0}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-gr-scale"
        />
        <LayerNumberStyleControl
          label="Res min"
          field="boreholeLogResistivityMinOhmM"
          fallback={1}
          min={0.01}
          max={100000}
          step={1}
          decimals={2}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-res-min"
        />
        <LayerNumberStyleControl
          label="Res max"
          field="boreholeLogResistivityMaxOhmM"
          fallback={1000}
          min={0.01}
          max={1000000}
          step={10}
          decimals={2}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-res-max"
        />
        <LayerNumberStyleControl
          label="Curve cutoff"
          field="boreholeLogCurveFillCutoff"
          fallback={0}
          min={0}
          max={1}
          step={0.02}
          decimals={2}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-curve-cutoff"
        />
        <LayerNumberStyleControl
          label="Depth min"
          field="boreholeLogDepthMinFt"
          fallback={0}
          min={0}
          max={30000}
          step={100}
          decimals={0}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-depth-min"
        />
        <LayerNumberStyleControl
          label="Depth max"
          field="boreholeLogDepthMaxFt"
          fallback={30000}
          min={0}
          max={30000}
          step={100}
          decimals={0}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-depth-max"
        />
        <LayerNumberStyleControl
          label="Vertical exag."
          field="boreholeLogVerticalExaggeration"
          fallback={1}
          min={0.25}
          max={8}
          step={0.05}
          decimals={2}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-vertical-exaggeration"
        />
        <LayerNumberStyleControl
          label="Lith opacity"
          field="boreholeLogLithologyOpacity"
          fallback={0.72}
          min={0}
          max={1}
          step={0.02}
          decimals={2}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-lithology-opacity"
        />
        <LayerBooleanStyleControl
          label="Provenance"
          field="boreholeLogProvenanceVisible"
          fallback={true}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-provenance-visible"
        />
        <LayerBooleanStyleControl
          label="Readout"
          field="boreholeLogReadoutVisible"
          fallback={true}
          style={style}
          isEnv={isEnv}
          currentPage={currentPage}
          layerId={layerId}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          testId="borehole-logs-readout-visible"
        />
        <div style={miniReadoutStyle}>
          Window {styleNumber(style, "boreholeLogDepthMinFt", 0).toFixed(0)}-
          {styleNumber(style, "boreholeLogDepthMaxFt", 30000).toFixed(0)} ft
          | vertical {styleNumber(style, "boreholeLogVerticalExaggeration", 1).toFixed(2)}
        </div>
      </div>
    </details>
  );
}

const trackButtonGroupStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  justifyContent: "flex-end",
};

const trackToggleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: "rgba(244,240,232,0.82)",
  fontSize: 11,
};

const miniReadoutStyle: React.CSSProperties = {
  color: "rgba(244,240,232,0.52)",
  fontSize: 11,
  lineHeight: 1.3,
  paddingTop: 4,
};
