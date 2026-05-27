import { useState } from "react";
import type React from "react";
import { panelStyles, vibrancyLabel, vibrancySecondaryLabel, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
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
  type PageStyleSetter,
} from "../../styleControls";
import type { EditableStyle, PresentationPage, ProjectLayerSpec } from "../../../pages/types";
import type { SceneHandle } from "../../../scene";
import { UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID } from "../../../projectModules/utahForge/layerIds";
import { IsobandControls } from "../mt/IsobandControls";
import {
  isVelocityProduct,
  seismicAudienceModeFromStyle,
  seismicAudiencePresets,
  seismicCapabilityPresets,
  seismicColormapFromValue,
  seismicDefaultProductId,
  seismicExportLayouts,
  seismicPresetPatch,
  seismicProductOptions,
  seismicProductVisibilityFromStyle,
  seismicWindowValueLabel,
  SEISMIC_AUDIENCE_MODE_OPTIONS,
  SEISMIC_DEMO_DISCLOSURE_LABELS,
  type SeismicProductOption,
} from "./seismicModel";
export function SeismicBrowserControls({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  overridden,
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
  overridden: boolean;
  sceneSectionStyle: EditableStyle;
  sceneHandle: SceneHandle;
  onToggleOverride?: (enabled: boolean) => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
}) {
  const products = seismicProductOptions(layer);
  const presets = seismicAudiencePresets(layer);
  const capabilityPresets = seismicCapabilityPresets(layer);
  const exportLayouts = seismicExportLayouts(layer);
  const defaultProductId = seismicDefaultProductId(layer);
  const rawProductId = styleString(style, "seismicProductId", defaultProductId);
  const productId = products.some((product) => product.id === rawProductId)
    ? rawProductId
    : defaultProductId;
  const selectedProduct = products.find((product) => product.id === productId);
  const productVisibility = seismicProductVisibilityFromStyle(
    style,
    products,
    productId,
  );
  const visibleProductCount = products.filter(
    (product) => productVisibility[product.id] === true,
  ).length;
  const audienceMode = seismicAudienceModeFromStyle(style);
  const selectedPreset =
    presets.find((preset) => preset.id === style.seismicAudiencePresetId) ??
    presets.find((preset) => preset.audienceMode === audienceMode) ??
    presets[0];
  const requestedRenderMode =
    style.seismicRenderMode === "raymarch" ? "raymarch" : "slice";
  const renderMode =
    requestedRenderMode === "raymarch" && selectedProduct?.raymarchCapable
      ? "raymarch"
      : "slice";
  const sliceAxis =
    selectedProduct?.surveyKind !== "3d"
      ? "line"
      : style.seismicSliceAxis === "crossline" ||
          style.seismicSliceAxis === "sample"
        ? style.seismicSliceAxis
        : "inline";
  const sliceFraction = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicSliceFraction", 0.5)),
  );
  const amplitudeMin = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicAmplitudeMin", 0.08)),
  );
  const amplitudeMax = Math.max(
    amplitudeMin + 0.01,
    Math.min(1, styleNumber(style, "seismicAmplitudeMax", 0.92)),
  );
  const amplitudeGamma = Math.max(
    0.35,
    Math.min(2.5, styleNumber(style, "seismicAmplitudeGamma", 1)),
  );
  const backgroundCutoff = Math.max(
    0,
    Math.min(0.45, styleNumber(style, "seismicBackgroundCutoff", 0.16)),
  );
  const volumeSampleSteps = Math.round(
    Math.max(
      24,
      Math.min(160, styleNumber(style, "seismicVolumeSampleSteps", 96)),
    ),
  );
  const timeScale = Math.max(
    0.25,
    Math.min(8, styleNumber(style, "seismicTimeScale", 2)),
  );
  const navigationVisible = styleBoolean(
    style,
    "seismicNavigationVisible",
    true,
  );
  const colormap = seismicColormapFromValue(style.seismicColormap);
  const removeBackground = styleBoolean(
    style,
    "seismicRemoveBackground",
    false,
  );
  const legendVisible = styleBoolean(style, "seismicLegendVisible", true);
  const sliceThroughVolume =
    selectedProduct?.raymarchCapable === true &&
    styleBoolean(style, "seismicSliceThroughVolume", false);
  const selectedProductVisible = productVisibility[productId] === true;
  const seismicOpacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "opacity", 0.62)),
  );
  const controlOpacity = disabled ? 0.4 : 1;
  const exportLayoutId =
    typeof style.seismicExportLayoutId === "string"
      ? style.seismicExportLayoutId
      : selectedPreset?.exportLayoutId;
  const selectedExportLayout = exportLayouts.find(
    (layout) => layout.id === exportLayoutId,
  );
  const disclosureLabels =
    selectedPreset?.badges && selectedPreset.badges.length > 0
      ? selectedPreset.badges
      : SEISMIC_DEMO_DISCLOSURE_LABELS;
  const mtCoRender =
    style.seismicMtCoRender === "mt" || style.seismicMtCoRender === "integrated"
      ? style.seismicMtCoRender
      : selectedPreset?.mtCoRender === "mt" ||
          selectedPreset?.mtCoRender === "integrated"
        ? selectedPreset.mtCoRender
        : "seismic";
  const comparisonProductId =
    typeof style.seismicComparisonProductId === "string"
      ? style.seismicComparisonProductId
      : selectedPreset?.comparisonProductId;
  const comparisonMode =
    style.seismicComparisonMode === "side-by-side" ? "side-by-side" : "overlay";
  const comparisonSpacingM = Math.max(
    0,
    Math.min(3000, styleNumber(style, "seismicComparisonSpacingM", 650)),
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
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const commitLayerStyle = (
    targetLayerId: string,
    patch: Partial<EditableStyle>,
  ) => {
    if (disabled) return;
    if (isEnv) {
      setEnvLayerStyle(targetLayerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, targetLayerId, patch);
    }
  };
  const commit = (patch: Partial<EditableStyle>) => {
    commitLayerStyle(layerId, patch);
  };
  const setProductVisible = (id: string, visible: boolean) => {
    commit({
      seismicProductVisibility: {
        ...productVisibility,
        [id]: visible,
      },
    });
  };
  const setVisibilityForProducts = (
    predicate: (product: SeismicProductOption) => boolean,
  ) => {
    commit({
      seismicProductVisibility: Object.fromEntries(
        products.map((product) => [product.id, predicate(product)]),
      ),
    });
  };
  const setMtCoRender = (
    value: NonNullable<EditableStyle["seismicMtCoRender"]>,
  ) => {
    const mtPatch: Partial<EditableStyle> =
      value === "integrated"
        ? { opacity: 0.36, scalarLegendVisible: true }
        : value === "mt"
          ? { opacity: 0.48, scalarLegendVisible: true }
          : { opacity: 0.06, scalarLegendVisible: false };
    const seismicPatch: Partial<EditableStyle> = { seismicMtCoRender: value };
    if (value === "mt") {
      seismicPatch.seismicProductVisibility = Object.fromEntries(
        products.map((product) => [product.id, false]),
      );
    } else if (visibleProductCount === 0 && productId) {
      seismicPatch.seismicProductVisibility = {
        ...productVisibility,
        [productId]: true,
      };
    }
    commit(seismicPatch);
    commitLayerStyle(UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID, mtPatch);
  };
  const applyPreset = (presetId: string) => {
    const preset = presets.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    commit(seismicPresetPatch(preset, products, productId));
    if (preset.mtStylePatch) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        preset.mtStylePatch,
      );
    }
  };
  const applyCapabilityPreset = (presetId: string) => {
    const preset = capabilityPresets.find(
      (candidate) => candidate.id === presetId,
    );
    if (!preset) return;
    commit(seismicPresetPatch(preset, products, productId));
    if (preset.mtStylePatch) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        preset.mtStylePatch,
      );
    }
  };
  const selectedOnlyVisibility = (id: string) =>
    Object.fromEntries(
      products.map((product) => [product.id, product.id === id]),
    );
  const setCapabilityForProduct = (
    product: SeismicProductOption,
    mode: "slice" | "raymarch",
    syncSlice: boolean,
  ) => {
    if (!product.id) return;
    const renderMode =
      mode === "raymarch" && product.raymarchCapable ? "raymarch" : "slice";
    commit({
      seismicCapabilityPresetId: `${product.id}-${renderMode}${
        syncSlice ? "-sync" : ""
      }`,
      seismicProductId: product.id,
      seismicProductVisibility: selectedOnlyVisibility(product.id),
      seismicRenderMode: renderMode,
      seismicColormap: isVelocityProduct(product) ? "velocity" : colormap,
      seismicSliceAxis:
        product.surveyKind === "3d"
          ? sliceAxis === "line"
            ? "inline"
            : sliceAxis
          : "line",
      seismicSliceThroughVolume:
        renderMode === "raymarch" &&
        syncSlice &&
        product.raymarchCapable === true,
      seismicNavigationVisible: true,
      seismicNavigationRoleVisibility: {
        sources: true,
        receivers: true,
        lines: true,
      },
    });
  };
  const applyAudienceMode = (
    value: NonNullable<EditableStyle["seismicAudienceMode"]>,
  ) => {
    const preset = presets.find(
      (candidate) => candidate.audienceMode === value,
    );
    if (preset) {
      applyPreset(preset.id);
      return;
    }
    commit({ seismicAudienceMode: value });
  };
  const selectProduct = (id: string) => {
    const product = products.find((candidate) => candidate.id === id);
    if (!product) return;
    const patch: Partial<EditableStyle> = {
      seismicProductId: id,
      seismicAudiencePresetId: undefined,
      seismicColormap: isVelocityProduct(product) ? "velocity" : colormap,
      seismicProductVisibility: {
        ...productVisibility,
        [id]: true,
      },
    };
    if (!product.raymarchCapable && renderMode === "raymarch") {
      patch.seismicRenderMode = "slice";
      patch.seismicSliceThroughVolume = false;
    }
    if (product.surveyKind !== "3d") {
      patch.seismicSliceAxis = "line";
    } else if (sliceAxis === "line") {
      patch.seismicSliceAxis = "inline";
    }
    commit(patch);
  };
  const setComparisonProduct = (id: string) => {
    if (id === "none") {
      commit({ seismicComparisonProductId: undefined });
      return;
    }
    commit({
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
  const productKindCounts = products.reduce<Record<string, number>>(
    (counts, product) => {
      const key = product.productKind ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const surveyCounts = products.reduce<Record<string, number>>(
    (counts, product) => {
      const key = product.surveyKind ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const raymarchProducts = products.filter(
    (product) => product.raymarchCapable === true,
  );
  const lineTheatreActions = [
    { id: "line-301-theatre", label: "Line 301" },
    { id: "line-302-theatre", label: "Line 302" },
    { id: "legacy-l5-l11-theatre", label: "L5 + L11" },
  ];
  const comparisonActions = [
    {
      label: "301",
      primary: "gdr-1141-line-301-pdm-enh",
      compare: "gdr-1141-line-301-psdm-unenh",
    },
    {
      label: "302",
      primary: "gdr-1141-line-302-psdm-enh",
      compare: "gdr-1141-line-302-psdm-unenh",
    },
    {
      label: "L5",
      primary: "gdr-1141-line-l5-psdm-enh",
      compare: "gdr-1141-line-l5-psdm-unenh",
    },
    {
      label: "L11",
      primary: "gdr-1141-line-l11-psdm-enh",
      compare: "gdr-1141-line-l11-psdm-unenh",
    },
  ].filter(
    (action) =>
      products.some((product) => product.id === action.primary) &&
      products.some((product) => product.id === action.compare),
  );
  const currentCapabilityPresetId =
    typeof style.seismicCapabilityPresetId === "string"
      ? style.seismicCapabilityPresetId
      : "";
  return (
    <>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>Seismic browser</summary>
        <div style={detailsContentStyle}>
          {presets.length > 0 ? (
            <>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Audience</label>
                <select
                  data-testid="seismic-audience-mode-select"
                  value={audienceMode}
                  disabled={disabled}
                  onChange={(e) =>
                    applyAudienceMode(
                      e.target.value as NonNullable<
                        EditableStyle["seismicAudienceMode"]
                      >,
                    )
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  {SEISMIC_AUDIENCE_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Preset</label>
                <select
                  data-testid="seismic-audience-preset-select"
                  value={selectedPreset?.id ?? ""}
                  disabled={disabled}
                  onChange={(e) => applyPreset(e.target.value)}
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                data-testid="seismic-preset-summary"
                style={{
                  margin: "4px 0 8px 0",
                  padding: "2px 0 4px 0",
                  color: vibrancyTertiaryLabel,
                  fontSize: 11,
                  lineHeight: 1.35,
                  opacity: controlOpacity,
                }}
              >
                <div style={{ color: vibrancySecondaryLabel, fontWeight: 750 }}>
                  {selectedPreset?.summary ?? "Curated seismic demo view"}
                </div>
                <div style={{ marginTop: 4 }}>
                  {disclosureLabels.join(" / ")}
                </div>
                {selectedPreset?.cameraShot ? (
                  <div style={{ marginTop: 4 }}>
                    Camera shot: {selectedPreset.cameraShot}
                  </div>
                ) : null}
                {selectedPreset?.caveats &&
                selectedPreset.caveats.length > 0 ? (
                  <div style={{ marginTop: 4 }}>
                    {selectedPreset.caveats.slice(0, 2).join(" / ")}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Controls</label>
            {!isEnv ? (
              <input
                type="checkbox"
                checked={overridden}
                onChange={(e) => onToggleOverride?.(e.target.checked)}
                title="Override environment seismic browser variables for this page"
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
              {selectedProductVisible
                ? selectedProduct?.raymarchCapable
                  ? "3D volume"
                  : "section curtain"
                : "hidden"}
            </span>
            {!isEnv ? (
              <span
                style={overridden ? overrideTagActiveStyle : overrideTagStyle}
              >
                {overridden ? "overridden" : "inherited"}
              </span>
            ) : null}
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>MT view</label>
            <select
              data-testid="seismic-mt-co-render-select"
              value={mtCoRender}
              disabled={disabled}
              onChange={(e) =>
                setMtCoRender(
                  e.target.value as NonNullable<
                    EditableStyle["seismicMtCoRender"]
                  >,
                )
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="seismic">Seismic only</option>
              <option value="mt">MT only</option>
              <option value="integrated">Integrated</option>
            </select>
          </div>

          {audienceMode === "data-room" ? (
            <div
              data-testid="seismic-data-room-summary"
              style={{
                margin: "4px 0 8px 0",
                padding: "2px 0 4px 0",
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
                opacity: controlOpacity,
              }}
            >
              <div>Products: {products.length}</div>
              <div>
                Survey:{" "}
                {Object.entries(surveyCounts)
                  .map(([key, count]) => `${key} ${count}`)
                  .join(" / ")}
              </div>
              <div>
                Type:{" "}
                {Object.entries(productKindCounts)
                  .map(([key, count]) => `${key} ${count}`)
                  .join(" / ")}
              </div>
              <div>
                Selected: {selectedProduct?.sourceSubmission ?? "source"} /{" "}
                {selectedProduct?.productKind ?? "processed"} /{" "}
                {selectedProduct?.domainUnit ?? "domain"}
              </div>
              <div>
                Confidence: measured navigation / processed seismic product
              </div>
            </div>
          ) : null}

          {audienceMode === "export" ? (
            <div
              data-testid="seismic-export-summary"
              style={{
                margin: "4px 0 8px 0",
                padding: "2px 0 4px 0",
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
                opacity: controlOpacity,
              }}
            >
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Layout</label>
                <select
                  data-testid="seismic-export-layout-select"
                  value={exportLayoutId ?? ""}
                  disabled={disabled || exportLayouts.length === 0}
                  onChange={(e) =>
                    commit({ seismicExportLayoutId: e.target.value })
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  {exportLayouts.map((layout) => (
                    <option key={layout.id} value={layout.id}>
                      {layout.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {selectedExportLayout?.output ?? "PDF-ready report visual"}
              </div>
              <div>
                {(
                  selectedExportLayout?.includes ?? [
                    "legend",
                    "scale",
                    "CRS",
                    "source",
                  ]
                ).join(" / ")}
              </div>
              <div>
                {selectedExportLayout?.caveat ??
                  "Report-supporting visual, not a compliance certification."}
              </div>
            </div>
          ) : null}
        </div>
      </details>

      {false ? (
        <>
          <details
            data-testid="seismic-capability-3d-products"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>3D volume products</summary>
            <div style={detailsContentStyle}>
              {raymarchProducts.map((product) => (
                <div
                  key={product.id}
                  style={{ ...nestedControlRowStyle, gap: 6 }}
                >
                  <label
                    style={{
                      ...nestedFieldLabelStyle,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={product.label}
                  >
                    {product.label}
                  </label>
                  {[
                    {
                      label: "Volume",
                      testId: `seismic-capability-volume-${product.id}`,
                      onClick: () =>
                        setCapabilityForProduct(product, "raymarch", false),
                    },
                    {
                      label: "Slice",
                      testId: `seismic-capability-slice-${product.id}`,
                      onClick: () =>
                        setCapabilityForProduct(product, "slice", false),
                    },
                    {
                      label: "Sync",
                      testId: `seismic-capability-sync-${product.id}`,
                      onClick: () =>
                        setCapabilityForProduct(product, "raymarch", true),
                    },
                  ].map((action) => (
                    <button
                      key={action.testId}
                      type="button"
                      data-testid={action.testId}
                      disabled={disabled}
                      onClick={action.onClick}
                      style={{
                        ...panelStyles.iconButton,
                        width: "auto",
                        padding: "3px 7px",
                        fontSize: 10,
                        opacity: controlOpacity,
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </details>

          <details
            data-testid="seismic-capability-slice-planes"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>3D slice planes</summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Plane</label>
                {[
                  { id: "inline-slice", label: "Inline" },
                  { id: "crossline-slice", label: "Crossline" },
                  { id: "time-depth-plane", label: "Time/depth" },
                ].map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    data-testid={`seismic-capability-${action.id}`}
                    disabled={disabled}
                    onClick={() => applyCapabilityPreset(action.id)}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Position</label>
                <input
                  data-testid="seismic-capability-slice-position"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={sliceFraction}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicSliceFraction: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${sliceFraction * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {sliceFraction.toFixed(2)}
                </span>
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-volume-sync"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Volume + slice sync</summary>
            <div style={detailsContentStyle}>
              <div style={{ ...nestedControlRowStyle, gap: 6 }}>
                <label style={nestedFieldLabelStyle}>Synced view</label>
                <button
                  type="button"
                  data-testid="seismic-capability-volume-slice-sync"
                  disabled={disabled}
                  onClick={() => applyCapabilityPreset("volume-slice-sync")}
                  style={{
                    ...panelStyles.iconButton,
                    width: "auto",
                    padding: "3px 7px",
                    fontSize: 10,
                    opacity: controlOpacity,
                  }}
                >
                  Apply
                </button>
                <span
                  style={{
                    flex: 1,
                    color: vibrancyTertiaryLabel,
                    fontSize: 11,
                    opacity: controlOpacity,
                  }}
                >
                  volume plus movable cut plane
                </span>
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-line-theatre"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>
              2D / legacy section theatre
            </summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Curtain</label>
                {lineTheatreActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    data-testid={`seismic-capability-${action.id}`}
                    disabled={disabled}
                    onClick={() => applyCapabilityPreset(action.id)}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-processing-comparison"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Processing comparison</summary>
            <div style={detailsContentStyle}>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Mode</label>
                <select
                  data-testid="seismic-comparison-mode-select"
                  value={comparisonMode}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({
                      seismicComparisonMode:
                        e.target.value === "side-by-side"
                          ? "side-by-side"
                          : "overlay",
                    })
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  <option value="overlay">Overlay</option>
                  <option value="side-by-side">Side-by-side</option>
                </select>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Spacing</label>
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
                <span style={sliderNumberReadoutStyle}>
                  {comparisonSpacingM.toFixed(0)} m
                </span>
              </div>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Pair</label>
                {comparisonActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    data-testid={`seismic-comparison-pair-${action.label.toLowerCase()}`}
                    disabled={disabled}
                    onClick={() =>
                      commit({
                        seismicCapabilityPresetId:
                          action.label === "301"
                            ? "enhanced-vs-unenhanced"
                            : `enhanced-vs-unenhanced-${action.label.toLowerCase()}`,
                        seismicProductId: action.primary,
                        seismicProductVisibility: Object.fromEntries(
                          products.map((product) => [
                            product.id,
                            product.id === action.primary ||
                              product.id === action.compare,
                          ]),
                        ),
                        seismicRenderMode: "slice",
                        seismicSliceAxis: "line",
                        seismicComparisonProductId: action.compare,
                        seismicComparisonMode: comparisonMode,
                      })
                    }
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-display-cleanup"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Display cleanup</summary>
            <div style={detailsContentStyle}>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Opacity</label>
                <input
                  data-testid="seismic-capability-opacity"
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={seismicOpacity}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ opacity: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${seismicOpacity * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {seismicOpacity.toFixed(2)}
                </span>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>
                  {isVelocityProduct(selectedProduct) ? "Vel min" : "Amp min"}
                </label>
                <input
                  data-testid="seismic-capability-amplitude-min"
                  type="range"
                  min={0}
                  max={0.98}
                  step={0.01}
                  value={amplitudeMin}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicAmplitudeMin: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${amplitudeMin * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {seismicWindowValueLabel(selectedProduct, amplitudeMin)}
                </span>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>
                  {isVelocityProduct(selectedProduct) ? "Vel max" : "Amp max"}
                </label>
                <input
                  data-testid="seismic-capability-amplitude-max"
                  type="range"
                  min={0.02}
                  max={1}
                  step={0.01}
                  value={amplitudeMax}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicAmplitudeMax: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${amplitudeMax * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {seismicWindowValueLabel(selectedProduct, amplitudeMax)}
                </span>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Palette</label>
                <select
                  data-testid="seismic-capability-colormap-select"
                  value={colormap}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({
                      seismicColormap: seismicColormapFromValue(e.target.value),
                    })
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  <option value="blue-white-red">Blue-white-red</option>
                  <option value="grayscale">Grayscale</option>
                  <option value="velocity">Velocity</option>
                </select>
              </div>
              <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                <span style={nestedFieldLabelStyle}>White bg</span>
                <input
                  data-testid="seismic-capability-remove-background"
                  type="checkbox"
                  checked={removeBackground}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicRemoveBackground: e.target.checked })
                  }
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
                  remove neutral fill
                </span>
              </label>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Time scale</label>
                <input
                  data-testid="seismic-capability-time-scale"
                  type="range"
                  min={0.25}
                  max={8}
                  step={0.25}
                  value={timeScale}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicTimeScale: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${
                        ((timeScale - 0.25) / 7.75) * 100
                      }%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {timeScale.toFixed(2)}
                </span>
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-survey-geometry"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Survey geometry</summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Preset</label>
                <button
                  type="button"
                  data-testid="seismic-capability-survey-geometry-preset"
                  disabled={disabled}
                  onClick={() => applyCapabilityPreset("survey-geometry")}
                  style={{
                    ...panelStyles.iconButton,
                    width: "auto",
                    padding: "3px 7px",
                    fontSize: 10,
                    opacity: controlOpacity,
                  }}
                >
                  Show survey
                </button>
              </div>
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
                  label: "Lines",
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
            </div>
          </details>

          <details
            data-testid="seismic-capability-integrated-geophysics"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Integrated geophysics</summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>View</label>
                {[
                  {
                    label: "Seismic",
                    testId: "seismic-capability-seismic-only",
                    onClick: () => setMtCoRender("seismic"),
                  },
                  {
                    label: "MT",
                    testId: "seismic-capability-mt-only",
                    onClick: () => setMtCoRender("mt"),
                  },
                  {
                    label: "Integrated",
                    testId: "seismic-capability-integrated",
                    onClick: () =>
                      applyCapabilityPreset("integrated-geophysics"),
                  },
                ].map((action) => (
                  <button
                    key={action.testId}
                    type="button"
                    data-testid={action.testId}
                    disabled={disabled}
                    onClick={action.onClick}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-data-confidence"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Data confidence</summary>
            <div
              style={{
                ...detailsContentStyle,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
              }}
            >
              <div>Products: {products.length} processed GUI products</div>
              <div>3D raymarch-capable: {raymarchProducts.length}</div>
              <div>
                Active capability:{" "}
                {currentCapabilityPresetId || "manual controls"}
              </div>
              <div>{SEISMIC_DEMO_DISCLOSURE_LABELS.join(" / ")}</div>
            </div>
          </details>
        </>
      ) : null}

      <details
        data-testid="seismic-technical-controls"
        style={nestedDetailsStyle}
        open={technicalOpen}
        onToggle={(event) =>
          setTechnicalOpen((event.currentTarget as HTMLDetailsElement).open)
        }
      >
        <summary style={panelStyles.summary}>Technical controls</summary>
        <div style={detailsContentStyle}>
          <details style={nestedDetailsStyle}>
            <summary style={panelStyles.summary}>
              Product visibility ({visibleProductCount}/{products.length})
            </summary>
            <div style={detailsContentStyle}>
              <div
                style={{
                  ...nestedControlRowStyle,
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <label style={nestedFieldLabelStyle}>Visibility</label>
                {[
                  {
                    label: "Show all",
                    testId: "seismic-products-show-all",
                    onClick: () => setVisibilityForProducts(() => true),
                  },
                  {
                    label: "Hide all",
                    testId: "seismic-products-hide-all",
                    onClick: () => setVisibilityForProducts(() => false),
                  },
                  {
                    label: "3D only",
                    testId: "seismic-products-show-3d-only",
                    onClick: () =>
                      setVisibilityForProducts(
                        (product) => product.surveyKind === "3d",
                      ),
                  },
                  {
                    label: "2D only",
                    testId: "seismic-products-show-2d-only",
                    onClick: () =>
                      setVisibilityForProducts(
                        (product) => product.surveyKind !== "3d",
                      ),
                  },
                ].map((action) => (
                  <button
                    key={action.testId}
                    type="button"
                    data-testid={action.testId}
                    disabled={disabled}
                    onClick={action.onClick}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              {products.map((product) => {
                const selected = product.id === productId;
                return (
                  <div
                    key={product.id}
                    style={{
                      ...nestedControlRowStyle,
                      borderRadius: 6,
                      background: selected
                        ? "rgba(244, 240, 232, 0.08)"
                        : "transparent",
                    }}
                  >
                    <input
                      data-testid={`seismic-product-visible-${product.id}`}
                      type="checkbox"
                      checked={productVisibility[product.id] === true}
                      disabled={disabled}
                      onChange={(e) =>
                        setProductVisible(product.id, e.target.checked)
                      }
                      title="Show or hide this product"
                      style={{ opacity: controlOpacity }}
                    />
                    <button
                      type="button"
                      data-testid={`seismic-product-row-${product.id}`}
                      disabled={disabled}
                      onClick={() => selectProduct(product.id)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        appearance: "none",
                        border: "none",
                        background: "transparent",
                        color: selected ? vibrancyLabel : vibrancyTertiaryLabel,
                        font: "inherit",
                        fontSize: 11,
                        fontWeight: selected ? 800 : 650,
                        textAlign: "left",
                        cursor: disabled ? "default" : "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        opacity: controlOpacity,
                      }}
                      title={product.label}
                    >
                      {product.label}
                    </button>
                    <span
                      style={{
                        color: vibrancyTertiaryLabel,
                        fontSize: 11,
                        opacity: controlOpacity,
                        minWidth: 54,
                        textAlign: "right",
                      }}
                    >
                      {product.raymarchCapable
                        ? "3D"
                        : (product.surveyKind ?? "2D")}
                      {product.domainUnit ? ` / ${product.domainUnit}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Product</label>
            <select
              data-testid="seismic-product-select"
              value={productId}
              disabled={disabled || products.length === 0}
              onChange={(e) => selectProduct(e.target.value)}
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </select>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Compare</label>
            <select
              data-testid="seismic-comparison-product-select"
              value={comparisonProductId ?? "none"}
              disabled={disabled}
              onChange={(e) => setComparisonProduct(e.target.value)}
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="none">None</option>
              {products
                .filter((product) => product.id !== productId)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.label}
                  </option>
                ))}
            </select>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Mode</label>
            <select
              data-testid="seismic-render-mode-select"
              value={renderMode}
              disabled={disabled || !selectedProduct?.raymarchCapable}
              onChange={(e) =>
                commit({
                  seismicRenderMode:
                    e.target.value === "raymarch" ? "raymarch" : "slice",
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="slice">Slice</option>
              {selectedProduct?.raymarchCapable ? (
                <option value="raymarch">Raymarch</option>
              ) : null}
            </select>
          </div>

          {selectedProduct?.raymarchCapable ? (
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Sync slice</span>
              <input
                data-testid="seismic-slice-through-volume"
                type="checkbox"
                checked={sliceThroughVolume}
                disabled={disabled}
                onChange={(e) =>
                  commit({ seismicSliceThroughVolume: e.target.checked })
                }
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
                through volume
              </span>
            </label>
          ) : null}

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Slice</label>
            <select
              data-testid="seismic-slice-axis-select"
              value={sliceAxis}
              disabled={
                disabled || (renderMode === "raymarch" && !sliceThroughVolume)
              }
              onChange={(e) =>
                commit({
                  seismicSliceAxis: e.target.value as NonNullable<
                    EditableStyle["seismicSliceAxis"]
                  >,
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              {selectedProduct?.surveyKind === "3d" ? (
                <>
                  <option value="inline">Inline</option>
                  <option value="crossline">Crossline</option>
                  <option value="sample">Time/depth plane</option>
                </>
              ) : (
                <option value="line">2D line</option>
              )}
            </select>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Position</label>
            <input
              data-testid="seismic-slice-fraction"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sliceFraction}
              disabled={
                disabled || (renderMode === "raymarch" && !sliceThroughVolume)
              }
              onChange={(e) =>
                commit({ seismicSliceFraction: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${sliceFraction * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sliceFraction.toFixed(2)}
            </span>
          </div>

          <IsobandControls
            style={style}
            disabled={disabled}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            rangeKind="seismic"
            volumePlanes={
              selectedProduct?.raymarchCapable === true &&
              renderMode === "raymarch"
            }
            sceneSectionStyle={sceneSectionStyle}
            sceneHandle={sceneHandle}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
          />

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>
              {isVelocityProduct(selectedProduct) ? "Vel min" : "Amp min"}
            </label>
            <input
              data-testid="seismic-amplitude-min"
              type="range"
              min={0}
              max={0.98}
              step={0.01}
              value={amplitudeMin}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicAmplitudeMin: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${amplitudeMin * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(selectedProduct, amplitudeMin)}
            </span>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>
              {isVelocityProduct(selectedProduct) ? "Vel max" : "Amp max"}
            </label>
            <input
              data-testid="seismic-amplitude-max"
              type="range"
              min={0.02}
              max={1}
              step={0.01}
              value={amplitudeMax}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicAmplitudeMax: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${amplitudeMax * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(selectedProduct, amplitudeMax)}
            </span>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Gain curve</label>
            <input
              data-testid="seismic-amplitude-gamma"
              type="range"
              min={0.35}
              max={2.5}
              step={0.05}
              value={amplitudeGamma}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicAmplitudeGamma: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${
                    ((amplitudeGamma - 0.35) / 2.15) * 100
                  }%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {amplitudeGamma.toFixed(2)}
            </span>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Palette</label>
            <select
              data-testid="seismic-colormap-select"
              value={colormap}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  seismicColormap: seismicColormapFromValue(e.target.value),
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="blue-white-red">Blue-white-red</option>
              <option value="grayscale">Grayscale</option>
              <option value="velocity">Velocity</option>
            </select>
          </div>

          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Legend</span>
            <input
              data-testid="seismic-legend-visible"
              type="checkbox"
              checked={legendVisible}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicLegendVisible: e.target.checked })
              }
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
              amplitude controls
            </span>
          </label>

          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>White bg</span>
            <input
              data-testid="seismic-remove-background"
              type="checkbox"
              checked={removeBackground}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicRemoveBackground: e.target.checked })
              }
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
              remove neutral fill
            </span>
          </label>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Zero mute</label>
            <input
              data-testid="seismic-background-cutoff"
              type="range"
              min={0}
              max={0.45}
              step={0.01}
              value={backgroundCutoff}
              disabled={disabled || !removeBackground}
              onChange={(e) =>
                commit({ seismicBackgroundCutoff: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: removeBackground ? controlOpacity : 0.35,
                  "--editor-slider-fill": `${(backgroundCutoff / 0.45) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {backgroundCutoff.toFixed(2)}
            </span>
          </div>

          {selectedProduct?.raymarchCapable ? (
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Ray steps</label>
              <input
                data-testid="seismic-volume-sample-steps"
                type="range"
                min={24}
                max={160}
                step={8}
                value={volumeSampleSteps}
                disabled={disabled}
                onChange={(e) =>
                  commit({
                    seismicVolumeSampleSteps: parseFloat(e.target.value),
                  })
                }
                style={
                  {
                    flex: 1,
                    opacity: controlOpacity,
                    "--editor-slider-fill": `${
                      ((volumeSampleSteps - 24) / 136) * 100
                    }%`,
                  } as React.CSSProperties
                }
              />
              <span style={sliderNumberReadoutStyle}>{volumeSampleSteps}</span>
            </div>
          ) : null}

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Time scale</label>
            <input
              data-testid="seismic-time-scale"
              type="range"
              min={0.25}
              max={8}
              step={0.25}
              value={timeScale}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicTimeScale: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${
                    ((timeScale - 0.25) / 7.75) * 100
                  }%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{timeScale.toFixed(2)}</span>
          </div>

          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Navigation</span>
            <input
              data-testid="seismic-navigation-visible"
              type="checkbox"
              checked={navigationVisible}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicNavigationVisible: e.target.checked })
              }
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
              source/receiver lines
            </span>
          </label>
        </div>
      </details>
    </>
  );
}
