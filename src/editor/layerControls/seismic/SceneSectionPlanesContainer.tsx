import { useEffect, useRef } from "react";
import type React from "react";
import { panelStyles } from "../../styles";
import {
  detailsContentStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  sliderNumberReadoutStyle,
  styleBoolean,
  type LayerStyleSetter,
  type PageStyleSetter,
} from "../../styleControls";
import { smallActionButtonStyle } from "../layout/layoutStyles";
import { editorLayerLabel } from "../layerLabels";
import { InlineEditableTitle } from "../../InlineEditableTitle";
import type {
  EditableStyle,
  PresentationPage,
  ProjectLayerSpec,
  SceneSectionAxisAlignment,
  SceneSectionAxisDatum,
  SceneSectionFrameEntry,
  SceneSectionFrameState,
  SceneSectionPlaneState,
} from "../../../pages/types";
import type { SceneHandle } from "../../../scene";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../../../projectModules/utahForge/layerIds";
import { seismicDefaultProductId, seismicProductOptions } from "./seismicModel";

const sceneSectionAxisColors = {
  x: "#ff6b78",
  y: "#35c7e8",
  z: "#f6d76b",
} as const;

const sceneSectionDefaultPositions = {
  x: -6000,
  y: -10300,
  z: -2200,
} as const;

const SCENE_SECTION_MAX_FRAME_COUNT = 8;
const sceneSectionAxes = ["x", "y", "z"] as const;

const builtInFrameId = (axis: SceneSectionAxis) => `axis:${axis}`;

type SceneSectionFrameUiEntry = {
  id: string;
  label: string;
  legendVisible: boolean;
  axis: SceneSectionAxis;
  builtIn: boolean;
  plane: SceneSectionPlaneState;
  frame: SceneSectionFrameState;
};

const frameNumberInputStyle: React.CSSProperties = {
  flex: "0 0 74px",
  minWidth: 0,
};

const frameUnitStyle: React.CSSProperties = {
  ...sliderNumberReadoutStyle,
  width: 24,
};

const frameInlineUnitInputWrapStyle: React.CSSProperties = {
  ...frameNumberInputStyle,
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
};

const frameInlineUnitNumberInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  paddingRight: 28,
};

const frameInlineScaleNumberInputStyle: React.CSSProperties = {
  ...frameInlineUnitNumberInputStyle,
  paddingRight: 18,
};

const frameInlineUnitSuffixStyle: React.CSSProperties = {
  position: "absolute",
  right: 7,
  top: "50%",
  transform: "translateY(-50%)",
  color: "rgba(238, 238, 238, 0.72)",
  fontSize: 11,
  lineHeight: 1,
  pointerEvents: "none",
  userSelect: "none",
};

const frameTextInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const frameColorInputStyle: React.CSSProperties = {
  flex: "0 0 74px",
  minWidth: 0,
  height: 24,
  padding: 1,
};

const sectionFrameListStyle: React.CSSProperties = {
  paddingTop: 4,
};

const frameObjectVisibilityRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(100px, 1fr) 48px",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
};

type SceneSectionAxis = "x" | "y" | "z";

type SceneSectionObjectTarget = {
  objectId: string;
  label: string;
  layerId: string;
  productId?: string;
  supported: boolean;
  visible: boolean;
  axes: SceneSectionAxis[];
};

const frameSummaryContentStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  width: "calc(100% - 16px)",
};

const frameSummaryTitleStyle: React.CSSProperties = {
  minWidth: 0,
  whiteSpace: "nowrap",
};

const frameSummaryControlGroupStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  marginLeft: "auto",
};

const frameSummaryToggleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: "rgba(238, 238, 238, 0.78)",
  fontSize: 11,
  lineHeight: 1,
  cursor: "pointer",
};

const frameSummaryToggleInputStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  margin: 0,
};

const frameSummaryActiveButtonStyle: React.CSSProperties = {
  ...smallActionButtonStyle,
  width: 72,
  minHeight: 18,
  padding: "1px 6px",
  fontSize: 11,
  lineHeight: 1.1,
  border: "none",
  background: "transparent",
  boxShadow: "none",
};

const frameSegmentedControlStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: 4,
  flex: 1,
};

const frameSegmentButtonStyle: React.CSSProperties = {
  ...smallActionButtonStyle,
  flex: 1,
  minHeight: 22,
  padding: "2px 8px",
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteStyleNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clampNumber(value, min, max)
    : fallback;
}

function colorInputValue(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : fallback;
}

function sceneSectionGeneratedHeading(
  axis: SceneSectionAxis,
  slot: "a" | "b",
  datum: SceneSectionAxisDatum,
): string {
  const isElevation = slot === "b" && axis !== "z";
  if (isElevation) return "Elevation (km)";
  if (datum === "local") return "Distance (km)";
  if (datum === "latlon") {
    if (axis === "x" && slot === "a") return "Latitude (°)";
    if (axis === "y" && slot === "a") return "Longitude (°)";
    if (axis === "z" && slot === "a") return "Longitude (°)";
    return "Latitude (°)";
  }
  if (axis === "x" && slot === "a") return "Northing (km)";
  if (axis === "y" && slot === "a") return "Easting (km)";
  if (axis === "z" && slot === "a") return "Easting (km)";
  return "Northing (km)";
}

function sceneSectionKnownGeneratedHeadings(
  axis: SceneSectionAxis,
  slot: "a" | "b",
): Set<string> {
  return new Set(
    (["utm", "local", "latlon"] as const).map((datum) =>
      sceneSectionGeneratedHeading(axis, slot, datum),
    ),
  );
}

function withGeneratedHeadingDefaults(
  axis: SceneSectionAxis,
  current: SceneSectionFrameState,
  patch: Partial<SceneSectionFrameState>,
): Partial<SceneSectionFrameState> {
  const nextDatum = patch.axisDatum ?? current.axisDatum ?? "utm";
  const nextPatch: Partial<SceneSectionFrameState> = { ...patch };
  const updateSlot = (slot: "a" | "b") => {
    const key = slot === "a" ? "axisAHeading" : "axisBHeading";
    const currentValue = current[key];
    const known = sceneSectionKnownGeneratedHeadings(axis, slot);
    if (
      typeof currentValue !== "string" ||
      currentValue.trim() === "" ||
      known.has(currentValue)
    ) {
      nextPatch[key] = sceneSectionGeneratedHeading(axis, slot, nextDatum);
    }
  };
  updateSlot("a");
  updateSlot("b");
  return nextPatch;
}

function stopSummaryToggle(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function layerObjectId(layerId: string): string {
  return `layer:${layerId}`;
}

function productObjectId(layerId: string, productId: string): string {
  return `product:${layerId}:${productId}`;
}

function legacyDefaultObjectOpacity({
  target,
  targetScope,
  targetLayerIds,
  targetProductIds,
}: {
  target: SceneSectionObjectTarget;
  targetScope: "selected-targets" | "all-visible" | "active-selection";
  targetLayerIds: Set<string>;
  targetProductIds: Set<string>;
}): number {
  if (targetScope === "all-visible") return target.visible ? 0 : 1;
  if (target.productId) {
    return targetProductIds.has(target.productId) ? 0 : 1;
  }
  return targetLayerIds.has(target.layerId) ? 0 : 1;
}

function objectVisibilityOpacity(
  style: EditableStyle,
  axis: SceneSectionAxis,
  frameId: string,
  target: SceneSectionObjectTarget,
  targetScope: "selected-targets" | "all-visible" | "active-selection",
  targetLayerIds: Set<string>,
  targetProductIds: Set<string>,
): number {
  const frameValue =
    style.sceneSectionObjectVisibilityByFrameId?.[frameId]?.[target.objectId]
      ?.outsideOpacity;
  if (typeof frameValue === "number" && Number.isFinite(frameValue)) {
    return clampNumber(frameValue, 0, 1);
  }
  const value =
    style.sceneSectionObjectVisibilityByAxis?.[axis]?.[target.objectId]
      ?.outsideOpacity;
  return typeof value === "number" && Number.isFinite(value)
    ? clampNumber(value, 0, 1)
    : legacyDefaultObjectOpacity({
        target,
        targetScope,
        targetLayerIds,
        targetProductIds,
      });
}

function frameDefaultLabel(id: string, axis: SceneSectionAxis): string {
  if (id === builtInFrameId(axis)) return `${axis.toUpperCase()} Section frame`;
  const custom = /^custom:([a-z])$/i.exec(id);
  return custom ? `${custom[1].toUpperCase()} Section frame` : `${axis.toUpperCase()} Section frame`;
}

function normalizeSceneSectionFrameEntries(
  style: EditableStyle,
): SceneSectionFrameUiEntry[] {
  const explicit = Array.isArray(style.sceneSectionFrames)
    ? style.sceneSectionFrames
    : [];
  const explicitById = new Map(
    explicit
      .filter((entry) => typeof entry?.id === "string" && entry.id.trim())
      .map((entry) => [entry.id, entry]),
  );
  const planes = style.sceneSectionPlanes ?? {};
  const frameByAxis = style.sceneSectionFrameByAxis ?? {};
  const builtIns: SceneSectionFrameUiEntry[] = sceneSectionAxes.map((axis) => {
    const id = builtInFrameId(axis);
    const entry = explicitById.get(id);
    return {
      id,
      label:
        typeof entry?.label === "string" && entry.label.trim()
          ? entry.label
          : frameDefaultLabel(id, axis),
      legendVisible: entry?.legendVisible !== false,
      axis,
      builtIn: true,
      plane: {
        ...(planes[axis] ?? {}),
        ...(entry?.plane ?? {}),
      },
      frame: {
        ...(frameByAxis[axis] ?? {}),
        ...(entry?.frame ?? {}),
      },
    };
  });
  const custom: SceneSectionFrameUiEntry[] = [];
  for (const entry of explicit) {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      entry.id.startsWith("axis:") ||
      (entry.axis !== "x" && entry.axis !== "y" && entry.axis !== "z")
    ) {
      continue;
    }
    custom.push({
      id: entry.id,
      label:
        typeof entry.label === "string" && entry.label.trim()
          ? entry.label
          : frameDefaultLabel(entry.id, entry.axis),
      legendVisible: entry.legendVisible !== false,
      axis: entry.axis,
      builtIn: false,
      plane: { ...(entry.plane ?? {}) },
      frame: { ...(entry.frame ?? {}) },
    });
  }
  return [...builtIns, ...custom].slice(0, SCENE_SECTION_MAX_FRAME_COUNT);
}

function serializeFrameEntries(
  entries: SceneSectionFrameUiEntry[],
): SceneSectionFrameEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    legendVisible: entry.legendVisible,
    axis: entry.axis,
    plane: { ...entry.plane },
    frame: { ...entry.frame },
  }));
}

export function SceneSectionPlanesContainer({
  seismicLayer,
  allLayers,
  style,
  disabled,
  isEnv,
  currentPage,
  setEnvLayerStyle,
  setPageLayerOverride,
  sceneHandle,
}: {
  seismicLayer?: ProjectLayerSpec;
  allLayers: ProjectLayerSpec[];
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  sceneHandle: SceneHandle;
}) {
  const products = seismicLayer ? seismicProductOptions(seismicLayer) : [];
  const defaultProductId = seismicLayer
    ? seismicDefaultProductId(seismicLayer)
    : (products[0]?.id ?? "");
  const enabled = styleBoolean(style, "sceneSectionEnabled", false);
  const targetScope =
    style.sceneSectionTargetScope === "all-visible" ||
    style.sceneSectionTargetScope === "active-selection"
      ? style.sceneSectionTargetScope
      : "selected-targets";
  const activeAxis =
    style.sceneSectionActiveAxis === "x" ||
    style.sceneSectionActiveAxis === "y" ||
    style.sceneSectionActiveAxis === "z"
      ? style.sceneSectionActiveAxis
      : "z";
  const targetLayerIds = new Set(
    Array.isArray(style.sceneSectionTargetLayerIds)
      ? style.sceneSectionTargetLayerIds
        : [
            UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
            UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
            UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
          ],
  );
  const targetProductIds = new Set(
    Array.isArray(style.sceneSectionTargetProductIds)
      ? style.sceneSectionTargetProductIds
      : defaultProductId
        ? [defaultProductId]
        : [],
  );
  const helperVisible = styleBoolean(style, "sceneSectionHelperVisible", true);
  const legendVisible = styleBoolean(style, "sceneSectionLegendVisible", true);
  const legacyFrameEnabled = styleBoolean(
    style,
    "sceneSectionFrameEnabled",
    styleBoolean(style, "sceneSectionWindowEnabled", false),
  );
  const defaultGroundTraceVisible = styleBoolean(
    style,
    "sceneSectionGroundTraceVisible",
    true,
  );
  const defaultAxesVisible = styleBoolean(style, "sceneSectionAxesVisible", true);
  const defaultAxisIntervalM = finiteStyleNumber(
    style.sceneSectionAxisIntervalM,
    5000,
    100,
    50000,
  );
  const defaultAxisTextScale = finiteStyleNumber(
    style.sceneSectionAxisTextScale,
    1,
    0.4,
    100,
  );
  const windowByAxis = style.sceneSectionWindowByAxis ?? {};
  const frameEntries = normalizeSceneSectionFrameEntries(style);
  const activeFrameId =
    typeof style.sceneSectionActiveFrameId === "string" &&
    style.sceneSectionActiveFrameId.trim()
      ? style.sceneSectionActiveFrameId
      : builtInFrameId(activeAxis);
  const fallbackObjectTargets: SceneSectionObjectTarget[] = [
    ...products.map((product) => ({
      objectId: productObjectId(
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        product.id,
      ),
      label: `Seismic: ${product.label}`,
      layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
      productId: product.id,
      supported: true,
      visible: true,
      axes: ["x", "y", "z"] as SceneSectionAxis[],
    })),
    ...[
      UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
      UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
      UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
      UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
      UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
      UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
      "utah-forge-reference-stage",
      UTAH_FORGE_MT_STATIONS_LAYER_ID,
    ].map((layerId) => {
      const layer = allLayers.find((candidate) => candidate.id === layerId);
      return {
        objectId: layerObjectId(layerId),
        label:
          layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID
            ? "3D MT resistivity volume"
            : layerId === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID
              ? "MT thresholds"
              : layer
                ? editorLayerLabel(layer)
                : layerId,
        layerId,
        supported: layerId !== UTAH_FORGE_MT_STATIONS_LAYER_ID,
        visible: true,
        axes: ["x", "y", "z"] as SceneSectionAxis[],
      };
    }),
  ];
  const objectTargetMap = new Map<string, SceneSectionObjectTarget>();
  for (const target of fallbackObjectTargets) objectTargetMap.set(target.objectId, target);
  for (const target of sceneHandle.manager.listSceneSectionObjectTargets()) {
    objectTargetMap.set(target.objectId, {
      ...target,
      label: objectTargetMap.get(target.objectId)?.label ?? target.label,
      axes: target.axes as SceneSectionAxis[],
    });
  }
  const objectTargets = Array.from(objectTargetMap.values()).filter((target) =>
    target.axes.length > 0,
  );
  const liveStyleRef = useRef(style);
  useEffect(() => {
    liveStyleRef.current = style;
  }, [style]);
  const commit = (patch: Partial<EditableStyle>) => {
    if (disabled) return;
    const merged = { ...liveStyleRef.current, ...patch };
    liveStyleRef.current = merged;
    sceneHandle.manager.applyStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, merged);
    if (isEnv) {
      setEnvLayerStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, patch);
    } else if (currentPage) {
      setPageLayerOverride(
        currentPage.id,
        UTAH_FORGE_SCENE_SECTION_LAYER_ID,
        patch,
      );
    }
  };
  const commitFrameEntries = (
    entries: SceneSectionFrameUiEntry[],
    patch: Partial<EditableStyle> = {},
  ) => {
    commit({
      sceneSectionFrames: serializeFrameEntries(entries),
      ...patch,
    });
  };
  const setFrameEntryPatch = (
    id: string,
    patch: {
      axis?: SceneSectionAxis;
      plane?: Partial<SceneSectionPlaneState>;
      frame?: Partial<SceneSectionFrameState>;
      label?: string;
      legendVisible?: boolean;
    },
  ) => {
    const currentEntries = normalizeSceneSectionFrameEntries(liveStyleRef.current);
    const currentEntry = currentEntries.find((entry) => entry.id === id);
    if (!currentEntry) return;
    const nextAxis = patch.axis ?? currentEntry.axis;
    const nextPlane = {
      ...currentEntry.plane,
      ...(patch.plane ?? {}),
    };
    const nextFrame = {
      ...currentEntry.frame,
      ...(patch.frame ?? {}),
    };
    const nextLegendVisible =
      patch.legendVisible ?? currentEntry.legendVisible;
    const nextEntries = currentEntries.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            label: patch.label ?? entry.label,
            legendVisible: nextLegendVisible,
            axis: nextAxis,
            plane: nextPlane,
            frame: nextFrame,
          }
        : entry,
    );
    const isBuiltIn = currentEntry.builtIn && id === builtInFrameId(nextAxis);
    const legacyPatch: Partial<EditableStyle> = isBuiltIn
      ? {
          sceneSectionActiveAxis: nextAxis,
          sceneSectionPlanes: {
            ...(liveStyleRef.current.sceneSectionPlanes ?? {}),
            [nextAxis]: nextPlane,
          },
          sceneSectionFrameByAxis: {
            ...(liveStyleRef.current.sceneSectionFrameByAxis ?? {}),
            [nextAxis]: nextFrame,
          },
        }
      : {
          sceneSectionActiveAxis: nextAxis,
        };
    const hasFramePatch = Boolean(patch.frame);
    const xOrYLegacyWindow =
      isBuiltIn &&
      (nextAxis === "x" || nextAxis === "y") &&
      (hasFramePatch || patch.frame?.enabled === true)
        ? {
            sceneSectionWindowEnabled: true,
            sceneSectionWindowActiveAxis: nextAxis,
            sceneSectionWindowByAxis: {
              ...(liveStyleRef.current.sceneSectionWindowByAxis ?? {}),
              [nextAxis]: {
                ...(liveStyleRef.current.sceneSectionWindowByAxis?.[nextAxis] ??
                  {}),
                minAlongM:
                  nextFrame.minAM ??
                  liveStyleRef.current.sceneSectionWindowByAxis?.[nextAxis]
                    ?.minAlongM,
                maxAlongM:
                  nextFrame.maxAM ??
                  liveStyleRef.current.sceneSectionWindowByAxis?.[nextAxis]
                    ?.maxAlongM,
                bottomElevationM:
                  nextFrame.minBM ??
                  liveStyleRef.current.sceneSectionWindowByAxis?.[nextAxis]
                    ?.bottomElevationM,
              },
            },
          }
        : {};
    commitFrameEntries(nextEntries, {
      sceneSectionActiveFrameId: id,
      sceneSectionFrameEnabled: true,
      ...legacyPatch,
      ...xOrYLegacyWindow,
    });
  };
  const setFrameSpecificPatch = (
    id: string,
    patch: Partial<SceneSectionFrameState>,
  ) => setFrameEntryPatch(id, { frame: patch });
  const setFrameBasisPatch = (
    entry: SceneSectionFrameUiEntry,
    patch: Partial<SceneSectionFrameState>,
  ) => {
    setFrameSpecificPatch(
      entry.id,
      withGeneratedHeadingDefaults(entry.axis, entry.frame ?? {}, patch),
    );
  };
  const setPlaneSpecificPatch = (
    id: string,
    patch: Partial<SceneSectionPlaneState>,
  ) => setFrameEntryPatch(id, { plane: patch });
  const addCustomFrame = () => {
    const currentEntries = normalizeSceneSectionFrameEntries(liveStyleRef.current);
    if (currentEntries.length >= SCENE_SECTION_MAX_FRAME_COUNT) return;
    const usedLetters = new Set(
      currentEntries
        .map((entry) => /^custom:([a-z])$/i.exec(entry.id)?.[1]?.toLowerCase())
        .filter((letter): letter is string => Boolean(letter)),
    );
    const letter =
      "abcdefghijklmnopqrstuvwxyz"
        .split("")
        .find((candidate) => !usedLetters.has(candidate)) ?? "a";
    const source =
      currentEntries.find((entry) => entry.id === activeFrameId) ??
      currentEntries[0];
    const id = `custom:${letter}`;
    const label = `${letter.toUpperCase()} Section frame`;
    const nextEntry: SceneSectionFrameUiEntry = {
      id,
      label,
      legendVisible: true,
      axis: source.axis,
      builtIn: false,
      plane: {
        ...source.plane,
        enabled: true,
      },
      frame: {
        ...source.frame,
        enabled: true,
      },
    };
    commitFrameEntries([...currentEntries, nextEntry], {
      sceneSectionEnabled: true,
      sceneSectionFrameEnabled: true,
      sceneSectionActiveAxis: source.axis,
      sceneSectionActiveFrameId: id,
    });
  };
  const setObjectVisibilityOpacity = (
    axis: SceneSectionAxis,
    frameId: string,
    objectId: string,
    value: number,
  ) => {
    if (!Number.isFinite(value)) return;
    const byFrame =
      liveStyleRef.current.sceneSectionObjectVisibilityByFrameId ?? {};
    commit({
      sceneSectionActiveAxis: axis,
      sceneSectionActiveFrameId: frameId,
      sceneSectionObjectVisibilityByFrameId: {
        ...byFrame,
        [frameId]: {
          ...(byFrame[frameId] ?? {}),
          [objectId]: {
            ...(byFrame[frameId]?.[objectId] ?? {}),
            outsideOpacity: clampNumber(value, 0, 1),
          },
        },
      },
    });
  };
  const axisRanges = {
    x: { min: -140000, max: 140000 },
    y: { min: -115000, max: 115000 },
    z: { min: -122000, max: 4000 },
  } as const;
  const controlDisabled = disabled || !enabled;
  const sectionOrigin = sceneHandle.manager.siteSurfaceGuideOrigin();
  const setAxisIntervalKm = (frameId: string, rawKm: number) => {
    if (!Number.isFinite(rawKm)) return;
    setFrameSpecificPatch(frameId, {
      axisIntervalM: clampNumber(rawKm * 1000, 100, 50000),
    });
  };
  const setAxisTextScale = (frameId: string, rawScale: number) => {
    if (!Number.isFinite(rawScale)) return;
    setFrameSpecificPatch(frameId, {
      axisTextScale: clampNumber(rawScale, 0.4, 100),
    });
  };
  const setAxisTextPaddingKm = (frameId: string, rawKm: number) => {
    if (!Number.isFinite(rawKm)) return;
    setFrameSpecificPatch(frameId, {
      axisTextPaddingM: clampNumber(rawKm * 1000, 0, 10000),
    });
  };
  const setGroundTraceWidthM = (frameId: string, rawM: number) => {
    if (!Number.isFinite(rawM)) return;
    setFrameSpecificPatch(frameId, {
      groundTraceWidthM: clampNumber(rawM, 30, 2000),
    });
  };
  const setAxisHeadingPaddingKm = (frameId: string, rawKm: number) => {
    if (!Number.isFinite(rawKm)) return;
    setFrameSpecificPatch(frameId, {
      axisHeadingPaddingM: clampNumber(rawKm * 1000, 0, 20000),
    });
  };
  const setAxisHeadingScale = (frameId: string, rawScale: number) => {
    if (!Number.isFinite(rawScale)) return;
    setFrameSpecificPatch(frameId, {
      axisHeadingScale: clampNumber(rawScale, 0.4, 100),
    });
  };
  const renderFrameRangeRow = ({
    frameId,
    kind,
    label,
    valueM,
    minM,
    maxM,
    elevation,
    frameActive,
  }: {
    axis: "x" | "y" | "z";
    frameId: string;
    kind: "min-a" | "max-a" | "min-b" | "max-b";
    label: string;
    valueM: number;
    minM: number;
    maxM: number;
    elevation: boolean;
    frameActive: boolean;
  }) => {
    const patchKey =
      kind === "min-a"
        ? "minAM"
        : kind === "max-a"
          ? "maxAM"
          : kind === "min-b"
            ? "minBM"
            : "maxBM";
    const numberValue = elevation
      ? Number((valueM / 1000).toFixed(1))
      : Math.round(valueM);
    const numberMin = elevation ? minM / 1000 : minM;
    const numberMax = elevation ? maxM / 1000 : maxM;
    const unit = elevation ? "km" : "m";
    const commitValue = (raw: number) => {
      if (!Number.isFinite(raw)) return;
      const meters = elevation ? raw * 1000 : raw;
      setFrameSpecificPatch(frameId, {
        [patchKey]: clampNumber(meters, minM, maxM),
      });
    };
    const testKey = frameId.replace(/[^a-z0-9]+/gi, "-");
    return (
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>{label}</label>
        <input
          data-testid={`scene-section-frame-${testKey}-${kind}`}
          type="range"
          min={minM}
          max={maxM}
          step={100}
          disabled={disabled || !frameActive}
          value={valueM}
          onChange={(e) => commitValue(parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
        <input
          data-testid={`scene-section-frame-${testKey}-${kind}-number`}
          type="number"
          min={numberMin}
          max={numberMax}
          step={elevation ? 0.1 : 1}
          disabled={disabled || !frameActive}
          value={numberValue}
          onChange={(e) => commitValue(parseFloat(e.target.value))}
          style={frameNumberInputStyle}
        />
        <span style={frameUnitStyle}>{unit}</span>
      </div>
    );
  };

  return (
    <div data-testid="scene-section-planes-container">
      <div style={detailsContentStyle}>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Enabled</span>
          <input
            data-testid="scene-section-enabled"
            type="checkbox"
            disabled={disabled}
            checked={enabled}
            onChange={(e) =>
              commit({
                sceneSectionEnabled: e.target.checked,
                sceneSectionMode: "cutaway",
              })
            }
          />
        </label>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Gizmo</span>
          <input
            data-testid="scene-section-helper-visible"
            type="checkbox"
            disabled={disabled}
            checked={helperVisible}
            onChange={(e) =>
              commit({ sceneSectionHelperVisible: e.target.checked })
            }
          />
        </label>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Legend</span>
          <input
            data-testid="scene-section-legend-visible"
            type="checkbox"
            disabled={disabled}
            checked={legendVisible}
            onChange={(e) =>
              commit({ sceneSectionLegendVisible: e.target.checked })
            }
          />
        </label>
        <div data-testid="scene-section-window" style={sectionFrameListStyle}>
          {frameEntries.map((frame) => {
              const axis = frame.axis;
              const testKey = frame.id.replace(/[^a-z0-9]+/gi, "-");
              const plane = frame.plane ?? {};
              const planeRange = axisRanges[axis];
              const isActiveFrame = frame.id === activeFrameId;
              const controlKey = frame.builtIn ? axis : testKey;
              const planeEnabled = plane.enabled === true;
              const position =
                typeof plane.positionM === "number" &&
                Number.isFinite(plane.positionM)
                  ? plane.positionM
                  : sceneSectionDefaultPositions[axis];
              const positionFill =
                ((position - planeRange.min) /
                  Math.max(1, planeRange.max - planeRange.min)) *
                100;
              const axisFrame = frame.frame ?? {};
              const axisWindow =
                frame.builtIn && (axis === "x" || axis === "y")
                  ? windowByAxis[axis]
                  : undefined;
              const aMinLimit = axis === "x" ? -115000 : -140000;
              const aMaxLimit = axis === "x" ? 115000 : 140000;
              const bMinLimit = axis === "z" ? -115000 : -122000;
              const bMaxLimit = axis === "z" ? 115000 : 4000;
              const minA =
                typeof axisFrame.minAM === "number" &&
                Number.isFinite(axisFrame.minAM)
                  ? axisFrame.minAM
                  : typeof axisWindow?.minAlongM === "number" &&
                      Number.isFinite(axisWindow.minAlongM)
                    ? axisWindow.minAlongM
                    : aMinLimit;
              const maxA =
                typeof axisFrame.maxAM === "number" &&
                Number.isFinite(axisFrame.maxAM)
                  ? axisFrame.maxAM
                  : typeof axisWindow?.maxAlongM === "number" &&
                      Number.isFinite(axisWindow.maxAlongM)
                    ? axisWindow.maxAlongM
                    : aMaxLimit;
              const minB =
                typeof axisFrame.minBM === "number" &&
                Number.isFinite(axisFrame.minBM)
                  ? axisFrame.minBM
                  : typeof axisWindow?.bottomElevationM === "number" &&
                      Number.isFinite(axisWindow.bottomElevationM)
                    ? axisWindow.bottomElevationM
                    : bMinLimit;
              const maxB =
                typeof axisFrame.maxBM === "number" &&
                Number.isFinite(axisFrame.maxBM)
                  ? axisFrame.maxBM
                  : bMaxLimit;
              const hasFrameBounds =
                typeof axisFrame.minAM === "number" ||
                typeof axisFrame.maxAM === "number" ||
                typeof axisFrame.minBM === "number" ||
                typeof axisFrame.maxBM === "number";
              const axisFrameEnabled =
                typeof axisFrame.enabled === "boolean"
                  ? axisFrame.enabled
                  : legacyFrameEnabled || Boolean(axisWindow) || hasFrameBounds;
              const axisGroundTraceVisible =
                typeof axisFrame.groundTraceVisible === "boolean"
                  ? axisFrame.groundTraceVisible
                  : defaultGroundTraceVisible;
              const axisGroundTraceWidthM = finiteStyleNumber(
                axisFrame.groundTraceWidthM,
                360,
                30,
                2000,
              );
              const axisAxesVisible =
                typeof axisFrame.axesVisible === "boolean"
                  ? axisFrame.axesVisible
                  : defaultAxesVisible;
              const axisIntervalM = finiteStyleNumber(
                axisFrame.axisIntervalM,
                defaultAxisIntervalM,
                100,
                50000,
              );
              const axisTextScale = finiteStyleNumber(
                axisFrame.axisTextScale,
                defaultAxisTextScale,
                0.4,
                100,
              );
              const aLabel =
                axis === "x" ? "Northing" : "Easting";
              const bLabel = axis === "z" ? "Northing" : "Elevation";
              const axisAlignment: SceneSectionAxisAlignment =
                axisFrame.axisAlignment === "cardinal" ? "cardinal" : "utm";
              const axisDatum: SceneSectionAxisDatum =
                axisFrame.axisDatum === "local" ||
                axisFrame.axisDatum === "latlon"
                  ? axisFrame.axisDatum
                  : "utm";
              const axisTextPaddingM = finiteStyleNumber(
                axisFrame.axisTextPaddingM,
                420,
                0,
                10000,
              );
              const axisAHeading =
                typeof axisFrame.axisAHeading === "string" &&
                axisFrame.axisAHeading.trim()
                  ? axisFrame.axisAHeading
                  : sceneSectionGeneratedHeading(axis, "a", axisDatum);
              const axisBHeading =
                typeof axisFrame.axisBHeading === "string" &&
                axisFrame.axisBHeading.trim()
                  ? axisFrame.axisBHeading
                  : sceneSectionGeneratedHeading(axis, "b", axisDatum);
              const axisHeadingPaddingM = finiteStyleNumber(
                axisFrame.axisHeadingPaddingM,
                1100,
                0,
                20000,
              );
              const axisHeadingScale = finiteStyleNumber(
                axisFrame.axisHeadingScale,
                1.2,
                0.4,
                100,
              );
              const axisHeadingColor = colorInputValue(
                axisFrame.axisHeadingColor,
                sceneSectionAxisColors[axis],
              );
              const frameCenterSceneX =
                axis === "y"
                  ? (minA + maxA) * 0.5
                  : axis === "z"
                    ? (minA + maxA) * 0.5
                    : position;
              const frameCenterSceneY =
                axis === "x"
                  ? (minA + maxA) * 0.5
                  : axis === "z"
                    ? (minB + maxB) * 0.5
                    : position;
              const defaultDatumEastingM =
                sectionOrigin.easting + frameCenterSceneX;
              const defaultDatumNorthingM =
                sectionOrigin.northing + frameCenterSceneY;
              const axisDatumOriginEastingM = finiteStyleNumber(
                axisFrame.axisDatumOriginEastingM,
                defaultDatumEastingM,
                -10_000_000,
                10_000_000,
              );
              const axisDatumOriginNorthingM = finiteStyleNumber(
                axisFrame.axisDatumOriginNorthingM,
                defaultDatumNorthingM,
                -10_000_000,
                10_000_000,
              );
              const axisDatumLatLonDecimals = finiteStyleNumber(
                axisFrame.axisDatumLatLonDecimals,
                3,
                0,
                6,
              );
              const basisControlDisabled =
                disabled || !axisFrameEnabled || !axisAxesVisible;
              return (
                <details
                  key={frame.id}
                  style={nestedDetailsStyle}
                  data-testid={`scene-section-window-${testKey}`}
                >
                  <summary
                    style={{
                      ...panelStyles.summary,
                      color: sceneSectionAxisColors[axis],
                    }}
                  >
                    <span style={frameSummaryContentStyle}>
                      <span
                        style={frameSummaryTitleStyle}
                        onClick={stopSummaryToggle}
                        onKeyDown={stopSummaryToggle}
                      >
                        <InlineEditableTitle
                          value={frame.label}
                          onCommit={(next) => {
                            const trimmed = next.trim();
                            if (!trimmed || trimmed === frame.label) return;
                            setFrameEntryPatch(frame.id, { label: trimmed });
                          }}
                          textStyle={{
                            color: sceneSectionAxisColors[axis],
                            fontWeight: 600,
                          }}
                          title="Click to rename section frame"
                        />
                      </span>
                      <span
                        style={frameSummaryControlGroupStyle}
                        onClick={stopSummaryToggle}
                        onKeyDown={stopSummaryToggle}
                      >
                        <label style={frameSummaryToggleStyle}>
                          <input
                            data-testid={`scene-section-plane-${controlKey}-enabled`}
                            type="checkbox"
                            disabled={disabled}
                            checked={planeEnabled}
                            onChange={(e) =>
                              setPlaneSpecificPatch(frame.id, {
                                enabled: e.target.checked,
                              })
                            }
                            style={frameSummaryToggleInputStyle}
                          />
                          <span>Enable</span>
                        </label>
                        <label
                          style={{
                            ...frameSummaryToggleStyle,
                            opacity: planeEnabled ? 1 : 0.48,
                          }}
                        >
                          <input
                            data-testid={`scene-section-plane-${controlKey}-invert`}
                            type="checkbox"
                            disabled={controlDisabled || !planeEnabled}
                            checked={plane.invert === true}
                            onChange={(e) =>
                              setPlaneSpecificPatch(frame.id, {
                                invert: e.target.checked,
                              })
                            }
                            style={frameSummaryToggleInputStyle}
                          />
                          <span>Flip</span>
                        </label>
                        <label
                          style={{
                            ...frameSummaryToggleStyle,
                            opacity: planeEnabled ? 1 : 0.48,
                          }}
                          title="When off: section still cuts onscreen objects, but no legend entry or push/pull handles render"
                        >
                          <input
                            data-testid={`scene-section-plane-${controlKey}-show`}
                            type="checkbox"
                            disabled={disabled || !planeEnabled}
                            checked={frame.legendVisible}
                            onChange={(e) =>
                              setFrameEntryPatch(frame.id, {
                                legendVisible: e.target.checked,
                              })
                            }
                            style={frameSummaryToggleInputStyle}
                          />
                          <span>Show</span>
                        </label>
                        <button
                          type="button"
                          data-testid={`scene-section-plane-${controlKey}-active`}
                          disabled={disabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            commit({
                              sceneSectionActiveAxis: axis,
                              sceneSectionActiveFrameId: frame.id,
                            });
                          }}
                          style={{
                            ...frameSummaryActiveButtonStyle,
                            color: isActiveFrame
                              ? sceneSectionAxisColors[axis]
                              : "rgba(238, 238, 238, 0.78)",
                          }}
                        >
                          {isActiveFrame ? "Active" : "Set active"}
                        </button>
                      </span>
                    </span>
                  </summary>
                  <div
                    style={detailsContentStyle}
                    data-testid={`scene-section-plane-${testKey}`}
                  >
                    {!frame.builtIn && (
                      <div style={nestedControlRowStyle}>
                        <label style={nestedFieldLabelStyle}>Orientation</label>
                        <select
                          data-testid={`scene-section-frame-${testKey}-axis`}
                          disabled={disabled}
                          value={axis}
                          onChange={(e) => {
                            const nextAxis =
                              e.target.value === "x" ||
                              e.target.value === "y" ||
                              e.target.value === "z"
                                ? e.target.value
                                : axis;
                            const nextRange = axisRanges[nextAxis];
                            const nextPosition =
                              position >= nextRange.min &&
                              position <= nextRange.max
                                ? position
                                : sceneSectionDefaultPositions[nextAxis];
                            setFrameEntryPatch(frame.id, {
                              axis: nextAxis,
                              plane: { positionM: nextPosition },
                            });
                          }}
                          style={{ flex: 1 }}
                        >
                          <option value="x">X orientation</option>
                          <option value="y">Y orientation</option>
                          <option value="z">Z orientation</option>
                        </select>
                      </div>
                    )}
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Cut position</label>
                      <input
                        data-testid={`scene-section-plane-${controlKey}-position`}
                        type="range"
                        min={planeRange.min}
                        max={planeRange.max}
                        step={25}
                        disabled={controlDisabled || !planeEnabled}
                        value={position}
                        onChange={(e) =>
                          setPlaneSpecificPatch(frame.id, {
                            positionM: parseFloat(e.target.value),
                          })
                        }
                        style={
                          {
                            flex: 1,
                            "--editor-slider-fill": `${Math.max(
                              0,
                              Math.min(100, positionFill),
                            )}%`,
                          } as React.CSSProperties
                        }
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {Math.round(position)} m
                      </span>
                    </div>
                    <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                      <span style={nestedFieldLabelStyle}>Frame crop</span>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-enabled`}
                        type="checkbox"
                        disabled={disabled}
                        checked={axisFrameEnabled}
                        onChange={(e) =>
                          setFrameSpecificPatch(frame.id, {
                            enabled: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                      <span style={nestedFieldLabelStyle}>Ground trace</span>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-ground-trace-visible`}
                        type="checkbox"
                        disabled={disabled || !axisFrameEnabled}
                        checked={axisGroundTraceVisible}
                        onChange={(e) =>
                          setFrameSpecificPatch(frame.id, {
                            groundTraceVisible: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Ground line width</label>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-ground-trace-width`}
                        type="range"
                        min={30}
                        max={2000}
                        step={10}
                        disabled={
                          disabled ||
                          !axisFrameEnabled ||
                          !axisGroundTraceVisible
                        }
                        value={axisGroundTraceWidthM}
                        onChange={(e) =>
                          setGroundTraceWidthM(
                            frame.id,
                            parseFloat(e.target.value),
                          )
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${controlKey}-ground-trace-width-number`}
                          type="number"
                          min={30}
                          max={2000}
                          step={10}
                          disabled={
                            disabled ||
                            !axisFrameEnabled ||
                            !axisGroundTraceVisible
                          }
                          value={Math.round(axisGroundTraceWidthM)}
                          onChange={(e) =>
                            setGroundTraceWidthM(
                              frame.id,
                              parseFloat(e.target.value),
                            )
                          }
                          style={frameInlineUnitNumberInputStyle}
                        />
                        <span
                          aria-hidden="true"
                          style={frameInlineUnitSuffixStyle}
                        >
                          m
                        </span>
                      </span>
                    </div>
                    <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                      <span style={nestedFieldLabelStyle}>Scale axes</span>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-axes-visible`}
                        type="checkbox"
                        disabled={disabled || !axisFrameEnabled}
                        checked={axisAxesVisible}
                        onChange={(e) =>
                          setFrameSpecificPatch(frame.id, {
                            axesVisible: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Alignment</label>
                      <div style={frameSegmentedControlStyle}>
                        {(["utm", "cardinal"] as const).map((value) => (
                          <button
                            key={value}
                            type="button"
                            data-testid={`scene-section-frame-${controlKey}-alignment-${value}`}
                            disabled={basisControlDisabled}
                            onClick={() =>
                              setFrameBasisPatch(frame, {
                                axisAlignment: value,
                              })
                            }
                            style={{
                              ...frameSegmentButtonStyle,
                              color:
                                axisAlignment === value
                                  ? sceneSectionAxisColors[axis]
                                  : "rgba(238, 238, 238, 0.78)",
                              borderColor:
                                axisAlignment === value
                                  ? sceneSectionAxisColors[axis]
                                  : "rgba(238, 238, 238, 0.26)",
                            }}
                          >
                            {value === "utm" ? "UTM grid" : "Cardinal"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Datum</label>
                      <div style={frameSegmentedControlStyle}>
                        {(["utm", "local", "latlon"] as const).map((value) => (
                          <button
                            key={value}
                            type="button"
                            data-testid={`scene-section-frame-${controlKey}-datum-${value}`}
                            disabled={basisControlDisabled}
                            onClick={() =>
                              setFrameBasisPatch(frame, {
                                axisDatum: value,
                                ...(value === "local" &&
                                typeof axisFrame.axisDatumOriginEastingM !==
                                  "number"
                                  ? {
                                      axisDatumOriginEastingM:
                                        defaultDatumEastingM,
                                      axisDatumOriginNorthingM:
                                        defaultDatumNorthingM,
                                    }
                                  : {}),
                              })
                            }
                            style={{
                              ...frameSegmentButtonStyle,
                              color:
                                axisDatum === value
                                  ? sceneSectionAxisColors[axis]
                                  : "rgba(238, 238, 238, 0.78)",
                              borderColor:
                                axisDatum === value
                                  ? sceneSectionAxisColors[axis]
                                  : "rgba(238, 238, 238, 0.26)",
                            }}
                          >
                            {value === "utm"
                              ? "UTM"
                              : value === "local"
                                ? "Local"
                                : "Lat/Lon"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {axisDatum === "local" && (
                      <>
                        <div style={nestedControlRowStyle}>
                          <label style={nestedFieldLabelStyle}>Datum easting</label>
                          <input
                            data-testid={`scene-section-frame-${controlKey}-datum-easting`}
                            type="number"
                            step={1}
                            disabled={basisControlDisabled}
                            value={Math.round(axisDatumOriginEastingM)}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!Number.isFinite(value)) return;
                              setFrameSpecificPatch(frame.id, {
                                axisDatumOriginEastingM: value,
                              });
                            }}
                            style={{ flex: 1 }}
                          />
                          <span style={frameUnitStyle}>m</span>
                        </div>
                        <div style={nestedControlRowStyle}>
                          <label style={nestedFieldLabelStyle}>Datum northing</label>
                          <input
                            data-testid={`scene-section-frame-${controlKey}-datum-northing`}
                            type="number"
                            step={1}
                            disabled={basisControlDisabled}
                            value={Math.round(axisDatumOriginNorthingM)}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!Number.isFinite(value)) return;
                              setFrameSpecificPatch(frame.id, {
                                axisDatumOriginNorthingM: value,
                              });
                            }}
                            style={{ flex: 1 }}
                          />
                          <span style={frameUnitStyle}>m</span>
                        </div>
                      </>
                    )}
                    {axisDatum === "latlon" && (
                      <div style={nestedControlRowStyle}>
                        <label style={nestedFieldLabelStyle}>Lat/Lon decimals</label>
                        <input
                          data-testid={`scene-section-frame-${controlKey}-datum-decimals`}
                          type="number"
                          min={0}
                          max={6}
                          step={1}
                          disabled={basisControlDisabled}
                          value={Math.round(axisDatumLatLonDecimals)}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (!Number.isFinite(value)) return;
                            setFrameBasisPatch(frame, {
                              axisDatumLatLonDecimals: clampNumber(value, 0, 6),
                            });
                          }}
                          style={frameNumberInputStyle}
                        />
                      </div>
                    )}
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Axis interval</label>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-axis-interval`}
                        type="range"
                        min={0.1}
                        max={50}
                        step={0.1}
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisIntervalM / 1000}
                        onChange={(e) =>
                          setAxisIntervalKm(frame.id, parseFloat(e.target.value))
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${controlKey}-axis-interval-number`}
                          type="number"
                          min={0.1}
                          max={50}
                          step={0.1}
                          disabled={
                            disabled || !axisFrameEnabled || !axisAxesVisible
                          }
                          value={Number((axisIntervalM / 1000).toFixed(1))}
                          onChange={(e) =>
                            setAxisIntervalKm(
                              frame.id,
                              parseFloat(e.target.value),
                            )
                          }
                          style={frameInlineUnitNumberInputStyle}
                        />
                        <span
                          aria-hidden="true"
                          style={frameInlineUnitSuffixStyle}
                        >
                          km
                        </span>
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Text size</label>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-axis-text-size`}
                        type="range"
                        min={0.4}
                        max={100}
                        step={0.1}
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisTextScale}
                        onChange={(e) =>
                          setAxisTextScale(frame.id, parseFloat(e.target.value))
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${controlKey}-axis-text-size-number`}
                          type="number"
                          min={0.4}
                          max={100}
                          step={0.1}
                          disabled={
                            disabled || !axisFrameEnabled || !axisAxesVisible
                          }
                          value={Number(axisTextScale.toFixed(1))}
                          onChange={(e) =>
                            setAxisTextScale(
                              frame.id,
                              parseFloat(e.target.value),
                            )
                          }
                          style={frameInlineScaleNumberInputStyle}
                        />
                        <span
                          aria-hidden="true"
                          style={frameInlineUnitSuffixStyle}
                        >
                          x
                        </span>
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Text padding</label>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-axis-text-padding`}
                        type="range"
                        min={0}
                        max={10}
                        step={0.1}
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisTextPaddingM / 1000}
                        onChange={(e) =>
                          setAxisTextPaddingKm(
                            frame.id,
                            parseFloat(e.target.value),
                          )
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${controlKey}-axis-text-padding-number`}
                          type="number"
                          min={0}
                          max={10}
                          step={0.1}
                          disabled={
                            disabled || !axisFrameEnabled || !axisAxesVisible
                          }
                          value={Number((axisTextPaddingM / 1000).toFixed(1))}
                          onChange={(e) =>
                            setAxisTextPaddingKm(
                              frame.id,
                              parseFloat(e.target.value),
                            )
                          }
                          style={frameInlineUnitNumberInputStyle}
                        />
                        <span
                          aria-hidden="true"
                          style={frameInlineUnitSuffixStyle}
                        >
                          km
                        </span>
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>A heading</label>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-axis-a-heading`}
                        type="text"
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisAHeading}
                        onChange={(e) =>
                          setFrameSpecificPatch(frame.id, {
                            axisAHeading: e.target.value,
                          })
                        }
                        style={frameTextInputStyle}
                      />
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>B heading</label>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-axis-b-heading`}
                        type="text"
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisBHeading}
                        onChange={(e) =>
                          setFrameSpecificPatch(frame.id, {
                            axisBHeading: e.target.value,
                          })
                        }
                        style={frameTextInputStyle}
                      />
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Heading padding</label>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-axis-heading-padding`}
                        type="range"
                        min={0}
                        max={20}
                        step={0.1}
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisHeadingPaddingM / 1000}
                        onChange={(e) =>
                          setAxisHeadingPaddingKm(
                            frame.id,
                            parseFloat(e.target.value),
                          )
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${controlKey}-axis-heading-padding-number`}
                          type="number"
                          min={0}
                          max={20}
                          step={0.1}
                          disabled={
                            disabled || !axisFrameEnabled || !axisAxesVisible
                          }
                          value={Number(
                            (axisHeadingPaddingM / 1000).toFixed(1),
                          )}
                          onChange={(e) =>
                            setAxisHeadingPaddingKm(
                              frame.id,
                              parseFloat(e.target.value),
                            )
                          }
                          style={frameInlineUnitNumberInputStyle}
                        />
                        <span
                          aria-hidden="true"
                          style={frameInlineUnitSuffixStyle}
                        >
                          km
                        </span>
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Heading size</label>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-axis-heading-size`}
                        type="range"
                        min={0.4}
                        max={100}
                        step={0.1}
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisHeadingScale}
                        onChange={(e) =>
                          setAxisHeadingScale(
                            frame.id,
                            parseFloat(e.target.value),
                          )
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${controlKey}-axis-heading-size-number`}
                          type="number"
                          min={0.4}
                          max={100}
                          step={0.1}
                          disabled={
                            disabled || !axisFrameEnabled || !axisAxesVisible
                          }
                          value={Number(axisHeadingScale.toFixed(1))}
                          onChange={(e) =>
                            setAxisHeadingScale(
                              frame.id,
                              parseFloat(e.target.value),
                            )
                          }
                          style={frameInlineScaleNumberInputStyle}
                        />
                        <span
                          aria-hidden="true"
                          style={frameInlineUnitSuffixStyle}
                        >
                          x
                        </span>
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Heading color</label>
                      <input
                        data-testid={`scene-section-frame-${controlKey}-axis-heading-color`}
                        type="color"
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisHeadingColor}
                        onChange={(e) =>
                          setFrameSpecificPatch(frame.id, {
                            axisHeadingColor: e.target.value,
                          })
                        }
                        style={frameColorInputStyle}
                      />
                    </div>
                    {renderFrameRangeRow({
                      axis,
                      frameId: frame.id,
                      kind: "min-a",
                      label: `${aLabel} min`,
                      valueM: minA,
                      minM: aMinLimit,
                      maxM: aMaxLimit,
                      elevation: false,
                      frameActive: axisFrameEnabled,
                    })}
                    {renderFrameRangeRow({
                      axis,
                      frameId: frame.id,
                      kind: "max-a",
                      label: `${aLabel} max`,
                      valueM: maxA,
                      minM: aMinLimit,
                      maxM: aMaxLimit,
                      elevation: false,
                      frameActive: axisFrameEnabled,
                    })}
                    {renderFrameRangeRow({
                      axis,
                      frameId: frame.id,
                      kind: "min-b",
                      label: `${bLabel} min`,
                      valueM: minB,
                      minM: bMinLimit,
                      maxM: bMaxLimit,
                      elevation: bLabel === "Elevation",
                      frameActive: axisFrameEnabled,
                    })}
                    {renderFrameRangeRow({
                      axis,
                      frameId: frame.id,
                      kind: "max-b",
                      label: `${bLabel} max`,
                      valueM: maxB,
                      minM: bMinLimit,
                      maxM: bMaxLimit,
                      elevation: bLabel === "Elevation",
                      frameActive: axisFrameEnabled,
                    })}
                    <details style={nestedDetailsStyle}>
                      <summary style={panelStyles.summary}>
                        Section object visibility
                      </summary>
                      <div style={detailsContentStyle}>
                        {objectTargets.map((target) => {
                          const supported =
                            target.supported && target.axes.includes(axis);
                          const opacity = objectVisibilityOpacity(
                            style,
                            axis,
                            frame.id,
                            target,
                            targetScope,
                            targetLayerIds,
                            targetProductIds,
                          );
                          const sliderDisabled =
                            disabled ||
                            !enabled ||
                            !planeEnabled ||
                            !axisFrameEnabled ||
                            !supported;
                          return (
                            <div
                              key={target.objectId}
                              style={{
                                ...frameObjectVisibilityRowStyle,
                                opacity: supported ? 1 : 0.45,
                              }}
                            >
                              <span
                                title={target.label}
                                style={{
                                  minWidth: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {target.label}
                              </span>
                              <input
                                data-testid={`scene-section-object-opacity-${controlKey}-${target.objectId}`}
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                disabled={sliderDisabled}
                                value={opacity}
                                onChange={(e) =>
                                  setObjectVisibilityOpacity(
                                    axis,
                                    frame.id,
                                    target.objectId,
                                    parseFloat(e.target.value),
                                  )
                                }
                                style={{ minWidth: 0 }}
                              />
                              <span style={sliderNumberReadoutStyle}>
                                {opacity.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </div>
                </details>
              );
          })}
          <button
            type="button"
            data-testid="scene-section-add-frame"
            disabled={
              disabled || frameEntries.length >= SCENE_SECTION_MAX_FRAME_COUNT
            }
            onClick={addCustomFrame}
            style={{
              ...smallActionButtonStyle,
              marginTop: 8,
              width: "100%",
            }}
          >
            Add section frame
          </button>
        </div>
      </div>
    </div>
  );
}
