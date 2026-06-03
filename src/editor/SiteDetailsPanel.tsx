import { useEffect, useRef, useState } from "react";
import type React from "react";
import {
  patchDemoBoreholeSourceLocationItemStyle,
  patchDemoBoreholeSourceLocationStyle,
  patchDemoBoreholeWellStyle,
  patchDemoOrientationBlockStyle,
  resolveDemoBoreholeSourceLocationItemStyle,
  resolveDemoBoreholeSourceLocationStyle,
  resolveDemoBoreholeWellStyle,
  resolveDemoOrientationBlockStyle,
  UTAH_FORGE_DEMO_BOREHOLE_WELL_IDS,
} from "../projectModules/utahForge/siteDetails";
import type {
  DemoBoreholeLineStyle,
  DemoBoreholePathTreatment,
  DemoBoreholeSourceLocationItemStyle,
  DemoBoreholeSourceLocationMode,
  DemoBoreholeSourceLocationStyle,
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

const SOURCE_LOCATION_MODE_OPTIONS = [
  { value: "rounded-trace", label: "Rounded trace" },
  { value: "line", label: "Line trace" },
  { value: "pin", label: "Pin trace" },
  { value: "crosshair", label: "Crosshair" },
  { value: "hidden", label: "Hidden" },
] as const satisfies readonly {
  value: DemoBoreholeSourceLocationMode;
  label: string;
}[];

interface BoreholePriorityRegistryEntry {
  id?: unknown;
  label?: unknown;
  displayLabel?: unknown;
  renderStatus?: unknown;
  sourceLocation?: { id?: unknown } | null;
  sourceCandidates?: { id?: unknown }[];
}

interface SourceLocationVisibilityRow {
  id: string;
  label: string;
}

function sourceLocationVisibilityRows(
  layer?: ProjectLayerSpec,
): SourceLocationVisibilityRow[] {
  const registry = (
    layer?.metadata as
      | {
          demoBoreholes?: {
            priorityRegistry?: BoreholePriorityRegistryEntry[];
          };
        }
      | undefined
  )?.demoBoreholes?.priorityRegistry;
  if (!Array.isArray(registry)) return [];
  const rows: SourceLocationVisibilityRow[] = [];
  for (const entry of registry) {
    if (entry.renderStatus === "trajectory-rendered") continue;
    const baseLabel =
      typeof entry.label === "string" && entry.label.trim()
        ? entry.label
        : typeof entry.id === "string"
          ? entry.id
          : "Source";
    const sourceLocationId = entry.sourceLocation?.id;
    if (typeof sourceLocationId === "string" && sourceLocationId.trim()) {
      rows.push({ id: sourceLocationId, label: baseLabel });
    }
    for (const candidate of entry.sourceCandidates ?? []) {
      if (typeof candidate.id !== "string" || !candidate.id.trim()) continue;
      rows.push({
        id: candidate.id,
        label: `${baseLabel} ${candidate.id}`,
      });
    }
  }
  return rows;
}

interface SiteDetailsPanelProps {
  boreholeLayer?: ProjectLayerSpec;
  boundaryLayer?: ProjectLayerSpec;
  renderLayer: (layer: ProjectLayerSpec) => React.ReactNode;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  activeSignalPrefix?: string;
  boreholeLayerActive?: boolean;
  disabled?: boolean;
}

function controlDisabled(isEnv: boolean, currentPage: PresentationPage | null) {
  return !isEnv && !currentPage;
}

function AutoOpenDetails({
  summary,
  children,
  openSignal,
  defaultOpen = false,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  openSignal?: unknown;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const previousOpenSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal === undefined || openSignal === previousOpenSignal.current) {
      return;
    }
    previousOpenSignal.current = openSignal;
    setOpen(true);
  }, [openSignal]);

  return (
    <details
      style={nestedDetailsStyle}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary style={panelStyles.summary}>{summary}</summary>
      {children}
    </details>
  );
}

function SiteDetailsBooleanRow({
  label,
  checked,
  disabled,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  testId?: string;
}) {
  return (
    <label
      data-testid={testId}
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
  testId,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{ ...nestedControlRowStyle, opacity: disabled ? 0.45 : 1 }}
    >
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
  activeSignalPrefix,
  boreholeLayerActive = false,
  disabled: disabledProp = false,
}: SiteDetailsPanelProps) {
  const disabled = disabledProp || controlDisabled(isEnv, currentPage);
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
  const updateSourceLocations = (patch: DemoBoreholeSourceLocationStyle) => {
    applyPatch(patchDemoBoreholeSourceLocationStyle(style, patch));
  };
  const updateSourceLocationItem = (
    sourceLocationId: string,
    patch: DemoBoreholeSourceLocationItemStyle,
  ) => {
    applyPatch(
      patchDemoBoreholeSourceLocationItemStyle(
        style,
        sourceLocationId,
        patch,
      ),
    );
  };
  const updateBlock = (patch: DemoOrientationBlockStyle) => {
    applyPatch(patchDemoOrientationBlockStyle(style, patch));
  };
  const block = resolveDemoOrientationBlockStyle(style);
  const sourceLocations = resolveDemoBoreholeSourceLocationStyle(style);
  const sourceLocationRows = sourceLocationVisibilityRows(boreholeLayer);
  const siteLabelRows = UTAH_FORGE_DEMO_BOREHOLE_WELL_IDS.flatMap((wellId) => {
    const well = resolveDemoBoreholeWellStyle(style, wellId);
    const keyBase = wellId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return [
      {
        id: `${keyBase}-collar`,
        label: `${WELL_LABELS[wellId] ?? wellId} collar`,
        visible: well.collarLabelVisible,
        text: well.collarLabelText,
        setVisible: (collarLabelVisible: boolean) =>
          updateWell(wellId, { collarLabelVisible }),
        setText: (collarLabelText: string) =>
          updateWell(wellId, { collarLabelText }),
      },
      {
        id: `${keyBase}-toe`,
        label: `${WELL_LABELS[wellId] ?? wellId} toe`,
        visible: well.toeLabelVisible,
        text: well.toeLabelText,
        setVisible: (toeLabelVisible: boolean) =>
          updateWell(wellId, { toeLabelVisible }),
        setText: (toeLabelText: string) =>
          updateWell(wellId, { toeLabelText }),
      },
    ];
  });
  siteLabelRows.push({
    id: "orientation-block",
    label: "Surface facility / orientation block",
    visible: block.labelVisible,
    text: block.labelText,
    setVisible: (labelVisible: boolean) => updateBlock({ labelVisible }),
    setText: (labelText: string) => updateBlock({ labelText }),
  });

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
          <AutoOpenDetails summary="Site Labels" defaultOpen>
            <div style={detailsContentStyle}>
              {siteLabelRows.map((row) => (
                <div
                  key={row.id}
                  data-testid={`site-details-label-${row.id}`}
                  style={{
                    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                    paddingTop: 6,
                  }}
                >
                  <SiteDetailsBooleanRow
                    label={row.label}
                    checked={row.visible}
                    disabled={disabled}
                    onChange={row.setVisible}
                  />
                  <SiteDetailsTextRow
                    label="Text"
                    value={row.text}
                    disabled={disabled}
                    onChange={row.setText}
                  />
                </div>
              ))}
            </div>
          </AutoOpenDetails>
          <AutoOpenDetails
            summary="Source Locations"
            openSignal={
              boreholeLayerActive && sourceLocations.visible
                ? `${activeSignalPrefix ?? "site-details"}:source-locations`
                : undefined
            }
            defaultOpen
          >
            <div style={detailsContentStyle}>
              <SiteDetailsBooleanRow
                label="Visible"
                checked={sourceLocations.visible}
                disabled={disabled}
                onChange={(visible) => updateSourceLocations({ visible })}
              />
              <SiteDetailsSelectRow
                label="Shape"
                value={sourceLocations.mode}
                options={SOURCE_LOCATION_MODE_OPTIONS}
                disabled={disabled}
                onChange={(mode) => updateSourceLocations({ mode })}
              />
              {sourceLocationRows.length > 0 ? (
                <AutoOpenDetails summary="Source visibility" defaultOpen>
                  <div style={detailsContentStyle}>
                    {sourceLocationRows.map((row) => {
                      const itemStyle =
                        resolveDemoBoreholeSourceLocationItemStyle(
                          style,
                          row.id,
                        );
                      return (
                        <SiteDetailsBooleanRow
                          key={row.id}
                          label={row.label}
                          checked={itemStyle.visible}
                          disabled={disabled}
                          onChange={(visible) =>
                            updateSourceLocationItem(row.id, { visible })
                          }
                        />
                      );
                    })}
                  </div>
                </AutoOpenDetails>
              ) : null}
              <SiteDetailsColorRow
                label="Color"
                value={sourceLocations.color}
                disabled={disabled}
                onChange={(color) => updateSourceLocations({ color })}
              />
              <SiteDetailsNumberRow
                label="Opacity"
                value={sourceLocations.opacity}
                min={0}
                max={1}
                step={0.01}
                decimals={2}
                disabled={disabled}
                onChange={(opacity) => updateSourceLocations({ opacity })}
              />
              <SiteDetailsNumberRow
                label="Diameter"
                value={sourceLocations.diameterM}
                min={8}
                max={400}
                step={1}
                decimals={0}
                disabled={disabled}
                onChange={(diameterM) => updateSourceLocations({ diameterM })}
              />
              <SiteDetailsNumberRow
                label="Trace length"
                value={sourceLocations.lengthM}
                min={50}
                max={4000}
                step={25}
                decimals={0}
                disabled={disabled}
                onChange={(lengthM) => updateSourceLocations({ lengthM })}
              />
              <SiteDetailsNumberRow
                label="Line width"
                value={sourceLocations.lineWidth}
                min={1}
                max={28}
                step={1}
                decimals={0}
                disabled={disabled}
                onChange={(lineWidth) => updateSourceLocations({ lineWidth })}
              />
              <SiteDetailsBooleanRow
                label="Top toroid"
                checked={sourceLocations.topRingVisible}
                disabled={disabled}
                onChange={(topRingVisible) =>
                  updateSourceLocations({ topRingVisible })
                }
              />
              <SiteDetailsNumberRow
                label="Toroid radius"
                value={sourceLocations.topRingRadiusM}
                min={20}
                max={1200}
                step={5}
                decimals={0}
                disabled={disabled || !sourceLocations.topRingVisible}
                onChange={(topRingRadiusM) =>
                  updateSourceLocations({ topRingRadiusM })
                }
              />
              <SiteDetailsNumberRow
                label="Toroid tube"
                value={sourceLocations.topRingTubeM}
                min={2}
                max={120}
                step={1}
                decimals={0}
                disabled={disabled || !sourceLocations.topRingVisible}
                onChange={(topRingTubeM) =>
                  updateSourceLocations({ topRingTubeM })
                }
              />
              <SiteDetailsColorRow
                label="Toroid color"
                value={sourceLocations.topRingColor}
                disabled={disabled || !sourceLocations.topRingVisible}
                onChange={(topRingColor) =>
                  updateSourceLocations({ topRingColor })
                }
              />
              <SiteDetailsNumberRow
                label="Toroid opacity"
                value={sourceLocations.topRingOpacity}
                min={0}
                max={1}
                step={0.01}
                decimals={2}
                disabled={disabled || !sourceLocations.topRingVisible}
                onChange={(topRingOpacity) =>
                  updateSourceLocations({ topRingOpacity })
                }
              />
              <SiteDetailsBooleanRow
                label="Labels"
                checked={sourceLocations.labelVisible}
                disabled={disabled}
                onChange={(labelVisible) =>
                  updateSourceLocations({ labelVisible })
                }
              />
              <SiteDetailsNumberRow
                label="Label lift"
                value={sourceLocations.labelLiftM}
                min={-250}
                max={1000}
                step={5}
                decimals={0}
                disabled={disabled || !sourceLocations.labelVisible}
                onChange={(labelLiftM) =>
                  updateSourceLocations({ labelLiftM })
                }
              />
            </div>
          </AutoOpenDetails>
          {UTAH_FORGE_DEMO_BOREHOLE_WELL_IDS.map((wellId) => {
            const well = resolveDemoBoreholeWellStyle(style, wellId);
            const wellOpenSignal =
              boreholeLayerActive && well.visible && well.opacity > 0.001
                ? `${activeSignalPrefix ?? "site-details"}:${wellId}`
                : undefined;
            return (
              <AutoOpenDetails
                key={wellId}
                summary={WELL_LABELS[wellId] ?? wellId}
                openSignal={wellOpenSignal}
              >
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
              </AutoOpenDetails>
            );
          })}
          <AutoOpenDetails
            summary="Surface facility / orientation block"
            openSignal={
              boreholeLayerActive && block.visible && block.opacity > 0.001
                ? `${activeSignalPrefix ?? "site-details"}:orientation-block`
                : undefined
            }
          >
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
          </AutoOpenDetails>
        </>
      ) : null}
    </>
  );
}
