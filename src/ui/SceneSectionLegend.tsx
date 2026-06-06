import type { CSSProperties } from "react";
import { useEditor } from "../editor/EditorContext";
import {
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  QUICK_LEGEND_INACTIVE_BACKGROUND,
  colorWithAlpha,
  compactQuickLegendIconButtonBaseStyle,
  compactQuickLegendPrimaryButtonBaseStyle,
  compactQuickLegendRowStyle,
  transparentLegendPanelStyle,
} from "./legendStyles";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import {
  effectiveStyle,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type {
  EditableStyle,
  PresentationPage,
  SceneSectionFrameEntry,
  SceneSectionFrameState,
  SceneSectionPlaneState,
} from "../pages/types";
import { selectedLegendAuthoringPage } from "./legendAuthoringTarget";

const UTAH_FORGE_PROJECT_SLUG = "utah-forge";
const SCENE_SECTION_LAYER_ID = "utah-forge-scene-section-planes";
const AXIS_COLORS = {
  x: "#ff6b78",
  y: "#35c7e8",
  z: "#f6d76b",
} as const;
const SCENE_SECTION_AXES = ["x", "y", "z"] as const;
type SceneSectionLegendAxis = (typeof SCENE_SECTION_AXES)[number];
type LegendToggleKind = "flip" | "controls" | "groundTrace" | "axes";

const rootStyle: CSSProperties = {
  ...transparentLegendPanelStyle,
  left: LEGEND_PAGE_EDGE_MARGIN_PX,
  bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX + 256,
  padding: 13,
  minWidth: 220,
};

const rowStyle: CSSProperties = {
  ...compactQuickLegendRowStyle,
  marginTop: 8,
};

const firstRowStyle: CSSProperties = {
  ...rowStyle,
  marginTop: 0,
};

const axisGroupStyle: CSSProperties = {
  ...compactQuickLegendRowStyle,
  minWidth: 0,
};

const iconSpacerStyle: CSSProperties = {
  height: 24,
  flex: "0 0 24px",
  width: 24,
};

function styleBoolean(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
}

function frameBoolean(
  frame: SceneSectionFrameState,
  key: keyof SceneSectionFrameState,
  fallback: boolean,
): boolean {
  const value = frame[key];
  return typeof value === "boolean" ? value : fallback;
}

function sectionButtonLabel(
  label: string,
  axis: SceneSectionLegendAxis,
): string {
  const trimmed = label.replace(/\s*frame\s*$/i, "").trim();
  return trimmed || `${axis.toUpperCase()} Section`;
}

function axisButtonStyle(color: string, active: boolean): CSSProperties {
  return {
    ...compactQuickLegendPrimaryButtonBaseStyle,
    background: colorWithAlpha(color, active ? 1 : 0.36),
    boxShadow: "none",
  };
}

function iconButtonStyle(color: string, available: boolean): CSSProperties {
  return {
    ...compactQuickLegendIconButtonBaseStyle,
    background: available
      ? colorWithAlpha(color, 1)
      : QUICK_LEGEND_INACTIVE_BACKGROUND,
    opacity: available ? 1 : 0.82,
    cursor: available ? "pointer" : "default",
    boxShadow: "none",
  };
}

function LegendToggleIcon({ kind }: { kind: LegendToggleKind }) {
  if (kind === "flip") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path
          d="M8 8 4 12l4 4M4 12h16M16 8l4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "controls") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path
          d="M5 7h14M5 12h14M5 17h14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="9" cy="7" r="2" fill="currentColor" />
        <circle cx="15" cy="12" r="2" fill="currentColor" />
        <circle cx="11" cy="17" r="2" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "groundTrace") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path
          d="M4 15c3-6 5 3 8-3s5 3 8-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 18h14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.72"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d="M6 18V5M6 18h13M6 9h4M11 18v-4M16 18v-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function builtInFrameId(axis: SceneSectionLegendAxis): string {
  return `axis:${axis}`;
}

function builtInFrameLabel(axis: SceneSectionLegendAxis): string {
  return `${axis.toUpperCase()} Section`;
}

function builtInFrameEntries(
  style: EditableStyle,
  axis: SceneSectionLegendAxis,
  planePatch: Partial<SceneSectionPlaneState> = {},
  framePatch: Partial<SceneSectionFrameState> = {},
): SceneSectionFrameEntry[] {
  const explicit = Array.isArray(style.sceneSectionFrames)
    ? style.sceneSectionFrames
    : [];
  const explicitById = new Map(
    explicit
      .filter((entry) => typeof entry?.id === "string" && entry.id.trim())
      .map((entry) => [entry.id, entry] as const),
  );
  const builtIns = SCENE_SECTION_AXES.map((entryAxis) => {
    const id = builtInFrameId(entryAxis);
    const entry = explicitById.get(id);
    const nextPlane = {
      ...(entry?.plane ?? {}),
      ...(style.sceneSectionPlanes?.[entryAxis] ?? {}),
      ...(entryAxis === axis ? planePatch : {}),
    };
    const nextFrame = {
      ...(style.sceneSectionFrameByAxis?.[entryAxis] ?? {}),
      ...(entry?.frame ?? {}),
      ...(entryAxis === axis ? framePatch : {}),
    };
    return {
      id,
      label:
        typeof entry?.label === "string" && entry.label.trim()
          ? entry.label
          : builtInFrameLabel(entryAxis),
      axis: entryAxis,
      plane: nextPlane,
      frame: nextFrame,
    };
  });
  const custom = explicit.filter(
    (entry) =>
      entry &&
      typeof entry.id === "string" &&
      entry.id.trim() &&
      !entry.id.startsWith("axis:"),
  );
  return [...builtIns, ...custom];
}

function axisModel(style: EditableStyle, axis: SceneSectionLegendAxis) {
  const entry = Array.isArray(style.sceneSectionFrames)
    ? style.sceneSectionFrames.find((candidate) => candidate?.id === builtInFrameId(axis))
    : null;
  const plane = {
    ...(entry?.plane ?? {}),
    ...(style.sceneSectionPlanes?.[axis] ?? {}),
  };
  const frame = {
    ...(style.sceneSectionFrameByAxis?.[axis] ?? {}),
    ...(entry?.frame ?? {}),
  };
  const controlsVisible =
    typeof frame.controlsVisible === "boolean"
      ? frame.controlsVisible
      : entry?.legendVisible === false
        ? false
        : styleBoolean(style, "sceneSectionHelperVisible", true);
  return {
    label:
      typeof entry?.label === "string" && entry.label.trim()
        ? entry.label
        : builtInFrameLabel(axis),
    plane,
    frame,
    shown: plane.enabled === true,
    flipped: plane.invert === true,
    controlsVisible,
    groundTraceVisible: frameBoolean(
      frame,
      "groundTraceVisible",
      styleBoolean(style, "sceneSectionGroundTraceVisible", true),
    ),
    axesVisible: frameBoolean(
      frame,
      "axesVisible",
      styleBoolean(style, "sceneSectionAxesVisible", true),
    ),
  };
}

export function SceneSectionLegend({
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
    setPageLayerOverride,
    canApplyLiveSceneEdits,
  } = useEditor();
  const { pages, currentIndex, transitionFrame } = usePageController();
  if (state.projectSlug !== UTAH_FORGE_PROJECT_SLUG) return null;

  const allAuthoringPages = [...state.pages, ...state.archivedPages];
  const targetIndex = transitionFrame.targetIndex;
  const controllerPage =
    pageOverride ??
    pages[targetIndex ?? transitionFrame.sourceIndex] ??
    pages[transitionFrame.sourceIndex] ??
    pages[currentIndex];
  const editingEnvironment = state.selectedPageId === ENVIRONMENT_SENTINEL;
  const authoringPage = selectedLegendAuthoringPage(state);
  const selectedPage =
    !pageOverride &&
    !editingEnvironment &&
    !transitionFrame.active &&
    state.selectedPageId
      ? allAuthoringPages.find((candidate) => candidate.id === state.selectedPageId)
      : null;
  const page =
    pageOverride ??
    (transitionFrame.active && targetIndex !== null
      ? controllerPage
      : selectedPage ?? controllerPage);
  const writePage = authoringPage ?? page;
  const pageEnvironment = page
    ? resolveEnvironmentForPage(state.environment, allAuthoringPages, page)
    : state.environment;
  const style = editingEnvironment
    ? state.environment.layerStyles[SCENE_SECTION_LAYER_ID] ?? {}
    : page
      ? effectiveStyle(pageEnvironment, page, SCENE_SECTION_LAYER_ID)
      : pageEnvironment.layerStyles[SCENE_SECTION_LAYER_ID] ?? {};
  if (style.sceneSectionEnabled !== true) return null;
  if (!styleBoolean(style, "sceneSectionLegendVisible", true)) return null;

  const commit = (patch: Partial<EditableStyle>) => {
    const merged = { ...style, ...patch };
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(SCENE_SECTION_LAYER_ID, merged);
    }
    if (editingEnvironment) {
      setEnvLayerStyle(SCENE_SECTION_LAYER_ID, patch);
    } else if (writePage) {
      setPageLayerOverride(writePage.id, SCENE_SECTION_LAYER_ID, patch);
    } else {
      setEnvLayerStyle(SCENE_SECTION_LAYER_ID, patch);
    }
  };
  const setAxisPlanePatch = (
    axis: SceneSectionLegendAxis,
    planePatch: Partial<SceneSectionPlaneState>,
  ) => {
    const nextPlane = {
      ...(style.sceneSectionPlanes?.[axis] ?? {}),
      ...planePatch,
    };
    commit({
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionActiveAxis: axis,
      sceneSectionActiveFrameId: builtInFrameId(axis),
      sceneSectionPlanes: {
        ...(style.sceneSectionPlanes ?? {}),
        [axis]: nextPlane,
      },
      sceneSectionFrames: builtInFrameEntries(style, axis, planePatch),
    });
  };
  const setAxisFramePatch = (
    axis: SceneSectionLegendAxis,
    framePatch: Partial<SceneSectionFrameState>,
  ) => {
    const nextFrame = {
      ...(style.sceneSectionFrameByAxis?.[axis] ?? {}),
      ...framePatch,
    };
    commit({
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionActiveAxis: axis,
      sceneSectionActiveFrameId: builtInFrameId(axis),
      sceneSectionFrameEnabled: true,
      sceneSectionFrameByAxis: {
        ...(style.sceneSectionFrameByAxis ?? {}),
        [axis]: nextFrame,
      },
      sceneSectionFrames: builtInFrameEntries(style, axis, {}, framePatch),
    });
  };

  return (
    <aside
      style={{
        ...rootStyle,
        ...(stacked ? { position: "relative", left: "auto", bottom: "auto" } : {}),
      }}
      aria-label="Utah FORGE scene section plane legend"
    >
      {SCENE_SECTION_AXES.map((axis, index) => {
        const model = axisModel(style, axis);
        const axisColor = AXIS_COLORS[axis];
        const axisLabel = sectionButtonLabel(model.label, axis);
        return (
          <div key={axis} style={index === 0 ? firstRowStyle : rowStyle}>
            <div style={axisGroupStyle}>
              <button
                type="button"
                aria-label={`${axisLabel} Show`}
                aria-pressed={model.shown}
                title={`${axisLabel} Show`}
                data-testid={`scene-section-legend-${axis}-show`}
                onClick={() =>
                  setAxisPlanePatch(axis, {
                    enabled: !model.shown,
                  })
                }
                style={axisButtonStyle(axisColor, model.shown)}
              >
                {axisLabel}
              </button>
              <button
                type="button"
                aria-label={`${axisLabel} Controls`}
                aria-pressed={model.controlsVisible}
                title="Controls"
                disabled={!model.shown}
                data-testid={`scene-section-legend-${axis}-controls`}
                onClick={() =>
                  setAxisFramePatch(axis, {
                    controlsVisible: !model.controlsVisible,
                  })
                }
                style={iconButtonStyle(axisColor, model.shown)}
              >
                <LegendToggleIcon kind="controls" />
              </button>
              <button
                type="button"
                aria-label={`${axisLabel} Flip`}
                aria-pressed={model.flipped}
                title="Flip side"
                disabled={!model.shown}
                data-testid={`scene-section-legend-${axis}-flip`}
                onClick={() =>
                  setAxisPlanePatch(axis, {
                    invert: !model.flipped,
                  })
                }
                style={iconButtonStyle(axisColor, model.shown)}
              >
                <LegendToggleIcon kind="flip" />
              </button>
              <button
                type="button"
                aria-label={`${axisLabel} Scale axes`}
                aria-pressed={model.axesVisible}
                title="Scale axes"
                disabled={!model.shown}
                data-testid={`scene-section-legend-${axis}-axes-visible`}
                onClick={() =>
                  setAxisFramePatch(axis, {
                    axesVisible: !model.axesVisible,
                  })
                }
                style={iconButtonStyle(axisColor, model.shown)}
              >
                <LegendToggleIcon kind="axes" />
              </button>
              {axis !== "z" ? (
                <button
                  type="button"
                  aria-label={`${axisLabel} Ground trace`}
                  aria-pressed={model.groundTraceVisible}
                  title="Ground trace"
                  disabled={!model.shown}
                  data-testid={`scene-section-legend-${axis}-ground-trace-visible`}
                  onClick={() =>
                    setAxisFramePatch(axis, {
                      groundTraceVisible: !model.groundTraceVisible,
                    })
                  }
                  style={iconButtonStyle(axisColor, model.shown)}
                >
                  <LegendToggleIcon kind="groundTrace" />
                </button>
              ) : (
                <span aria-hidden="true" style={iconSpacerStyle} />
              )}
            </div>
          </div>
        );
      })}
    </aside>
  );
}
