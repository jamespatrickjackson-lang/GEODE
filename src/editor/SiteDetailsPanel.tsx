import type React from "react";
import {
  patchDemoBoreholeWellStyle,
  patchDemoOrientationBlockStyle,
  resolveDemoBoreholeWellStyle,
  resolveDemoOrientationBlockStyle,
  UTAH_FORGE_DEMO_BOREHOLE_WELL_IDS,
} from "../projectModules/utahForge/siteDetails";
import type {
  DemoBoreholeLineStyle,
  DemoBoreholePathTreatment,
  DemoBoreholeWellStyle,
  DemoOrientationBlockStyle,
  EditableStyle,
  PresentationPage,
  ProjectLayerSpec,
} from "../pages/types";
import {
  detailsContentStyle,
  EnvSelectRow,
  EnvStyleRow,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  type LayerStyleSetter,
  type PageStyleSetter,
} from "./styleControls";
import { panelStyles } from "./styles";

const WELL_LABELS: Record<string, string> = {
  "16A(78)-32": "16A(78)-32 injection",
  "16B(78)-32": "16B(78)-32 production",
};

const LINE_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
] as const satisfies readonly { value: DemoBoreholeLineStyle; label: string }[];

const PATH_TREATMENT_OPTIONS = [
  { value: "survey", label: "Survey" },
  { value: "smoothed", label: "Smoothed" },
  { value: "presentation-normalized", label: "Presentation normalized" },
] as const satisfies readonly {
  value: DemoBoreholePathTreatment;
  label: string;
}[];

interface SiteDetailsPanelProps {
  boreholeLayer?: ProjectLayerSpec;
  boundaryLayer?: ProjectLayerSpec;
  renderLayer: (layer: ProjectLayerSpec) => React.ReactNode;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
}

function controlDisabled(isEnv: boolean, currentPage: PresentationPage | null) {
  return !isEnv && !currentPage;
}

function SiteDetailsBooleanRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      style={{
        ...nestedControlRowStyle,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span style={nestedFieldLabelStyle}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function SiteDetailsTextRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ ...nestedControlRowStyle, opacity: disabled ? 0.45 : 1 }}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={panelStyles.textInput}
      />
    </div>
  );
}

function SiteDetailsNumberRow({
  label,
  value,
  min,
  max,
  step,
  decimals,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  if (disabled) {
    return (
      <div style={{ opacity: 0.45 }}>
        <EnvStyleRow
          label={label}
          inputType="range"
          value={String(value)}
          min={min}
          max={max}
          step={step}
          decimals={decimals}
          onChange={() => undefined}
        />
      </div>
    );
  }
  return (
    <EnvStyleRow
      label={label}
      inputType="range"
      value={String(value)}
      min={min}
      max={max}
      step={step}
      decimals={decimals}
      onChange={(next) => onChange(parseFloat(next))}
    />
  );
}

function SiteDetailsColorRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (disabled) {
    return (
      <div style={{ opacity: 0.45 }}>
        <EnvStyleRow
          label={label}
          inputType="color"
          value={value}
          onChange={() => undefined}
        />
      </div>
    );
  }
  return (
    <EnvStyleRow
      label={label}
      inputType="color"
      value={value}
      onChange={onChange}
    />
  );
}

function SiteDetailsSelectRow<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  if (disabled) {
    return (
      <div style={{ opacity: 0.45 }}>
        <EnvSelectRow
          label={label}
          value={value}
          options={options}
          onChange={() => undefined}
        />
      </div>
    );
  }
  return (
    <EnvSelectRow label={label} value={value} options={options} onChange={onChange} />
  );
}

export function SiteDetailsPanel({
  boreholeLayer,
  boundaryLayer,
  renderLayer,
  style,
  isEnv,
  currentPage,
  setEnvLayerStyle,
  setPageLayerOverride,
}: SiteDetailsPanelProps) {
  const disabled = controlDisabled(isEnv, currentPage);
  const applyPatch = (patch: Partial<EditableStyle>) => {
    if (!boreholeLayer) return;
    if (isEnv) {
      setEnvLayerStyle(boreholeLayer.id, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, boreholeLayer.id, patch);
    }
  };
  const updateWell = (wellId: string, patch: DemoBoreholeWellStyle) => {
    applyPatch(patchDemoBoreholeWellStyle(style, wellId, patch));
  };
  const updateBlock = (patch: DemoOrientationBlockStyle) => {
    applyPatch(patchDemoOrientationBlockStyle(style, patch));
  };
  const block = resolveDemoOrientationBlockStyle(style);

  return (
    <>
      {boundaryLayer ? renderLayer(boundaryLayer) : null}
      {boreholeLayer ? (
        <>
          <div style={nestedControlRowStyle}>
            <span style={nestedFieldLabelStyle}>Demo layer</span>
            <span style={panelStyles.muted}>
              demo-orientation / not for engineering use
            </span>
          </div>
          <SiteDetailsBooleanRow
            label="Labels master"
            checked={style.showLabels === true}
            disabled={disabled}
            onChange={(checked) => applyPatch({ showLabels: checked })}
          />
          {UTAH_FORGE_DEMO_BOREHOLE_WELL_IDS.map((wellId) => {
            const well = resolveDemoBoreholeWellStyle(style, wellId);
            return (
              <details key={wellId} style={nestedDetailsStyle}>
                <summary style={panelStyles.summary}>
                  {WELL_LABELS[wellId] ?? wellId}
                </summary>
                <div style={detailsContentStyle}>
                  <SiteDetailsBooleanRow
                    label="Visible"
                    checked={well.visible}
                    disabled={disabled}
                    onChange={(visible) => updateWell(wellId, { visible })}
                  />
                  <SiteDetailsNumberRow
                    label="Diameter"
                    value={well.pipeDiameterM}
                    min={4}
                    max={80}
                    step={1}
                    decimals={0}
                    disabled={disabled}
                    onChange={(pipeDiameterM) =>
                      updateWell(wellId, { pipeDiameterM })
                    }
                  />
                  <SiteDetailsColorRow
                    label="Color"
                    value={well.color}
                    disabled={disabled}
                    onChange={(color) => updateWell(wellId, { color })}
                  />
                  <SiteDetailsNumberRow
                    label="Opacity"
                    value={well.opacity}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    disabled={disabled}
                    onChange={(opacity) => updateWell(wellId, { opacity })}
                  />
                  <SiteDetailsSelectRow
                    label="Pipe style"
                    value={well.lineStyle}
                    options={LINE_STYLE_OPTIONS}
                    disabled={disabled}
                    onChange={(lineStyle) => updateWell(wellId, { lineStyle })}
                  />
                  <SiteDetailsNumberRow
                    label="Dash length"
                    value={well.dashLengthM}
                    min={20}
                    max={1500}
                    step={10}
                    decimals={0}
                    disabled={disabled || well.lineStyle !== "dashed"}
                    onChange={(dashLengthM) =>
                      updateWell(wellId, { dashLengthM })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Dash gap"
                    value={well.dashGapM}
                    min={10}
                    max={1500}
                    step={10}
                    decimals={0}
                    disabled={disabled || well.lineStyle !== "dashed"}
                    onChange={(dashGapM) => updateWell(wellId, { dashGapM })}
                  />
                  <SiteDetailsBooleanRow
                    label="Centerline"
                    checked={well.centerlineVisible}
                    disabled={disabled}
                    onChange={(centerlineVisible) =>
                      updateWell(wellId, { centerlineVisible })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Line width"
                    value={well.centerlineWidth}
                    min={0.25}
                    max={12}
                    step={0.25}
                    decimals={2}
                    disabled={disabled}
                    onChange={(centerlineWidth) =>
                      updateWell(wellId, { centerlineWidth })
                    }
                  />
                  <SiteDetailsColorRow
                    label="Line color"
                    value={well.centerlineColor}
                    disabled={disabled}
                    onChange={(centerlineColor) =>
                      updateWell(wellId, { centerlineColor })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Line opacity"
                    value={well.centerlineOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    disabled={disabled}
                    onChange={(centerlineOpacity) =>
                      updateWell(wellId, { centerlineOpacity })
                    }
                  />
                  <SiteDetailsBooleanRow
                    label="Collar"
                    checked={well.collarVisible}
                    disabled={disabled}
                    onChange={(collarVisible) =>
                      updateWell(wellId, { collarVisible })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Collar dia."
                    value={well.collarDiameterM}
                    min={6}
                    max={160}
                    step={1}
                    decimals={0}
                    disabled={disabled}
                    onChange={(collarDiameterM) =>
                      updateWell(wellId, { collarDiameterM })
                    }
                  />
                  <SiteDetailsSelectRow
                    label="Path"
                    value={well.pathTreatment}
                    options={PATH_TREATMENT_OPTIONS}
                    disabled={disabled}
                    onChange={(pathTreatment) =>
                      updateWell(wellId, { pathTreatment })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Smoothing"
                    value={well.smoothingStrength}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    disabled={disabled || well.pathTreatment === "survey"}
                    onChange={(smoothingStrength) =>
                      updateWell(wellId, { smoothingStrength })
                    }
                  />
                  <SiteDetailsBooleanRow
                    label="Collar label"
                    checked={well.collarLabelVisible}
                    disabled={disabled}
                    onChange={(collarLabelVisible) =>
                      updateWell(wellId, { collarLabelVisible })
                    }
                  />
                  <SiteDetailsTextRow
                    label="Collar text"
                    value={well.collarLabelText}
                    disabled={disabled}
                    onChange={(collarLabelText) =>
                      updateWell(wellId, { collarLabelText })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Collar lift"
                    value={well.collarLabelLiftM}
                    min={-250}
                    max={500}
                    step={5}
                    decimals={0}
                    disabled={disabled}
                    onChange={(collarLabelLiftM) =>
                      updateWell(wellId, { collarLabelLiftM })
                    }
                  />
                  <SiteDetailsBooleanRow
                    label="Toe label"
                    checked={well.toeLabelVisible}
                    disabled={disabled}
                    onChange={(toeLabelVisible) =>
                      updateWell(wellId, { toeLabelVisible })
                    }
                  />
                  <SiteDetailsTextRow
                    label="Toe text"
                    value={well.toeLabelText}
                    disabled={disabled}
                    onChange={(toeLabelText) =>
                      updateWell(wellId, { toeLabelText })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Toe lift"
                    value={well.toeLabelLiftM}
                    min={-250}
                    max={500}
                    step={5}
                    decimals={0}
                    disabled={disabled}
                    onChange={(toeLabelLiftM) =>
                      updateWell(wellId, { toeLabelLiftM })
                    }
                  />
                </div>
              </details>
            );
          })}
          <details style={nestedDetailsStyle}>
            <summary style={panelStyles.summary}>
              Surface facility / orientation block
            </summary>
            <div style={detailsContentStyle}>
              <SiteDetailsBooleanRow
                label="Visible"
                checked={block.visible}
                disabled={disabled}
                onChange={(visible) => updateBlock({ visible })}
              />
              <SiteDetailsNumberRow
                label="Width"
                value={block.widthM}
                min={5}
                max={500}
                step={1}
                decimals={0}
                disabled={disabled}
                onChange={(widthM) => updateBlock({ widthM })}
              />
              <SiteDetailsNumberRow
                label="Depth"
                value={block.depthM}
                min={5}
                max={500}
                step={1}
                decimals={0}
                disabled={disabled}
                onChange={(depthM) => updateBlock({ depthM })}
              />
              <SiteDetailsNumberRow
                label="Height"
                value={block.heightM}
                min={2}
                max={200}
                step={1}
                decimals={0}
                disabled={disabled}
                onChange={(heightM) => updateBlock({ heightM })}
              />
              <SiteDetailsNumberRow
                label="Lift"
                value={block.liftM}
                min={-300}
                max={500}
                step={5}
                decimals={0}
                disabled={disabled}
                onChange={(liftM) => updateBlock({ liftM })}
              />
              <SiteDetailsNumberRow
                label="Rotation"
                value={block.rotationDeg}
                min={-180}
                max={180}
                step={1}
                decimals={0}
                disabled={disabled}
                onChange={(rotationDeg) => updateBlock({ rotationDeg })}
              />
              <SiteDetailsColorRow
                label="Fill color"
                value={block.fillColor}
                disabled={disabled}
                onChange={(fillColor) => updateBlock({ fillColor })}
              />
              <SiteDetailsNumberRow
                label="Fill opacity"
                value={block.opacity}
                min={0}
                max={1}
                step={0.01}
                decimals={2}
                disabled={disabled}
                onChange={(opacity) => updateBlock({ opacity })}
              />
              <SiteDetailsBooleanRow
                label="Outline"
                checked={block.outlineVisible}
                disabled={disabled}
                onChange={(outlineVisible) => updateBlock({ outlineVisible })}
              />
              <SiteDetailsColorRow
                label="Outline color"
                value={block.outlineColor}
                disabled={disabled}
                onChange={(outlineColor) => updateBlock({ outlineColor })}
              />
              <SiteDetailsNumberRow
                label="Outline thick."
                value={block.outlineThickness}
                min={0.25}
                max={8}
                step={0.25}
                decimals={2}
                disabled={disabled}
                onChange={(outlineThickness) =>
                  updateBlock({ outlineThickness })
                }
              />
              <SiteDetailsNumberRow
                label="Outline opacity"
                value={block.outlineOpacity}
                min={0}
                max={1}
                step={0.01}
                decimals={2}
                disabled={disabled}
                onChange={(outlineOpacity) => updateBlock({ outlineOpacity })}
              />
              <SiteDetailsBooleanRow
                label="Label"
                checked={block.labelVisible}
                disabled={disabled}
                onChange={(labelVisible) => updateBlock({ labelVisible })}
              />
              <SiteDetailsTextRow
                label="Label text"
                value={block.labelText}
                disabled={disabled}
                onChange={(labelText) => updateBlock({ labelText })}
              />
              <SiteDetailsNumberRow
                label="Label lift"
                value={block.labelLiftM}
                min={-100}
                max={300}
                step={5}
                decimals={0}
                disabled={disabled}
                onChange={(labelLiftM) => updateBlock({ labelLiftM })}
              />
            </div>
          </details>
        </>
      ) : null}
    </>
  );
}
