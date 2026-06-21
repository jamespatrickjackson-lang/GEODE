import { useState } from "react";
import type React from "react";
import { FROSTED_HAIRLINE, panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  EnvSelectRow,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  styleBoolean,
  styleNumber,
  styleString,
  type LayerStyleSetter,
  type PageStyleClearer,
  type PageStyleSetter,
} from "../../styleControls";
import type { EditableStyle, PresentationPage, ProjectLayerSpec } from "../../../pages/types";
import {
  boundaryStyleFromDefinition,
  liveBoundaryId,
  mtSurfaceBoundaryDefinitionsForLayer,
  mtSurfaceBoundaryMode,
  mtSurfaceBoundaryOrder,
  resolveMtSurfaceBoundaries,
  type MtSurfaceBoundaryComparison,
} from "../../../projectModules/utahForge/mtSurfaceBoundaries";
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
      id: "mt-isosurface-full-extent",
      label: "MT iso-resistivity surfaces",
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
      : "mt-isosurface-full-extent";
  const [boundaryToAddId, setBoundaryToAddId] = useState("");
  const boundaryMode = mtSurfaceBoundaryMode(style);
  const boundaryOrder = mtSurfaceBoundaryOrder(style, definitions);
  const boundaries = resolveMtSurfaceBoundaries(style, definitions);
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
    const visibilityPatch =
      typeof patch.visible === "boolean"
        ? {
            mtThresholdSurfaceVisibility: {
              ...legacyVisibility,
              [id]: patch.visible,
            },
          }
        : {};
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
      ...visibilityPatch,
    });
  };
  const removeBoundary = (id: string) => {
    const nextById = { ...boundaryStyles };
    delete nextById[id];
    const nextVisibility = { ...legacyVisibility };
    delete nextVisibility[id];
    commit({
      mtSurfaceBoundaryOrder: boundaryOrder.filter((boundaryId) => boundaryId !== id),
      mtSurfaceBoundariesById: nextById,
      mtThresholdSurfaceVisibility: nextVisibility,
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
        mtThresholdSurfaceVisibility: {
          ...legacyVisibility,
          [id]: true,
        },
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
        mtThresholdSurfaceVisibility: {
          ...legacyVisibility,
          [definition.id]: true,
        },
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
      <summary style={panelStyles.summary}>Iso-resistivity surfaces</summary>
      <div style={detailsContentStyle}>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Surface set</label>
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
            source-derived iso-resistivity surfaces
          </span>
        </div>
        <EnvSelectRow<string>
          label="Iso-surface product"
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
          label="Surface source"
          value={boundaryMode}
          testId="mt-surface-boundary-mode"
          options={[
            { value: "precomputed-bank", label: "Precomputed surface bank" },
            { value: "live-compute", label: "Live iso-surface solve (expert)" },
          ]}
          disabled={disabled}
          onChange={(value) => commit({ mtSurfaceBoundaryMode: value })}
        />
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Boundary legend</span>
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
          <label style={nestedFieldLabelStyle}>Surface opacity</label>
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
                <label style={nestedFieldLabelStyle}>Boundary label</label>
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
                label="Threshold relation"
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
                <label style={nestedFieldLabelStyle}>Threshold Ohm-m</label>
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
                <label style={nestedFieldLabelStyle}>Threshold log10(Ohm-m)</label>
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
              </div>
              <div style={nestedControlRowStyle}>
                <span style={nestedFieldLabelStyle}>Boundary action</span>
                <button
                  type="button"
                  className="editor-action-button"
                  disabled={disabled}
                  onClick={() => removeBoundary(boundary.id)}
                >
                  Remove surface
                </button>
                <span style={{ flex: 1 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ ...nestedControlRowStyle, marginTop: 8 }}>
          <span style={nestedFieldLabelStyle}>Surface bank</span>
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
            Add surface
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
          <label style={nestedFieldLabelStyle}>Surface roughness</label>
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
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Surface metalness</label>
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
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Surface light boost</label>
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
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Wireframe color</label>
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
          <label style={nestedFieldLabelStyle}>Wireframe opacity</label>
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
        </div>
      </div>
    </details>
  );
}

