import type { CSSProperties } from "react";
import { useEditor } from "../editor/EditorContext";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import { UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID } from "../projectModules/utahForge/layerIds";
import {
  effectiveStyle,
  effectiveVisibility,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { EditableStyle, PresentationPage } from "../pages/types";
import { selectedLegendAuthoringPage } from "./legendAuthoringTarget";
import {
  QUICK_LEGEND_INACTIVE_BACKGROUND,
  colorWithAlpha,
  compactQuickLegendPrimaryButtonBaseStyle,
  compactQuickLegendRowStyle,
  compactQuickLegendStackStyle,
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  transparentLegendPanelStyle,
} from "./legendStyles";

const UTAH_FORGE_PROJECT_SLUG = "utah-forge";
const LAYER_ID = UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID;
const DEFAULT_HCGR_COLOR = "#ffe26d";
const DEFAULT_HSGR_COLOR = "#ff9f43";
const DEFAULT_RESISTIVITY_COLOR = "#4dd6ff";
const DEFAULT_BASELINE_COLOR = "#eef7f2";
const DEFAULT_LITHOLOGY_COLOR = "#86d279";

type BoreholeLegendTrackKey = "hcgr" | "hsgr" | "resistivity" | "lithology";

const TRACKS: Array<{
  key: BoreholeLegendTrackKey;
  label: string;
  colorField?: keyof EditableStyle;
  fallback: string;
  icon: "curve" | "column";
}> = [
  {
    key: "hcgr",
    label: "HCGR",
    colorField: "boreholeLogHcgrColor",
    fallback: DEFAULT_HCGR_COLOR,
    icon: "curve",
  },
  {
    key: "hsgr",
    label: "HSGR",
    colorField: "boreholeLogHsgrColor",
    fallback: DEFAULT_HSGR_COLOR,
    icon: "curve",
  },
  {
    key: "resistivity",
    label: "RES",
    colorField: "boreholeLogResistivityColor",
    fallback: DEFAULT_RESISTIVITY_COLOR,
    icon: "curve",
  },
  {
    key: "lithology",
    label: "Lith",
    fallback: DEFAULT_LITHOLOGY_COLOR,
    icon: "column",
  },
];

const rootStyle: CSSProperties = {
  ...transparentLegendPanelStyle,
  minWidth: 220,
};

const rowStyle: CSSProperties = {
  ...compactQuickLegendRowStyle,
};

const stackStyle: CSSProperties = {
  ...compactQuickLegendStackStyle,
};

function styleString(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: string,
): string {
  const value = style[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function trackSelection(style: EditableStyle) {
  const selection = style.boreholeLogTrackSelection;
  const gamma = selection?.gamma !== false;
  const hcgr = gamma && selection?.hcgr !== false;
  const hsgr = gamma && selection?.hsgr !== false;
  return {
    gamma: hcgr || hsgr,
    hcgr,
    hsgr,
    resistivity: selection?.resistivity !== false,
    lithology: selection?.lithology !== false,
  };
}

function buttonStyle(color: string, active: boolean): CSSProperties {
  return {
    ...compactQuickLegendPrimaryButtonBaseStyle,
    background: active ? colorWithAlpha(color, 1) : QUICK_LEGEND_INACTIVE_BACKGROUND,
    opacity: active ? 1 : 0.78,
  };
}

function passiveButtonStyle(color: string): CSSProperties {
  return {
    ...compactQuickLegendPrimaryButtonBaseStyle,
    background: colorWithAlpha(color, 0.72),
    cursor: "default",
  };
}

function TrackIcon({ kind }: { kind: "curve" | "column" | "logs" | "spine" }) {
  if (kind === "column") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9 4h6v16H9zM9 8h6M9 12h6M9 16h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "logs") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 19V5M12 19V5M17 19V5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "spine") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 4v16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 14c3-6 5 4 8-2s5 4 8-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buttonContents(label: string, icon: "curve" | "column" | "logs" | "spine") {
  return (
    <>
      <TrackIcon kind={icon} />
      <span style={{ marginLeft: 6 }}>{label}</span>
    </>
  );
}

export function BoreholeLogsLegend({
  stacked = false,
  pageOverride = null,
}: {
  stacked?: boolean;
  pageOverride?: PresentationPage | null;
}) {
  const {
    state,
    sceneHandle,
    setEnvLayerStyle,
    toggleEnvDefaultVisible,
    setPageLayerOverride,
    setPageVisibilityOverride,
    canApplyLiveSceneEdits,
  } = useEditor();
  const { pages, currentIndex, transitionFrame } = usePageController();
  if (state.projectSlug !== UTAH_FORGE_PROJECT_SLUG) return null;

  const targetIndex = transitionFrame.targetIndex;
  const controllerPage =
    pageOverride ??
    pages[targetIndex ?? transitionFrame.sourceIndex] ??
    pages[transitionFrame.sourceIndex] ??
    pages[currentIndex];
  const editingEnvironment =
    !state.presenterMode && state.selectedPageId === ENVIRONMENT_SENTINEL;
  const authoringPage = selectedLegendAuthoringPage(state);
  const selectedPage =
    !pageOverride &&
    !editingEnvironment &&
    !transitionFrame.active &&
    state.selectedPageId
      ? state.pages.find((candidate) => candidate.id === state.selectedPageId)
      : null;
  const page =
    pageOverride ??
    (transitionFrame.active && targetIndex !== null
      ? controllerPage
      : selectedPage ?? controllerPage);
  const writePage = authoringPage ?? page;
  if (!page) return null;

  const pageEnvironment = resolveEnvironmentForPage(
    state.environment,
    state.pages,
    page,
  );
  const visible = editingEnvironment
    ? new Set(state.environment.defaultVisibleLayers)
    : effectiveVisibility(pageEnvironment, page);
  const layerVisible = visible.has(LAYER_ID);
  const explicitPageOverride = writePage?.visibilityOverrides?.[LAYER_ID] !== undefined;
  if (!layerVisible && !explicitPageOverride && !editingEnvironment) return null;

  const style = editingEnvironment
    ? state.environment.layerStyles[LAYER_ID] ?? {}
    : effectiveStyle(pageEnvironment, page, LAYER_ID);
  if (style.boreholeLogLegendVisible === false) return null;

  const selection = trackSelection(style);
  const setStylePatch = (patch: Partial<EditableStyle>) => {
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(LAYER_ID, { ...style, ...patch });
    }
    if (editingEnvironment) {
      setEnvLayerStyle(LAYER_ID, patch);
    } else if (writePage) {
      setPageLayerOverride(writePage.id, LAYER_ID, patch);
    }
  };
  const setLayerVisible = (nextVisible: boolean) => {
    if (editingEnvironment) {
      const currentlyVisible = state.environment.defaultVisibleLayers.includes(LAYER_ID);
      if (currentlyVisible !== nextVisible) toggleEnvDefaultVisible(LAYER_ID);
    } else if (writePage) {
      setPageVisibilityOverride(writePage.id, LAYER_ID, nextVisible);
    }
  };
  const setTrackVisible = (key: BoreholeLegendTrackKey, nextVisible: boolean) => {
    const nextSelection = {
      ...selection,
      [key]: nextVisible,
    };
    nextSelection.gamma = nextSelection.hcgr || nextSelection.hsgr;
    setStylePatch({ boreholeLogTrackSelection: nextSelection });
  };
  const spineColor = styleString(
    style,
    "boreholeLogBaselineColor",
    DEFAULT_BASELINE_COLOR,
  );

  return (
    <aside
      style={{
        ...rootStyle,
        ...(stacked
          ? { position: "relative" }
          : {
              left: LEGEND_PAGE_EDGE_MARGIN_PX,
              bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX,
            }),
      }}
      aria-label="Borehole logs legend"
    >
      <div style={stackStyle}>
        <div style={rowStyle}>
          <button
            type="button"
            aria-label="Toggle borehole logs"
            aria-pressed={layerVisible}
            title="Borehole Logs"
            data-testid="borehole-logs-legend-toggle"
            onClick={() => setLayerVisible(!layerVisible)}
            style={buttonStyle("#f4f5f7", layerVisible)}
          >
            {buttonContents("Logs", "logs")}
          </button>
          <button
            type="button"
            aria-label="Lane spine color"
            aria-disabled="true"
            title="Spine"
            data-testid="borehole-logs-legend-spine"
            tabIndex={-1}
            style={passiveButtonStyle(spineColor)}
          >
            {buttonContents("Spine", "spine")}
          </button>
        </div>
        {[0, 2].map((start) => (
          <div style={rowStyle} key={start}>
            {TRACKS.slice(start, start + 2).map((track) => {
              const color = track.colorField
                ? styleString(style, track.colorField, track.fallback)
                : track.fallback;
              const active = selection[track.key];
              return (
                <button
                  key={track.key}
                  type="button"
                  aria-label={`Toggle ${track.label}`}
                  aria-pressed={active}
                  title={track.label}
                  data-testid={`borehole-logs-legend-${track.key}`}
                  onClick={() => setTrackVisible(track.key, !active)}
                  style={buttonStyle(color, active)}
                >
                  {buttonContents(track.label, track.icon)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
