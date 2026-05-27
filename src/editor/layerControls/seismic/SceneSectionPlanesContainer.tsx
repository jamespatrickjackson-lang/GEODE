import { useEffect, useRef } from "react";
import type React from "react";
import { panelStyles, vibrancySecondaryLabel } from "../../styles";
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
  const windowEnabled = styleBoolean(style, "sceneSectionWindowEnabled", false);
  const groundTraceVisible = styleBoolean(
    style,
    "sceneSectionGroundTraceVisible",
    true,
  );
  const axesVisible = styleBoolean(style, "sceneSectionAxesVisible", true);
  const windowByAxis = style.sceneSectionWindowByAxis ?? {};
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
  const setWindowPatch = (
    axis: "x" | "y",
    patch: { minAlongM?: number; maxAlongM?: number; bottomElevationM?: number },
  ) => {
    commit({
      sceneSectionActiveAxis: axis,
      sceneSectionWindowEnabled: true,
      sceneSectionWindowActiveAxis: axis,
      sceneSectionWindowByAxis: {
        ...windowByAxis,
        [axis]: {
          ...(windowByAxis[axis] ?? {}),
          ...patch,
        },
      },
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
              ? "3D MT threshold surfaces"
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
            color: isActiveAxis
              ? vibrancySecondaryLabel
              : panelStyles.summary.color,
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
          <summary style={panelStyles.summary}>MT section window</summary>
          <div style={detailsContentStyle}>
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Window crop</span>
              <input
                data-testid="scene-section-window-enabled"
                type="checkbox"
                disabled={disabled}
                checked={windowEnabled}
                onChange={(e) =>
                  commit({ sceneSectionWindowEnabled: e.target.checked })
                }
              />
            </label>
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Ground trace</span>
              <input
                data-testid="scene-section-ground-trace-visible"
                type="checkbox"
                disabled={disabled || !windowEnabled}
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
                disabled={disabled || !windowEnabled}
                checked={axesVisible}
                onChange={(e) =>
                  commit({ sceneSectionAxesVisible: e.target.checked })
                }
              />
            </label>
            {(["x", "y"] as const).map((axis) => {
              const axisWindow = windowByAxis[axis] ?? {};
              const minLimit = axis === "x" ? -115000 : -140000;
              const maxLimit = axis === "x" ? 115000 : 140000;
              const minAlong =
                typeof axisWindow.minAlongM === "number" &&
                Number.isFinite(axisWindow.minAlongM)
                  ? axisWindow.minAlongM
                  : minLimit;
              const maxAlong =
                typeof axisWindow.maxAlongM === "number" &&
                Number.isFinite(axisWindow.maxAlongM)
                  ? axisWindow.maxAlongM
                  : maxLimit;
              const bottomElevation =
                typeof axisWindow.bottomElevationM === "number" &&
                Number.isFinite(axisWindow.bottomElevationM)
                  ? axisWindow.bottomElevationM
                  : -25000;
              const alongLabel =
                axis === "x" ? "Northing window" : "Easting window";
              return (
                <details
                  key={axis}
                  style={nestedDetailsStyle}
                  data-testid={`scene-section-window-${axis}`}
                >
                  <summary style={panelStyles.summary}>
                    {axis.toUpperCase()} section frame
                  </summary>
                  <div style={detailsContentStyle}>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>
                        {alongLabel} min
                      </label>
                      <input
                        data-testid={`scene-section-window-${axis}-min`}
                        type="range"
                        min={minLimit}
                        max={maxLimit}
                        step={100}
                        disabled={disabled || !windowEnabled}
                        value={minAlong}
                        onChange={(e) =>
                          setWindowPatch(axis, {
                            minAlongM: parseFloat(e.target.value),
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {Math.round(minAlong)} m
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>
                        {alongLabel} max
                      </label>
                      <input
                        data-testid={`scene-section-window-${axis}-max`}
                        type="range"
                        min={minLimit}
                        max={maxLimit}
                        step={100}
                        disabled={disabled || !windowEnabled}
                        value={maxAlong}
                        onChange={(e) =>
                          setWindowPatch(axis, {
                            maxAlongM: parseFloat(e.target.value),
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {Math.round(maxAlong)} m
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Bottom elev.</label>
                      <input
                        data-testid={`scene-section-window-${axis}-bottom`}
                        type="range"
                        min={-122000}
                        max={4000}
                        step={100}
                        disabled={disabled || !windowEnabled}
                        value={bottomElevation}
                        onChange={(e) =>
                          setWindowPatch(axis, {
                            bottomElevationM: parseFloat(e.target.value),
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {(bottomElevation / 1000).toFixed(1)} km
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

