import type { CSSProperties } from "react";
import { useEditor } from "../editor/EditorContext";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import {
  TECHNICAL_MONO_FONT,
} from "../editor/styles";
import {
  QUICK_LEGEND_INACTIVE_BACKGROUND,
  colorWithAlpha,
  compactQuickLegendPrimaryButtonBaseStyle,
  compactQuickLegendStackStyle,
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  transparentLegendPanelStyle,
} from "./legendStyles";
import {
  effectiveStyle,
  effectiveVisibility,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { EditableStyle, PresentationPage } from "../pages/types";
import {
  legendWritesLanded,
  selectedLegendAuthoringPage,
} from "./legendAuthoringTarget";
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
  minWidth: 220,
};

const rowStyle: CSSProperties = {
  ...compactQuickLegendStackStyle,
};

const boundaryButtonBaseStyle: CSSProperties = {
  ...compactQuickLegendPrimaryButtonBaseStyle,
};

function boundaryButtonStyle(color: string, active: boolean): CSSProperties {
  return {
    ...boundaryButtonBaseStyle,
    background: active ? colorWithAlpha(color, 1) : QUICK_LEGEND_INACTIVE_BACKGROUND,
  };
}

function boundaryLegendLabel(label: string): string {
  return `MT ${label.replace(/\s+(Ohm-m)\b/g, "$1")}`;
}

export function MtSurfaceBoundaryLegend({
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
  const writesEnabled = legendWritesLanded({
    transitionActive: transitionFrame.active,
    targetIndex,
    authoringPage,
    displayedPage: pageOverride ?? pages[currentIndex] ?? null,
    editingEnvironment,
  });
  if (!page) return null;
  const pageEnvironment = resolveEnvironmentForPage(
    state.environment,
    state.pages,
    page,
  );

  const visible = editingEnvironment
    ? new Set(state.environment.defaultVisibleLayers)
    : effectiveVisibility(pageEnvironment, page);
  if (!visible.has(MT_THRESHOLD_SURFACES_LAYER_ID)) return null;

  const style = editingEnvironment
    ? state.environment.layerStyles[MT_THRESHOLD_SURFACES_LAYER_ID] ?? {}
    : effectiveStyle(pageEnvironment, page, MT_THRESHOLD_SURFACES_LAYER_ID);
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
  const legacyVisibility =
    typeof style.mtThresholdSurfaceVisibility === "object" &&
    style.mtThresholdSurfaceVisibility !== null
      ? (style.mtThresholdSurfaceVisibility as Record<string, boolean>)
      : {};
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const setBoundaryVisibility = (boundaryId: string, nextVisible: boolean) => {
    if (!writesEnabled) return;
    const definition = definitionsById.get(boundaryId);
    const current =
      boundaryStyles[boundaryId] ??
      (definition ? boundaryStyleFromDefinition(definition) : {});
    const patch: Partial<EditableStyle> = {
      mtSurfaceBoundaryOrder: order.includes(boundaryId)
        ? order
        : [...order, boundaryId],
      mtThresholdSurfaceVisibility: {
        ...legacyVisibility,
        [boundaryId]: nextVisible,
      },
      mtSurfaceBoundariesById: {
        ...boundaryStyles,
        [boundaryId]: {
          ...current,
          visible: nextVisible,
        },
      },
    };
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(MT_THRESHOLD_SURFACES_LAYER_ID, {
        ...style,
        ...patch,
      });
    }
    if (editingEnvironment) {
      setEnvLayerStyle(MT_THRESHOLD_SURFACES_LAYER_ID, patch);
    } else if (writePage) {
      setPageLayerOverride(writePage.id, MT_THRESHOLD_SURFACES_LAYER_ID, patch);
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
      <div style={rowStyle}>
        {boundaries.map((boundary) => {
          const label = boundaryLegendLabel(boundary.label);
          return (
            <button
              key={boundary.id}
              type="button"
              aria-label={`${label} surface boundary`}
              aria-pressed={boundary.visible}
              title={label}
              data-testid={`mt-boundary-legend-${boundary.id}`}
              onClick={() => setBoundaryVisibility(boundary.id, !boundary.visible)}
              style={boundaryButtonStyle(boundary.color, boundary.visible)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
