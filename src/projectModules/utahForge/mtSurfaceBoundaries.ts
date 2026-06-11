import type {
  EditableStyle,
  MtSurfaceBoundaryStyle,
  ProjectLayerSpec,
} from "../../pages/types";

export type MtSurfaceBoundaryMode = "precomputed-bank" | "live-compute";
export type MtSurfaceBoundaryComparison = "<=" | ">=";

export interface MtSurfaceBoundaryDefinition {
  id: string;
  label: string;
  color: string;
  comparison: MtSurfaceBoundaryComparison;
  thresholdOhmM: number;
  thresholdLog10: number;
  kind?: string;
  source: "precomputed" | "live";
}

export interface ResolvedMtSurfaceBoundary extends MtSurfaceBoundaryDefinition {
  visible: boolean;
  opacity: number;
}

export const DEFAULT_MT_SURFACE_BOUNDARY_MODE: MtSurfaceBoundaryMode =
  "precomputed-bank";

export const DEFAULT_MT_SURFACE_BOUNDARY_IDS = [
  "conductive-le-10-ohm-m",
  "conductive-le-30-ohm-m",
  "resistive-ge-1000-ohm-m",
] as const;

export const DEFAULT_MT_SURFACE_BOUNDARIES: MtSurfaceBoundaryDefinition[] = [
  {
    id: "conductive-le-10-ohm-m",
    label: "<=10 Ohm-m",
    color: "#2cc9ff",
    comparison: "<=",
    thresholdOhmM: 10,
    thresholdLog10: 1,
    kind: "conductive-threshold-surface",
    source: "precomputed",
  },
  {
    id: "conductive-le-30-ohm-m",
    label: "<=30 Ohm-m",
    color: "#38f0b3",
    comparison: "<=",
    thresholdOhmM: 30,
    thresholdLog10: Math.log10(30),
    kind: "conductive-threshold-surface",
    source: "precomputed",
  },
  {
    id: "resistive-ge-1000-ohm-m",
    label: ">=1000 Ohm-m",
    color: "#ff637a",
    comparison: ">=",
    thresholdOhmM: 1000,
    thresholdLog10: 3,
    kind: "resistive-threshold-surface",
    source: "precomputed",
  },
];

const DEFAULT_COLORS_BY_ID = new Map(
  DEFAULT_MT_SURFACE_BOUNDARIES.map((boundary) => [boundary.id, boundary.color]),
);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function inferComparison(id: string, raw: unknown): MtSurfaceBoundaryComparison {
  if (raw === ">=" || raw === "<=") return raw;
  return id.includes("-ge-") ? ">=" : "<=";
}

function inferColor(id: string, raw: unknown): string {
  if (typeof raw === "string" && /^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return DEFAULT_COLORS_BY_ID.get(id) ?? "#f8f4e8";
}

function compactBoundaryLabel(
  comparison: MtSurfaceBoundaryComparison,
  thresholdOhmM: number,
): string {
  const value =
    thresholdOhmM >= 100
      ? Math.round(thresholdOhmM).toLocaleString("en-US")
      : thresholdOhmM >= 10
        ? thresholdOhmM.toFixed(1).replace(/\.0$/, "")
        : thresholdOhmM.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${comparison}${value} Ohm-m`;
}

function boundaryDefinitionFromRaw(raw: unknown): MtSurfaceBoundaryDefinition | null {
  const item = raw as {
    id?: unknown;
    label?: unknown;
    color?: unknown;
    comparison?: unknown;
    thresholdOhmM?: unknown;
    thresholdLog10?: unknown;
    kind?: unknown;
  };
  if (typeof item.id !== "string" || item.id.trim().length === 0) return null;
  const thresholdOhmM = finiteNumber(item.thresholdOhmM);
  const thresholdLog10 =
    finiteNumber(item.thresholdLog10) ??
    (thresholdOhmM !== null && thresholdOhmM > 0
      ? Math.log10(thresholdOhmM)
      : null);
  const resolvedOhmM =
    thresholdOhmM ??
    (thresholdLog10 !== null ? 10 ** thresholdLog10 : undefined);
  if (!Number.isFinite(resolvedOhmM) || !Number.isFinite(thresholdLog10)) {
    const fallback = DEFAULT_MT_SURFACE_BOUNDARIES.find(
      (boundary) => boundary.id === item.id,
    );
    if (fallback) return fallback;
    return null;
  }
  const comparison = inferComparison(item.id, item.comparison);
  return {
    id: item.id,
    label:
      typeof item.label === "string" && item.label.trim().length > 0
        ? item.label
        : compactBoundaryLabel(comparison, resolvedOhmM as number),
    color: inferColor(item.id, item.color),
    comparison,
    thresholdOhmM: resolvedOhmM as number,
    thresholdLog10: thresholdLog10 as number,
    kind: typeof item.kind === "string" ? item.kind : undefined,
    source: "precomputed",
  };
}

export function mtSurfaceBoundaryDefinitionsFromMetadata(
  metadata: unknown,
): MtSurfaceBoundaryDefinition[] {
  const raw = (metadata as { thresholdSurfaces?: unknown })?.thresholdSurfaces;
  const byId = new Map<string, MtSurfaceBoundaryDefinition>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const boundary = boundaryDefinitionFromRaw(item);
      if (boundary && !byId.has(boundary.id)) {
        byId.set(boundary.id, boundary);
      }
    }
  }
  for (const boundary of DEFAULT_MT_SURFACE_BOUNDARIES) {
    if (!byId.has(boundary.id)) byId.set(boundary.id, boundary);
  }
  return [...byId.values()].sort((a, b) => {
    const aDefault = DEFAULT_MT_SURFACE_BOUNDARY_IDS.indexOf(
      a.id as (typeof DEFAULT_MT_SURFACE_BOUNDARY_IDS)[number],
    );
    const bDefault = DEFAULT_MT_SURFACE_BOUNDARY_IDS.indexOf(
      b.id as (typeof DEFAULT_MT_SURFACE_BOUNDARY_IDS)[number],
    );
    if (aDefault !== -1 || bDefault !== -1) {
      return (aDefault === -1 ? 99 : aDefault) - (bDefault === -1 ? 99 : bDefault);
    }
    return a.thresholdLog10 - b.thresholdLog10;
  });
}

export function mtSurfaceBoundaryDefinitionsForLayer(
  layer: ProjectLayerSpec,
): MtSurfaceBoundaryDefinition[] {
  return mtSurfaceBoundaryDefinitionsFromMetadata(layer.metadata);
}

export function mtSurfaceBoundaryMode(style: EditableStyle): MtSurfaceBoundaryMode {
  return style.mtSurfaceBoundaryMode === "live-compute"
    ? "live-compute"
    : DEFAULT_MT_SURFACE_BOUNDARY_MODE;
}

export function mtSurfaceBoundaryOrder(
  style: EditableStyle,
  definitions: MtSurfaceBoundaryDefinition[],
): string[] {
  const known = new Set(definitions.map((boundary) => boundary.id));
  const authoredById =
    typeof style.mtSurfaceBoundariesById === "object" &&
    style.mtSurfaceBoundariesById !== null
      ? style.mtSurfaceBoundariesById
      : {};
  const authoredOrder = Array.isArray(style.mtSurfaceBoundaryOrder)
    ? style.mtSurfaceBoundaryOrder.filter(
        (id) => known.has(id) || authoredById[id]?.source === "live",
      )
    : [];
  if (authoredOrder.length > 0) return [...new Set(authoredOrder)];
  return DEFAULT_MT_SURFACE_BOUNDARY_IDS.filter((id) => known.has(id));
}

export function resolveMtSurfaceBoundaries(
  style: EditableStyle,
  definitions: MtSurfaceBoundaryDefinition[],
): ResolvedMtSurfaceBoundary[] {
  const definitionsById = new Map(
    definitions.map((boundary) => [boundary.id, boundary]),
  );
  const order = mtSurfaceBoundaryOrder(style, definitions);
  const orderedIds = new Set(order);
  const legacyVisibility =
    typeof style.mtThresholdSurfaceVisibility === "object" &&
    style.mtThresholdSurfaceVisibility !== null
      ? style.mtThresholdSurfaceVisibility
      : {};
  const authored =
    typeof style.mtSurfaceBoundariesById === "object" &&
    style.mtSurfaceBoundariesById !== null
      ? style.mtSurfaceBoundariesById
      : {};
  // A map carrying ANY explicit visibility flag is deliberate authoring and
  // must be honored — including all-off ("show no isosurfaces"). Treating
  // all-off as stale made the default surfaces appear on pages authored to
  // show none. Only maps with no explicit flags at all inherit defaults.
  const canonicalHasVisibleBoundary = Object.values(authored).some(
    (boundary) => typeof boundary?.visible === "boolean",
  );
  const legacyHasVisibleBoundary = Object.values(legacyVisibility).some(
    (visible) => typeof visible === "boolean",
  );

  return order
    .map((id) => {
      const override = authored[id] ?? {};
      const authoredOhmM = finiteNumber(override.thresholdOhmM);
      const authoredLog10 =
        finiteNumber(override.thresholdLog10) ??
        (authoredOhmM !== null && authoredOhmM > 0
          ? Math.log10(authoredOhmM)
          : null);
      const definition =
        definitionsById.get(id) ??
        (authoredOhmM !== null || authoredLog10 !== null
          ? {
              id,
              label:
                typeof override.label === "string" &&
                override.label.trim().length > 0
                  ? override.label
                  : compactBoundaryLabel(
                      inferComparison(id, override.comparison),
                      authoredOhmM ?? 10 ** (authoredLog10 ?? Math.log10(30)),
                    ),
              color: inferColor(id, override.color),
              comparison: inferComparison(id, override.comparison),
              thresholdOhmM: authoredOhmM ?? 10 ** (authoredLog10 ?? Math.log10(30)),
              thresholdLog10: authoredLog10 ?? Math.log10(authoredOhmM ?? 30),
              source: override.source === "live" ? "live" : "precomputed",
            }
          : null);
      if (!definition) return null;
      const visibleDefault =
        DEFAULT_MT_SURFACE_BOUNDARY_IDS.includes(
          id as (typeof DEFAULT_MT_SURFACE_BOUNDARY_IDS)[number],
        ) || orderedIds.has(id);
      const visible =
        canonicalHasVisibleBoundary && typeof override.visible === "boolean"
          ? override.visible
          : legacyHasVisibleBoundary && typeof legacyVisibility[id] === "boolean"
            ? legacyVisibility[id]
            : visibleDefault;
      const thresholdOhmM =
        finiteNumber(override.thresholdOhmM) ?? definition.thresholdOhmM;
      const thresholdLog10 =
        finiteNumber(override.thresholdLog10) ??
        (thresholdOhmM > 0 ? Math.log10(thresholdOhmM) : definition.thresholdLog10);
      const comparison = inferComparison(id, override.comparison ?? definition.comparison);
      return {
        ...definition,
        label:
          typeof override.label === "string" && override.label.trim().length > 0
            ? override.label
            : definition.label,
        color: inferColor(id, override.color ?? definition.color),
        comparison,
        thresholdOhmM,
        thresholdLog10,
        opacity: clamp01(finiteNumber(override.opacity) ?? 1),
        source: override.source === "live" ? "live" : definition.source,
        visible,
      };
    })
    .filter((boundary): boundary is ResolvedMtSurfaceBoundary => boundary !== null);
}

export function boundaryStyleFromDefinition(
  boundary: MtSurfaceBoundaryDefinition,
  visible = true,
): MtSurfaceBoundaryStyle {
  return {
    visible,
    label: boundary.label,
    color: boundary.color,
    comparison: boundary.comparison,
    thresholdOhmM: boundary.thresholdOhmM,
    thresholdLog10: boundary.thresholdLog10,
    opacity: 1,
    source: boundary.source,
  };
}

export function liveBoundaryId(): string {
  return `live-boundary-${Date.now().toString(36)}`;
}
