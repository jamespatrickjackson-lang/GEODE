import type { CSSProperties } from "react";
import { useEditor } from "../editor/EditorContext";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import {
  TECHNICAL_MONO_FONT,
} from "../editor/styles";
import {
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  legendCheckboxStyle,
  legendControlRowStyle,
  resolveLegendTextColors,
  transparentLegendPanelStyle,
} from "./legendStyles";
import { effectiveStyle, effectiveVisibility } from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { EditableStyle, PresentationPage } from "../pages/types";
import {
  boundaryStyleFromDefinition,
  mtSurfaceBoundaryDefinitionsFromMetadata,
  mtSurfaceBoundaryOrder,
  resolveMtSurfaceBoundaries,
} from "../projectModules/utahForge/mtSurfaceBoundaries";

const UTAH_FORGE_PROJECT_SLUG = "utah-forge";
const MT_THRESHOLD_SURFACES_LAYER_ID =
  "utah-forge-mt-resistivity-threshold-surfaces";

const rootStyle: CSSProperties = {
  ...transparentLegendPanelStyle,
  fontFamily: TECHNICAL_MONO_FONT,
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
  lineHeight: 1.2,
};

export function MtSurfaceBoundaryLegend({
  stacked = false,
  pageOverride = null,
}: {
  stacked?: boolean;
  pageOverride?: PresentationPage | null;
}) {
  const { state, sceneHandle, setEnvLayerStyle, setPageLayerOverride } =
    useEditor();
  const { pages, currentIndex, targetIndex } = usePageController();
  if (state.projectSlug !== UTAH_FORGE_PROJECT_SLUG) return null;
  const legendTextColors = resolveLegendTextColors(
    state.environment.scene?.gui?.overlay,
  );

  const controllerPage =
    pageOverride ?? pages[targetIndex ?? currentIndex] ?? pages[currentIndex];
  const editingEnvironment = state.selectedPageId === ENVIRONMENT_SENTINEL;
  const selectedPage =
    !pageOverride &&
    !editingEnvironment &&
    targetIndex === null &&
    state.selectedPageId
      ? state.pages.find((candidate) => candidate.id === state.selectedPageId)
      : null;
  const page =
    pageOverride ??
    (targetIndex !== null ? controllerPage : selectedPage ?? controllerPage);
  if (!page) return null;

  const visible = editingEnvironment
    ? new Set(state.environment.defaultVisibleLayers)
    : effectiveVisibility(state.environment, page);
  if (!visible.has(MT_THRESHOLD_SURFACES_LAYER_ID)) return null;

  const style = editingEnvironment
    ? state.environment.layerStyles[MT_THRESHOLD_SURFACES_LAYER_ID] ?? {}
    : effectiveStyle(state.environment, page, MT_THRESHOLD_SURFACES_LAYER_ID);
  if (style.mtSurfaceBoundaryLegendVisible === false) return null;

  const layer = state.manifest.layers.find(
    (candidate) => candidate.id === MT_THRESHOLD_SURFACES_LAYER_ID,
  );
  const definitions = mtSurfaceBoundaryDefinitionsFromMetadata(layer?.metadata);
  const boundaries = resolveMtSurfaceBoundaries(style, definitions).filter(
    (boundary) => boundary.opacity > 0.001,
  );
  if (boundaries.length === 0) return null;

  const order = mtSurfaceBoundaryOrder(style, definitions);
  const boundaryStyles =
    typeof style.mtSurfaceBoundariesById === "object" &&
    style.mtSurfaceBoundariesById !== null
      ? style.mtSurfaceBoundariesById
      : {};
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const setBoundaryVisibility = (boundaryId: string, nextVisible: boolean) => {
    const definition = definitionsById.get(boundaryId);
    const current =
      boundaryStyles[boundaryId] ??
      (definition ? boundaryStyleFromDefinition(definition) : {});
    const patch: Partial<EditableStyle> = {
      mtSurfaceBoundaryOrder: order.includes(boundaryId)
        ? order
        : [...order, boundaryId],
      mtSurfaceBoundariesById: {
        ...boundaryStyles,
        [boundaryId]: {
          ...current,
          visible: nextVisible,
        },
      },
    };
    sceneHandle.manager.applyStyle(MT_THRESHOLD_SURFACES_LAYER_ID, {
      ...style,
      ...patch,
    });
    if (editingEnvironment) {
      setEnvLayerStyle(MT_THRESHOLD_SURFACES_LAYER_ID, patch);
    } else {
      setPageLayerOverride(page.id, MT_THRESHOLD_SURFACES_LAYER_ID, patch);
    }
  };

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
      aria-label="MT threshold boundaries legend"
    >
      <h2 style={{ ...titleStyle, color: legendTextColors.heading }}>
        MT Threshold Boundaries
      </h2>
      {boundaries.map((boundary) => (
        <label
          key={boundary.id}
          style={{ ...rowStyle, color: legendTextColors.body }}
        >
          <input
            type="checkbox"
            aria-label={`${boundary.label} surface boundary`}
            checked={boundary.visible}
            onChange={(event) =>
              setBoundaryVisibility(boundary.id, event.currentTarget.checked)
            }
            style={legendCheckboxStyle(boundary.visible, {
              checkedColor: boundary.color,
            })}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {boundary.label}
          </span>
        </label>
      ))}
    </aside>
  );
}
