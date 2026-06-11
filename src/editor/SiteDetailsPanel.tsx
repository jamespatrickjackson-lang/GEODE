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
  DemoBoreholeElementOffset,
  DemoBoreholeIconOrientation,
  DemoBoreholeIconStyle,
  DemoBoreholeLineStyle,
  DemoBoreholePathTreatment,
  DemoBoreholeSourceLocationItemStyle,
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

const ICON_ORIENTATION_OPTIONS = [
  { value: "axis", label: "On axis (flat)" },
  { value: "billboard", label: "Billboard" },
] as const satisfies readonly {
  value: DemoBoreholeIconOrientation;
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

function siteDetailsRowId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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

interface SiteLabelRow {
  id: string;
  label: string;
  visible: boolean;
  text?: string;
  disabled?: boolean;
  setVisible: (visible: boolean) => void;
  setText?: (text: string) => void;
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
  testId,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
  testId?: string;
}) {
  const inner = disabled ? (
    <div style={{ opacity: 0.45 }}>
      <EnvSelectRow
        label={label}
        value={value}
        options={options}
        onChange={() => undefined}
      />
    </div>
  ) : (
    <EnvSelectRow label={label} value={value} options={options} onChange={onChange} />
  );
  return testId ? <div data-testid={testId}>{inner}</div> : inner;
}

function SiteDetailsOffsetRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: readonly number[];
  disabled: boolean;
  onChange: (axis: "x" | "y" | "z", value: number) => void;
}) {
  const axes = ["x", "y", "z"] as const;
  return (
    <>
      {axes.map((axis, index) => (
        <SiteDetailsNumberRow
          key={axis}
          label={`${label} ${axis.toUpperCase()}`}
          value={typeof value[index] === "number" ? value[index] : 0}
          min={-20000}
          max={20000}
          step={5}
          decimals={0}
          disabled={disabled}
          onChange={(next) => onChange(axis, next)}
        />
      ))}
    </>
  );
}

function SiteDetailsUploadRow({
  label,
  hasValue,
  disabled,
  onChange,
  onClear,
  testId,
}: {
  label: string;
  hasValue: boolean;
  disabled: boolean;
  onChange: (dataUrl: string) => void;
  onClear: () => void;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{ ...nestedControlRowStyle, opacity: disabled ? 0.45 : 1 }}
    >
      <label style={nestedFieldLabelStyle}>{label}</label>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="file"
          accept=".svg,image/svg+xml,image/png,image/webp"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") onChange(reader.result);
            };
            reader.readAsDataURL(file);
            event.target.value = "";
          }}
          style={panelStyles.textInput}
        />
        {hasValue ? (
          <button type="button" disabled={disabled} onClick={onClear}>
            Clear
          </button>
        ) : null}
      </span>
    </div>
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
  const updateSourceLocationOffset = (
    key: "groundBallOffsetM" | "topRingOffsetM",
    axis: "x" | "y" | "z",
    value: number,
  ) => {
    const current =
      (style.demoBoreholeSourceLocations?.[key] as
        | DemoBoreholeElementOffset
        | undefined) ?? {};
    const patch: DemoBoreholeSourceLocationStyle = {};
    patch[key] = { ...current, [axis]: value };
    updateSourceLocations(patch);
  };
  const updateSourceLocationIcon = (patch: DemoBoreholeIconStyle) => {
    const current = style.demoBoreholeSourceLocations?.icon ?? {};
    updateSourceLocations({ icon: { ...current, ...patch } });
  };
  const updateIconOffset = (axis: "x" | "y" | "z", value: number) => {
    const current = style.demoBoreholeSourceLocations?.icon?.offsetM ?? {};
    updateSourceLocationIcon({ offsetM: { ...current, [axis]: value } });
  };
  const updateBlock = (patch: DemoOrientationBlockStyle) => {
    applyPatch(patchDemoOrientationBlockStyle(style, patch));
  };
  const block = resolveDemoOrientationBlockStyle(style);
  const sourceLocations = resolveDemoBoreholeSourceLocationStyle(style);
  const sourceLocationRows = sourceLocationVisibilityRows(boreholeLayer);
  const siteLabelRows: SiteLabelRow[] = UTAH_FORGE_DEMO_BOREHOLE_WELL_IDS.flatMap((wellId) => {
    const well = resolveDemoBoreholeWellStyle(style, wellId);
    const keyBase = siteDetailsRowId(wellId);
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
  if (sourceLocationRows.length > 0) {
    siteLabelRows.push({
      id: "source-locations",
      label: "Source locations",
      visible: sourceLocations.labelVisible,
      setVisible: (labelVisible: boolean) =>
        updateSourceLocations({ labelVisible }),
    });
    for (const row of sourceLocationRows) {
      const itemStyle = resolveDemoBoreholeSourceLocationItemStyle(
        style,
        row.id,
      );
      siteLabelRows.push({
        id: `source-${siteDetailsRowId(row.id)}`,
        label: `${row.label} source`,
        visible: itemStyle.labelVisible,
        disabled: !sourceLocations.labelVisible,
        setVisible: (labelVisible: boolean) =>
          updateSourceLocationItem(row.id, { labelVisible }),
      });
    }
  }

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
          <SiteDetailsBooleanRow
            label="Always on top"
            checked={style.siteDetailsAlwaysOnTop === true}
            disabled={disabled}
            onChange={(checked) =>
              applyPatch({ siteDetailsAlwaysOnTop: checked })
            }
            testId="site-details-always-on-top"
          />
          <SiteDetailsBooleanRow
            label="Align to topo"
            checked={style.siteDetailsAlignToTopo === true}
            disabled={disabled}
            onChange={(checked) =>
              applyPatch({ siteDetailsAlignToTopo: checked })
            }
            testId="site-details-align-to-topo"
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
                    disabled={disabled || row.disabled === true}
                    onChange={row.setVisible}
                  />
                  {row.text !== undefined && row.setText ? (
                    <SiteDetailsTextRow
                      label="Text"
                      value={row.text}
                      disabled={disabled}
                      onChange={row.setText}
                    />
                  ) : null}
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
              {sourceLocationRows.length > 0 ? (
                <AutoOpenDetails summary="Per-borehole show / hide" defaultOpen>
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
                label="Shared color"
                value={sourceLocations.color}
                disabled={disabled}
                onChange={(color) => updateSourceLocations({ color })}
              />
              <SiteDetailsNumberRow
                label="Shared opacity"
                value={sourceLocations.opacity}
                min={0}
                max={1}
                step={0.01}
                decimals={2}
                disabled={disabled}
                onChange={(opacity) => updateSourceLocations({ opacity })}
              />
              <AutoOpenDetails summary="Line" defaultOpen>
                <div style={detailsContentStyle}>
                  <SiteDetailsBooleanRow
                    label="Visible"
                    checked={sourceLocations.lineVisible}
                    disabled={disabled}
                    onChange={(lineVisible) =>
                      updateSourceLocations({ lineVisible })
                    }
                    testId="site-details-borehole-line-visible"
                  />
                  <SiteDetailsColorRow
                    label="Color"
                    value={sourceLocations.lineColor}
                    disabled={disabled || !sourceLocations.lineVisible}
                    onChange={(lineColor) => updateSourceLocations({ lineColor })}
                  />
                  <SiteDetailsNumberRow
                    label="Opacity"
                    value={sourceLocations.lineOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    disabled={disabled || !sourceLocations.lineVisible}
                    onChange={(lineOpacity) =>
                      updateSourceLocations({ lineOpacity })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Width"
                    value={sourceLocations.lineWidth}
                    min={1}
                    max={28}
                    step={1}
                    decimals={0}
                    disabled={disabled || !sourceLocations.lineVisible}
                    onChange={(lineWidth) => updateSourceLocations({ lineWidth })}
                  />
                  <SiteDetailsNumberRow
                    label="Depth"
                    value={sourceLocations.depthM}
                    min={50}
                    max={4000}
                    step={25}
                    decimals={0}
                    disabled={disabled || !sourceLocations.lineVisible}
                    onChange={(depthM) => updateSourceLocations({ depthM })}
                  />
                  <SiteDetailsBooleanRow
                    label="Dashed"
                    checked={sourceLocations.lineDashed}
                    disabled={disabled || !sourceLocations.lineVisible}
                    onChange={(lineDashed) =>
                      updateSourceLocations({ lineDashed })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Dash length"
                    value={sourceLocations.lineDashLengthM}
                    min={20}
                    max={1500}
                    step={10}
                    decimals={0}
                    disabled={
                      disabled ||
                      !sourceLocations.lineVisible ||
                      !sourceLocations.lineDashed
                    }
                    onChange={(lineDashLengthM) =>
                      updateSourceLocations({ lineDashLengthM })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Dash gap"
                    value={sourceLocations.lineDashGapM}
                    min={10}
                    max={1500}
                    step={10}
                    decimals={0}
                    disabled={
                      disabled ||
                      !sourceLocations.lineVisible ||
                      !sourceLocations.lineDashed
                    }
                    onChange={(lineDashGapM) =>
                      updateSourceLocations({ lineDashGapM })
                    }
                  />
                </div>
              </AutoOpenDetails>
              <AutoOpenDetails summary="Ground torus">
                <div style={detailsContentStyle}>
                  <SiteDetailsBooleanRow
                    label="Visible"
                    checked={sourceLocations.topRingVisible}
                    disabled={disabled}
                    onChange={(topRingVisible) =>
                      updateSourceLocations({ topRingVisible })
                    }
                    testId="site-details-borehole-ground-torus-visible"
                  />
                  <SiteDetailsNumberRow
                    label="Radius"
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
                    label="Tube"
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
                    label="Color"
                    value={sourceLocations.topRingColor}
                    disabled={disabled || !sourceLocations.topRingVisible}
                    onChange={(topRingColor) =>
                      updateSourceLocations({ topRingColor })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Opacity"
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
                  <SiteDetailsOffsetRow
                    label="Offset"
                    value={sourceLocations.topRingOffsetM}
                    disabled={disabled || !sourceLocations.topRingVisible}
                    onChange={(axis, v) =>
                      updateSourceLocationOffset("topRingOffsetM", axis, v)
                    }
                  />
                </div>
              </AutoOpenDetails>
              <AutoOpenDetails summary="Ground ball">
                <div style={detailsContentStyle}>
                  <SiteDetailsBooleanRow
                    label="Visible"
                    checked={sourceLocations.groundBallVisible}
                    disabled={disabled}
                    onChange={(groundBallVisible) =>
                      updateSourceLocations({ groundBallVisible })
                    }
                    testId="site-details-borehole-ground-ball-visible"
                  />
                  <SiteDetailsNumberRow
                    label="Radius"
                    value={sourceLocations.groundBallRadiusM}
                    min={4}
                    max={600}
                    step={1}
                    decimals={0}
                    disabled={disabled || !sourceLocations.groundBallVisible}
                    onChange={(groundBallRadiusM) =>
                      updateSourceLocations({ groundBallRadiusM })
                    }
                  />
                  <SiteDetailsColorRow
                    label="Color"
                    value={sourceLocations.groundBallColor}
                    disabled={disabled || !sourceLocations.groundBallVisible}
                    onChange={(groundBallColor) =>
                      updateSourceLocations({ groundBallColor })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Opacity"
                    value={sourceLocations.groundBallOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    disabled={disabled || !sourceLocations.groundBallVisible}
                    onChange={(groundBallOpacity) =>
                      updateSourceLocations({ groundBallOpacity })
                    }
                  />
                  <SiteDetailsOffsetRow
                    label="Offset"
                    value={sourceLocations.groundBallOffsetM}
                    disabled={disabled || !sourceLocations.groundBallVisible}
                    onChange={(axis, v) =>
                      updateSourceLocationOffset("groundBallOffsetM", axis, v)
                    }
                  />
                </div>
              </AutoOpenDetails>
              <AutoOpenDetails summary="Crosshair">
                <div style={detailsContentStyle}>
                  <SiteDetailsBooleanRow
                    label="Visible"
                    checked={sourceLocations.crosshairVisible}
                    disabled={disabled}
                    onChange={(crosshairVisible) =>
                      updateSourceLocations({ crosshairVisible })
                    }
                    testId="site-details-borehole-crosshair-visible"
                  />
                  <SiteDetailsNumberRow
                    label="Length"
                    value={sourceLocations.crosshairLengthM}
                    min={40}
                    max={2000}
                    step={10}
                    decimals={0}
                    disabled={disabled || !sourceLocations.crosshairVisible}
                    onChange={(crosshairLengthM) =>
                      updateSourceLocations({ crosshairLengthM })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Width"
                    value={sourceLocations.crosshairWidth}
                    min={1}
                    max={28}
                    step={1}
                    decimals={0}
                    disabled={disabled || !sourceLocations.crosshairVisible}
                    onChange={(crosshairWidth) =>
                      updateSourceLocations({ crosshairWidth })
                    }
                  />
                  <SiteDetailsColorRow
                    label="Color"
                    value={sourceLocations.crosshairColor}
                    disabled={disabled || !sourceLocations.crosshairVisible}
                    onChange={(crosshairColor) =>
                      updateSourceLocations({ crosshairColor })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Opacity"
                    value={sourceLocations.crosshairOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    disabled={disabled || !sourceLocations.crosshairVisible}
                    onChange={(crosshairOpacity) =>
                      updateSourceLocations({ crosshairOpacity })
                    }
                  />
                </div>
              </AutoOpenDetails>
              <AutoOpenDetails summary="Depth trace">
                <div style={detailsContentStyle}>
                  <SiteDetailsBooleanRow
                    label="Visible"
                    checked={sourceLocations.depthTraceVisible}
                    disabled={disabled}
                    onChange={(depthTraceVisible) =>
                      updateSourceLocations({ depthTraceVisible })
                    }
                    testId="site-details-borehole-depth-trace-visible"
                  />
                  <SiteDetailsNumberRow
                    label="Diameter"
                    value={sourceLocations.diameterM}
                    min={8}
                    max={400}
                    step={1}
                    decimals={0}
                    disabled={disabled || !sourceLocations.depthTraceVisible}
                    onChange={(diameterM) => updateSourceLocations({ diameterM })}
                  />
                  <SiteDetailsNumberRow
                    label="Length"
                    value={sourceLocations.lengthM}
                    min={50}
                    max={4000}
                    step={25}
                    decimals={0}
                    disabled={disabled || !sourceLocations.depthTraceVisible}
                    onChange={(lengthM) => updateSourceLocations({ lengthM })}
                  />
                  <SiteDetailsColorRow
                    label="Color"
                    value={sourceLocations.depthTraceColor}
                    disabled={disabled || !sourceLocations.depthTraceVisible}
                    onChange={(depthTraceColor) =>
                      updateSourceLocations({ depthTraceColor })
                    }
                  />
                  <SiteDetailsNumberRow
                    label="Opacity"
                    value={sourceLocations.depthTraceOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    disabled={disabled || !sourceLocations.depthTraceVisible}
                    onChange={(depthTraceOpacity) =>
                      updateSourceLocations({ depthTraceOpacity })
                    }
                  />
                </div>
              </AutoOpenDetails>
              <AutoOpenDetails summary="Icon on top (SVG)">
                <div style={detailsContentStyle}>
                  <SiteDetailsBooleanRow
                    label="Visible"
                    checked={sourceLocations.icon.visible}
                    disabled={disabled}
                    onChange={(visible) => updateSourceLocationIcon({ visible })}
                    testId="site-details-borehole-icon-visible"
                  />
                  <SiteDetailsUploadRow
                    label="SVG file"
                    hasValue={sourceLocations.icon.src !== null}
                    disabled={disabled}
                    onChange={(src) => updateSourceLocationIcon({ src })}
                    onClear={() => updateSourceLocationIcon({ src: "" })}
                    testId="site-details-borehole-icon-upload"
                  />
                  <SiteDetailsSelectRow
                    label="Orientation"
                    value={sourceLocations.icon.orientation}
                    options={ICON_ORIENTATION_OPTIONS}
                    disabled={disabled || !sourceLocations.icon.visible}
                    onChange={(orientation) =>
                      updateSourceLocationIcon({ orientation })
                    }
                    testId="site-details-borehole-icon-orientation"
                  />
                  <SiteDetailsNumberRow
                    label="Size"
                    value={sourceLocations.icon.sizeM}
                    min={10}
                    max={4000}
                    step={10}
                    decimals={0}
                    disabled={disabled || !sourceLocations.icon.visible}
                    onChange={(sizeM) => updateSourceLocationIcon({ sizeM })}
                  />
                  <SiteDetailsNumberRow
                    label="Opacity"
                    value={sourceLocations.icon.opacity}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    disabled={disabled || !sourceLocations.icon.visible}
                    onChange={(opacity) => updateSourceLocationIcon({ opacity })}
                  />
                  <SiteDetailsColorRow
                    label="Tint"
                    value={sourceLocations.icon.color}
                    disabled={disabled || !sourceLocations.icon.visible}
                    onChange={(color) => updateSourceLocationIcon({ color })}
                  />
                  <SiteDetailsOffsetRow
                    label="Offset"
                    value={sourceLocations.icon.offsetM}
                    disabled={disabled || !sourceLocations.icon.visible}
                    onChange={(axis, v) => updateIconOffset(axis, v)}
                  />
                </div>
              </AutoOpenDetails>
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
