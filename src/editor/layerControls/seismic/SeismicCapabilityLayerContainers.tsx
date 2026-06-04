import { useEffect, useRef } from "react";
import type React from "react";
import { panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  EditorCompactSegmentedRow,
  EditorEyeButton,
  detailsContentStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  styleBoolean,
  styleNumber,
  styleString,
  type LayerStyleSetter,
  type PageStyleSetter,
} from "../../styleControls";
import type { EditableStyle, PresentationPage, ProjectLayerSpec } from "../../../pages/types";
import type { SceneHandle } from "../../../scene";
import { useEditor } from "../../EditorContext";
import { UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID } from "../../../projectModules/utahForge/layerIds";
import { SeismicAudienceAndDataConfidenceControls } from "./SeismicAudienceAndDataConfidenceControls";
import { SeismicCapabilityLayerItem } from "./SeismicCapabilityLayerItem";
import { SeismicProductDisplayVariables } from "./SeismicProductDisplayVariables";
import { SeismicProductVisibilityControls } from "./SeismicProductVisibilityControls";
import {
  isVelocityProduct,
  seismicColormapFromValue,
  seismicCapabilityPresets,
  seismicComparisonActions,
  seismicDefaultProductId,
  seismicPresetPatch,
  seismicProductOptions,
  seismicProductVisibilityFromStyle,
  type SeismicProductOption,
} from "./seismicModel";

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
export function SeismicCapabilityLayerContainers({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  sceneHandle,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  sceneHandle: SceneHandle;
}) {
  const { canApplyLiveSceneEdits } = useEditor();
  const products = seismicProductOptions(layer);
  const capabilityPresets = seismicCapabilityPresets(layer);
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
  const seismicOpacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "opacity", 0.62)),
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
  const figureCaptionBoxOpacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicFigureCaptionBoxOpacity", 0.54)),
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
  const figureTitle = styleString(style, "seismicFigureTitle", "");
  const figureCaption = styleString(style, "seismicFigureCaption", "");
  const figureScaleLabel = styleString(style, "seismicFigureScaleLabel", "");
  const figureWellLabel = styleString(style, "seismicFigureWellLabel", "");
  const figureWellVisible = styleBoolean(
    style,
    "seismicFigureWellVisible",
    false,
  );
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
  const figureOutsideOffsetM = Math.max(
    40,
    Math.min(1500, styleNumber(style, "seismicFigureOutsideOffsetM", 240)),
  );
  const figureLabelSizeM = Math.max(
    60,
    Math.min(420, styleNumber(style, "seismicFigureLabelSizeM", 140)),
  );
  const currentCapabilityPresetId =
    typeof style.seismicCapabilityPresetId === "string"
      ? style.seismicCapabilityPresetId
      : "";
  const controlOpacity = disabled ? 0.4 : 1;
  const liveSeismicStyleRef = useRef(style);
  useEffect(() => {
    liveSeismicStyleRef.current = style;
  }, [style]);

  const commitLayerStyle = (
    targetLayerId: string,
    patch: Partial<EditableStyle>,
  ) => {
    if (disabled) return;
    if (targetLayerId === layerId) {
      const merged = { ...liveSeismicStyleRef.current, ...patch };
      liveSeismicStyleRef.current = merged;
      if (canApplyLiveSceneEdits()) {
        sceneHandle.manager.applyStyle(targetLayerId, merged);
      }
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
  const commitProductState = (
    id: string,
    patch: Partial<EditableStyle>,
  ) => {
    const currentStates =
      typeof liveSeismicStyleRef.current.seismicProductStates === "object" &&
      liveSeismicStyleRef.current.seismicProductStates !== null
        ? liveSeismicStyleRef.current.seismicProductStates
        : {};
    const nextStates = { ...currentStates };
    const currentState = nextStates[id] ?? {};
    const nextState = { ...currentState };
    const patchVisibility =
      typeof patch.seismicProductVisibility === "object" &&
      patch.seismicProductVisibility !== null
        ? patch.seismicProductVisibility
        : undefined;
    if (patchVisibility) {
      for (const [stateId, visible] of Object.entries(patchVisibility)) {
        if (typeof visible !== "boolean") continue;
        nextStates[stateId] = {
          ...(nextStates[stateId] ?? {}),
          visible,
        };
      }
      if (typeof patchVisibility[id] === "boolean") {
        nextState.visible = patchVisibility[id];
      }
    }
    if (typeof patch.opacity === "number") nextState.opacity = patch.opacity;
    if (patch.seismicRenderMode) nextState.renderMode = patch.seismicRenderMode;
    if (patch.seismicSliceAxis) nextState.sliceAxis = patch.seismicSliceAxis;
    if (typeof patch.seismicSliceFraction === "number") {
      nextState.sliceFraction = patch.seismicSliceFraction;
    }
    if (typeof patch.seismicSliceThroughVolume === "boolean") {
      nextState.sliceThroughVolume = patch.seismicSliceThroughVolume;
    }
    if (typeof patch.seismicAmplitudeMin === "number") {
      nextState.amplitudeMin = patch.seismicAmplitudeMin;
    }
    if (typeof patch.seismicAmplitudeMax === "number") {
      nextState.amplitudeMax = patch.seismicAmplitudeMax;
    }
    if (typeof patch.seismicAmplitudeGamma === "number") {
      nextState.amplitudeGamma = patch.seismicAmplitudeGamma;
    }
    if (patch.seismicColormap) nextState.colormap = patch.seismicColormap;
    if (typeof patch.seismicRemoveBackground === "boolean") {
      nextState.removeBackground = patch.seismicRemoveBackground;
    }
    if (typeof patch.seismicBackgroundCutoff === "number") {
      nextState.backgroundCutoff = patch.seismicBackgroundCutoff;
    }
    if (typeof patch.seismicTimeScale === "number") {
      nextState.timeScale = patch.seismicTimeScale;
    }
    if (typeof patch.seismicVolumeSampleSteps === "number") {
      nextState.volumeSampleSteps = patch.seismicVolumeSampleSteps;
    }
    commit({
      ...patch,
      seismicProductStates: {
        ...nextStates,
        [id]: nextState,
      },
    });
  };
  const selectedOnlyVisibility = (id: string) =>
    Object.fromEntries(
      products.map((product) => [product.id, product.id === id]),
    );
  const setProductVisible = (id: string, visible: boolean) => {
    commitProductState(id, {
      seismicProductVisibility: {
        ...productVisibility,
        [id]: visible,
      },
    });
  };
  const setCapabilityForProduct = (
    product: SeismicProductOption,
    mode: "slice" | "raymarch",
    syncSlice: boolean,
  ) => {
    const nextRenderMode =
      mode === "raymarch" && product.raymarchCapable ? "raymarch" : "slice";
    commitProductState(product.id, {
      seismicCapabilityPresetId: `${product.id}-${nextRenderMode}${
        syncSlice ? "-sync" : ""
      }`,
      seismicProductId: product.id,
      seismicProductVisibility: selectedOnlyVisibility(product.id),
      seismicRenderMode: nextRenderMode,
      seismicColormap: isVelocityProduct(product) ? "velocity" : colormap,
      seismicSliceAxis:
        product.surveyKind === "3d"
          ? sliceAxis === "line"
            ? "inline"
            : sliceAxis
          : "line",
      seismicSliceThroughVolume:
        nextRenderMode === "raymarch" &&
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
    } else if (productId) {
      seismicPatch.seismicProductVisibility = {
        ...productVisibility,
        [productId]: true,
      };
    }
    commit(seismicPatch);
    commitLayerStyle(UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID, mtPatch);
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
  const comparisonActions = seismicComparisonActions(products);
  const raymarchProducts = products.filter(
    (product) => product.raymarchCapable === true,
  );
  const sectionOnlyProducts = products.filter(
    (product) => product.raymarchCapable !== true,
  );
  const productControlActive = (product: SeismicProductOption) =>
    product.id === productId;

  const renderProductCapabilityItem = (product: SeismicProductOption) => {
    const productVisible = productVisibility[product.id] === true;
    const active = productControlActive(product);
    const capabilityMode: "volume" | "slice" | "sync" =
      active &&
      renderMode === "raymarch" &&
      styleBoolean(style, "seismicSliceThroughVolume", false)
        ? "sync"
        : active && renderMode === "raymarch"
          ? "volume"
          : "slice";
    return (
      <SeismicCapabilityLayerItem
        key={product.id}
        testId={`seismic-capability-product-${product.id}`}
        title={product.label}
        type={
          product.raymarchCapable
            ? isVelocityProduct(product)
              ? "3D velocity"
              : "3D seismic"
            : "section"
        }
        inactive={!productVisible}
      >
        <div style={nestedControlRowStyle}>
          <span style={nestedFieldLabelStyle}>Visible</span>
          <EditorEyeButton
            testId={`seismic-capability-product-visible-${product.id}`}
            visible={productVisible}
            disabled={disabled}
            onClick={() => setProductVisible(product.id, !productVisible)}
            title={productVisible ? "Hide this product" : "Show this product"}
            ariaLabel={
              productVisible ? `Hide ${product.label}` : `Show ${product.label}`
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
            {productVisible
              ? active
                ? product.raymarchCapable && renderMode === "raymarch"
                  ? "active volume"
                  : "active slice"
                : (product.domainKind ?? "processed product")
              : "inactive"}
          </span>
        </div>
        {productVisible ? (
          <>
            <details style={nestedDetailsStyle}>
              <summary style={panelStyles.summary}>Render</summary>
              <div style={detailsContentStyle}>
                <EditorCompactSegmentedRow
                  label="RenderMode"
                  value={product.raymarchCapable ? capabilityMode : "slice"}
                  testId={`seismic-capability-render-${product.id}`}
                  disabled={disabled}
                  controlOpacity={controlOpacity}
                  options={
                    product.raymarchCapable
                      ? [
                          {
                            value: "volume",
                            label: "Volume",
                            testId: `seismic-capability-volume-${product.id}`,
                          },
                          {
                            value: "slice",
                            label: "Slice",
                            testId: `seismic-capability-slice-${product.id}`,
                          },
                          {
                            value: "sync",
                            label: "Sync",
                            testId: `seismic-capability-sync-${product.id}`,
                          },
                        ]
                      : [
                          {
                            value: "slice",
                            label: "Slice",
                            testId: `seismic-capability-slice-${product.id}`,
                          },
                        ]
                  }
                  onChange={(value) =>
                    setCapabilityForProduct(
                      product,
                      value === "slice" ? "slice" : "raymarch",
                      value === "sync",
                    )
                  }
                />
              </div>
            </details>
            <SeismicProductDisplayVariables
              product={product}
              active={active}
              disabled={disabled}
              controlOpacity={controlOpacity}
              sliceAxis={sliceAxis}
              sliceFraction={sliceFraction}
              seismicOpacity={seismicOpacity}
              amplitudeMin={amplitudeMin}
              amplitudeMax={amplitudeMax}
              amplitudeGamma={amplitudeGamma}
              colormap={colormap}
              removeBackground={removeBackground}
              backgroundCutoff={backgroundCutoff}
              volumeSampleSteps={volumeSampleSteps}
              timeScale={timeScale}
                commit={(patch) => commitProductState(product.id, patch)}
              />
          </>
        ) : null}
      </SeismicCapabilityLayerItem>
    );
  };

  return (
    <>
      <SeismicProductVisibilityControls
        products={products}
        productVisibility={productVisibility}
        productId={productId}
        disabled={disabled}
        controlOpacity={controlOpacity}
        commit={commit}
      />

      {raymarchProducts.length > 0 ? (
        <details style={nestedDetailsStyle} open>
          <summary style={panelStyles.summary}>3D / raymarch products</summary>
          <div style={detailsContentStyle}>
            {raymarchProducts.map(renderProductCapabilityItem)}
          </div>
        </details>
      ) : null}

      {sectionOnlyProducts.length > 0 ? (
        <details style={nestedDetailsStyle} open>
          <summary style={panelStyles.summary}>Section-only products</summary>
          <div style={detailsContentStyle}>
            {sectionOnlyProducts.map(renderProductCapabilityItem)}
          </div>
        </details>
      ) : null}

      <SeismicCapabilityLayerItem
        testId="seismic-capability-line-theatre"
        title="2D / legacy section theatre"
        type="section"
      >
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
          <label style={nestedFieldLabelStyle}>Curtain</label>
          {[
            { id: "line-301-theatre", label: "Line 301" },
            { id: "line-302-theatre", label: "Line 302" },
            { id: "legacy-l5-l11-theatre", label: "L5 + L11" },
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
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-processing-comparison"
        title="Processing comparison"
        type="comparison"
      >
        <EditorCompactSegmentedRow
          label="Mode"
          value={comparisonMode}
          testId="seismic-comparison-mode-select"
          disabled={disabled}
          controlOpacity={controlOpacity}
          options={[
            { value: "overlay", label: "Overlay" },
            { value: "side-by-side", label: "Side-by-side" },
          ]}
          onChange={(value) =>
            commit({
              seismicComparisonMode:
                value === "side-by-side" ? "side-by-side" : "overlay",
            })
          }
        />
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
              commit({ seismicComparisonSpacingM: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                opacity:
                  comparisonMode === "side-by-side" ? controlOpacity : 0.35,
                "--editor-slider-fill": `${(comparisonSpacingM / 3000) * 100}%`,
              } as React.CSSProperties
            }
          />
        </div>
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
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
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-display-cleanup"
        title="Display cleanup"
        type="display"
      >
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
            onChange={(e) => commit({ opacity: parseFloat(e.target.value) })}
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${seismicOpacity * 100}%`,
              } as React.CSSProperties
            }
          />
        </div>
        <EditorCompactSegmentedRow
          label="Palette"
          value={colormap}
          testId="seismic-capability-colormap-select"
          disabled={disabled}
          controlOpacity={controlOpacity}
          options={[
            { value: "blue-white-red", label: "BWR" },
            { value: "grayscale", label: "Gray" },
            { value: "velocity", label: "Velocity" },
          ]}
          onChange={(value) =>
            commit({
              seismicColormap: seismicColormapFromValue(value),
            })
          }
        />
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Gain curve</label>
          <input
            data-testid="seismic-capability-amplitude-gamma"
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
                "--editor-slider-fill": `${((amplitudeGamma - 0.35) / 2.15) * 100}%`,
              } as React.CSSProperties
            }
          />
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
          <label style={nestedFieldLabelStyle}>Zero mute</label>
          <input
            data-testid="seismic-capability-background-cutoff"
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
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Ray steps</label>
          <input
            data-testid="seismic-capability-volume-sample-steps"
            type="range"
            min={24}
            max={160}
            step={8}
            value={volumeSampleSteps}
            disabled={disabled || !selectedProduct?.raymarchCapable}
            onChange={(e) =>
              commit({ seismicVolumeSampleSteps: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: selectedProduct?.raymarchCapable
                  ? controlOpacity
                  : 0.35,
                "--editor-slider-fill": `${((volumeSampleSteps - 24) / 136) * 100}%`,
              } as React.CSSProperties
            }
          />
        </div>
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-figure-annotations"
        title="Figure annotations"
        type="display"
      >
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Frame</span>
          <input
            data-testid="seismic-figure-annotations-visible"
            type="checkbox"
            checked={figureAnnotationsVisible}
            disabled={disabled}
            onChange={(e) =>
              commit({ seismicFigureAnnotationsVisible: e.target.checked })
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
            placeholder={selectedProduct?.label ?? "Auto"}
            disabled={disabled || !figureAnnotationsVisible}
            onChange={(e) => commit({ seismicFigureTitle: e.target.value })}
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
            onChange={(e) => commit({ seismicFigureCaption: e.target.value })}
            style={{
              ...compactTextareaStyle,
              opacity: figureAnnotationsVisible ? controlOpacity : 0.35,
            }}
          />
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Scale</label>
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
        <div style={{ ...nestedControlRowStyle, gap: 8, flexWrap: "wrap" }}>
          <label style={nestedFieldLabelStyle}>Colors</label>
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
              title: "Box",
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
          <label style={nestedFieldLabelStyle}>Box</label>
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
                seismicFigureCaptionBoxOpacity: parseFloat(e.target.value),
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
          <label style={nestedFieldLabelStyle}>Offset</label>
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
                seismicFigureOutsideOffsetM: parseFloat(e.target.value),
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
              commit({ seismicFigureLabelSizeM: parseFloat(e.target.value) })
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
          <span style={nestedFieldLabelStyle}>Well</span>
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
            onChange={(e) => commit({ seismicFigureWellLabel: e.target.value })}
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
          <label style={nestedFieldLabelStyle}>Well pos</label>
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
              commit({ seismicFigureWellPosition: parseFloat(e.target.value) })
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
          <span style={nestedFieldLabelStyle}>Horizon</span>
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
          <label style={nestedFieldLabelStyle}>Horizon pts</label>
          <textarea
            data-testid="seismic-figure-horizon-points"
            value={figureHorizonPointsText}
            disabled={
              disabled || !figureAnnotationsVisible || !figureHorizonVisible
            }
            onChange={(e) =>
              commit({
                seismicFigureHorizonPoints: parseHorizonPoints(e.target.value),
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
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-survey-geometry"
        title="Survey geometry"
        type="navigation"
      >
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Navigation</span>
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
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
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
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-integrated-geophysics"
        title="Integrated geophysics"
        type="preset"
      >
        <EditorCompactSegmentedRow
          label="View"
          value={
            style.seismicMtCoRender === "mt" ||
            style.seismicMtCoRender === "integrated"
              ? style.seismicMtCoRender
              : "seismic"
          }
          testId="seismic-capability-mt-view"
          disabled={disabled}
          controlOpacity={controlOpacity}
          options={[
            {
              value: "seismic",
              label: "Seismic",
              testId: "seismic-capability-seismic-only",
            },
            {
              value: "mt",
              label: "MT",
              testId: "seismic-capability-mt-only",
            },
            {
              value: "integrated",
              label: "Integrated",
              testId: "seismic-capability-integrated",
            },
          ]}
          onChange={(value) => {
            if (value === "integrated") {
              applyCapabilityPreset("integrated-geophysics");
            } else {
              setMtCoRender(value);
            }
          }}
        />
      </SeismicCapabilityLayerItem>

      <SeismicAudienceAndDataConfidenceControls
        layer={layer}
        style={style}
        products={products}
        productId={productId}
        selectedProduct={selectedProduct}
        raymarchProductCount={raymarchProducts.length}
        renderMode={renderMode}
        amplitudeMin={amplitudeMin}
        currentCapabilityPresetId={currentCapabilityPresetId}
        disabled={disabled}
        controlOpacity={controlOpacity}
        commit={commit}
        commitLayerStyle={commitLayerStyle}
      />
    </>
  );
}
