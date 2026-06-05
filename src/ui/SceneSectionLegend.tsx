import type { CSSProperties } from "react";
import { useEditor } from "../editor/EditorContext";
import {
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  legendCheckboxStyle,
  legendControlRowStyle,
  resolveLegendTextColors,
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

const rootStyle: CSSProperties = {
  ...transparentLegendPanelStyle,
  left: LEGEND_PAGE_EDGE_MARGIN_PX,
  bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX + 256,
  padding: 13,
  minWidth: 220,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.15,
  fontWeight: 700,
};

const rowStyle: CSSProperties = {
  ...legendControlRowStyle(),
  fontSize: 10,
  alignItems: "flex-start",
};

const firstRowStyle: CSSProperties = {
  ...rowStyle,
  ...legendControlRowStyle({ first: true }),
};

const axisGroupStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "64px repeat(5, auto)",
  alignItems: "center",
  columnGap: 7,
  rowGap: 4,
  width: "100%",
};

const axisLabelStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const compactLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  minWidth: 0,
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
  const legendTextColors = resolveLegendTextColors(
    state.environment.scene?.gui?.overlay,
  );

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

  const bodyRowStyle: CSSProperties = {
    ...rowStyle,
    color: legendTextColors.body,
  };
  const firstBodyRowStyle: CSSProperties = {
    ...firstRowStyle,
    color: legendTextColors.body,
  };
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
      <h2 style={{ ...titleStyle, color: legendTextColors.heading }}>
        Section Planes
      </h2>
      {SCENE_SECTION_AXES.map((axis, index) => {
        const model = axisModel(style, axis);
        return (
          <div key={axis} style={index === 0 ? firstBodyRowStyle : bodyRowStyle}>
            <div style={axisGroupStyle}>
              <span style={{ ...axisLabelStyle, color: AXIS_COLORS[axis] }}>
                <strong>{model.label}</strong>
              </span>
              <label style={compactLabelStyle}>
                <input
                  type="checkbox"
                  aria-label={`${model.label} Show`}
                  checked={model.shown}
                  data-testid={`scene-section-legend-${axis}-show`}
                  onChange={(event) =>
                    setAxisPlanePatch(axis, {
                      enabled: event.currentTarget.checked,
                    })
                  }
                  style={legendCheckboxStyle(model.shown, {
                    checkedColor: AXIS_COLORS[axis],
                  })}
                />
                <span>Show</span>
              </label>
              <label style={compactLabelStyle}>
                <input
                  type="checkbox"
                  aria-label={`${model.label} Flip`}
                  checked={model.flipped}
                  disabled={!model.shown}
                  data-testid={`scene-section-legend-${axis}-flip`}
                  onChange={(event) =>
                    setAxisPlanePatch(axis, {
                      invert: event.currentTarget.checked,
                    })
                  }
                  style={legendCheckboxStyle(model.flipped, {
                    checkedColor: AXIS_COLORS[axis],
                  })}
                />
                <span>Flip</span>
              </label>
              <label style={compactLabelStyle}>
                <input
                  type="checkbox"
                  aria-label={`${model.label} Controls`}
                  checked={model.controlsVisible}
                  disabled={!model.shown}
                  data-testid={`scene-section-legend-${axis}-controls`}
                  onChange={(event) =>
                    setAxisFramePatch(axis, {
                      controlsVisible: event.currentTarget.checked,
                    })
                  }
                  style={legendCheckboxStyle(model.controlsVisible, {
                    checkedColor: AXIS_COLORS[axis],
                  })}
                />
                <span>Controls</span>
              </label>
              {axis !== "z" ? (
                <label style={compactLabelStyle}>
                  <input
                    type="checkbox"
                    aria-label={`${model.label} Ground trace`}
                    checked={model.groundTraceVisible}
                    disabled={!model.shown}
                    data-testid={`scene-section-legend-${axis}-ground-trace-visible`}
                    onChange={(event) =>
                      setAxisFramePatch(axis, {
                        groundTraceVisible: event.currentTarget.checked,
                      })
                    }
                    style={legendCheckboxStyle(model.groundTraceVisible, {
                      checkedColor: AXIS_COLORS[axis],
                    })}
                  />
                  <span>Ground trace</span>
                </label>
              ) : (
                <span aria-hidden="true" />
              )}
              <label style={compactLabelStyle}>
                <input
                  type="checkbox"
                  aria-label={`${model.label} Scale axes`}
                  checked={model.axesVisible}
                  disabled={!model.shown}
                  data-testid={`scene-section-legend-${axis}-axes-visible`}
                  onChange={(event) =>
                    setAxisFramePatch(axis, {
                      axesVisible: event.currentTarget.checked,
                    })
                  }
                  style={legendCheckboxStyle(model.axesVisible, {
                    checkedColor: AXIS_COLORS[axis],
                  })}
                />
                <span>Scale axes</span>
              </label>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
