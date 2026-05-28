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
import type { EditableStyle, PresentationPage, ProjectLayerSpec } from "../../../pages/types";
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
  const frameEnabled = styleBoolean(
    style,
    "sceneSectionFrameEnabled",
    styleBoolean(style, "sceneSectionWindowEnabled", false),
  );
  const groundTraceVisible = styleBoolean(
    style,
    "sceneSectionGroundTraceVisible",
    true,
  );
  const axesVisible = styleBoolean(style, "sceneSectionAxesVisible", true);
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
    patch: { minAM?: number; maxAM?: number; minBM?: number; maxBM?: number },
  ) => {
    const current = frameByAxis[axis] ?? {};
    const nextFrame = {
      ...current,
      ...patch,
    };
    const legacyPatch: Partial<EditableStyle> =
      axis === "x" || axis === "y"
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
    commit({
      sceneSectionActiveAxis: axis,
      sceneSectionFrameEnabled: true,
      sceneSectionFrameByAxis: {
        ...frameByAxis,
        [axis]: {
          ...nextFrame,
        },
      },
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
    x: { min: -140000, max: 140000, label: "X Section" },
    y: { min: -115000, max: 115000, label: "Y Section" },
    z: { min: -122000, max: 4000, label: "Z Section" },
  } as const;
  const controlDisabled = disabled || !enabled;

  const renderAxis = (axis: "x" | "y" | "z") => {
    const plane = planes[axis] ?? {};
    const range = axisRanges[axis];
    const isActiveAxis = axis === activeAxis;
    const planeEnabled = plane.enabled === true;
    const position =
      typeof plane.positionM === "number" && Number.isFinite(plane.positionM)
        ? plane.positionM
        : axis === "x"
          ? -6000
          : axis === "y"
            ? -10300
            : -2200;
    const fill =
      ((position - range.min) / Math.max(1, range.max - range.min)) * 100;
    return (
      <details
        key={axis}
        style={nestedDetailsStyle}
        data-testid={`scene-section-plane-${axis}`}
      >
        <summary
          style={{
            ...panelStyles.summary,
            color: sceneSectionAxisColors[axis],
          }}
        >
          {range.label}
          {isActiveAxis ? " active" : ""}
        </summary>
        <div style={detailsContentStyle}>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Enabled</span>
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
            />
          </label>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cut position</label>
            <input
              data-testid={`scene-section-plane-${axis}-position`}
              type="range"
              min={range.min}
              max={range.max}
              step={25}
              disabled={controlDisabled || !planeEnabled}
              value={position}
              onChange={(e) =>
                setPlanePatch(axis, { positionM: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${Math.max(0, Math.min(100, fill))}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {Math.round(position)} m
            </span>
          </div>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Flip side</span>
            <input
              data-testid={`scene-section-plane-${axis}-invert`}
              type="checkbox"
              disabled={controlDisabled || !planeEnabled}
              checked={plane.invert === true}
              onChange={(e) =>
                setPlanePatch(axis, { invert: e.target.checked })
              }
            />
          </label>
          <button
            type="button"
            data-testid={`scene-section-plane-${axis}-active`}
            disabled={disabled}
            onClick={() => commit({ sceneSectionActiveAxis: axis })}
            style={smallActionButtonStyle}
          >
            Make active handle
          </button>
        </div>
      </details>
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
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Frame crop</span>
              <input
                data-testid="scene-section-window-enabled"
                type="checkbox"
                disabled={disabled}
                checked={frameEnabled}
                onChange={(e) =>
                  commit({
                    sceneSectionFrameEnabled: e.target.checked,
                    sceneSectionWindowEnabled: e.target.checked,
                  })
                }
              />
            </label>
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Ground trace</span>
              <input
                data-testid="scene-section-ground-trace-visible"
                type="checkbox"
                disabled={disabled || !frameEnabled}
                checked={groundTraceVisible}
                onChange={(e) =>
                  commit({ sceneSectionGroundTraceVisible: e.target.checked })
                }
              />
            </label>
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Scale axes</span>
              <input
                data-testid="scene-section-axes-visible"
                type="checkbox"
                disabled={disabled || !frameEnabled}
                checked={axesVisible}
                onChange={(e) =>
                  commit({ sceneSectionAxesVisible: e.target.checked })
                }
              />
            </label>
            {(["x", "y", "z"] as const).map((axis) => {
              const axisFrame = frameByAxis[axis] ?? {};
              const axisWindow =
                axis === "x" || axis === "y" ? windowByAxis[axis] ?? {} : {};
              const aMinLimit = axis === "x" ? -115000 : -140000;
              const aMaxLimit = axis === "x" ? 115000 : 140000;
              const bMinLimit = axis === "z" ? -115000 : -122000;
              const bMaxLimit = axis === "z" ? 115000 : 4000;
              const minA =
                typeof axisFrame.minAM === "number" &&
                Number.isFinite(axisFrame.minAM)
                  ? axisFrame.minAM
                  : typeof axisWindow.minAlongM === "number" &&
                      Number.isFinite(axisWindow.minAlongM)
                    ? axisWindow.minAlongM
                    : aMinLimit;
              const maxA =
                typeof axisFrame.maxAM === "number" &&
                Number.isFinite(axisFrame.maxAM)
                  ? axisFrame.maxAM
                  : typeof axisWindow.maxAlongM === "number" &&
                      Number.isFinite(axisWindow.maxAlongM)
                    ? axisWindow.maxAlongM
                    : aMaxLimit;
              const minB =
                typeof axisFrame.minBM === "number" &&
                Number.isFinite(axisFrame.minBM)
                  ? axisFrame.minBM
                  : typeof axisWindow.bottomElevationM === "number" &&
                      Number.isFinite(axisWindow.bottomElevationM)
                    ? axisWindow.bottomElevationM
                    : bMinLimit;
              const maxB =
                typeof axisFrame.maxBM === "number" &&
                Number.isFinite(axisFrame.maxBM)
                  ? axisFrame.maxBM
                  : bMaxLimit;
              const aLabel =
                axis === "x" ? "Northing" : "Easting";
              const bLabel = axis === "z" ? "Northing" : "Elevation";
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
                    {axis.toUpperCase()} Section frame
                  </summary>
                  <div style={detailsContentStyle}>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>
                        {aLabel} min
                      </label>
                      <input
                        data-testid={`scene-section-frame-${axis}-min-a`}
                        type="range"
                        min={aMinLimit}
                        max={aMaxLimit}
                        step={100}
                        disabled={disabled || !frameEnabled}
                        value={minA}
                        onChange={(e) =>
                          setFramePatch(axis, {
                            minAM: parseFloat(e.target.value),
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {Math.round(minA)} m
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>
                        {aLabel} max
                      </label>
                      <input
                        data-testid={`scene-section-frame-${axis}-max-a`}
                        type="range"
                        min={aMinLimit}
                        max={aMaxLimit}
                        step={100}
                        disabled={disabled || !frameEnabled}
                        value={maxA}
                        onChange={(e) =>
                          setFramePatch(axis, {
                            maxAM: parseFloat(e.target.value),
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {Math.round(maxA)} m
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>{bLabel} min</label>
                      <input
                        data-testid={`scene-section-frame-${axis}-min-b`}
                        type="range"
                        min={bMinLimit}
                        max={bMaxLimit}
                        step={100}
                        disabled={disabled || !frameEnabled}
                        value={minB}
                        onChange={(e) =>
                          setFramePatch(axis, {
                            minBM: parseFloat(e.target.value),
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {bLabel === "Elevation"
                          ? `${(minB / 1000).toFixed(1)} km`
                          : `${Math.round(minB)} m`}
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>{bLabel} max</label>
                      <input
                        data-testid={`scene-section-frame-${axis}-max-b`}
                        type="range"
                        min={bMinLimit}
                        max={bMaxLimit}
                        step={100}
                        disabled={disabled || !frameEnabled}
                        value={maxB}
                        onChange={(e) =>
                          setFramePatch(axis, {
                            maxBM: parseFloat(e.target.value),
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {bLabel === "Elevation"
                          ? `${(maxB / 1000).toFixed(1)} km`
                          : `${Math.round(maxB)} m`}
                      </span>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </details>
        {(["x", "y", "z"] as const).map(renderAxis)}
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
