import type { CSSProperties } from "react";
import { useEditor } from "../editor/EditorContext";
import {
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "../editor/styles";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import { effectiveStyle } from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { EditableStyle } from "../pages/types";

const UTAH_FORGE_PROJECT_SLUG = "utah-forge";
const SCENE_SECTION_LAYER_ID = "utah-forge-scene-section-planes";
const AXIS_COLORS = {
  x: "#ff6b78",
  y: "#35c7e8",
  z: "#f6d76b",
} as const;
const LEGEND_PANEL_SHADOW =
  "0 24px 80px rgba(0, 0, 0, 0.24), inset 0 -1px 0 rgba(0, 0, 0, 0.12)";

const rootStyle: CSSProperties = {
  position: "absolute",
  zIndex: 11,
  left: 34,
  bottom: 306,
  width: 282,
  boxSizing: "border-box",
  padding: 13,
  pointerEvents: "auto",
  fontFamily: TECHNICAL_MONO_FONT,
  color: vibrancyLabel,
  background: "rgba(18, 21, 24, 0.55)",
  border: FROSTED_HAIRLINE,
  borderRadius: 12,
  boxShadow: LEGEND_PANEL_SHADOW,
  backdropFilter: "blur(20px) saturate(145%)",
  WebkitBackdropFilter: "blur(20px) saturate(145%)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.15,
  fontWeight: 700,
};

const subtitleStyle: CSSProperties = {
  marginTop: 5,
  color: vibrancySecondaryLabel,
  fontSize: 10,
  lineHeight: 1.25,
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "16px 1fr auto",
  alignItems: "center",
  gap: 7,
  marginTop: 9,
  color: vibrancySecondaryLabel,
  fontSize: 10,
};

const swatchBaseStyle: CSSProperties = {
  width: 13,
  height: 13,
  borderRadius: 2,
  boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.36)",
};

const footerStyle: CSSProperties = {
  marginTop: 9,
  color: vibrancyTertiaryLabel,
  fontSize: 10,
  lineHeight: 1.25,
};

function styleBoolean(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
}

function planePositionLabel(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value).toLocaleString()} m`
    : "default";
}

function scopeLabel(scope: EditableStyle["sceneSectionTargetScope"]): string {
  if (scope === "all-visible") return "all visible";
  if (scope === "active-selection") return "active selection";
  return "selected targets";
}

export function SceneSectionLegend() {
  const { state, sceneHandle, setEnvLayerStyle, setPageLayerOverride } = useEditor();
  const { pages, currentIndex, targetIndex } = usePageController();
  if (state.projectSlug !== UTAH_FORGE_PROJECT_SLUG) return null;

  const controllerPage = pages[targetIndex ?? currentIndex] ?? pages[currentIndex];
  const editingEnvironment = state.selectedPageId === ENVIRONMENT_SENTINEL;
  const selectedPage =
    !editingEnvironment && state.selectedPageId
      ? state.pages.find((candidate) => candidate.id === state.selectedPageId)
      : null;
  const page = selectedPage ?? controllerPage;
  const style = editingEnvironment
    ? state.environment.layerStyles[SCENE_SECTION_LAYER_ID] ?? {}
    : page
      ? effectiveStyle(state.environment, page, SCENE_SECTION_LAYER_ID)
      : state.environment.layerStyles[SCENE_SECTION_LAYER_ID] ?? {};
  if (style.sceneSectionEnabled !== true) return null;
  if (!styleBoolean(style, "sceneSectionLegendVisible", true)) return null;

  const planes = style.sceneSectionPlanes ?? {};
  const activeAxis =
    style.sceneSectionActiveAxis === "x" ||
    style.sceneSectionActiveAxis === "y" ||
    style.sceneSectionActiveAxis === "z"
      ? style.sceneSectionActiveAxis
      : "z";
  const helperVisible = style.sceneSectionHelperVisible !== false;
  const commit = (patch: Partial<EditableStyle>) => {
    const merged = { ...style, ...patch };
    sceneHandle.manager.applyStyle(SCENE_SECTION_LAYER_ID, merged);
    if (editingEnvironment || !page) {
      setEnvLayerStyle(SCENE_SECTION_LAYER_ID, patch);
    } else {
      setPageLayerOverride(page.id, SCENE_SECTION_LAYER_ID, patch);
    }
  };
  const setAxisEnabled = (axis: "x" | "y" | "z", enabled: boolean) => {
    commit({
      sceneSectionActiveAxis: axis,
      sceneSectionPlanes: {
        ...planes,
        [axis]: {
          ...(planes[axis] ?? {}),
          enabled,
        },
      },
    });
  };

  return (
    <aside style={rootStyle} aria-label="Utah FORGE scene section plane legend">
      <h2 style={titleStyle}>Scene section planes</h2>
      <div style={subtitleStyle}>
        Cutaway clip - {scopeLabel(style.sceneSectionTargetScope)}
      </div>
      {(["x", "y", "z"] as const).map((axis) => {
        const plane = planes[axis] ?? {};
        const enabled = plane.enabled === true;
        const side = plane.invert === true ? "+ side kept" : "- side kept";
        return (
          <label key={axis} style={{ ...rowStyle, cursor: "pointer" }}>
            <span
              style={{
                ...swatchBaseStyle,
                background: AXIS_COLORS[axis],
                opacity: enabled ? 1 : 0.28,
              }}
            />
            <span>
              <strong>{axis.toUpperCase()} Section</strong>
              {axis === activeAxis ? " active" : ""}
              <br />
              {planePositionLabel(plane.positionM)} - {side}
            </span>
            <input
              data-testid={`scene-section-legend-${axis}-enabled`}
              type="checkbox"
              checked={enabled}
              onChange={(event) => setAxisEnabled(axis, event.currentTarget.checked)}
            />
          </label>
        );
      })}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 10,
          color: vibrancySecondaryLabel,
          fontSize: 10,
        }}
      >
        <input
          data-testid="scene-section-legend-helper-visible"
          type="checkbox"
          checked={helperVisible}
          onChange={(event) =>
            commit({ sceneSectionHelperVisible: event.currentTarget.checked })
          }
        />
        Show outline handles
      </label>
      <div style={footerStyle}>Outlined planes mark the cut location; hidden side is clipped.</div>
    </aside>
  );
}
