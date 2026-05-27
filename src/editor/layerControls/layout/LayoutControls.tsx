import { useEffect, useRef, useState } from "react";
import type React from "react";
import { DEFAULT_ASSAY_COLOR_STOPS } from "../../../loaders/assayPalette";
import { effectiveStyle } from "../../../pages/effective";
import type { EnvironmentSetup, PresentationPage, RenderPresetId, SceneProperties } from "../../../pages/types";
import {
  detailsContentStyle,
  drillingAssayDetailsStyle,
  drillingAssayHintStyle,
  drillingAssayPaletteStyle,
  drillingAssayPaletteTitleStyle,
  drillingAssaySummaryStyle,
  nestedControlRowStyle,
  nestedFieldLabelStyle,
  overrideTagActiveStyle,
  overrideTagStyle,
  sliderNumberReadoutStyle,
} from "../../styleControls";
import { panelStyles } from "../../styles";
import { ToggleButton } from "../env/EnvRows";
import { PageBooleanOverrideRow, PageMoodOverrideRow, PageRenderPresetOverrideRow } from "../page/PageOverrideRows";
import {
  assayOutlineColorInputStyle,
  drillingAssayColorNameStyle,
  drillingAssayColorRowStyle,
  layerGroupBodyStyle,
  layerGroupChevronStyle,
  layerGroupDisclosureStyle,
  layerGroupFogControlRowStyle,
  layerGroupFogControlStyle,
  layerGroupStyle,
  layerGroupSummaryStyle,
  layerGroupTitleStyle,
  pageRenderPresetHelpStyle,
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

function TopoDistanceSlider({
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

function AssayToggle({
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

function AssayColorControl({
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

export function DrillingAssayPanel({
  scene,
  setEnvScene,
}: {
  scene: SceneProperties;
  setEnvScene: (patch: Partial<SceneProperties>) => void;
}) {
  const drilling = scene.drilling ?? {};
  const assays = drilling.assays ?? {};
  const traceMode = assays.traceMode ?? "assay";
  const showBoreLine = assays.showBoreLine ?? true;
  const boreLineColor = assays.boreLineColor ?? "#e7dcc4";
  const boreWidth = assays.boreLineWidthPx ?? 3.25;
  const boreLineOpacity = assays.boreLineOpacity ?? 0.72;
  const boreLineRenderOrder = assays.boreLineRenderOrder ?? 6.8;
  const showBoreTube = assays.showBoreTube ?? true;
  const boreTubeColor = assays.boreTubeColor ?? "#d8ccb2";
  const boreTubeOpacity = assays.boreTubeOpacity ?? 0.88;
  const boreTubeRoughness = assays.boreTubeRoughness ?? 0.64;
  const boreTubeMetalness = assays.boreTubeMetalness ?? 0.08;
  const boreTubeEmissiveColor = assays.boreTubeEmissiveColor ?? "#8d826f";
  const boreTubeEmissive = assays.boreTubeEmissive ?? 0.012;
  const boreTubeRenderOrder = assays.boreTubeRenderOrder ?? 5.4;
  const assayMultiplier = assays.assayWidthMultiplier ?? 2.6;
  const lithologyMultiplier = assays.lithologyWidthMultiplier ?? 2.45;
  const assayWidth = boreWidth * assayMultiplier;
  const lithologyWidth = boreWidth * lithologyMultiplier;
  const lithologyOpacity = assays.lithologyOpacity ?? 0.56;
  const showAssaySides = assays.showAssaySides ?? true;
  const showAssayCaps = assays.showAssayCaps ?? true;
  const assaySideOpacity = assays.assaySideOpacity ?? 1;
  const assayCapOpacity = assays.assayCapOpacity ?? 1;
  const capThicknessM = assays.assayCapThicknessM ?? 1.6;
  const sideRoughness = assays.assaySideRoughness ?? 0.46;
  const capRoughness = assays.assayCapRoughness ?? 0.74;
  const metalness = assays.assayMetalness ?? 0.02;
  const sideEmissive = assays.assaySideEmissive ?? 0.018;
  const capEmissive = assays.assayCapEmissive ?? 0.012;
  const sideRenderOrder = assays.assaySideRenderOrder ?? 7.4;
  const capRenderOrder = assays.assayCapRenderOrder ?? 8;
  const showBoreLens = assays.showBoreLens ?? true;
  const boreLensColor = assays.boreLensColor ?? "#e9dec4";
  const boreLensOpacity = assays.boreLensOpacity ?? 0.16;
  const colorStopMap = new Map(
    DEFAULT_ASSAY_COLOR_STOPS.map((stop) => [stop.id, stop]),
  );
  for (const stop of assays.colorStops ?? []) {
    colorStopMap.set(stop.id, stop);
  }
  const colorStops = DEFAULT_ASSAY_COLOR_STOPS.map(
    (stop) => colorStopMap.get(stop.id) ?? stop,
  );
  const setAssays = (
    patch: NonNullable<NonNullable<SceneProperties["drilling"]>["assays"]>,
  ) => {
    setEnvScene({
      drilling: {
        ...drilling,
        assays: { ...assays, ...patch },
      },
    });
  };
  const updateColorStop = (
    id: string,
    patch: Partial<{ label: string; color: string }>,
  ) => {
    setAssays({
      colorStops: colorStops.map((stop) =>
        stop.id === id ? { ...stop, ...patch } : stop,
      ),
    });
  };

  return (
    <details
      style={drillingAssayDetailsStyle}
      data-dev-source="src/editor/LayerPanel.tsx:529"
      data-dev-note="DrillingAssayPanel captures render variables for 2023 downhole assay display under the Assay Samples layer group."
    >
      <summary style={drillingAssaySummaryStyle}>Assays</summary>
      <div style={detailsContentStyle}>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Trace view</label>
          <select
            value={traceMode}
            onChange={(e) =>
              setAssays({
                traceMode: e.target.value as "assay" | "lithology" | "both",
              })
            }
            style={panelStyles.textInput}
          >
            <option value="assay">Assay grade</option>
            <option value="lithology">Lithology</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Bore line / outline</div>
          <AssayToggle
            label="Line"
            checked={showBoreLine}
            onChange={(checked) => setAssays({ showBoreLine: checked })}
          />
          <AssayColorControl
            label="Color"
            value={boreLineColor}
            onChange={(color) => setAssays({ boreLineColor: color })}
          />
          <TopoDistanceSlider
            label="Opacity"
            value={boreLineOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreLineOpacity: value })}
          />
          <TopoDistanceSlider
            label="Order"
            value={boreLineRenderOrder}
            min={0}
            max={12}
            step={0.1}
            decimals={1}
            onChange={(value) => setAssays({ boreLineRenderOrder: value })}
          />
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Bore tube</div>
          <AssayToggle
            label="Tube"
            checked={showBoreTube}
            onChange={(checked) => setAssays({ showBoreTube: checked })}
          />
          <AssayColorControl
            label="Color"
            value={boreTubeColor}
            onChange={(color) => setAssays({ boreTubeColor: color })}
          />
          <AssayColorControl
            label="Glow color"
            value={boreTubeEmissiveColor}
            onChange={(color) => setAssays({ boreTubeEmissiveColor: color })}
          />
          <TopoDistanceSlider
            label="Opacity"
            value={boreTubeOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreTubeOpacity: value })}
          />
          <TopoDistanceSlider
            label="Rough"
            value={boreTubeRoughness}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreTubeRoughness: value })}
          />
          <TopoDistanceSlider
            label="Metal"
            value={boreTubeMetalness}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreTubeMetalness: value })}
          />
          <TopoDistanceSlider
            label="Glow"
            value={boreTubeEmissive}
            min={0}
            max={0.4}
            step={0.005}
            decimals={3}
            onChange={(value) => setAssays({ boreTubeEmissive: value })}
          />
          <TopoDistanceSlider
            label="Order"
            value={boreTubeRenderOrder}
            min={0}
            max={12}
            step={0.1}
            decimals={1}
            onChange={(value) => setAssays({ boreTubeRenderOrder: value })}
          />
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Bore width</label>
          <input
            type="range"
            min={0.5}
            max={6}
            step={0.5}
            value={boreWidth}
            onChange={(e) =>
              setAssays({ boreLineWidthPx: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                "--editor-slider-fill": `${((boreWidth - 0.5) / 5.5) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{boreWidth.toFixed(1)}</span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Assay width</label>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={assayMultiplier}
            onChange={(e) =>
              setAssays({ assayWidthMultiplier: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                "--editor-slider-fill": `${((assayMultiplier - 1) / 7) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{assayWidth.toFixed(1)}</span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Lith width</label>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={lithologyMultiplier}
            onChange={(e) =>
              setAssays({
                lithologyWidthMultiplier: parseFloat(e.target.value),
              })
            }
            style={
              {
                flex: 1,
                "--editor-slider-fill": `${((lithologyMultiplier - 1) / 9) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {lithologyWidth.toFixed(1)}
          </span>
        </div>
        <TopoDistanceSlider
          label="Lith opacity"
          value={lithologyOpacity}
          min={0}
          max={1}
          step={0.01}
          decimals={2}
          onChange={(value) => setAssays({ lithologyOpacity: value })}
        />
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Assay tuning</div>
          <AssayToggle
            label="Sides"
            checked={showAssaySides}
            onChange={(checked) => setAssays({ showAssaySides: checked })}
          />
          <AssayToggle
            label="Caps"
            checked={showAssayCaps}
            onChange={(checked) => setAssays({ showAssayCaps: checked })}
          />
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap thick</label>
            <input
              type="range"
              min={0.2}
              max={20}
              step={0.2}
              value={capThicknessM}
              onChange={(e) =>
                setAssays({ assayCapThicknessM: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${((capThicknessM - 0.2) / 19.8) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {capThicknessM.toFixed(1)}m
            </span>
          </div>
          <TopoDistanceSlider
            label="Side alpha"
            value={assaySideOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ assaySideOpacity: value })}
          />
          <TopoDistanceSlider
            label="Cap alpha"
            value={assayCapOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ assayCapOpacity: value })}
          />
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Side rough</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sideRoughness}
              onChange={(e) =>
                setAssays({ assaySideRoughness: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${sideRoughness * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sideRoughness.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap rough</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={capRoughness}
              onChange={(e) =>
                setAssays({ assayCapRoughness: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${capRoughness * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {capRoughness.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Metal</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={metalness}
              onChange={(e) =>
                setAssays({ assayMetalness: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${metalness * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{metalness.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Side lift</label>
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.005}
              value={sideEmissive}
              onChange={(e) =>
                setAssays({ assaySideEmissive: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${(sideEmissive / 0.4) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sideEmissive.toFixed(3)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap lift</label>
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.005}
              value={capEmissive}
              onChange={(e) =>
                setAssays({ assayCapEmissive: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${(capEmissive / 0.4) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {capEmissive.toFixed(3)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Side order</label>
            <input
              type="range"
              min={6}
              max={10}
              step={0.1}
              value={sideRenderOrder}
              onChange={(e) =>
                setAssays({ assaySideRenderOrder: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${((sideRenderOrder - 6) / 4) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sideRenderOrder.toFixed(1)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap order</label>
            <input
              type="range"
              min={6}
              max={10}
              step={0.1}
              value={capRenderOrder}
              onChange={(e) =>
                setAssays({ assayCapRenderOrder: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${((capRenderOrder - 6) / 4) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {capRenderOrder.toFixed(1)}
            </span>
          </div>
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Cap lens</div>
          <AssayToggle
            label="Lens"
            checked={showBoreLens}
            onChange={(checked) => setAssays({ showBoreLens: checked })}
          />
          <AssayColorControl
            label="Color"
            value={boreLensColor}
            onChange={(color) => setAssays({ boreLensColor: color })}
          />
          <TopoDistanceSlider
            label="Opacity"
            value={boreLensOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreLensOpacity: value })}
          />
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Assay colors</div>
          {colorStops.map((stop) => (
            <div key={stop.id} style={drillingAssayColorRowStyle}>
              <input
                type="color"
                value={stop.color}
                onChange={(e) =>
                  updateColorStop(stop.id, { color: e.target.value })
                }
                style={assayOutlineColorInputStyle}
                title={stop.label}
              />
              <input
                type="text"
                value={stop.label}
                onChange={(e) =>
                  updateColorStop(stop.id, { label: e.target.value })
                }
                style={drillingAssayColorNameStyle}
              />
            </div>
          ))}
        </div>
        <div style={drillingAssayHintStyle}>
          Assay intervals are loaded from drillhole_assays.json; lithology bands
          are loaded from drillhole_lithology.json.
        </div>
      </div>
    </details>
  );
}

export function PageEnvironmentOverridePanel({
  page,
  setPageField,
  accentColor,
}: {
  page: PresentationPage;
  setPageField: (
    pageId: string,
    patch: Partial<
      Pick<
        PresentationPage,
        | "cinematicExposure"
        | "bloomBoost"
        | "sunLockToCamera"
        | "renderPreset"
        | "renderPresetId"
      >
    >,
  ) => void;
  accentColor?: string | null;
}) {
  return (
    <LayerGroup
      title="Page Render Preset Override"
      devSource="src/editor/LayerPanel.tsx:704"
      devNote="PageEnvironmentOverridePanel controls per-page Exposure and Bloom overrides."
      accentColor={accentColor}
    >
      <PageRenderPresetOverrideRow
        value={page.renderPreset ?? page.renderPresetId ?? ""}
        onChange={(value) =>
          setPageField(page.id, {
            renderPreset: value ? (value as RenderPresetId) : undefined,
            renderPresetId: undefined,
          })
        }
      />
      <div style={pageRenderPresetHelpStyle}>
        Overrides the project render preset for this page only.
      </div>
      <PageMoodOverrideRow
        label="Exposure"
        value={page.cinematicExposure ?? 1}
        min={0.4}
        max={2}
        step={0.05}
        overridden={page.cinematicExposure !== undefined}
        onEnable={() => setPageField(page.id, { cinematicExposure: 1 })}
        onClear={() => setPageField(page.id, { cinematicExposure: undefined })}
        onChange={(value) =>
          setPageField(page.id, { cinematicExposure: value })
        }
      />
      <PageMoodOverrideRow
        label="Bloom"
        value={page.bloomBoost ?? 1}
        min={0}
        max={3}
        step={0.05}
        overridden={page.bloomBoost !== undefined}
        onEnable={() => setPageField(page.id, { bloomBoost: 1 })}
        onClear={() => setPageField(page.id, { bloomBoost: undefined })}
        onChange={(value) => setPageField(page.id, { bloomBoost: value })}
      />
      <PageBooleanOverrideRow
        label="Sun follows camera"
        value={page.sunLockToCamera === true}
        overridden={page.sunLockToCamera !== undefined}
        onEnable={() => setPageField(page.id, { sunLockToCamera: true })}
        onClear={() => setPageField(page.id, { sunLockToCamera: undefined })}
        onChange={(value) => setPageField(page.id, { sunLockToCamera: value })}
      />
    </LayerGroup>
  );
}
