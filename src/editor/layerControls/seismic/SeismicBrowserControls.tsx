import type React from "react";
import { panelStyles, vibrancySecondaryLabel, vibrancyTertiaryLabel } from "../../styles";
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
import { SeismicDisplayTuningControls } from "./SeismicDisplayTuningControls";
import { SeismicProductVisibilityControls } from "./SeismicProductVisibilityControls";
import {
  isVelocityProduct,
  seismicAudienceModeFromStyle,
  seismicAudiencePresets,
  seismicColormapFromValue,
  seismicDefaultProductId,
  seismicExportLayouts,
  seismicPresetPatch,
  seismicProductOptions,
  seismicProductVisibilityFromStyle,
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


      <details
        data-testid="seismic-technical-controls"
        style={nestedDetailsStyle}
      >
        <summary style={panelStyles.summary}>Technical controls</summary>
        <div style={detailsContentStyle}>
          <SeismicProductVisibilityControls
            products={products}
            productVisibility={productVisibility}
            productId={productId}
            visibleProductCount={visibleProductCount}
            disabled={disabled}
            controlOpacity={controlOpacity}
            setVisibilityForProducts={setVisibilityForProducts}
            setProductVisible={setProductVisible}
            selectProduct={selectProduct}
          />

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
            <label style={nestedFieldLabelStyle}>RenderMode</label>
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

          <SeismicDisplayTuningControls
            style={style}
            disabled={disabled}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            sceneSectionStyle={sceneSectionStyle}
            sceneHandle={sceneHandle}
            selectedProduct={selectedProduct}
            renderMode={renderMode}
            amplitudeMin={amplitudeMin}
            amplitudeMax={amplitudeMax}
            amplitudeGamma={amplitudeGamma}
            colormap={colormap}
            legendVisible={legendVisible}
            removeBackground={removeBackground}
            backgroundCutoff={backgroundCutoff}
            volumeSampleSteps={volumeSampleSteps}
            timeScale={timeScale}
            navigationVisible={navigationVisible}
            controlOpacity={controlOpacity}
            commit={commit}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
          />
        </div>
      </details>
    </>
  );
}
