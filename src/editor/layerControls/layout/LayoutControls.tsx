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
  OverrideStateIndicator,
} from "../../styleControls";
import { ToggleButton } from "../env/EnvRows";
import {
  assayOutlineColorInputStyle,
  layerGroupBodyStyle,
  layerGroupChevronStyle,
  layerGroupDisclosureStyle,
  layerGroupFogControlRowStyle,
  layerGroupFogControlStyle,
  layerGroupIconStyle,
  layerGroupStyle,
  layerGroupSummaryStyle,
  layerGroupTitleStyle,
} from "./layoutStyles";
import { TransientSlider } from "../../TransientSlider";

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
  manifestId,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  openSignal?: unknown;
  devSource?: string;
  devNote?: string;
  accentColor?: string | null;
  manifestId?: string;
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
  const rootStyle = accentColor
    ? ({
        ...layerGroupStyle,
        "--editor-slider-thumb": accentColor,
      } as React.CSSProperties)
    : layerGroupStyle;
  return (
    <div
      style={rootStyle}
      data-dev-source="src/editor/LayerPanel.tsx:862"
      data-dev-container="true"
      data-dev-container-type="layer-tool-container"
      data-dev-container-name={title}
      data-dev-container-scope="LayerGroup / layerGroupSummaryStyle"
      data-dev-note="layerGroupStyle controls the left inset and spacing around each Layers subheading."
      data-editor-section-id={manifestId}
    >
      <button
        type="button"
        style={summaryStyle}
        data-dev-source={devSource}
        data-dev-container="true"
        data-dev-container-type="nested-section-header"
        data-dev-container-name={title}
        data-dev-container-scope="layerGroupSummaryStyle"
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
          <LayerGroupTitleIcon title={title} />
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

function LayerGroupTitleIcon({ title }: { title: string }) {
  const icon = layerGroupIconForTitle(title);
  return (
    <svg
      style={layerGroupIconStyle}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}

function layerGroupIconForTitle(title: string): React.ReactNode {
  const normalized = title.toLowerCase();
  if (normalized === "environment") {
    return (
      <>
        <path d="M17.5 19H8a5 5 0 1 1 1.2-9.85A6.5 6.5 0 0 1 21 12.5 3.5 3.5 0 0 1 17.5 19Z" />
      </>
    );
  }
  if (
    normalized.includes("topo settings") ||
    normalized.includes("topo map") ||
    normalized.includes("topo details") ||
    normalized.includes("quarry base")
  ) {
    return (
      <>
        <path d="M3 17.5 8 6l5 11.5" />
        <path d="m11.5 17.5 3-7 6.5 7" />
        <path d="M8 6h7" />
        <path d="M2.75 17.5h18.5" />
      </>
    );
  }
  if (normalized.includes("longitude") || normalized.includes("grid")) {
    return (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16" />
        <path d="M12 4v16" />
        <path d="M6.25 6.25c3.2 2.1 8.3 2.1 11.5 0" />
        <path d="M6.25 17.75c3.2-2.1 8.3-2.1 11.5 0" />
      </>
    );
  }
  if (normalized.includes("title block") || normalized.includes("overlay")) {
    return (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M7 9h10" />
        <path d="M7 13h6" />
        <path d="M7 16h4" />
      </>
    );
  }
  if (normalized.includes("site detail") || normalized.includes("foundation")) {
    return (
      <>
        <path d="M12 21s6-5.1 6-10a6 6 0 0 0-12 0c0 4.9 6 10 6 10Z" />
        <circle cx="12" cy="11" r="2.2" />
      </>
    );
  }
  if (normalized.includes("bore")) {
    return (
      <>
        <path d="M9 3v16" />
        <path d="M15 5v16" />
        <path d="M9 5c2 1.6 4 1.6 6 0" />
        <path d="M9 12c2 1.6 4 1.6 6 0" />
        <path d="M9 19c2 1.6 4 1.6 6 0" />
      </>
    );
  }
  if (normalized.includes("seismic") || normalized.includes("geophysical")) {
    return (
      <>
        <path d="M3 12h3l2-5 4 10 3-8 2 3h4" />
        <path d="M3 18h18" />
      </>
    );
  }
  if (normalized.includes("mt resistivity")) {
    return (
      <>
        <path d="M4 17c2.4-6.7 13.6-6.7 16 0" />
        <path d="M7 17c1.5-3.8 8.5-3.8 10 0" />
        <path d="M10 17c.7-1.4 3.3-1.4 4 0" />
        <path d="M12 5v4" />
        <path d="m9.5 7.5 5-5" />
      </>
    );
  }
  if (normalized.includes("working area") || normalized.includes("area outline")) {
    return (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 9h8" />
        <path d="M8 15h8" />
        <path d="M8 9v6" />
        <path d="M16 9v6" />
      </>
    );
  }
  if (normalized.includes("scene section")) {
    return (
      <>
        <path d="M5 5h14v14H5z" />
        <path d="M8 19 16 5" />
        <path d="M7 12h10" />
      </>
    );
  }
  if (normalized.includes("drilling")) {
    return (
      <>
        <path d="m7 4 10 10" />
        <path d="m14 11 3.5-3.5" />
        <path d="m5 18 4-4" />
        <path d="m9 14 1.5 4.5" />
      </>
    );
  }
  if (normalized.includes("assay") || normalized.includes("geochemical")) {
    return (
      <>
        <path d="M9 3v5l-4 8a3 3 0 0 0 2.7 4h8.6a3 3 0 0 0 2.7-4l-4-8V3" />
        <path d="M8 3h8" />
        <path d="M7 16h10" />
      </>
    );
  }
  if (normalized.includes("hyperspectral") || normalized.includes("imagery")) {
    return (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="m7 15 3-3 2 2 3-4 2 5" />
        <circle cx="8" cy="9" r="1" />
      </>
    );
  }
  if (normalized.includes("target") || normalized.includes("tenure")) {
    return (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3" />
        <path d="M12 19v3" />
        <path d="M2 12h3" />
        <path d="M19 12h3" />
      </>
    );
  }
  if (normalized.includes("photogrammetry")) {
    return (
      <>
        <path d="M5 7h14v10H5z" />
        <circle cx="12" cy="12" r="3" />
        <path d="M8 7l1.5-2h5L16 7" />
      </>
    );
  }
  if (normalized.includes("gamma")) {
    return (
      <>
        <path d="M12 12 5 5" />
        <path d="M12 12h9" />
        <path d="M12 12 7 20" />
        <circle cx="12" cy="12" r="2.2" />
      </>
    );
  }
  if (normalized.includes("water")) {
    return (
      <>
        <path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11Z" />
        <path d="M8.5 15.5c2 1 5 1 7 0" />
      </>
    );
  }
  return (
    <>
      <path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" />
      <path d="M4 12l8 4.5 8-4.5" />
      <path d="M4 16.5 12 21l8-4.5" />
    </>
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
        <label style={nestedFieldLabelStyle}>Fog participation</label>
        <ToggleButton
          editorControlId="layer.fog.use"
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
        <OverrideStateIndicator active={mixed || allOn} />
      </div>
      {!allOff ? (
        <div style={layerGroupFogControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Fog dens.</label>
          <input
            type="range"
            min={FOG_DENSITY_UI_MIN}
            max={FOG_DENSITY_UI_MAX}
            step={FOG_DENSITY_UI_STEP}
            value={densityUi}
            disabled={disabled}
            onChange={(e) => setDensity(parseFloat(e.target.value))}
            style={
              {
                flex: 1,
                opacity: disabled ? 0.42 : 1,
                "--editor-slider-fill": `${
                  ((densityUi - FOG_DENSITY_UI_MIN) /
                    (FOG_DENSITY_UI_MAX - FOG_DENSITY_UI_MIN)) *
                  100
                }%`,
              } as React.CSSProperties
            }
          />
          <OverrideStateIndicator active={densityMixed} />
        </div>
      ) : null}
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
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <TransientSlider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        format={(nextValue) => `${nextValue.toFixed(decimals)}${suffix}`}
        style={{ flex: 1 }}
      />
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
