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
import { compactCheckboxRowStyle, miniGroupTitleStyle, smallActionButtonStyle } from "../layout/layoutStyles";
import { editorLayerLabel } from "../layerLabels";
import type {
  EditableStyle,
  PresentationPage,
  ProjectLayerSpec,
  SceneSectionFrameState,
} from "../../../pages/types";
import type { SceneHandle } from "../../../scene";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../../../projectModules/utahForge/layerIds";
import { SeismicCapabilityLayerItem } from "./SeismicCapabilityLayerItem";
import { seismicDefaultProductId, seismicProductOptions } from "./seismicModel";

const sceneSectionAxisColors = {
  x: "#ff6b78",
  y: "#35c7e8",
  z: "#f6d76b",
} as const;

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
  minHeight: 18,
  padding: "1px 6px",
  fontSize: 11,
  lineHeight: 1.1,
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

function stopSummaryToggle(event: React.SyntheticEvent) {
  event.stopPropagation();
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
  const mode = "cutaway";
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
  const planes = style.sceneSectionPlanes ?? {};
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
  const frameByAxis = style.sceneSectionFrameByAxis ?? {};
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
  const setPlanePatch = (
    axis: "x" | "y" | "z",
    patch: { enabled?: boolean; positionM?: number; invert?: boolean },
  ) => {
    commit({
      sceneSectionActiveAxis: axis,
      sceneSectionPlanes: {
        ...planes,
        [axis]: {
          ...(planes[axis] ?? {}),
          ...patch,
        },
      },
    });
  };
  const setFramePatch = (
    axis: "x" | "y" | "z",
    patch: Partial<SceneSectionFrameState>,
  ) => {
    const current = frameByAxis[axis] ?? {};
    const nextFrame = {
      ...current,
      ...patch,
    };
    const hasCoordinatePatch =
      patch.minAM !== undefined ||
      patch.maxAM !== undefined ||
      patch.minBM !== undefined ||
      patch.maxBM !== undefined;
    const legacyPatch: Partial<EditableStyle> =
      (axis === "x" || axis === "y") &&
      (hasCoordinatePatch || patch.enabled === true)
        ? {
            sceneSectionWindowEnabled: true,
            sceneSectionWindowActiveAxis: axis,
            sceneSectionWindowByAxis: {
              ...windowByAxis,
              [axis]: {
                ...(windowByAxis[axis] ?? {}),
                minAlongM: nextFrame.minAM ?? windowByAxis[axis]?.minAlongM,
                maxAlongM: nextFrame.maxAM ?? windowByAxis[axis]?.maxAlongM,
                bottomElevationM:
                  nextFrame.minBM ?? windowByAxis[axis]?.bottomElevationM,
              },
            },
          }
        : {};
    const compatibilityPatch: Partial<EditableStyle> =
      patch.enabled === true || hasCoordinatePatch
        ? {
            sceneSectionFrameEnabled: true,
          }
        : {};
    commit({
      sceneSectionActiveAxis: axis,
      sceneSectionFrameByAxis: {
        ...frameByAxis,
        [axis]: {
          ...nextFrame,
        },
      },
      ...compatibilityPatch,
      ...legacyPatch,
    });
  };
  const toggleLayerTarget = (id: string, checked: boolean) => {
    const next = new Set(targetLayerIds);
    if (checked) next.add(id);
    else next.delete(id);
    commit({ sceneSectionTargetLayerIds: Array.from(next) });
  };
  const toggleProductTarget = (id: string, checked: boolean) => {
    const next = new Set(targetProductIds);
    if (checked) next.add(id);
    else next.delete(id);
    commit({ sceneSectionTargetProductIds: Array.from(next) });
  };
  const layerOptions = allLayers
    .filter((layer) =>
      [
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
        UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
        UTAH_FORGE_MT_STATIONS_LAYER_ID,
        "utah-forge-reference-stage",
      ].includes(layer.id),
    )
    .map((layer) => ({
      id: layer.id,
      label:
        layer.id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID
          ? "Seismic browser / survey geometry"
          : layer.id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID
            ? "3D MT resistivity volume"
            : layer.id === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID
              ? "MT thresholds"
              : editorLayerLabel(layer),
      supported:
        layer.id !== UTAH_FORGE_MT_STATIONS_LAYER_ID ||
        targetScope === "all-visible",
    }));
  const axisRanges = {
    x: { min: -140000, max: 140000 },
    y: { min: -115000, max: 115000 },
    z: { min: -122000, max: 4000 },
  } as const;
  const controlDisabled = disabled || !enabled;
  const setAxisIntervalKm = (axis: "x" | "y" | "z", rawKm: number) => {
    if (!Number.isFinite(rawKm)) return;
    setFramePatch(axis, {
      axisIntervalM: clampNumber(rawKm * 1000, 100, 50000),
    });
  };
  const setAxisTextScale = (axis: "x" | "y" | "z", rawScale: number) => {
    if (!Number.isFinite(rawScale)) return;
    setFramePatch(axis, {
      axisTextScale: clampNumber(rawScale, 0.4, 100),
    });
  };
  const setAxisTextPaddingKm = (axis: "x" | "y" | "z", rawKm: number) => {
    if (!Number.isFinite(rawKm)) return;
    setFramePatch(axis, {
      axisTextPaddingM: clampNumber(rawKm * 1000, 0, 10000),
    });
  };
  const setGroundTraceWidthM = (axis: "x" | "y" | "z", rawM: number) => {
    if (!Number.isFinite(rawM)) return;
    setFramePatch(axis, {
      groundTraceWidthM: clampNumber(rawM, 30, 2000),
    });
  };
  const setAxisHeadingPaddingKm = (axis: "x" | "y" | "z", rawKm: number) => {
    if (!Number.isFinite(rawKm)) return;
    setFramePatch(axis, {
      axisHeadingPaddingM: clampNumber(rawKm * 1000, 0, 20000),
    });
  };
  const setAxisHeadingScale = (axis: "x" | "y" | "z", rawScale: number) => {
    if (!Number.isFinite(rawScale)) return;
    setFramePatch(axis, {
      axisHeadingScale: clampNumber(rawScale, 0.4, 100),
    });
  };
  const renderFrameRangeRow = ({
    axis,
    kind,
    label,
    valueM,
    minM,
    maxM,
    elevation,
    frameActive,
  }: {
    axis: "x" | "y" | "z";
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
      setFramePatch(axis, {
        [patchKey]: clampNumber(meters, minM, maxM),
      });
    };
    return (
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>{label}</label>
        <input
          data-testid={`scene-section-frame-${axis}-${kind}`}
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
          data-testid={`scene-section-frame-${axis}-${kind}-number`}
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
    <SeismicCapabilityLayerItem
      title="Scene section planes"
      type="section"
      testId="scene-section-planes-container"
    >
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
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Type</label>
          <select
            data-testid="scene-section-mode"
            disabled={disabled}
            value={mode}
            onChange={() =>
              commit({
                sceneSectionMode: "cutaway",
              })
            }
            style={{ flex: 1 }}
          >
            <option value="cutaway">Cutaway clip</option>
          </select>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Targets</label>
          <select
            data-testid="scene-section-target-scope"
            disabled={disabled}
            value={targetScope}
            onChange={(e) =>
              commit({
                sceneSectionTargetScope:
                  e.target.value === "all-visible"
                    ? "all-visible"
                    : e.target.value === "active-selection"
                      ? "active-selection"
                      : "selected-targets",
              })
            }
            style={{ flex: 1 }}
          >
            <option value="selected-targets">Selected targets</option>
            <option value="all-visible">All visible</option>
            <option value="active-selection">Active selection</option>
          </select>
        </div>
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
        <details style={nestedDetailsStyle} data-testid="scene-section-window">
          <summary style={panelStyles.summary}>Section frames</summary>
          <div style={detailsContentStyle}>
            {(["x", "y", "z"] as const).map((axis) => {
              const plane = planes[axis] ?? {};
              const planeRange = axisRanges[axis];
              const isActiveAxis = axis === activeAxis;
              const planeEnabled = plane.enabled === true;
              const position =
                typeof plane.positionM === "number" &&
                Number.isFinite(plane.positionM)
                  ? plane.positionM
                  : axis === "x"
                    ? -6000
                    : axis === "y"
                      ? -10300
                      : -2200;
              const positionFill =
                ((position - planeRange.min) /
                  Math.max(1, planeRange.max - planeRange.min)) *
                100;
              const axisFrame = frameByAxis[axis] ?? {};
              const axisWindow =
                axis === "x" || axis === "y" ? windowByAxis[axis] : undefined;
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
                  : `${aLabel} (km)`;
              const axisBHeading =
                typeof axisFrame.axisBHeading === "string" &&
                axisFrame.axisBHeading.trim()
                  ? axisFrame.axisBHeading
                  : `${bLabel} (km)`;
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
              return (
                <details
                  key={axis}
                  style={nestedDetailsStyle}
                  data-testid={`scene-section-window-${axis}`}
                >
                  <summary
                    style={{
                      ...panelStyles.summary,
                      color: sceneSectionAxisColors[axis],
                    }}
                  >
                    <span style={frameSummaryContentStyle}>
                      <span style={frameSummaryTitleStyle}>
                        {axis.toUpperCase()} Section frame
                      </span>
                      <span
                        style={frameSummaryControlGroupStyle}
                        onClick={stopSummaryToggle}
                        onKeyDown={stopSummaryToggle}
                      >
                        <label style={frameSummaryToggleStyle}>
                          <input
                            data-testid={`scene-section-plane-${axis}-enabled`}
                            type="checkbox"
                            disabled={disabled}
                            checked={planeEnabled}
                            onChange={(e) =>
                              commit({
                                sceneSectionMode: "cutaway",
                                sceneSectionActiveAxis: axis,
                                sceneSectionPlanes: {
                                  ...planes,
                                  [axis]: {
                                    ...(planes[axis] ?? {}),
                                    enabled: e.target.checked,
                                  },
                                },
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
                            data-testid={`scene-section-plane-${axis}-invert`}
                            type="checkbox"
                            disabled={controlDisabled || !planeEnabled}
                            checked={plane.invert === true}
                            onChange={(e) =>
                              setPlanePatch(axis, {
                                invert: e.target.checked,
                              })
                            }
                            style={frameSummaryToggleInputStyle}
                          />
                          <span>Flip</span>
                        </label>
                        <button
                          type="button"
                          data-testid={`scene-section-plane-${axis}-active`}
                          disabled={disabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            commit({ sceneSectionActiveAxis: axis });
                          }}
                          style={{
                            ...frameSummaryActiveButtonStyle,
                            color: isActiveAxis
                              ? sceneSectionAxisColors[axis]
                              : "rgba(238, 238, 238, 0.78)",
                            borderColor: isActiveAxis
                              ? sceneSectionAxisColors[axis]
                              : "rgba(238, 238, 238, 0.26)",
                          }}
                        >
                          {isActiveAxis ? "Active" : "Set active"}
                        </button>
                      </span>
                    </span>
                  </summary>
                  <div
                    style={detailsContentStyle}
                    data-testid={`scene-section-plane-${axis}`}
                  >
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Cut position</label>
                      <input
                        data-testid={`scene-section-plane-${axis}-position`}
                        type="range"
                        min={planeRange.min}
                        max={planeRange.max}
                        step={25}
                        disabled={controlDisabled || !planeEnabled}
                        value={position}
                        onChange={(e) =>
                          setPlanePatch(axis, {
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
                        data-testid={`scene-section-frame-${axis}-enabled`}
                        type="checkbox"
                        disabled={disabled}
                        checked={axisFrameEnabled}
                        onChange={(e) =>
                          setFramePatch(axis, { enabled: e.target.checked })
                        }
                      />
                    </label>
                    <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                      <span style={nestedFieldLabelStyle}>Ground trace</span>
                      <input
                        data-testid={`scene-section-frame-${axis}-ground-trace-visible`}
                        type="checkbox"
                        disabled={disabled || !axisFrameEnabled}
                        checked={axisGroundTraceVisible}
                        onChange={(e) =>
                          setFramePatch(axis, {
                            groundTraceVisible: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Ground line width</label>
                      <input
                        data-testid={`scene-section-frame-${axis}-ground-trace-width`}
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
                            axis,
                            parseFloat(e.target.value),
                          )
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${axis}-ground-trace-width-number`}
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
                              axis,
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
                        data-testid={`scene-section-frame-${axis}-axes-visible`}
                        type="checkbox"
                        disabled={disabled || !axisFrameEnabled}
                        checked={axisAxesVisible}
                        onChange={(e) =>
                          setFramePatch(axis, { axesVisible: e.target.checked })
                        }
                      />
                    </label>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Axis interval</label>
                      <input
                        data-testid={`scene-section-frame-${axis}-axis-interval`}
                        type="range"
                        min={0.1}
                        max={50}
                        step={0.1}
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisIntervalM / 1000}
                        onChange={(e) =>
                          setAxisIntervalKm(axis, parseFloat(e.target.value))
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${axis}-axis-interval-number`}
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
                              axis,
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
                        data-testid={`scene-section-frame-${axis}-axis-text-size`}
                        type="range"
                        min={0.4}
                        max={100}
                        step={0.1}
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisTextScale}
                        onChange={(e) =>
                          setAxisTextScale(axis, parseFloat(e.target.value))
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${axis}-axis-text-size-number`}
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
                              axis,
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
                        data-testid={`scene-section-frame-${axis}-axis-text-padding`}
                        type="range"
                        min={0}
                        max={10}
                        step={0.1}
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisTextPaddingM / 1000}
                        onChange={(e) =>
                          setAxisTextPaddingKm(axis, parseFloat(e.target.value))
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${axis}-axis-text-padding-number`}
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
                              axis,
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
                        data-testid={`scene-section-frame-${axis}-axis-a-heading`}
                        type="text"
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisAHeading}
                        onChange={(e) =>
                          setFramePatch(axis, { axisAHeading: e.target.value })
                        }
                        style={frameTextInputStyle}
                      />
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>B heading</label>
                      <input
                        data-testid={`scene-section-frame-${axis}-axis-b-heading`}
                        type="text"
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisBHeading}
                        onChange={(e) =>
                          setFramePatch(axis, { axisBHeading: e.target.value })
                        }
                        style={frameTextInputStyle}
                      />
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Heading padding</label>
                      <input
                        data-testid={`scene-section-frame-${axis}-axis-heading-padding`}
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
                            axis,
                            parseFloat(e.target.value),
                          )
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${axis}-axis-heading-padding-number`}
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
                              axis,
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
                        data-testid={`scene-section-frame-${axis}-axis-heading-size`}
                        type="range"
                        min={0.4}
                        max={100}
                        step={0.1}
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisHeadingScale}
                        onChange={(e) =>
                          setAxisHeadingScale(axis, parseFloat(e.target.value))
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={frameInlineUnitInputWrapStyle}>
                        <input
                          data-testid={`scene-section-frame-${axis}-axis-heading-size-number`}
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
                              axis,
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
                        data-testid={`scene-section-frame-${axis}-axis-heading-color`}
                        type="color"
                        disabled={
                          disabled || !axisFrameEnabled || !axisAxesVisible
                        }
                        value={axisHeadingColor}
                        onChange={(e) =>
                          setFramePatch(axis, {
                            axisHeadingColor: e.target.value,
                          })
                        }
                        style={frameColorInputStyle}
                      />
                    </div>
                    {renderFrameRangeRow({
                      axis,
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
                      kind: "max-b",
                      label: `${bLabel} max`,
                      valueM: maxB,
                      minM: bMinLimit,
                      maxM: bMaxLimit,
                      elevation: bLabel === "Elevation",
                      frameActive: axisFrameEnabled,
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </details>
        <details style={nestedDetailsStyle}>
          <summary style={panelStyles.summary}>Target checklist</summary>
          <div style={detailsContentStyle}>
            <div style={miniGroupTitleStyle}>Volume products</div>
            {products
              .filter((product) => product.raymarchCapable)
              .map((product) => (
                <label
                  key={product.id}
                  style={{ ...compactCheckboxRowStyle, cursor: "pointer" }}
                >
                  <input
                    data-testid={`scene-section-target-product-${product.id}`}
                    type="checkbox"
                    disabled={disabled || targetScope === "all-visible"}
                    checked={
                      targetScope === "all-visible" ||
                      targetProductIds.has(product.id)
                    }
                    onChange={(e) =>
                      toggleProductTarget(product.id, e.target.checked)
                    }
                  />
                  <span>{product.label}</span>
                </label>
              ))}
            <div style={miniGroupTitleStyle}>Scene layers</div>
            {layerOptions.map((layer) => (
              <label
                key={layer.id}
                style={{
                  ...compactCheckboxRowStyle,
                  cursor: layer.supported ? "pointer" : "not-allowed",
                  opacity: layer.supported ? 1 : 0.45,
                }}
              >
                <input
                  data-testid={`scene-section-target-layer-${layer.id}`}
                  type="checkbox"
                  disabled={
                    disabled ||
                    targetScope === "all-visible" ||
                    !layer.supported
                  }
                  checked={
                    targetScope === "all-visible" ||
                    targetLayerIds.has(layer.id)
                  }
                  onChange={(e) =>
                    toggleLayerTarget(layer.id, e.target.checked)
                  }
                />
                <span>{layer.label}</span>
              </label>
            ))}
          </div>
        </details>
      </div>
    </SeismicCapabilityLayerItem>
  );
}
