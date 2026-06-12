import type React from "react";
import { panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  EditorCompactSegmentedRow,
  detailsContentStyle,
  editorDarkSelectStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  OverrideStateIndicator,
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
  seismicColormapFromValue,
  seismicDefaultProductId,
  seismicProcessingStageLabel,
  seismicProductGroups,
  seismicProductOptions,
  seismicProductVisibilityFromStyle,
  seismicVerticalDatumModeFromStyle,
  SEISMIC_VERTICAL_DATUM_MODE_OPTIONS,
} from "./seismicModel";
export function SeismicBrowserControls({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  overridden,
  onToggleOverride,
  ensureLayerVisible,
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
  ensureLayerVisible?: () => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
}) {
  const products = seismicProductOptions(layer);
  const productGroups = seismicProductGroups(products);
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
  const colormap = seismicColormapFromValue(style.seismicColormap);
  const removeBackground = styleBoolean(
    style,
    "seismicRemoveBackground",
    false,
  );
  const legendVisible = styleBoolean(style, "seismicLegendVisible", true);
  const presentationBarVisible = styleBoolean(
    style,
    "seismicPresentationBarVisible",
    false,
  );
  const verticalDatumMode = seismicVerticalDatumModeFromStyle(style);
  const sliceThroughVolume =
    selectedProduct?.raymarchCapable === true &&
    styleBoolean(style, "seismicSliceThroughVolume", false);
  const selectedProductVisible = productVisibility[productId] === true;
  const controlOpacity = disabled ? 0.4 : 1;
  const mtCoRender =
    style.seismicMtCoRender === "mt" || style.seismicMtCoRender === "integrated"
      ? style.seismicMtCoRender
      : "seismic";
  const comparisonProductId =
    typeof style.seismicComparisonProductId === "string"
      ? style.seismicComparisonProductId
      : undefined;
  const comparisonMode =
    style.seismicComparisonMode === "side-by-side" ? "side-by-side" : "overlay";

  const commitLayerStyle = (
    targetLayerId: string,
    patch: Partial<EditableStyle>,
  ) => {
    if (disabled) return;
    if (targetLayerId === layerId && patch.visible === true) {
      ensureLayerVisible?.();
    }
    if (isEnv) {
      setEnvLayerStyle(targetLayerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, targetLayerId, patch);
    }
  };
  const commit = (patch: Partial<EditableStyle>) => {
    commitLayerStyle(layerId, patch);
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
  const selectProduct = (id: string) => {
    const product = products.find((candidate) => candidate.id === id);
    if (!product) return;
    const patch: Partial<EditableStyle> = {
      visible: true,
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
  const layerMetadata = layer.metadata as Record<string, unknown> | undefined;
  const crsRegistration =
    layerMetadata?.crsRegistration &&
    typeof layerMetadata.crsRegistration === "object"
      ? (layerMetadata.crsRegistration as Record<string, unknown>)
      : null;
  const crsStatus =
    crsRegistration?.registrationStatus === "validated"
      ? "CRS verified"
      : "CRS/datum review required";
  const crsBasis =
    typeof crsRegistration?.horizontalCrs === "string"
      ? crsRegistration.horizontalCrs
      : "unverified CRS";
  const placement = selectedProduct?.navigationPlacement;
  const placementStatus =
    placement?.navigationSource === "fallback"
      ? (placement.statusLabel ??
        "Approximate legacy line placement; precise registration not validated.")
      : placement?.canClaimPreciseRegistration === true
        ? "Precise placement claim allowed"
        : placement
          ? "Placement review required before precision claims"
          : null;
  return (
    <>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>Source and registration</summary>
        <div style={detailsContentStyle}>
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
              <OverrideStateIndicator active={overridden} />
            ) : null}
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Products</label>
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              {visibleProductCount}/{products.length} visible
            </span>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Source</label>
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              {selectedProduct?.sourceSubmission ?? "source record unavailable"}
            </span>
          </div>

          <div
            data-testid="seismic-crs-registration-status"
            style={{
              color: vibrancyTertiaryLabel,
              fontSize: 11,
              lineHeight: 1.35,
              opacity: controlOpacity,
            }}
          >
            {crsStatus} / {crsBasis}
          </div>
          {placementStatus ? (
            <div
              data-testid="seismic-placement-registration-status"
              style={{
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
                opacity: controlOpacity,
              }}
            >
              {placementStatus}
            </div>
          ) : null}
          <EditorCompactSegmentedRow
            label="Vertical datum"
            value={verticalDatumMode}
            testId="seismic-browser-vertical-datum-mode-select"
            disabled={disabled}
            controlOpacity={controlOpacity}
            options={SEISMIC_VERTICAL_DATUM_MODE_OPTIONS}
            onChange={(value) => commit({ seismicVerticalDatumMode: value })}
          />
        </div>
      </details>


      <details
        data-testid="seismic-product-display-controls"
        style={nestedDetailsStyle}
      >
        <summary style={panelStyles.summary}>Product and display</summary>
        <div style={detailsContentStyle}>
          <SeismicProductVisibilityControls
            products={products}
            productVisibility={productVisibility}
            productId={productId}
            disabled={disabled}
            controlOpacity={controlOpacity}
            commit={commit}
          />

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Product</label>
            <select
              data-testid="seismic-product-select"
              value={productId}
              disabled={disabled || products.length === 0}
              onChange={(e) => selectProduct(e.target.value)}
              style={{ ...editorDarkSelectStyle, opacity: controlOpacity }}
            >
              {productGroups.map((group) => (
                <optgroup key={group.key} label={group.label}>
                  {group.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {seismicProcessingStageLabel(product.processingStage)}:{" "}
                      {product.label}
                    </option>
                  ))}
                </optgroup>
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
              style={{ ...editorDarkSelectStyle, opacity: controlOpacity }}
            >
              <option value="none">None</option>
              {productGroups.map((group) => {
                const comparisonProducts = group.products.filter(
                  (product) => product.id !== productId,
                );
                if (comparisonProducts.length === 0) return null;
                return (
                  <optgroup key={group.key} label={group.label}>
                    {comparisonProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {seismicProcessingStageLabel(product.processingStage)}:{" "}
                        {product.label}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          <EditorCompactSegmentedRow
            label="Render mode"
            value={renderMode}
            testId="seismic-render-mode-select"
            disabled={disabled || !selectedProduct?.raymarchCapable}
            controlOpacity={controlOpacity}
            options={[
              { value: "slice", label: "Slice" },
              {
                value: "raymarch",
                label: "Raymarch",
                disabled: !selectedProduct?.raymarchCapable,
              },
            ]}
            onChange={(value) =>
              commit({
                seismicRenderMode: value === "raymarch" ? "raymarch" : "slice",
              })
            }
          />

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

          <EditorCompactSegmentedRow
            label="Slice"
            value={sliceAxis}
            testId="seismic-slice-axis-select"
            disabled={
              disabled || (renderMode === "raymarch" && !sliceThroughVolume)
            }
            controlOpacity={controlOpacity}
            options={
              selectedProduct?.surveyKind === "3d"
                ? [
                    { value: "inline", label: "Inline" },
                    { value: "crossline", label: "Crossline" },
                    { value: "sample", label: "Plane" },
                  ]
                : [{ value: "line", label: "2D line" }]
            }
            onChange={(value) =>
              commit({
                seismicSliceAxis:
                  value as NonNullable<EditableStyle["seismicSliceAxis"]>,
              })
            }
          />

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
          </div>

          <SeismicDisplayTuningControls
            disabled={disabled}
            selectedProduct={selectedProduct}
            amplitudeMin={amplitudeMin}
            amplitudeMax={amplitudeMax}
            amplitudeGamma={amplitudeGamma}
            colormap={colormap}
            legendVisible={legendVisible}
            presentationBarVisible={presentationBarVisible}
            removeBackground={removeBackground}
            backgroundCutoff={backgroundCutoff}
            volumeSampleSteps={volumeSampleSteps}
            timeScale={timeScale}
            controlOpacity={controlOpacity}
            commit={commit}
          />
        </div>
      </details>

      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>Integrated geophysics</summary>
        <div style={detailsContentStyle}>
          <EditorCompactSegmentedRow
            label="MT view"
            value={mtCoRender}
            testId="seismic-mt-co-render-select"
            disabled={disabled}
            controlOpacity={controlOpacity}
            options={[
              { value: "seismic", label: "Seismic" },
              { value: "mt", label: "MT" },
              { value: "integrated", label: "Integrated" },
            ]}
            onChange={setMtCoRender}
          />
        </div>
      </details>
    </>
  );
}
