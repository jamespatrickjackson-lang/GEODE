import type { CSSProperties } from "react";
import { useEditor } from "../editor/EditorContext";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import {
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  resolveLegendTextColors,
  transparentLegendPanelStyle,
} from "./legendStyles";
import { usePageController } from "../pages/PageController";
import {
  effectiveVisibility,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { resolveTopoMapSettings } from "../topoMap/settings";
import type { PresentationPage } from "../pages/types";

const UTAH_FORGE_PROJECT_SLUG = "utah-forge";
const DEFAULT_MIN_M = 1500;
const DEFAULT_MAX_M = 3500;
const DEFAULT_COLORS = [
  "#5147b8",
  "#2e8fd8",
  "#4fc3c7",
  "#93d66b",
  "#fff24d",
] as const;
const DEFAULT_POSITIONS = [0, 0.25, 0.5, 0.75, 1] as const;
const DEFAULT_MIDPOINTS = [0.5, 0.5, 0.5, 0.5] as const;
const STOP_GAP = 0.01;

const rootStyle: CSSProperties = {
  ...transparentLegendPanelStyle,
  left: LEGEND_PAGE_EDGE_MARGIN_PX,
  bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX + 450,
  pointerEvents: "none",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.15,
  fontWeight: 700,
};

const rampStyle: CSSProperties = {
  height: 13,
  marginTop: 12,
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.22)",
  overflow: "hidden",
};

const ticksStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 4,
  marginTop: 8,
  fontSize: 9,
  lineHeight: 1.2,
  fontVariantNumeric: "tabular-nums",
};

function terrainNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function terrainColors(value: unknown): string[] {
  const colors = Array.isArray(value) ? value : [];
  return Array.from({ length: 5 }, (_, index) =>
    typeof colors[index] === "string" ? colors[index] : DEFAULT_COLORS[index],
  );
}

function terrainPositions(value: unknown): number[] {
  const values = Array.isArray(value) ? value : [];
  let previous = 0;
  return Array.from({ length: 5 }, (_, index) => {
    const raw =
      typeof values[index] === "number" && Number.isFinite(values[index])
        ? values[index]
        : DEFAULT_POSITIONS[index];
    const remaining = 4 - index;
    const min = index === 0 ? 0 : previous + STOP_GAP;
    const max = 1 - remaining * STOP_GAP;
    const next = Math.min(Math.max(raw, min), max);
    previous = next;
    return next;
  });
}

function terrainMidpoints(value: unknown): number[] {
  const values = Array.isArray(value) ? value : [];
  return Array.from({ length: 4 }, (_, index) => {
    const raw =
      typeof values[index] === "number" && Number.isFinite(values[index])
        ? values[index]
        : DEFAULT_MIDPOINTS[index];
    return Math.min(Math.max(raw, 0.05), 0.95);
  });
}

function gradientStops(
  colors: string[],
  positions: number[],
  midpoints: number[],
): string {
  const parts = [`${colors[0]} ${(positions[0] * 100).toFixed(1)}%`];
  for (let index = 1; index < colors.length; index += 1) {
    const left = positions[index - 1];
    const right = positions[index];
    const midpoint = midpoints[index - 1] ?? 0.5;
    const hint = left + (right - left) * midpoint;
    parts.push(`${(hint * 100).toFixed(1)}%`);
    parts.push(`${colors[index]} ${(right * 100).toFixed(1)}%`);
  }
  return parts.join(", ");
}

function tickLabel(minM: number, maxM: number, index: number): string {
  return String(Math.round(minM + ((maxM - minM) * index) / 4));
}

export function SurfaceElevationLegend({
  stacked = false,
  pageOverride = null,
}: {
  stacked?: boolean;
  pageOverride?: PresentationPage | null;
}) {
  const { state } = useEditor();
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
  const pageEnvironment = page
    ? resolveEnvironmentForPage(state.environment, state.pages, page)
    : state.environment;
  const settings = resolveTopoMapSettings({
    manifest: state.manifest,
    environment: editingEnvironment ? state.environment : pageEnvironment,
    page: editingEnvironment ? null : page,
  });
  const terrain = settings.terrain;
  const visibleLayerIds =
    !editingEnvironment && page
      ? effectiveVisibility(pageEnvironment, page)
      : new Set(state.environment.defaultVisibleLayers);
  if (settings.surfaceLayerId && !visibleLayerIds.has(settings.surfaceLayerId)) {
    return null;
  }
  if (terrain.surfaceElevationEnabled !== true) return null;
  if (terrain.surfaceElevationLegendVisible === false) return null;

  const minM = terrainNumber(terrain.surfaceElevationMinM, DEFAULT_MIN_M);
  const maxM = Math.max(
    minM + 1,
    terrainNumber(terrain.surfaceElevationMaxM, DEFAULT_MAX_M),
  );
  const colors = terrainColors(terrain.surfaceElevationColors);
  const positions = terrainPositions(terrain.surfaceElevationColorPositions);
  const midpoints = terrainMidpoints(terrain.surfaceElevationMidpoints);
  const reversed = terrain.surfaceElevationReverse === true;
  const displayColors = reversed ? [...colors].reverse() : colors;
  const displayPositions = reversed
    ? positions.map((position) => 1 - position).reverse()
    : positions;
  const displayMidpoints = reversed
    ? midpoints.map((midpoint) => 1 - midpoint).reverse()
    : midpoints;
  const rampStops = gradientStops(
    displayColors,
    displayPositions,
    displayMidpoints,
  );

  return (
    <aside
      style={{
        ...rootStyle,
        ...(stacked
          ? { position: "relative", left: "auto", bottom: "auto" }
          : {}),
      }}
      data-testid="surface-elevation-legend"
      aria-label="Utah FORGE surface elevation legend"
    >
      <h2 style={{ ...titleStyle, color: legendTextColors.heading }}>
        Surface Elevation (m)
      </h2>
      <div
        data-testid="surface-elevation-legend-ramp"
        style={{
          ...rampStyle,
          background: `linear-gradient(90deg, ${rampStops})`,
        }}
      />
      <div
        data-testid="surface-elevation-legend-ticks"
        style={{ ...ticksStyle, color: legendTextColors.body }}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            style={{
              textAlign:
                index === 0 ? "left" : index === 4 ? "right" : "center",
            }}
          >
            {tickLabel(minM, maxM, index)}
          </span>
        ))}
      </div>
    </aside>
  );
}
