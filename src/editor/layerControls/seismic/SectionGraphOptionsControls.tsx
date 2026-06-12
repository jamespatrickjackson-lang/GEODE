import type React from "react";
import { panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  EditorCompactSegmentedRow,
  detailsContentStyle,
  editorDarkSelectStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  styleBoolean,
  styleNumber,
  styleString,
} from "../../styleControls";
import type { EditableStyle, ProjectLayerSpec } from "../../../pages/types";
import { UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID } from "../../../projectModules/utahForge/layerIds";
import { SeismicCapabilityLayerItem } from "./SeismicCapabilityLayerItem";
import {
  seismicDefaultProductId,
  seismicProcessingStageLabel,
  seismicProductGroups,
  seismicProductOptions,
  seismicProductVisibilityFromStyle,
  seismicSectionGraphOptionGroups,
  type SeismicSectionGraphOption,
} from "./seismicModel";

const compactTextInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 24,
  borderRadius: 5,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.07)",
  color: "#f6f1e8",
  fontSize: 11,
  padding: "0 7px",
};

const compactTextareaStyle: React.CSSProperties = {
  ...compactTextInputStyle,
  height: 54,
  resize: "vertical",
  padding: "5px 7px",
  lineHeight: 1.25,
};

const compactColorInputStyle: React.CSSProperties = {
  width: 34,
  height: 24,
  padding: 0,
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 5,
  background: "transparent",
};

function formatHorizonPoints(points: EditableStyle["seismicFigureHorizonPoints"]): string {
  if (!Array.isArray(points)) return "";
  return points
    .filter(
      (point): point is [number, number] =>
        Array.isArray(point) &&
        typeof point[0] === "number" &&
        Number.isFinite(point[0]) &&
        typeof point[1] === "number" &&
        Number.isFinite(point[1]),
    )
    .map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)
    .join("; ");
}

function parseHorizonPoints(text: string): Array<[number, number]> {
  return text
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): [number, number] | null => {
      const [rawX, rawY] = part.split(/[\s,]+/);
      const x = Number.parseFloat(rawX ?? "");
      const y = Number.parseFloat(rawY ?? "");
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
    })
    .filter((point): point is [number, number] => point !== null);
}

function buttonStyle(controlOpacity: number): React.CSSProperties {
  return {
    ...panelStyles.iconButton,
    width: "auto",
    padding: "3px 7px",
    fontSize: 10,
    opacity: controlOpacity,
  };
}

function optionTestId(option: SeismicSectionGraphOption): string {
  return `section-graph-option-${option.id}`;
}

export function SectionGraphOptionsControls({
  layer,
  style,
  disabled,
  controlOpacity = disabled ? 0.4 : 1,
  compact = false,
  commit,
  commitLayerStyle,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  disabled: boolean;
  controlOpacity?: number;
  compact?: boolean;
  commit: (patch: Partial<EditableStyle>) => void;
  commitLayerStyle?: (layerId: string, patch: Partial<EditableStyle>) => void;
}) {
  const products = seismicProductOptions(layer);
  const defaultProductId = seismicDefaultProductId(layer);
  const rawProductId = styleString(style, "seismicProductId", defaultProductId);
  const productId = products.some((product) => product.id === rawProductId)
    ? rawProductId
    : defaultProductId;
  const productVisibility = seismicProductVisibilityFromStyle(
    style,
    products,
    productId,
  );
  const productGroups = seismicProductGroups(products);
  const optionGroups = seismicSectionGraphOptionGroups(layer, style);
  const comparisonProductId =
    typeof style.seismicComparisonProductId === "string"
      ? style.seismicComparisonProductId
      : undefined;
  const comparisonMode =
    style.seismicComparisonMode === "side-by-side" ? "side-by-side" : "overlay";
  const comparisonSpacingM = Math.max(
    0,
    Math.min(3000, styleNumber(style, "seismicComparisonSpacingM", 650)),
  );
  const navigationVisible = styleBoolean(
    style,
    "seismicNavigationVisible",
    true,
  );
  const navigationRoleVisibility =
    typeof style.seismicNavigationRoleVisibility === "object" &&
    style.seismicNavigationRoleVisibility !== null
      ? style.seismicNavigationRoleVisibility
      : {};
  const navigationSourcesVisible = navigationRoleVisibility.sources !== false;
  const navigationReceiversVisible =
    navigationRoleVisibility.receivers !== false;
  const navigationLinesVisible = navigationRoleVisibility.lines !== false;
  const figureAnnotationsVisible = styleBoolean(
    style,
    "seismicFigureAnnotationsVisible",
    false,
  );
  const figureTitle = styleString(style, "seismicFigureTitle", "");
  const figureCaption = styleString(style, "seismicFigureCaption", "");
  const figureScaleLabel = styleString(style, "seismicFigureScaleLabel", "");
  const figureTextColor = styleString(
    style,
    "seismicFigureTextColor",
    "#f7f7f2",
  );
  const figureAxisColor = styleString(
    style,
    "seismicFigureAxisColor",
    "#f7f7f2",
  );
  const figureCaptionBoxColor = styleString(
    style,
    "seismicFigureCaptionBoxColor",
    "#050505",
  );
  const figureHorizonColor = styleString(
    style,
    "seismicFigureHorizonColor",
    "#ffcc33",
  );
  const figureWellColor = styleString(
    style,
    "seismicFigureWellColor",
    "#5875ff",
  );
  const figureCaptionBoxOpacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicFigureCaptionBoxOpacity", 0.54)),
  );
  const figureOutsideOffsetM = Math.max(
    40,
    Math.min(1500, styleNumber(style, "seismicFigureOutsideOffsetM", 240)),
  );
  const figureLabelSizeM = Math.max(
    60,
    Math.min(420, styleNumber(style, "seismicFigureLabelSizeM", 140)),
  );
  const figureWellVisible = styleBoolean(
    style,
    "seismicFigureWellVisible",
    false,
  );
  const figureWellLabel = styleString(style, "seismicFigureWellLabel", "");
  const figureWellPosition = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicFigureWellPosition", 0.5)),
  );
  const figureHorizonVisible = styleBoolean(
    style,
    "seismicFigureHorizonVisible",
    false,
  );
  const figureHorizonPointsText = formatHorizonPoints(
    style.seismicFigureHorizonPoints,
  );

  const applyOption = (option: SeismicSectionGraphOption) => {
    if (disabled) return;
    commit({
      visible: true,
      ...option.patch,
    });
    if (option.mtStylePatch && commitLayerStyle) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        option.mtStylePatch,
      );
    }
    if (option.linkedLayerStylePatches && commitLayerStyle) {
      for (const [layerId, patch] of Object.entries(option.linkedLayerStylePatches)) {
        commitLayerStyle(layerId, patch);
      }
    }
  };

  const setComparisonProduct = (id: string) => {
    if (id === "none") {
      commit({ seismicComparisonProductId: undefined });
      return;
    }
    commit({
      visible: true,
      seismicComparisonProductId: id,
      seismicComparisonMode: comparisonMode,
      seismicProductVisibility: {
        ...productVisibility,
        [id]: true,
      },
      seismicRenderMode: "slice",
    });
  };

  const setNavigationRoleVisible = (
    role: "sources" | "receivers" | "lines",
    visible: boolean,
  ) => {
    commit({
      seismicNavigationVisible: true,
      seismicNavigationRoleVisibility: {
        sources: navigationSourcesVisible,
        receivers: navigationReceiversVisible,
        lines: navigationLinesVisible,
        [role]: visible,
      },
    });
  };

  const content = (
    <div
      data-testid="seismic-section-options-controls"
      style={compact ? { minWidth: 0 } : detailsContentStyle}
    >
      {optionGroups.map((group) => (
        <details
          key={group.heading}
          open={compact || group.heading === "3D Volume"}
          style={nestedDetailsStyle}
          data-testid={`seismic-section-options-${group.heading
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}`}
        >
          <summary style={panelStyles.summary}>{group.heading}</summary>
          <div style={detailsContentStyle}>
            {group.options.length > 0 ? (
              <div
                style={{
                  ...nestedControlRowStyle,
                  alignItems: "flex-start",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <label style={nestedFieldLabelStyle}>Select</label>
                {group.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={optionTestId(option)}
                    disabled={disabled || option.disabled === true}
                    title={option.label}
                    onClick={() => applyOption(option)}
                    style={buttonStyle(controlOpacity)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {group.heading === "Processing Comparison" ? (
              <>
                <EditorCompactSegmentedRow
                  label="Mode"
                  value={comparisonMode}
                  testId="seismic-comparison-mode-select"
                  disabled={disabled}
                  controlOpacity={controlOpacity}
                  options={[
                    { value: "overlay", label: "Overlay mode" },
                    { value: "side-by-side", label: "Side-by-side mode" },
                  ]}
                  onChange={(value) =>
                    commit({
                      seismicComparisonMode:
                        value === "side-by-side" ? "side-by-side" : "overlay",
                    })
                  }
                />
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Compare</label>
                  <select
                    data-testid="seismic-comparison-product-select"
                    value={comparisonProductId ?? "none"}
                    disabled={disabled}
                    onChange={(e) => setComparisonProduct(e.target.value)}
                    style={{ ...editorDarkSelectStyle, opacity: controlOpacity }}
                  >
                    <option value="none">None</option>
                    {productGroups.map((productGroup) => {
                      const comparisonProducts = productGroup.products.filter(
                        (product) => product.id !== productId,
                      );
                      if (comparisonProducts.length === 0) return null;
                      return (
                        <optgroup
                          key={productGroup.key}
                          label={productGroup.label}
                        >
                          {comparisonProducts.map((product) => (
                            <option key={product.id} value={product.id}>
                              {seismicProcessingStageLabel(
                                product.processingStage,
                              )}
                              : {product.label}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>
                    Side-by-side spacing
                  </label>
                  <input
                    data-testid="seismic-comparison-spacing"
                    type="range"
                    min={0}
                    max={3000}
                    step={50}
                    value={comparisonSpacingM}
                    disabled={disabled || comparisonMode !== "side-by-side"}
                    onChange={(e) =>
                      commit({
                        seismicComparisonSpacingM: parseFloat(e.target.value),
                      })
                    }
                    style={
                      {
                        flex: 1,
                        opacity:
                          comparisonMode === "side-by-side"
                            ? controlOpacity
                            : 0.35,
                        "--editor-slider-fill": `${(comparisonSpacingM / 3000) * 100}%`,
                      } as React.CSSProperties
                    }
                  />
                </div>
              </>
            ) : null}

            {group.heading === "Survey Geometry" ? (
              <>
                <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                  <span style={nestedFieldLabelStyle}>Show survey geometry</span>
                  <input
                    data-testid="seismic-navigation-visible-capability"
                    type="checkbox"
                    checked={navigationVisible}
                    disabled={disabled}
                    onChange={(e) =>
                      commit({ seismicNavigationVisible: e.target.checked })
                    }
                    style={{ opacity: controlOpacity }}
                  />
                  <span style={{ flex: 1 }} />
                </label>
                {[
                  {
                    role: "sources" as const,
                    label: "Sources",
                    checked: navigationSourcesVisible,
                  },
                  {
                    role: "receivers" as const,
                    label: "Receivers",
                    checked: navigationReceiversVisible,
                  },
                  {
                    role: "lines" as const,
                    label: "Navigation lines",
                    checked: navigationLinesVisible,
                  },
                ].map((item) => (
                  <label
                    key={item.role}
                    style={{ ...nestedControlRowStyle, cursor: "pointer" }}
                  >
                    <span style={nestedFieldLabelStyle}>{item.label}</span>
                    <input
                      data-testid={`seismic-navigation-role-${item.role}`}
                      type="checkbox"
                      checked={item.checked}
                      disabled={disabled}
                      onChange={(e) =>
                        setNavigationRoleVisible(item.role, e.target.checked)
                      }
                      style={{ opacity: controlOpacity }}
                    />
                    <span style={{ flex: 1 }} />
                  </label>
                ))}
              </>
            ) : null}

            {group.heading === "Figure Annotation" ? (
              <>
                <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                  <span style={nestedFieldLabelStyle}>Frame</span>
                  <input
                    data-testid="seismic-figure-annotations-visible"
                    type="checkbox"
                    checked={figureAnnotationsVisible}
                    disabled={disabled}
                    onChange={(e) =>
                      commit({
                        seismicFigureAnnotationsVisible: e.target.checked,
                      })
                    }
                    style={{ opacity: controlOpacity }}
                  />
                  <span style={{ flex: 1 }} />
                </label>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Title</label>
                  <input
                    data-testid="seismic-figure-title"
                    type="text"
                    value={figureTitle}
                    placeholder="Auto"
                    disabled={disabled || !figureAnnotationsVisible}
                    onChange={(e) =>
                      commit({ seismicFigureTitle: e.target.value })
                    }
                    style={{
                      ...compactTextInputStyle,
                      opacity: figureAnnotationsVisible ? controlOpacity : 0.35,
                    }}
                  />
                </div>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Caption</label>
                  <textarea
                    data-testid="seismic-figure-caption"
                    value={figureCaption}
                    placeholder="Auto"
                    disabled={disabled || !figureAnnotationsVisible}
                    onChange={(e) =>
                      commit({ seismicFigureCaption: e.target.value })
                    }
                    style={{
                      ...compactTextareaStyle,
                      opacity: figureAnnotationsVisible ? controlOpacity : 0.35,
                    }}
                  />
                </div>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>
                    Scale label / scale bar
                  </label>
                  <input
                    data-testid="seismic-figure-scale-label"
                    type="text"
                    value={figureScaleLabel}
                    placeholder="Auto"
                    disabled={disabled || !figureAnnotationsVisible}
                    onChange={(e) =>
                      commit({ seismicFigureScaleLabel: e.target.value })
                    }
                    style={{
                      ...compactTextInputStyle,
                      opacity: figureAnnotationsVisible ? controlOpacity : 0.35,
                    }}
                  />
                </div>
                {[
                  "Axis ticks and depth/time heading",
                  "Direction labels",
                ].map((label) => (
                  <div key={label} style={nestedControlRowStyle}>
                    <span style={nestedFieldLabelStyle}>{label}</span>
                    <span
                      style={{
                        flex: 1,
                        color: vibrancyTertiaryLabel,
                        fontSize: 11,
                        opacity: figureAnnotationsVisible
                          ? controlOpacity
                          : 0.35,
                      }}
                    >
                      plane-locked figure frame
                    </span>
                  </div>
                ))}
                <div style={{ ...nestedControlRowStyle, gap: 8, flexWrap: "wrap" }}>
                  <label style={nestedFieldLabelStyle}>
                    Text, axis, caption box, horizon, and well colors
                  </label>
                  {[
                    {
                      key: "seismicFigureTextColor" as const,
                      testId: "seismic-figure-text-color",
                      value: figureTextColor,
                      title: "Text",
                    },
                    {
                      key: "seismicFigureAxisColor" as const,
                      testId: "seismic-figure-axis-color",
                      value: figureAxisColor,
                      title: "Axis",
                    },
                    {
                      key: "seismicFigureCaptionBoxColor" as const,
                      testId: "seismic-figure-caption-box-color",
                      value: figureCaptionBoxColor,
                      title: "Caption box",
                    },
                    {
                      key: "seismicFigureHorizonColor" as const,
                      testId: "seismic-figure-horizon-color",
                      value: figureHorizonColor,
                      title: "Horizon",
                    },
                    {
                      key: "seismicFigureWellColor" as const,
                      testId: "seismic-figure-well-color",
                      value: figureWellColor,
                      title: "Well",
                    },
                  ].map((item) => (
                    <input
                      key={item.key}
                      data-testid={item.testId}
                      type="color"
                      value={item.value}
                      title={item.title}
                      disabled={disabled || !figureAnnotationsVisible}
                      onChange={(e) => commit({ [item.key]: e.target.value })}
                      style={{
                        ...compactColorInputStyle,
                        opacity: figureAnnotationsVisible ? controlOpacity : 0.35,
                      }}
                    />
                  ))}
                </div>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Caption box</label>
                  <input
                    data-testid="seismic-figure-caption-box-opacity"
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={figureCaptionBoxOpacity}
                    disabled={disabled || !figureAnnotationsVisible}
                    onChange={(e) =>
                      commit({
                        seismicFigureCaptionBoxOpacity: parseFloat(
                          e.target.value,
                        ),
                      })
                    }
                    style={
                      {
                        flex: 1,
                        opacity: figureAnnotationsVisible ? controlOpacity : 0.35,
                        "--editor-slider-fill": `${figureCaptionBoxOpacity * 100}%`,
                      } as React.CSSProperties
                    }
                  />
                </div>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Outside offset</label>
                  <input
                    data-testid="seismic-figure-outside-offset"
                    type="range"
                    min={40}
                    max={1500}
                    step={20}
                    value={figureOutsideOffsetM}
                    disabled={disabled || !figureAnnotationsVisible}
                    onChange={(e) =>
                      commit({
                        seismicFigureOutsideOffsetM: parseFloat(
                          e.target.value,
                        ),
                      })
                    }
                    style={
                      {
                        flex: 1,
                        opacity: figureAnnotationsVisible ? controlOpacity : 0.35,
                        "--editor-slider-fill": `${((figureOutsideOffsetM - 40) / 1460) * 100}%`,
                      } as React.CSSProperties
                    }
                  />
                </div>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Text size</label>
                  <input
                    data-testid="seismic-figure-label-size"
                    type="range"
                    min={60}
                    max={420}
                    step={10}
                    value={figureLabelSizeM}
                    disabled={disabled || !figureAnnotationsVisible}
                    onChange={(e) =>
                      commit({
                        seismicFigureLabelSizeM: parseFloat(e.target.value),
                      })
                    }
                    style={
                      {
                        flex: 1,
                        opacity: figureAnnotationsVisible ? controlOpacity : 0.35,
                        "--editor-slider-fill": `${((figureLabelSizeM - 60) / 360) * 100}%`,
                      } as React.CSSProperties
                    }
                  />
                </div>
                <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                  <span style={nestedFieldLabelStyle}>
                    Well trace and well label
                  </span>
                  <input
                    data-testid="seismic-figure-well-visible"
                    type="checkbox"
                    checked={figureWellVisible}
                    disabled={disabled || !figureAnnotationsVisible}
                    onChange={(e) =>
                      commit({ seismicFigureWellVisible: e.target.checked })
                    }
                    style={{
                      opacity: figureAnnotationsVisible ? controlOpacity : 0.35,
                    }}
                  />
                  <input
                    data-testid="seismic-figure-well-label"
                    type="text"
                    value={figureWellLabel}
                    disabled={
                      disabled || !figureAnnotationsVisible || !figureWellVisible
                    }
                    onChange={(e) =>
                      commit({ seismicFigureWellLabel: e.target.value })
                    }
                    style={{
                      ...compactTextInputStyle,
                      opacity:
                        figureAnnotationsVisible && figureWellVisible
                          ? controlOpacity
                          : 0.35,
                    }}
                  />
                </label>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Well position</label>
                  <input
                    data-testid="seismic-figure-well-position"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={figureWellPosition}
                    disabled={
                      disabled || !figureAnnotationsVisible || !figureWellVisible
                    }
                    onChange={(e) =>
                      commit({
                        seismicFigureWellPosition: parseFloat(e.target.value),
                      })
                    }
                    style={
                      {
                        flex: 1,
                        opacity:
                          figureAnnotationsVisible && figureWellVisible
                            ? controlOpacity
                            : 0.35,
                        "--editor-slider-fill": `${figureWellPosition * 100}%`,
                      } as React.CSSProperties
                    }
                  />
                </div>
                <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                  <span style={nestedFieldLabelStyle}>Horizon polyline</span>
                  <input
                    data-testid="seismic-figure-horizon-visible"
                    type="checkbox"
                    checked={figureHorizonVisible}
                    disabled={disabled || !figureAnnotationsVisible}
                    onChange={(e) =>
                      commit({ seismicFigureHorizonVisible: e.target.checked })
                    }
                    style={{
                      opacity: figureAnnotationsVisible ? controlOpacity : 0.35,
                    }}
                  />
                  <span style={{ flex: 1 }} />
                </label>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Horizon points</label>
                  <textarea
                    data-testid="seismic-figure-horizon-points"
                    value={figureHorizonPointsText}
                    disabled={
                      disabled ||
                      !figureAnnotationsVisible ||
                      !figureHorizonVisible
                    }
                    onChange={(e) =>
                      commit({
                        seismicFigureHorizonPoints: parseHorizonPoints(
                          e.target.value,
                        ),
                      })
                    }
                    style={{
                      ...compactTextareaStyle,
                      opacity:
                        figureAnnotationsVisible && figureHorizonVisible
                          ? controlOpacity
                          : 0.35,
                    }}
                  />
                </div>
              </>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );

  if (compact) return content;

  return (
    <SeismicCapabilityLayerItem
      testId="seismic-section-options"
      title="Section Options"
      type="graph selector"
      visible
      visibilityDisabled
      onVisibleChange={() => undefined}
    >
      {content}
    </SeismicCapabilityLayerItem>
  );
}
