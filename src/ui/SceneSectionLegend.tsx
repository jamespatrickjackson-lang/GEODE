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
import type { EditableStyle, PresentationPage } from "../pages/types";
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
};

const firstRowStyle: CSSProperties = {
  ...rowStyle,
  ...legendControlRowStyle({ first: true }),
};

const helperRowStyle: CSSProperties = {
  ...rowStyle,
  ...legendControlRowStyle({ cursor: "pointer" }),
};

function styleBoolean(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
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
      ? state.pages.find((candidate) => candidate.id === state.selectedPageId)
      : null;
  const page =
    pageOverride ??
    (transitionFrame.active && targetIndex !== null
      ? controllerPage
      : selectedPage ?? controllerPage);
  const writePage = authoringPage ?? page;
  const pageEnvironment = page
    ? resolveEnvironmentForPage(state.environment, state.pages, page)
    : state.environment;
  const style = editingEnvironment
    ? state.environment.layerStyles[SCENE_SECTION_LAYER_ID] ?? {}
    : page
      ? effectiveStyle(pageEnvironment, page, SCENE_SECTION_LAYER_ID)
      : pageEnvironment.layerStyles[SCENE_SECTION_LAYER_ID] ?? {};
  if (style.sceneSectionEnabled !== true) return null;
  if (!styleBoolean(style, "sceneSectionLegendVisible", true)) return null;

  const planes = style.sceneSectionPlanes ?? {};
  const explicitFrameById = new Map(
    (Array.isArray(style.sceneSectionFrames) ? style.sceneSectionFrames : [])
      .filter((entry) => typeof entry?.id === "string" && entry.id.trim())
      .map((entry) => [entry.id, entry] as const),
  );
  const axisFrameEntry = (axis: SceneSectionLegendAxis) =>
    explicitFrameById.get(`axis:${axis}`);
  const axisLabel = (axis: SceneSectionLegendAxis) => {
    const entry = axisFrameEntry(axis);
    const label = typeof entry?.label === "string" && entry.label.trim()
      ? entry.label
      : `${axis.toUpperCase()} Section`;
    return label;
  };
  const axisInLegend = (axis: SceneSectionLegendAxis) =>
    axisFrameEntry(axis)?.legendVisible !== false;
  const bodyRowStyle: CSSProperties = {
    ...rowStyle,
    color: legendTextColors.body,
  };
  const firstBodyRowStyle: CSSProperties = {
    ...firstRowStyle,
    color: legendTextColors.body,
  };
  const helperBodyRowStyle: CSSProperties = {
    ...helperRowStyle,
    color: legendTextColors.body,
  };
  const helperVisible =
    typeof style.sceneSectionHelperVisible === "boolean"
      ? style.sceneSectionHelperVisible
      : !state.presenterMode;
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
  const setAxisEnabled = (axis: SceneSectionLegendAxis, enabled: boolean) => {
    const nextAxisPlane = {
      ...(planes[axis] ?? {}),
      enabled,
    };
    const nextPlanes = {
      ...planes,
      [axis]: nextAxisPlane,
    };
    const frameEntries = Array.isArray(style.sceneSectionFrames)
      ? style.sceneSectionFrames
      : null;
    let matchedFrameEntry = false;
    const nextFrameEntries = frameEntries
      ? frameEntries.map((entry) => {
          if (entry?.id !== `axis:${axis}`) return entry;
          matchedFrameEntry = true;
          return {
            ...entry,
            axis,
            plane: {
              ...(entry.plane ?? {}),
              ...nextAxisPlane,
            },
          };
        })
      : null;
    const frameEntryForAxis = (entryAxis: SceneSectionLegendAxis) =>
      nextFrameEntries?.find((entry) => entry?.id === `axis:${entryAxis}`);
    const anyBuiltInPlaneEnabled = SCENE_SECTION_AXES.some((entryAxis) => {
      const frameEntry = frameEntryForAxis(entryAxis);
      const resolvedPlane = {
        ...(nextPlanes[entryAxis] ?? {}),
        ...(frameEntry?.plane ?? {}),
      };
      return resolvedPlane.enabled === true;
    });
    const anyCustomPlaneEnabled =
      nextFrameEntries?.some(
        (entry) =>
          typeof entry?.id === "string" &&
          !entry.id.startsWith("axis:") &&
          entry.plane?.enabled === true,
      ) === true;
    commit({
      sceneSectionEnabled: anyBuiltInPlaneEnabled || anyCustomPlaneEnabled,
      sceneSectionMode: "cutaway",
      sceneSectionActiveAxis: axis,
      sceneSectionPlanes: nextPlanes,
      ...(matchedFrameEntry && nextFrameEntries
        ? { sceneSectionFrames: nextFrameEntries }
        : {}),
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
      {SCENE_SECTION_AXES
        .filter((axis) => axisInLegend(axis))
        .map((axis, index) => {
          const plane = planes[axis] ?? {};
          const enabled = plane.enabled === true;
          const label = axisLabel(axis);
          return (
            <div key={axis} style={index === 0 ? firstBodyRowStyle : bodyRowStyle}>
              <input
                type="checkbox"
                aria-label={label}
                checked={enabled}
                data-testid={`scene-section-legend-${axis}-enabled`}
                onChange={(event) => setAxisEnabled(axis, event.currentTarget.checked)}
                style={legendCheckboxStyle(enabled, {
                  checkedColor: AXIS_COLORS[axis],
                })}
              />
              <span>
                <strong>{label}</strong>
              </span>
            </div>
          );
        })}
      <label style={helperBodyRowStyle}>
        <input
          type="checkbox"
          aria-label="P Controle"
          checked={helperVisible}
          data-testid="scene-section-legend-helper-visible"
          onChange={(event) =>
            commit({ sceneSectionHelperVisible: event.currentTarget.checked })
          }
          style={legendCheckboxStyle(helperVisible, {
            checkedColor: legendTextColors.heading,
          })}
        />
        <span>
          <strong>P Controle</strong>
        </span>
      </label>
    </aside>
  );
}
