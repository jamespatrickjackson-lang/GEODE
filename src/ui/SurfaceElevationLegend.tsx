import type { CSSProperties } from "react";
import { useEditor } from "../editor/EditorContext";
import {
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
  vibrancyLabel,
  vibrancySecondaryLabel,
} from "../editor/styles";

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
  position: "absolute",
  zIndex: 11,
  left: 34,
  bottom: 500,
  width: 282,
  boxSizing: "border-box",
  padding: 14,
  pointerEvents: "none",
  fontFamily: TECHNICAL_MONO_FONT,
  color: vibrancyLabel,
  background: "rgba(18, 21, 24, 0.55)",
  border: FROSTED_HAIRLINE,
  borderRadius: 12,
  boxShadow:
    "0 24px 80px rgba(0, 0, 0, 0.24), inset 0 -1px 0 rgba(0, 0, 0, 0.12)",
  backdropFilter: "blur(20px) saturate(145%)",
  WebkitBackdropFilter: "blur(20px) saturate(145%)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: vibrancyLabel,
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
  color: vibrancySecondaryLabel,
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
}: {
  stacked?: boolean;
}) {
  const { state } = useEditor();
  if (state.projectSlug !== UTAH_FORGE_PROJECT_SLUG) return null;

  const terrain = state.environment.scene?.terrain ?? {};
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
      <h2 style={titleStyle}>Surface Elevation (m)</h2>
      <div
        data-testid="surface-elevation-legend-ramp"
        style={{
          ...rampStyle,
          background: `linear-gradient(90deg, ${rampStops})`,
        }}
      />
      <div data-testid="surface-elevation-legend-ticks" style={ticksStyle}>
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
