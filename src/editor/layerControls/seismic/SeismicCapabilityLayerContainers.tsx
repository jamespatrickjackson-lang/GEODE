import { useEffect, useRef } from "react";
import type React from "react";
import { panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
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
import { SeismicCapabilityLayerItem } from "./SeismicCapabilityLayerItem";
import { SeismicProductDisplayVariables } from "./SeismicProductDisplayVariables";
import {
  isVelocityProduct,
  seismicColormapFromValue,
  seismicCapabilityPresets,
  seismicComparisonActions,
  seismicDefaultProductId,
  seismicPresetPatch,
  seismicProductOptions,
  seismicProductVisibilityFromStyle,
  SEISMIC_DEMO_DISCLOSURE_LABELS,
  type SeismicProductOption,
} from "./seismicModel";
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
      sceneHandle.manager.applyStyle(targetLayerId, merged);
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
  const selectedOnlyVisibility = (id: string) =>
    Object.fromEntries(
      products.map((product) => [product.id, product.id === id]),
    );
  const setProductVisible = (id: string, visible: boolean) => {
    commit({
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
    commit({
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
  const productControlActive = (product: SeismicProductOption) =>
    product.id === productId;


  return (
    <>
      {raymarchProducts.map((product) => {
        const productVisible = productVisibility[product.id] === true;
        return (
          <SeismicCapabilityLayerItem
            key={product.id}
            testId={`seismic-capability-product-${product.id}`}
            title={product.label}
            type={isVelocityProduct(product) ? "3D velocity" : "3D seismic"}
            inactive={!productVisible}
          >
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Visible</span>
              <input
                data-testid={`seismic-capability-product-visible-${product.id}`}
                type="checkbox"
                checked={productVisible}
                disabled={disabled}
                onChange={(e) =>
                  setProductVisible(product.id, e.target.checked)
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
                  ? productControlActive(product)
                    ? renderMode === "raymarch"
                      ? "active volume"
                      : "active slice"
                    : (product.domainKind ?? "processed product")
                  : "inactive"}
              </span>
            </label>
            {productVisible ? (
              <>
                <details style={nestedDetailsStyle}>
                  <summary style={panelStyles.summary}>Render</summary>
                  <div style={detailsContentStyle}>
                    <div
                      style={{
                        ...nestedControlRowStyle,
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <label style={nestedFieldLabelStyle}>RenderMode</label>
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
                  </div>
                </details>
                <SeismicProductDisplayVariables
                  product={product}
                  active={productControlActive(product)}
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
                  commit={commit}
                />
              </>
            ) : null}
          </SeismicCapabilityLayerItem>
        );
      })}

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
          <span style={sliderNumberReadoutStyle}>
            {comparisonSpacingM.toFixed(0)} m
          </span>
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
          <span style={sliderNumberReadoutStyle}>
            {seismicOpacity.toFixed(2)}
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
          <span style={sliderNumberReadoutStyle}>
            {amplitudeGamma.toFixed(2)}
          </span>
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
          <span style={sliderNumberReadoutStyle}>
            {backgroundCutoff.toFixed(2)}
          </span>
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
          <span style={sliderNumberReadoutStyle}>{volumeSampleSteps}</span>
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
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
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
              onClick: () => applyCapabilityPreset("integrated-geophysics"),
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
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-data-confidence"
        title="Data confidence"
        type="metadata"
      >
        <div
          style={{
            color: vibrancyTertiaryLabel,
            fontSize: 11,
            lineHeight: 1.35,
          }}
        >
          <div>Products: {products.length} processed GUI products</div>
          <div>3D raymarch-capable: {raymarchProducts.length}</div>
          <div>RenderMode: {renderMode}</div>
          <div>Audience: {style.seismicAudienceMode ?? "investor"}</div>
          <div>
            {isVelocityProduct(selectedProduct) ? "Vel min" : "Amp min"}:{" "}
            {amplitudeMin.toFixed(2)}
          </div>
          <div>
            Active capability: {currentCapabilityPresetId || "manual controls"}
          </div>
          <div>{SEISMIC_DEMO_DISCLOSURE_LABELS.join(" / ")}</div>
        </div>
      </SeismicCapabilityLayerItem>
    </>
  );
}
