import { useEffect, useState } from "react";
import type React from "react";
import { FROSTED_HAIRLINE, panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  EnvSelectRow,
  EzGammaCheckboxRow,
  LayerBooleanStyleControl,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  overrideTagActiveStyle,
  overrideTagStyle,
  sliderNumberReadoutStyle,
  styleBoolean,
  styleNumber,
  styleString,
  type LayerStyleSetter,
  type PageStyleClearer,
  type PageStyleSetter,
} from "../../styleControls";
import type { EditableStyle, PresentationPage, ProjectLayerSpec } from "../../../pages/types";
import type { SceneHandle } from "../../../scene";
import { appAssetUrl } from "../../../projects/projectPathsRuntime";
import {
  boundaryStyleFromDefinition,
  liveBoundaryId,
  mtSurfaceBoundaryDefinitionsForLayer,
  mtSurfaceBoundaryMode,
  mtSurfaceBoundaryOrder,
  resolveMtSurfaceBoundaries,
  type MtSurfaceBoundaryComparison,
} from "../../../projectModules/utahForge/mtSurfaceBoundaries";
import { UTAH_FORGE_SCENE_SECTION_LAYER_ID } from "../../../projectModules/utahForge/layerIds";
import {
  DEFAULT_MT_RESISTIVITY_SLICE_ID,
  MT_RESISTIVITY_SLICE_PRODUCTS,
  mtResistivitySliceById,
} from "../../../mtResistivity/sliceProducts";
import { SCALAR_SOURCE_MAX, SCALAR_SOURCE_MIN } from "../scalarSourceRange";
import { SurfaceGradientColorInput } from "../style/StyleControls";
import {
  SURFACE_GRADIENT_DEFAULT_HIGH,
  SURFACE_GRADIENT_DEFAULT_LOW,
  SURFACE_GRADIENT_DEFAULT_MID,
} from "../surfaceGradientDefaults";

const miniInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72px minmax(0, 1fr)",
  gap: "4px 8px",
  alignItems: "baseline",
  margin: "6px 0",
  color: vibrancyTertiaryLabel,
  fontSize: 11,
  lineHeight: 1.25,
};

function prefixMtDimension(label: string, dimension: "2D" | "3D"): string {
  const cleaned = label
    .replace(/\bUtah\s+FORGE\s+Phase\s*3\b/gi, "")
    .replace(/\bUtah\s+FORGE\b/gi, "")
    .replace(/\bFORGE[-\s]*/gi, "")
    .replace(/\bUtah\b/gi, "")
    .replace(/\bPhase\s*3\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(2D|3D)\b/i.test(cleaned)) return cleaned;
  return `${dimension} ${cleaned}`;
}

export function SurfaceGradientControls({
  style,
  disabled,
  isPageOverride,
  overridden,
  onToggleOverride,
  onChange,
}: {
  style: EditableStyle;
  disabled: boolean;
  isPageOverride: boolean;
  overridden: boolean;
  onToggleOverride?: (enabled: boolean) => void;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const lowColor = styleString(
    style,
    "surfaceGradientLowColor",
    SURFACE_GRADIENT_DEFAULT_LOW,
  );
  const midColor = styleString(
    style,
    "surfaceGradientMidColor",
    SURFACE_GRADIENT_DEFAULT_MID,
  );
  const highColor = styleString(
    style,
    "surfaceGradientHighColor",
    SURFACE_GRADIENT_DEFAULT_HIGH,
  );
  const midpoint = Math.max(
    0.05,
    Math.min(0.95, styleNumber(style, "surfaceGradientMidpoint", 0.5)),
  );
  const contrast = Math.max(
    0.35,
    Math.min(2.5, styleNumber(style, "surfaceGradientContrast", 1)),
  );
  const midpointFill = Math.max(0, Math.min(100, midpoint * 100));
  const contrastFill = Math.max(
    0,
    Math.min(100, ((contrast - 0.35) / (2.5 - 0.35)) * 100),
  );
  const controlOpacity = disabled ? 0.4 : 1;
  const gradientBackground = `linear-gradient(90deg, ${lowColor} 0%, ${midColor} ${midpointFill.toFixed(
    1,
  )}%, ${highColor} 100%)`;

  return (
    <>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Gradient</label>
        {isPageOverride ? (
          <input
            type="checkbox"
            checked={overridden}
            onChange={(e) => onToggleOverride?.(e.target.checked)}
            title="Override environment surface gradient for this page"
          />
        ) : null}
        <div
          style={{
            flex: 1,
            height: 14,
            borderRadius: 999,
            border: FROSTED_HAIRLINE,
            background: gradientBackground,
            opacity: controlOpacity,
          }}
        />
        {isPageOverride ? (
          <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
            {overridden ? "overridden" : "inherited"}
          </span>
        ) : null}
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Colors</label>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          <SurfaceGradientColorInput
            label="Low"
            value={lowColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ surfaceGradientLowColor: value })}
          />
          <SurfaceGradientColorInput
            label="Mid"
            value={midColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ surfaceGradientMidColor: value })}
          />
          <SurfaceGradientColorInput
            label="High"
            value={highColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ surfaceGradientHighColor: value })}
          />
        </div>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Midpoint</label>
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.01}
          value={midpoint}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              surfaceGradientMidpoint: parseFloat(e.target.value),
            })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${midpointFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{midpoint.toFixed(2)}</span>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Nuance</label>
        <input
          type="range"
          min={0.35}
          max={2.5}
          step={0.05}
          value={contrast}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              surfaceGradientContrast: parseFloat(e.target.value),
            })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${contrastFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{contrast.toFixed(2)}</span>
      </div>
    </>
  );
}


export function MtTopSurfaceControls({
  style,
  disabled,
  isPageOverride,
  overridden,
  onToggleOverride,
  onChange,
}: {
  style: EditableStyle;
  disabled: boolean;
  isPageOverride: boolean;
  overridden: boolean;
  onToggleOverride?: (enabled: boolean) => void;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const lift = Math.max(
    -3000,
    Math.min(3000, styleNumber(style, "meshSurfaceLiftM", 0)),
  );
  const wireframe = styleBoolean(style, "meshWireframe", false);
  const roughness = Math.max(
    0,
    Math.min(1, styleNumber(style, "meshRoughness", 0.72)),
  );
  const metalness = Math.max(
    0,
    Math.min(1, styleNumber(style, "meshMetalness", 0.02)),
  );
  const controlOpacity = disabled ? 0.4 : 1;
  const liftFill = ((lift + 3000) / 6000) * 100;

  return (
    <>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Top surface</label>
        {isPageOverride ? (
          <input
            type="checkbox"
            checked={overridden}
            onChange={(e) => onToggleOverride?.(e.target.checked)}
            title="Override environment top-surface variables for this page"
          />
        ) : null}
        <span
          style={{
            flex: 1,
            color: vibrancyTertiaryLabel,
            fontSize: 11,
            opacity: controlOpacity,
          }}
        >
          inferred MT topology
        </span>
        {isPageOverride ? (
          <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
            {overridden ? "overridden" : "inherited"}
          </span>
        ) : null}
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Surface lift</label>
        <input
          type="range"
          min={-3000}
          max={3000}
          step={25}
          value={lift}
          disabled={disabled}
          onChange={(e) =>
            onChange({ meshSurfaceLiftM: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${liftFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{lift.toFixed(0)} m</span>
      </div>
      <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
        <span style={nestedFieldLabelStyle}>Wireframe</span>
        <input
          type="checkbox"
          checked={wireframe}
          disabled={disabled}
          onChange={(e) => onChange({ meshWireframe: e.target.checked })}
          style={{ opacity: controlOpacity }}
        />
        <span style={{ flex: 1 }} />
      </label>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Roughness</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={roughness}
          disabled={disabled}
          onChange={(e) =>
            onChange({ meshRoughness: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${roughness * 100}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{roughness.toFixed(2)}</span>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Metalness</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={metalness}
          disabled={disabled}
          onChange={(e) =>
            onChange({ meshMetalness: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${metalness * 100}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{metalness.toFixed(2)}</span>
      </div>
    </>
  );
}


interface MtVolumeProductOption {
  id: string;
  label: string;
  description?: string;
}

function mtVolumeProductOptions(
  layer: ProjectLayerSpec,
): MtVolumeProductOption[] {
  const raw = (layer.metadata as { volumeProducts?: unknown }).volumeProducts;
  if (Array.isArray(raw)) {
    const options: MtVolumeProductOption[] = [];
    for (const item of raw) {
      const product = item as {
        id?: unknown;
        label?: unknown;
        description?: unknown;
      };
      if (typeof product.id !== "string") continue;
      options.push({
        id: product.id,
        label:
          typeof product.label === "string"
            ? prefixMtDimension(product.label, "3D")
            : prefixMtDimension(product.id, "3D"),
        description:
          typeof product.description === "string"
            ? product.description
            : undefined,
      });
    }
    if (options.length > 0) return options;
  }
  return [
    {
      id: "mt-resistivity-forge-focused-volume",
      label: "3D MT resistivity focused volume",
    },
    {
      id: "mt-resistivity-full-extent-volume",
      label: "3D MT resistivity full-extent volume",
    },
  ];
}

type IsobandRangeKind = "mt" | "seismic";

function isobandAxisRange(axis: "x" | "y" | "z") {
  if (axis === "x") return { min: -140000, max: 140000, label: "X plane" };
  if (axis === "y") return { min: -115000, max: 115000, label: "Y plane" };
  return { min: -122000, max: 4000, label: "Z plane" };
}

function isobandDefaultPlanePosition(axis: "x" | "y" | "z"): number {
  return axis === "x" ? -6000 : axis === "y" ? -10300 : -2200;
}

export function IsobandControls({
  title = "Isobands",
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  rangeKind,
  volumePlanes,
  sceneSectionStyle,
  sceneHandle,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  title?: string;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  rangeKind: IsobandRangeKind;
  volumePlanes?: boolean;
  sceneSectionStyle?: EditableStyle;
  sceneHandle?: SceneHandle;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
}) {
  const enabled = styleBoolean(style, "sectionIsoEnabled", false);
  const linesVisible = styleBoolean(style, "sectionIsoLinesVisible", true);
  const bandsVisible = styleBoolean(style, "sectionIsoBandsVisible", true);
  const sourceOpacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "sectionIsoSourceOpacity", 0)),
  );
  const bandCount = Math.max(
    2,
    Math.min(32, Math.round(styleNumber(style, "sectionIsoLevelCount", 32))),
  );
  const lineWidth = Math.max(
    0,
    Math.min(12, styleNumber(style, "sectionIsoLineWidth", 2.6)),
  );
  const bandOpacity = Math.max(
    0,
    Math.min(0.85, styleNumber(style, "sectionIsoBandOpacity", 0.32)),
  );
  const fillOffset = Math.max(
    -1,
    Math.min(1, styleNumber(style, "sectionIsoFillOffset", 0)),
  );
  const lineStyle = style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid";
  const sourceMin = rangeKind === "seismic" ? 0 : SCALAR_SOURCE_MIN;
  const sourceMax = rangeKind === "seismic" ? 1 : SCALAR_SOURCE_MAX;
  const fallbackMin =
    rangeKind === "seismic"
      ? styleNumber(style, "seismicAmplitudeMin", 0.08)
      : sourceMin;
  const fallbackMax =
    rangeKind === "seismic"
      ? styleNumber(style, "seismicAmplitudeMax", 0.92)
      : sourceMax;
  const isoMin = Math.max(
    sourceMin,
    Math.min(
      sourceMax - 0.001,
      styleNumber(style, "sectionIsoMin", fallbackMin),
    ),
  );
  const isoMax = Math.max(
    isoMin + 0.001,
    Math.min(sourceMax, styleNumber(style, "sectionIsoMax", fallbackMax)),
  );
  const sceneStyle = sceneSectionStyle ?? {};
  const scenePlanes = sceneStyle.sceneSectionPlanes ?? {};
  const activeAxis =
    sceneStyle.sceneSectionActiveAxis === "x" ||
    sceneStyle.sceneSectionActiveAxis === "y" ||
    sceneStyle.sceneSectionActiveAxis === "z"
      ? sceneStyle.sceneSectionActiveAxis
      : "z";
  const activePlane = scenePlanes[activeAxis] ?? {};
  const axisRange = isobandAxisRange(activeAxis);
  const planePosition =
    typeof activePlane.positionM === "number" &&
    Number.isFinite(activePlane.positionM)
      ? activePlane.positionM
      : isobandDefaultPlanePosition(activeAxis);
  const controlOpacity = disabled ? 0.4 : 1;
  const rangeSpan = sourceMax - sourceMin;
  const rangeFill = (value: number) =>
    `${Math.max(0, Math.min(100, ((value - sourceMin) / rangeSpan) * 100))}%`;
  const planeFill = Math.max(
    0,
    Math.min(
      100,
      ((planePosition - axisRange.min) /
        Math.max(1, axisRange.max - axisRange.min)) *
        100,
    ),
  );
  const commit = (patch: Partial<EditableStyle>) => {
    if (disabled) return;
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  const commitScene = (patch: Partial<EditableStyle>) => {
    if (disabled || !volumePlanes || !sceneHandle) return;
    const merged = { ...sceneStyle, ...patch };
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
  const ensureScenePlane = (axis: "x" | "y" | "z") => {
    const targetLayerIds = new Set(
      Array.isArray(sceneStyle.sceneSectionTargetLayerIds)
        ? sceneStyle.sceneSectionTargetLayerIds
        : [],
    );
    targetLayerIds.add(layerId);
    commitScene({
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionActiveAxis: axis,
      sceneSectionTargetScope: "selected-targets",
      sceneSectionTargetLayerIds: Array.from(targetLayerIds),
      sceneSectionHelperVisible: true,
      sceneSectionLegendVisible: true,
      sceneSectionPlanes: {
        ...scenePlanes,
        [axis]: {
          ...(scenePlanes[axis] ?? {}),
          enabled: true,
          positionM:
            typeof scenePlanes[axis]?.positionM === "number"
              ? scenePlanes[axis]?.positionM
              : isobandDefaultPlanePosition(axis),
        },
      },
    });
  };
  const setEnabled = (checked: boolean) => {
    if (checked && volumePlanes) ensureScenePlane(activeAxis);
    commit(
      checked
        ? {
            sectionIsoEnabled: true,
            sectionIsoBandsVisible: true,
            sectionIsoLinesVisible: true,
            sectionIsoLevelCount: 32,
            sectionIsoSourceOpacity: 0,
            sectionIsoMin: fallbackMin,
            sectionIsoMax: Math.max(fallbackMin + 0.001, fallbackMax),
          }
        : { sectionIsoEnabled: false },
    );
  };

  return (
    <details style={nestedDetailsStyle} data-testid="layer-isobands-controls">
      <summary style={panelStyles.summary}>{title}</summary>
      <div style={detailsContentStyle}>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>View</span>
          <input
            data-testid="layer-isobands-enabled"
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(event) => setEnabled(event.target.checked)}
            style={{ opacity: controlOpacity }}
          />
          <span
            style={{
              flex: 1,
              color: vibrancyTertiaryLabel,
              fontSize: 11,
              opacity: controlOpacity,
            }}
          >
            {volumePlanes ? "section plane bands" : "slice overlay bands"}
          </span>
        </label>

        {volumePlanes ? (
          <>
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Plane</label>
              <select
                data-testid="layer-isobands-volume-axis"
                value={activeAxis}
                disabled={disabled}
                onChange={(event) =>
                  ensureScenePlane(event.target.value as "x" | "y" | "z")
                }
                style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
              >
                <option value="x">X</option>
                <option value="y">Y</option>
                <option value="z">Z</option>
              </select>
            </div>
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Plane pos.</label>
              <input
                data-testid="layer-isobands-volume-position"
                type="range"
                min={axisRange.min}
                max={axisRange.max}
                step={25}
                value={planePosition}
                disabled={disabled}
                onChange={(event) =>
                  commitScene({
                    sceneSectionEnabled: true,
                    sceneSectionActiveAxis: activeAxis,
                    sceneSectionPlanes: {
                      ...scenePlanes,
                      [activeAxis]: {
                        ...(scenePlanes[activeAxis] ?? {}),
                        enabled: true,
                        positionM: parseFloat(event.target.value),
                      },
                    },
                  })
                }
                style={
                  {
                    flex: 1,
                    opacity: controlOpacity,
                    "--editor-slider-fill": `${planeFill}%`,
                  } as React.CSSProperties
                }
              />
              <span style={sliderNumberReadoutStyle}>
                {Math.round(planePosition)} m
              </span>
            </div>
          </>
        ) : null}

        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Original</label>
          <input
            data-testid="layer-isobands-source-opacity"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={sourceOpacity}
            disabled={disabled || !enabled}
            onChange={(event) =>
              commit({
                sectionIsoSourceOpacity: parseFloat(event.target.value),
              })
            }
            style={
              {
                flex: 1,
                opacity: enabled ? controlOpacity : 0.35,
                "--editor-slider-fill": `${sourceOpacity * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {sourceOpacity.toFixed(2)}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Bands</label>
          <input
            data-testid="layer-isobands-count"
            type="range"
            min={2}
            max={32}
            step={1}
            value={bandCount}
            disabled={disabled || !enabled}
            onChange={(event) =>
              commit({
                sectionIsoLevelCount: Math.round(
                  parseFloat(event.target.value),
                ),
              })
            }
            style={
              {
                flex: 1,
                opacity: enabled ? controlOpacity : 0.35,
                "--editor-slider-fill": `${((bandCount - 2) / 30) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{bandCount}</span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Min</label>
          <input
            data-testid="layer-isobands-min"
            type="range"
            min={sourceMin}
            max={sourceMax}
            step={rangeKind === "seismic" ? 0.01 : 0.01}
            value={isoMin}
            disabled={disabled || !enabled}
            onChange={(event) => {
              const next = parseFloat(event.target.value);
              commit({
                sectionIsoMin: next,
                sectionIsoMax: Math.max(isoMax, next + 0.001),
              });
            }}
            style={
              {
                flex: 1,
                opacity: enabled ? controlOpacity : 0.35,
                "--editor-slider-fill": rangeFill(isoMin),
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {rangeKind === "seismic" ? isoMin.toFixed(2) : isoMin.toFixed(2)}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Max</label>
          <input
            data-testid="layer-isobands-max"
            type="range"
            min={sourceMin}
            max={sourceMax}
            step={0.01}
            value={isoMax}
            disabled={disabled || !enabled}
            onChange={(event) => {
              const next = parseFloat(event.target.value);
              commit({
                sectionIsoMin: Math.min(isoMin, next - 0.001),
                sectionIsoMax: next,
              });
            }}
            style={
              {
                flex: 1,
                opacity: enabled ? controlOpacity : 0.35,
                "--editor-slider-fill": rangeFill(isoMax),
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{isoMax.toFixed(2)}</span>
        </div>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Fill</span>
          <input
            data-testid="layer-isobands-bands-visible"
            type="checkbox"
            checked={bandsVisible}
            disabled={disabled || !enabled}
            onChange={(event) =>
              commit({ sectionIsoBandsVisible: event.target.checked })
            }
            style={{ opacity: enabled ? controlOpacity : 0.35 }}
          />
          <span style={{ flex: 1 }} />
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Fill alpha</label>
          <input
            data-testid="layer-isobands-band-opacity"
            type="range"
            min={0}
            max={0.85}
            step={0.01}
            value={bandOpacity}
            disabled={disabled || !enabled || !bandsVisible}
            onChange={(event) =>
              commit({ sectionIsoBandOpacity: parseFloat(event.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: enabled && bandsVisible ? controlOpacity : 0.35,
                "--editor-slider-fill": `${(bandOpacity / 0.85) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {Math.round(bandOpacity * 100)}%
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Fill offset</label>
          <input
            data-testid="layer-isobands-fill-offset"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={fillOffset}
            disabled={disabled || !enabled || !bandsVisible}
            onChange={(event) =>
              commit({ sectionIsoFillOffset: parseFloat(event.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: enabled && bandsVisible ? controlOpacity : 0.35,
                "--editor-slider-fill": `${((fillOffset + 1) / 2) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {Math.round(fillOffset * 100)}%
          </span>
        </div>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Lines</span>
          <input
            data-testid="layer-isobands-lines-visible"
            type="checkbox"
            checked={linesVisible}
            disabled={disabled || !enabled}
            onChange={(event) =>
              commit({ sectionIsoLinesVisible: event.target.checked })
            }
            style={{ opacity: enabled ? controlOpacity : 0.35 }}
          />
          <span style={{ flex: 1 }} />
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Line style</label>
          <select
            data-testid="layer-isobands-line-style"
            value={lineStyle}
            disabled={disabled || !enabled || !linesVisible}
            onChange={(event) =>
              commit({
                sectionIsoLineStyle:
                  event.target.value === "dashed" ? "dashed" : "solid",
              })
            }
            style={{
              flex: 1,
              minWidth: 0,
              opacity: enabled && linesVisible ? controlOpacity : 0.35,
            }}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
          </select>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Line width</label>
          <input
            data-testid="layer-isobands-line-width"
            type="range"
            min={0}
            max={12}
            step={0.1}
            value={lineWidth}
            disabled={disabled || !enabled || !linesVisible}
            onChange={(event) =>
              commit({ sectionIsoLineWidth: parseFloat(event.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: enabled && linesVisible ? controlOpacity : 0.35,
                "--editor-slider-fill": `${(lineWidth / 12) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{lineWidth.toFixed(1)}</span>
        </div>
      </div>
    </details>
  );
}

export function MtVolumeControls({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  sceneSectionStyle,
  sceneHandle,
  onToggleOverride,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  sceneSectionStyle: EditableStyle;
  sceneHandle: SceneHandle;
  onToggleOverride?: (enabled: boolean) => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const options = mtVolumeProductOptions(layer);
  const fallbackProduct =
    options[0]?.id ?? "mt-resistivity-forge-focused-volume";
  const selected = options.some(
    (option) => option.id === style.scalarVolumeProductId,
  )
    ? (style.scalarVolumeProductId as string)
    : fallbackProduct;
  const opacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "scalarVolumeOpacity", 0.48)),
  );
  const density = Math.max(
    0,
    Math.min(2, styleNumber(style, "scalarVolumeDensity", 0.72)),
  );
  const sampleSteps = Math.max(
    24,
    Math.min(192, styleNumber(style, "scalarVolumeSampleSteps", 112)),
  );
  const transferMode =
    style.scalarVolumeTransferMode === "soft" ||
    style.scalarVolumeTransferMode === "dense"
      ? style.scalarVolumeTransferMode
      : "balanced";
  const thresholdMin = Math.max(
    SCALAR_SOURCE_MIN,
    Math.min(
      SCALAR_SOURCE_MAX - 0.01,
      styleNumber(style, "scalarVolumeThresholdMin", SCALAR_SOURCE_MIN),
    ),
  );
  const thresholdMax = Math.max(
    thresholdMin + 0.01,
    Math.min(
      SCALAR_SOURCE_MAX,
      styleNumber(style, "scalarVolumeThresholdMax", SCALAR_SOURCE_MAX),
    ),
  );
  const maskVisible = styleBoolean(style, "scalarVolumeMaskVisible", true);
  const controlOpacity = disabled ? 0.4 : 1;
  const commit = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  const range = SCALAR_SOURCE_MAX - SCALAR_SOURCE_MIN;
  const fill = (value: number) =>
    `${Math.max(0, Math.min(100, ((value - SCALAR_SOURCE_MIN) / range) * 100))}%`;

  return (
    <>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>3D volume products</summary>
        <div style={detailsContentStyle}>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Volume</label>
            {!isEnv ? (
              <input
                type="checkbox"
                checked={!disabled}
                onChange={(e) => onToggleOverride?.(e.target.checked)}
                title="Override environment MT volume controls for this page"
              />
            ) : null}
            <select
              data-testid="mt-volume-product-select"
              value={selected}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  scalarVolumeProductId: e.target.value,
                  scalarVolumeRenderMode: "raymarch",
                })
              }
              style={{ flex: 1, opacity: controlOpacity }}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Opacity</label>
            <input
              data-testid="mt-volume-opacity"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={opacity}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  scalarVolumeOpacity: parseFloat(e.target.value),
                  opacity: parseFloat(e.target.value),
                })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${opacity * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{opacity.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Density</label>
            <input
              data-testid="mt-volume-density"
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={density}
              disabled={disabled}
              onChange={(e) =>
                commit({ scalarVolumeDensity: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${(density / 2) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{density.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Samples</label>
            <input
              data-testid="mt-volume-samples"
              type="range"
              min={24}
              max={192}
              step={4}
              value={sampleSteps}
              disabled={disabled}
              onChange={(e) =>
                commit({ scalarVolumeSampleSteps: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${((sampleSteps - 24) / (192 - 24)) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sampleSteps.toFixed(0)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Transfer</label>
            <select
              data-testid="mt-volume-transfer"
              value={transferMode}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  scalarVolumeTransferMode: e.target
                    .value as EditableStyle["scalarVolumeTransferMode"],
                })
              }
              style={{ flex: 1, opacity: controlOpacity }}
            >
              <option value="soft">Soft</option>
              <option value="balanced">Balanced</option>
              <option value="dense">Dense</option>
            </select>
          </div>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Mask</span>
            <input
              data-testid="mt-volume-mask-visible"
              type="checkbox"
              checked={maskVisible}
              disabled={disabled}
              onChange={(e) =>
                commit({ scalarVolumeMaskVisible: e.target.checked })
              }
              style={{ opacity: controlOpacity }}
            />
            <span
              style={{ flex: 1, color: vibrancyTertiaryLabel, fontSize: 11 }}
            >
              hide empty voxels
            </span>
          </label>
        </div>
      </details>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>3D cut window</summary>
        <div style={detailsContentStyle}>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Min log10</label>
            <input
              data-testid="mt-volume-threshold-min"
              type="range"
              min={SCALAR_SOURCE_MIN}
              max={SCALAR_SOURCE_MAX}
              step={0.01}
              value={thresholdMin}
              disabled={disabled}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                commit({
                  scalarVolumeThresholdMin: next,
                  scalarVolumeThresholdMax: Math.max(thresholdMax, next + 0.01),
                });
              }}
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": fill(thresholdMin),
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {thresholdMin.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Max log10</label>
            <input
              data-testid="mt-volume-threshold-max"
              type="range"
              min={SCALAR_SOURCE_MIN}
              max={SCALAR_SOURCE_MAX}
              step={0.01}
              value={thresholdMax}
              disabled={disabled}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                commit({
                  scalarVolumeThresholdMin: Math.min(thresholdMin, next - 0.01),
                  scalarVolumeThresholdMax: next,
                });
              }}
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": fill(thresholdMax),
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {thresholdMax.toFixed(2)}
            </span>
          </div>
        </div>
      </details>
      <IsobandControls
        title="3D isobands"
        style={style}
        disabled={disabled}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        rangeKind="mt"
        volumePlanes
        sceneSectionStyle={sceneSectionStyle}
        sceneHandle={sceneHandle}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
      />
    </>
  );
}

interface MtIsosurfaceProductOption {
  id: string;
  label: string;
  cropStatus: string | undefined;
}

function mtIsosurfaceProductOptions(
  layer: ProjectLayerSpec,
): MtIsosurfaceProductOption[] {
  const raw = (layer.metadata as { isosurfaceProducts?: unknown })
    .isosurfaceProducts;
  if (Array.isArray(raw)) {
    const options = raw
      .map((item) => {
        const product = item as {
          id?: unknown;
          label?: unknown;
          cropStatus?: unknown;
        };
        return typeof product.id === "string"
          ? {
              id: product.id,
              label:
                typeof product.label === "string" ? product.label : product.id,
              cropStatus:
                typeof product.cropStatus === "string"
                  ? product.cropStatus
                  : undefined,
            }
          : null;
      })
      .filter((item): item is MtIsosurfaceProductOption => item !== null);
    if (options.length > 0) return options;
  }
  return [
    {
      id: "mt-isosurface-forge-focused",
      label: "MT FORGE-focused isosurfaces",
      cropStatus: "presentation-crop",
    },
    {
      id: "mt-isosurface-full-extent",
      label: "MT full-extent isosurfaces",
      cropStatus: "full-source",
    },
  ];
}


export function MtThresholdSurfaceControls({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  onToggleOverride,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  onToggleOverride?: (enabled: boolean) => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const definitions = mtSurfaceBoundaryDefinitionsForLayer(layer);
  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const productOptions = mtIsosurfaceProductOptions(layer);
  const selectedProductId =
    typeof style.mtIsosurfaceProductId === "string"
      ? style.mtIsosurfaceProductId
      : "mt-isosurface-forge-focused";
  const [boundaryToAddId, setBoundaryToAddId] = useState("");
  const boundaryMode = mtSurfaceBoundaryMode(style);
  const boundaryOrder = mtSurfaceBoundaryOrder(style, definitions);
  const boundaries = resolveMtSurfaceBoundaries(style, definitions);
  const boundaryStyles =
    typeof style.mtSurfaceBoundariesById === "object" &&
    style.mtSurfaceBoundariesById !== null
      ? style.mtSurfaceBoundariesById
      : {};
  const opacity = Math.max(0, Math.min(1, styleNumber(style, "opacity", 0.86)));
  const legendVisible = styleBoolean(style, "mtSurfaceBoundaryLegendVisible", true);
  const wireframe = styleBoolean(style, "mtThresholdSurfaceWireframe", false);
  const roughness = Math.max(
    0,
    Math.min(1, styleNumber(style, "mtThresholdSurfaceRoughness", 0.64)),
  );
  const metalness = Math.max(
    0,
    Math.min(1, styleNumber(style, "mtThresholdSurfaceMetalness", 0)),
  );
  const emissiveBoost = Math.max(
    0,
    Math.min(1, styleNumber(style, "mtThresholdSurfaceEmissiveBoost", 0.08)),
  );
  const wireframeOpacity = Math.max(
    0,
    Math.min(
      1,
      styleNumber(style, "mtThresholdSurfaceWireframeOpacity", 0.42),
    ),
  );
  const surfaceSide =
    style.mtThresholdSurfaceSide === "front" ? "front" : "double";
  const smoothNormals = styleBoolean(
    style,
    "mtThresholdSurfaceSmoothNormals",
    true,
  );
  const wireframeColor = styleString(
    style,
    "mtThresholdSurfaceWireframeColor",
    "#f8f4e8",
  );
  const controlOpacity = disabled ? 0.4 : 1;
  const commit = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  const updateBoundary = (
    id: string,
    patch: Partial<NonNullable<EditableStyle["mtSurfaceBoundariesById"]>[string]>,
  ) => {
    const definition = definitionsById.get(id);
    const current =
      boundaryStyles[id] ??
      (definition ? boundaryStyleFromDefinition(definition) : {});
    commit({
      mtSurfaceBoundaryOrder: boundaryOrder.includes(id)
        ? boundaryOrder
        : [...boundaryOrder, id],
      mtSurfaceBoundariesById: {
        ...boundaryStyles,
        [id]: {
          ...current,
          ...patch,
        },
      },
    });
  };
  const removeBoundary = (id: string) => {
    const nextById = { ...boundaryStyles };
    delete nextById[id];
    commit({
      mtSurfaceBoundaryOrder: boundaryOrder.filter((boundaryId) => boundaryId !== id),
      mtSurfaceBoundariesById: nextById,
    });
  };
  const availableBoundaries = definitions.filter(
    (definition) => !boundaryOrder.includes(definition.id),
  );
  const addBoundary = () => {
    if (boundaryMode === "live-compute") {
      const id = liveBoundaryId();
      const thresholdOhmM = 30;
      commit({
        mtSurfaceBoundaryOrder: [...boundaryOrder, id],
        mtSurfaceBoundariesById: {
          ...boundaryStyles,
          [id]: {
            visible: true,
            label: "<=30 Ohm-m live",
            color: "#f8dd6d",
            comparison: "<=",
            thresholdOhmM,
            thresholdLog10: Math.log10(thresholdOhmM),
            opacity: 1,
            source: "live",
          },
        },
      });
      return;
    }
    const definition =
      availableBoundaries.find((boundary) => boundary.id === boundaryToAddId) ??
      availableBoundaries[0];
    if (definition) {
      commit({
        mtSurfaceBoundaryOrder: [...boundaryOrder, definition.id],
        mtSurfaceBoundariesById: {
          ...boundaryStyles,
          [definition.id]: boundaryStyleFromDefinition(definition, true),
        },
      });
      return;
    }
  };
  return (
    <details style={nestedDetailsStyle}>
      <summary style={panelStyles.summary}>Surface boundaries</summary>
      <div style={detailsContentStyle}>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Surfaces</label>
          {!isEnv ? (
            <input
              type="checkbox"
              checked={!disabled}
              onChange={(e) => onToggleOverride?.(e.target.checked)}
              title="Override environment threshold-surface controls for this page"
            />
          ) : null}
          <span
            style={{
              flex: 1,
              color: vibrancyTertiaryLabel,
              fontSize: 11,
              opacity: controlOpacity,
            }}
          >
            source-derived iso-resistivity
          </span>
        </div>
        <EnvSelectRow<string>
          label="Product"
          value={selectedProductId}
          testId="mt-isosurface-product"
          options={productOptions.map((option) => ({
            value: option.id,
            label:
              option.cropStatus === "presentation-crop"
                ? `${option.label} (crop)`
                : option.label,
          }))}
          disabled={disabled}
          onChange={(value) => commit({ mtIsosurfaceProductId: value })}
        />
        <EnvSelectRow<"precomputed-bank" | "live-compute">
          label="Mode"
          value={boundaryMode}
          testId="mt-surface-boundary-mode"
          options={[
            { value: "precomputed-bank", label: "Precomputed bank" },
            { value: "live-compute", label: "Live compute (expert)" },
          ]}
          disabled={disabled}
          onChange={(value) => commit({ mtSurfaceBoundaryMode: value })}
        />
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Legend</span>
          <input
            type="checkbox"
            checked={legendVisible}
            disabled={disabled}
            onChange={(e) =>
              commit({ mtSurfaceBoundaryLegendVisible: e.target.checked })
            }
            style={{ opacity: controlOpacity }}
          />
          <span style={{ flex: 1 }} />
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Master opacity</label>
          <input
            data-testid="mt-threshold-opacity"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            disabled={disabled}
            onChange={(e) => commit({ opacity: parseFloat(e.target.value) })}
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${opacity * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{opacity.toFixed(2)}</span>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {boundaries.map((boundary) => (
            <div
              key={boundary.id}
              style={{
                display: "grid",
                gap: 6,
                padding: "8px 0",
                borderTop: FROSTED_HAIRLINE,
              }}
            >
              <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                <span style={nestedFieldLabelStyle}>Visible</span>
                <input
                  data-testid={`mt-threshold-${boundary.id}`}
                  type="checkbox"
                  checked={boundary.visible}
                  disabled={disabled}
                  onChange={(e) =>
                    updateBoundary(boundary.id, { visible: e.target.checked })
                  }
                  style={{ opacity: controlOpacity }}
                />
                <input
                  type="color"
                  value={boundary.color}
                  disabled={disabled}
                  onChange={(e) =>
                    updateBoundary(boundary.id, { color: e.target.value })
                  }
                  style={{ opacity: controlOpacity }}
                />
              </label>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Label</label>
                <input
                  type="text"
                  value={boundary.label}
                  disabled={disabled}
                  onChange={(e) =>
                    updateBoundary(boundary.id, { label: e.target.value })
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                />
              </div>
              <EnvSelectRow<MtSurfaceBoundaryComparison>
                label="Compare"
                value={boundary.comparison}
                testId={`mt-threshold-comparison-${boundary.id}`}
                options={[
                  { value: "<=", label: "<=" },
                  { value: ">=", label: ">=" },
                ]}
                disabled={disabled || boundaryMode === "precomputed-bank"}
                onChange={(value) =>
                  updateBoundary(boundary.id, { comparison: value })
                }
              />
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Ohm-m</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.1}
                  value={Number.isFinite(boundary.thresholdOhmM) ? boundary.thresholdOhmM : 0}
                  disabled={disabled || boundaryMode === "precomputed-bank"}
                  onChange={(e) => {
                    const thresholdOhmM = parseFloat(e.target.value);
                    if (!(thresholdOhmM > 0)) return;
                    updateBoundary(boundary.id, {
                      thresholdOhmM,
                      thresholdLog10: Math.log10(thresholdOhmM),
                    });
                  }}
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                />
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>log10 rho</label>
                <input
                  type="number"
                  step={0.01}
                  value={
                    Number.isFinite(boundary.thresholdLog10)
                      ? boundary.thresholdLog10.toFixed(3)
                      : "0"
                  }
                  disabled={disabled || boundaryMode === "precomputed-bank"}
                  onChange={(e) => {
                    const thresholdLog10 = parseFloat(e.target.value);
                    if (!Number.isFinite(thresholdLog10)) return;
                    updateBoundary(boundary.id, {
                      thresholdLog10,
                      thresholdOhmM: 10 ** thresholdLog10,
                    });
                  }}
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                />
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Boundary opacity</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={boundary.opacity}
                  disabled={disabled}
                  onChange={(e) =>
                    updateBoundary(boundary.id, {
                      opacity: parseFloat(e.target.value),
                    })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${boundary.opacity * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {boundary.opacity.toFixed(2)}
                </span>
              </div>
              <div style={nestedControlRowStyle}>
                <span style={nestedFieldLabelStyle}>Boundary</span>
                <button
                  type="button"
                  className="editor-action-button"
                  disabled={disabled}
                  onClick={() => removeBoundary(boundary.id)}
                >
                  Remove
                </button>
                <span style={{ flex: 1 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ ...nestedControlRowStyle, marginTop: 8 }}>
          <span style={nestedFieldLabelStyle}>Bank</span>
          {boundaryMode === "precomputed-bank" ? (
            <select
              value={
                availableBoundaries.some(
                  (boundary) => boundary.id === boundaryToAddId,
                )
                  ? boundaryToAddId
                  : (availableBoundaries[0]?.id ?? "")
              }
              disabled={disabled || availableBoundaries.length === 0}
              onChange={(e) => setBoundaryToAddId(e.target.value)}
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              {availableBoundaries.map((boundary) => (
                <option key={boundary.id} value={boundary.id}>
                  {boundary.label}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className="editor-action-button"
            disabled={disabled}
            onClick={addBoundary}
          >
            Add boundary
          </button>
          <span style={{ color: vibrancyTertiaryLabel, fontSize: 11 }}>
            {availableBoundaries.length} available
          </span>
        </div>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Diagnostic wireframe</span>
          <input
            type="checkbox"
            checked={wireframe}
            disabled={disabled}
            onChange={(e) =>
              commit({ mtThresholdSurfaceWireframe: e.target.checked })
            }
            style={{ opacity: controlOpacity }}
          />
          <span style={{ flex: 1 }} />
        </label>
        <EnvSelectRow<"double" | "front">
          label="Surface side"
          value={surfaceSide}
          testId="mt-threshold-side"
          options={[
            { value: "double", label: "Double-sided" },
            { value: "front", label: "Front only" },
          ]}
          disabled={disabled}
          onChange={(value) => commit({ mtThresholdSurfaceSide: value })}
        />
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Smooth normals</span>
          <input
            type="checkbox"
            checked={smoothNormals}
            disabled={disabled}
            onChange={(e) =>
              commit({ mtThresholdSurfaceSmoothNormals: e.target.checked })
            }
            style={{ opacity: controlOpacity }}
          />
          <span style={{ flex: 1 }} />
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Roughness</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={roughness}
            disabled={disabled}
            onChange={(e) =>
              commit({
                mtThresholdSurfaceRoughness: parseFloat(e.target.value),
              })
            }
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${roughness * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{roughness.toFixed(2)}</span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Metalness</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={metalness}
            disabled={disabled}
            onChange={(e) =>
              commit({
                mtThresholdSurfaceMetalness: parseFloat(e.target.value),
              })
            }
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${metalness * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{metalness.toFixed(2)}</span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Light boost</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={emissiveBoost}
            disabled={disabled}
            onChange={(e) =>
              commit({
                mtThresholdSurfaceEmissiveBoost: parseFloat(e.target.value),
              })
            }
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${emissiveBoost * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {emissiveBoost.toFixed(2)}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Wire color</label>
          <input
            type="color"
            value={wireframeColor}
            disabled={disabled}
            onChange={(e) =>
              commit({ mtThresholdSurfaceWireframeColor: e.target.value })
            }
            style={{ opacity: controlOpacity }}
          />
          <span style={{ flex: 1 }} />
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Wire opacity</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={wireframeOpacity}
            disabled={disabled}
            onChange={(e) =>
              commit({
                mtThresholdSurfaceWireframeOpacity: parseFloat(e.target.value),
              })
            }
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${wireframeOpacity * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {wireframeOpacity.toFixed(2)}
          </span>
        </div>
      </div>
    </details>
  );
}


interface MtStationQcVariant {
  variant: string;
  frequencyHzMin: number | null;
  frequencyHzMax: number | null;
  spectraBlockCount: number;
  directResponseSections?: string[];
  responseCurvesAvailable?: boolean;
}

interface MtStationQcStation {
  stationId: string;
  displayName?: string;
  selectedVariant?: string;
  variants?: MtStationQcVariant[];
  qc?: {
    variantCount?: number;
    spectraBlockCount?: number;
    spectraRowCount?: number;
    frequencyHzMin?: number | null;
    frequencyHzMax?: number | null;
    responseCurvesAvailable?: boolean;
    responseCurveStatus?: string;
  };
}

interface MtStationQcPayload {
  stationCount: number;
  ediFileCount: number;
  spectraStations: number;
  responseCurveStations: number;
  frequencyHzRange: [number, number] | null;
  stations: MtStationQcStation[];
}

export function MtStationQcControls({
  layer,
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const [qc, setQc] = useState<MtStationQcPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const stationQcPath = (layer as { supportFiles?: Record<string, string> })
    .supportFiles?.stationQc;

  useEffect(() => {
    let cancelled = false;
    if (!stationQcPath) {
      setQc(null);
      setLoadError("Station QC artifact is not registered.");
      return;
    }
    fetch(appAssetUrl(stationQcPath))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<MtStationQcPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        setQc(payload);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setQc(null);
        setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [stationQcPath]);

  const selectedStationId =
    typeof style.mtStationQcSelectedStationId === "string"
      ? style.mtStationQcSelectedStationId
      : (qc?.stations?.[0]?.stationId ?? "");
  const selected = qc?.stations?.find(
    (station) => station.stationId === selectedStationId,
  );
  const commit = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };

  return (
    <details style={nestedDetailsStyle}>
      <summary style={panelStyles.summary}>2D MT station response / QC</summary>
      <div style={detailsContentStyle}>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Station</label>
          <select
            data-testid="mt-station-qc-select"
            value={selectedStationId}
            onChange={(e) =>
              commit({ mtStationQcSelectedStationId: e.target.value })
            }
            style={{ flex: 1 }}
          >
            {(qc?.stations ?? []).map((station) => (
              <option key={station.stationId} value={station.stationId}>
                {station.stationId}
              </option>
            ))}
          </select>
        </div>
        <div style={miniInfoGridStyle}>
          <span>Stations</span>
          <strong>{qc?.stationCount ?? "--"}</strong>
          <span>EDI files</span>
          <strong>{qc?.ediFileCount ?? "--"}</strong>
          <span>Freq. range</span>
          <strong>
            {qc?.frequencyHzRange
              ? `${qc.frequencyHzRange[0].toExponential(2)}-${qc.frequencyHzRange[1].toFixed(2)} Hz`
              : "--"}
          </strong>
          <span>Curves</span>
          <strong>{qc?.responseCurveStations ?? 0}</strong>
        </div>
        {selected ? (
          <div style={miniInfoGridStyle}>
            <span>Selected</span>
            <strong>{selected.stationId}</strong>
            <span>Variants</span>
            <strong>
              {selected.qc?.variantCount ?? selected.variants?.length ?? "--"}
            </strong>
            <span>Spectra</span>
            <strong>{selected.qc?.spectraBlockCount ?? "--"}</strong>
            <span>Coverage</span>
            <strong>
              {selected.qc?.frequencyHzMin && selected.qc?.frequencyHzMax
                ? `${selected.qc.frequencyHzMin.toExponential(2)}-${selected.qc.frequencyHzMax.toFixed(2)} Hz`
                : "--"}
            </strong>
          </div>
        ) : null}
        <div style={{ ...panelStyles.muted, lineHeight: 1.35 }}>
          {selected?.qc?.responseCurveStatus ??
            loadError ??
            "Spectra metadata is parsed; apparent resistivity/phase curves are shown only when directly present in source EDI."}
        </div>
      </div>
    </details>
  );
}

export function ResistivitySliceControls({
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
}: {
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const visibility =
    typeof style.resistivitySliceVisibility === "object" &&
    style.resistivitySliceVisibility !== null
      ? (style.resistivitySliceVisibility as Record<string, boolean>)
      : {};
  const sliceMode = style.resistivitySliceMode === "single" ? "single" : "stack";
  const selectedSliceId =
    mtResistivitySliceById(style.resistivitySelectedSliceId)?.id ??
    DEFAULT_MT_RESISTIVITY_SLICE_ID;
  const selectedSliceIndex = Math.max(
    0,
    MT_RESISTIVITY_SLICE_PRODUCTS.findIndex(
      (product) => product.id === selectedSliceId,
    ),
  );
  const selectedSlice =
    MT_RESISTIVITY_SLICE_PRODUCTS[selectedSliceIndex] ??
    MT_RESISTIVITY_SLICE_PRODUCTS[0];
  const sliceSelectOptions = MT_RESISTIVITY_SLICE_PRODUCTS.map((product) => ({
    value: product.id,
    label: product.label,
  }));
  const updateSliceStyle = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  const setSelectedSlice = (id: string) => {
    updateSliceStyle({
      resistivitySliceMode: "single",
      resistivitySelectedSliceId: id,
    });
  };
  const setSliceVisible = (id: string, checked: boolean) => {
    const next = { ...visibility, [id]: checked };
    updateSliceStyle({ resistivitySliceVisibility: next });
  };

  return (
    <>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>2D slice products</summary>
        <div style={detailsContentStyle}>
          <EnvSelectRow<"stack" | "single">
            label="Mode"
            value={sliceMode}
            testId="mt-slice-mode"
            options={[
              { value: "stack", label: "Stack" },
              { value: "single", label: "Single slice" },
            ]}
            onChange={(value) =>
              updateSliceStyle({
                resistivitySliceMode: value,
                resistivitySelectedSliceId: selectedSliceId,
              })
            }
          />
          <EnvSelectRow<string>
            label="Active slice"
            value={selectedSlice.id}
            testId="mt-slice-select"
            options={sliceSelectOptions}
            onChange={setSelectedSlice}
          />
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Depth slider</label>
            <input
              type="range"
              min={0}
              max={MT_RESISTIVITY_SLICE_PRODUCTS.length - 1}
              step={1}
              value={selectedSliceIndex}
              data-testid="mt-slice-depth-slider"
              onChange={(event) => {
                const next =
                  MT_RESISTIVITY_SLICE_PRODUCTS[
                    Number.parseInt(event.target.value, 10)
                  ] ?? MT_RESISTIVITY_SLICE_PRODUCTS[0];
                setSelectedSlice(next.id);
              }}
              style={{ flex: 1 }}
            />
            <span style={sliderNumberReadoutStyle}>{selectedSlice.label}</span>
          </div>
          <LayerBooleanStyleControl
            label="Horiz. slices"
            field="resistivityHorizontalSlicesVisible"
            fallback={true}
            style={style}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
            clearPageLayerOverride={clearPageLayerOverride}
          />
          <LayerBooleanStyleControl
            label="Vertical sections"
            field="resistivityVerticalSectionsVisible"
            fallback={true}
            style={style}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
            clearPageLayerOverride={clearPageLayerOverride}
          />
          <LayerBooleanStyleControl
            label="Top trace"
            field="resistivitySectionTopTraceVisible"
            fallback={true}
            style={style}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
            clearPageLayerOverride={clearPageLayerOverride}
          />
          <details style={nestedDetailsStyle}>
            <summary style={panelStyles.summary}>Slice visibility</summary>
            <div style={detailsContentStyle}>
              {MT_RESISTIVITY_SLICE_PRODUCTS.map((option) => (
                <EzGammaCheckboxRow
                  key={option.id}
                  label={option.label}
                  checked={visibility[option.id] !== false}
                  onChange={(checked) => setSliceVisible(option.id, checked)}
                />
              ))}
              {!isEnv && currentPage ? (
                <button
                  type="button"
                  style={panelStyles.secondaryButton}
                  onClick={() =>
                    clearPageLayerOverride(
                      currentPage.id,
                      layerId,
                      "resistivitySliceVisibility",
                    )
                  }
                >
                  Clear page slice override
                </button>
              ) : null}
            </div>
          </details>
        </div>
      </details>
      <IsobandControls
        title="2D isobands"
        style={style}
        disabled={false}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        rangeKind="mt"
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
      />
    </>
  );
}
