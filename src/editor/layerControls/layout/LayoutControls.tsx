import { useEffect, useRef, useState } from "react";
import type React from "react";
import { effectiveStyle } from "../../../pages/effective";
import type {
  EnvironmentSetup,
  PresentationPage,
  SceneProperties,
} from "../../../pages/types";
import {
  detailsContentStyle,
  drillingAssayDetailsStyle,
  drillingAssayHintStyle,
  drillingAssaySummaryStyle,
  nestedControlRowStyle,
  nestedFieldLabelStyle,
  overrideTagActiveStyle,
  overrideTagStyle,
  sliderNumberReadoutStyle,
} from "../../styleControls";
import { ToggleButton } from "../env/EnvRows";
import {
  assayOutlineColorInputStyle,
  layerGroupBodyStyle,
  layerGroupChevronStyle,
  layerGroupDisclosureStyle,
  layerGroupFogControlRowStyle,
  layerGroupFogControlStyle,
  layerGroupStyle,
  layerGroupSummaryStyle,
  layerGroupTitleStyle,
} from "./layoutStyles";

const FOG_DENSITY_UI_MIN = 0.02;
const FOG_DENSITY_UI_MAX = 6;
const FOG_DENSITY_UI_STEP = 0.05;

export function LayerGroup({
  title,
  children,
  defaultOpen = false,
  openSignal,
  devSource = "src/editor/LayerPanel.tsx:423",
  devNote,
  accentColor,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  openSignal?: unknown;
  devSource?: string;
  devNote?: string;
  accentColor?: string | null;
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
  const summaryStyle: React.CSSProperties = accentColor
    ? {
        ...layerGroupSummaryStyle,
        background: accentColor,
        border: "1px solid transparent",
        boxShadow: "none",
      }
    : layerGroupSummaryStyle;
  return (
    <div
      style={layerGroupStyle}
      data-dev-source="src/editor/LayerPanel.tsx:862"
      data-dev-note="layerGroupStyle controls the left inset and spacing around each Layers subheading."
    >
      <button
        type="button"
        style={summaryStyle}
        data-dev-source={devSource}
        data-dev-padding-source="src/editor/LayerPanel.tsx:888"
        data-dev-note={
          devNote ??
          "layerGroupSummaryStyle controls this subheading pill, including padding, width, and chevron alignment."
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          style={layerGroupTitleStyle}
          data-dev-text-source="src/editor/LayerPanel.tsx:469"
        >
          {title}
        </span>
        <span style={layerGroupDisclosureStyle} aria-hidden="true">
          <span
            style={{
              ...layerGroupChevronStyle,
              transform: open ? "rotate(45deg)" : "rotate(-45deg)",
            }}
          />
        </span>
      </button>
      {open && <div style={layerGroupBodyStyle}>{children}</div>}
    </div>
  );
}

export function LayerGroupFogControl({
  layerIds,
  isEnv,
  currentPage,
  environment,
  globalFogDensity,
  onSetEnv,
  onSetPage,
  onSetEnvDensity,
  onSetPageDensity,
}: {
  layerIds: string[];
  isEnv: boolean;
  currentPage: PresentationPage | null;
  environment: EnvironmentSetup;
  globalFogDensity: number;
  onSetEnv: (layerId: string, affectedByFog: boolean) => void;
  onSetPage: (pageId: string, layerId: string, affectedByFog: boolean) => void;
  onSetEnvDensity: (layerId: string, fogDensity: number) => void;
  onSetPageDensity: (
    pageId: string,
    layerId: string,
    fogDensity: number,
  ) => void;
}) {
  if (layerIds.length === 0) return null;
  const styles = layerIds.map((id) =>
    currentPage
      ? effectiveStyle(environment, currentPage, id)
      : (environment.layerStyles[id] ?? {}),
  );
  const values = styles.map((style) => style.affectedByFog !== false);
  const allOn = values.every(Boolean);
  const allOff = values.every((v) => !v);
  const mixed = !allOn && !allOff;
  const next = !allOn;
  const disabled = !isEnv && !currentPage;
  const densityValues = styles.map((style) =>
    typeof style.fogDensity === "number" ? style.fogDensity : globalFogDensity,
  );
  const densityAvg =
    densityValues.reduce((sum, value) => sum + value, 0) / densityValues.length;
  const densityMixed = densityValues.some(
    (value) => Math.abs(value - densityAvg) > 0.0000025,
  );
  const densityUi = densityAvg * 10000;
  const setDensity = (value: number) => {
    const fogDensity = value / 10000;
    if (isEnv) {
      for (const id of layerIds) onSetEnvDensity(id, fogDensity);
    } else if (currentPage) {
      for (const id of layerIds) {
        onSetPageDensity(currentPage.id, id, fogDensity);
      }
    }
  };

  return (
    <div style={layerGroupFogControlStyle}>
      <div style={layerGroupFogControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Use fog</label>
        <ToggleButton
          active={allOn}
          title="Toggle fog for every layer in this section"
          onClick={() => {
            if (disabled) return;
            if (isEnv) {
              for (const id of layerIds) onSetEnv(id, next);
            } else if (currentPage) {
              for (const id of layerIds) onSetPage(currentPage.id, id, next);
            }
          }}
        />
        <span style={mixed ? overrideTagActiveStyle : overrideTagStyle}>
          {mixed ? "mixed" : allOn ? "included" : "excluded"}
        </span>
      </div>
      <div style={layerGroupFogControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Fog dens.</label>
        <input
          type="range"
          min={FOG_DENSITY_UI_MIN}
          max={FOG_DENSITY_UI_MAX}
          step={FOG_DENSITY_UI_STEP}
          value={densityUi}
          disabled={allOff || disabled}
          onChange={(e) => setDensity(parseFloat(e.target.value))}
          style={
            {
              flex: 1,
              opacity: allOff || disabled ? 0.42 : 1,
              "--editor-slider-fill": `${
                ((densityUi - FOG_DENSITY_UI_MIN) /
                  (FOG_DENSITY_UI_MAX - FOG_DENSITY_UI_MIN)) *
                100
              }%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{densityUi.toFixed(2)}</span>
        <span style={densityMixed ? overrideTagActiveStyle : overrideTagStyle}>
          {densityMixed ? "mixed" : "density"}
        </span>
      </div>
    </div>
  );
}

export function TopoDetailDistancePanel({
  scene,
  setEnvScene,
}: {
  scene: SceneProperties;
  setEnvScene: (patch: Partial<SceneProperties>) => void;
}) {
  const topo = scene.topoDetails ?? {};
  const near = topo.distanceFadeNear ?? 5000;
  const far = topo.distanceFadeFar ?? 19000;
  const farLineScale = topo.farLineScale ?? 0.67;
  const farOpacity = topo.farOpacity ?? 0.2;
  const setTopo = (patch: NonNullable<SceneProperties["topoDetails"]>) => {
    setEnvScene({
      topoDetails: {
        ...topo,
        ...patch,
      },
    });
  };

  return (
    <details
      style={drillingAssayDetailsStyle}
      data-dev-source="src/editor/LayerPanel.tsx:632"
      data-dev-note="TopoDetailDistancePanel controls global distance thinning/fade for roads, streams, and power lines."
      open
    >
      <summary style={drillingAssaySummaryStyle}>Distance fade</summary>
      <div style={detailsContentStyle}>
        <TopoDistanceSlider
          label="Fade start"
          value={near}
          min={0}
          max={500000}
          step={5000}
          decimals={0}
          suffix="m"
          onChange={(v) => setTopo({ distanceFadeNear: v })}
        />
        <TopoDistanceSlider
          label="Fade end"
          value={far}
          min={1000}
          max={750000}
          step={5000}
          decimals={0}
          suffix="m"
          onChange={(v) => setTopo({ distanceFadeFar: v })}
        />
        <TopoDistanceSlider
          label="Far width"
          value={farLineScale}
          min={0.01}
          max={1}
          step={0.01}
          decimals={2}
          onChange={(v) => setTopo({ farLineScale: v })}
        />
        <TopoDistanceSlider
          label="Far opacity"
          value={farOpacity}
          min={0}
          max={1}
          step={0.02}
          decimals={2}
          onChange={(v) => setTopo({ farOpacity: v })}
        />
        <div style={drillingAssayHintStyle}>
          Global controls for roads, streams, and power lines. Start/end are
          camera distance; far width and opacity are what remains at the end.
        </div>
      </div>
    </details>
  );
}

export function TopoDistanceSlider({
  label,
  value,
  min,
  max,
  step,
  decimals,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const fill = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={
          {
            flex: 1,
            "--editor-slider-fill": `${fill}%`,
          } as React.CSSProperties
        }
      />
      <span style={sliderNumberReadoutStyle}>
        {value.toFixed(decimals)}
        {suffix}
      </span>
    </div>
  );
}

export function AssayToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
      <span style={nestedFieldLabelStyle}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function AssayColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={assayOutlineColorInputStyle}
      />
    </div>
  );
}

export { DrillingAssayPanel } from "./DrillingAssayPanel";
export { PageEnvironmentOverridePanel } from "./PageEnvironmentOverridePanel";
