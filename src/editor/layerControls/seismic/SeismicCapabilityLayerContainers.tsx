import { useEffect, useRef } from "react";
import { panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  nestedControlRowStyle,
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
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
} from "../../../projectModules/utahForge/layerIds";
import { IsobandControls } from "../mt/IsobandControls";
import { SectionGraphOptionsControls } from "./SectionGraphOptionsControls";
import { SeismicCapabilityLayerItem } from "./SeismicCapabilityLayerItem";
import { SeismicDisplayTuningControls } from "./SeismicDisplayTuningControls";
import { SeismicSourceAndRegistrationControls } from "./SeismicSourceAndRegistrationControls";
import { SeismicSurveyGeometryControls } from "./SeismicSurveyGeometryControls";
import {
  seismicCapabilityPresetPatch,
  seismicColormapFromValue,
  seismicCapabilityPresets,
  seismicDefaultProductId,
  seismicProductOptions,
  seismicRequiredProductSourceGates,
  seismicProductVisibilityFromStyle,
  seismicVerticalDatumModeFromStyle,
  type SeismicRequiredProductSourceGate,
} from "./seismicModel";

function formatSourceGateBytes(bytes: number | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return "source size unknown";
  }
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function SeismicSurveyGeometryContainer({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  ensureLayerVisible,
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
  ensureLayerVisible?: () => void;
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
    if (targetLayerId === layerId && patch.visible === true) {
      ensureLayerVisible?.();
    }
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
  const applyCapabilityPreset = (presetId: string) => {
    const preset = capabilityPresets.find(
      (candidate) => candidate.id === presetId,
    );
    if (!preset) return;
    commit({
      visible: true,
      ...seismicCapabilityPresetPatch(preset, products, productId),
    });
    if (preset.mtStylePatch) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        preset.mtStylePatch,
      );
    }
    if (preset.linkedLayerStylePatches) {
      for (const [targetLayerId, patch] of Object.entries(
        preset.linkedLayerStylePatches,
      )) {
        commitLayerStyle(targetLayerId, patch);
      }
    }
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

  return (
    <SeismicSurveyGeometryControls
      navigationVisible={navigationVisible}
      navigationSourcesVisible={navigationSourcesVisible}
      navigationReceiversVisible={navigationReceiversVisible}
      navigationLinesVisible={navigationLinesVisible}
      disabled={disabled}
      controlOpacity={controlOpacity}
      commit={commit}
      setNavigationRoleVisible={setNavigationRoleVisible}
      applyCapabilityPreset={applyCapabilityPreset}
    />
  );
}
export function SeismicCapabilityLayerContainers({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  overridden = false,
  onToggleOverride,
  sceneSectionStyle,
  ensureLayerVisible,
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
  overridden?: boolean;
  onToggleOverride?: (enabled: boolean) => void;
  sceneSectionStyle: EditableStyle;
  ensureLayerVisible?: () => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  sceneHandle: SceneHandle;
}) {
  const { canApplyLiveSceneEdits } = useEditor();
  const products = seismicProductOptions(layer);
  const sourceGatedProducts = seismicRequiredProductSourceGates(layer);
  const capabilityPresets = seismicCapabilityPresets(layer);
  const defaultProductId = seismicDefaultProductId(layer);
  const rawProductId = styleString(style, "seismicProductId", defaultProductId);
  const productId = products.some((product) => product.id === rawProductId)
    ? rawProductId
    : defaultProductId;
  const selectedProduct = products.find((product) => product.id === productId);
  const raymarchProducts = products.filter(
    (product) => product.raymarchCapable === true,
  );
  const productVisibility = seismicProductVisibilityFromStyle(
    style,
    products,
    productId,
  );
  const seismicLayerVisible = styleBoolean(style, "visible", true);
  const requestedRenderMode =
    style.seismicRenderMode === "raymarch" ? "raymarch" : "slice";
  const renderMode =
    requestedRenderMode === "raymarch" && selectedProduct?.raymarchCapable
      ? "raymarch"
      : "slice";
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
  const currentCapabilityPresetId =
    typeof style.seismicCapabilityPresetId === "string"
      ? style.seismicCapabilityPresetId
      : "";
  const activeCapabilityPreset = capabilityPresets.find(
    (preset) => preset.id === currentCapabilityPresetId,
  );
  const linkedSceneSectionPresets = capabilityPresets.filter((preset) =>
    Boolean(preset.linkedLayerStylePatches?.[UTAH_FORGE_SCENE_SECTION_LAYER_ID]),
  );
  const controlOpacity = disabled ? 0.4 : 1;
  const liveSeismicStyleRef = useRef(style);
  const liveSceneSectionStyleRef = useRef(sceneSectionStyle);
  useEffect(() => {
    liveSeismicStyleRef.current = style;
  }, [style]);
  useEffect(() => {
    liveSceneSectionStyleRef.current = sceneSectionStyle;
  }, [sceneSectionStyle]);

  const commitLayerStyle = (
    targetLayerId: string,
    patch: Partial<EditableStyle>,
  ) => {
    if (disabled) return;
    if (targetLayerId === layerId && patch.visible === true) {
      ensureLayerVisible?.();
    }
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
  const setSeismicLayerVisible = (visible: boolean) => {
    commit({ visible });
  };
  const commitSceneSectionStyle = (patch: Partial<EditableStyle>) => {
    if (disabled) return;
    const merged = { ...liveSceneSectionStyleRef.current, ...patch };
    liveSceneSectionStyleRef.current = merged;
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, merged);
    }
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
  const sceneSectionStringList = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((candidate): candidate is string => typeof candidate === "string")
      : [];
  const seismicDepthWindowSceneSectionPatch = (
    visible: boolean,
  ): Partial<EditableStyle> => {
    if (!visible) {
      return {
        visible: false,
        sceneSectionEnabled: false,
        sceneSectionFrameEnabled: false,
        sceneSectionWindowEnabled: false,
      };
    }
    const currentStyle = liveSceneSectionStyleRef.current;
    const layerTargets = sceneSectionStringList(
      currentStyle.sceneSectionTargetLayerIds,
    );
    const productTargets = sceneSectionStringList(
      currentStyle.sceneSectionTargetProductIds,
    );
    const activeFrameId =
      currentStyle.sceneSectionActiveAxis === "y" &&
      typeof currentStyle.sceneSectionActiveFrameId === "string" &&
      currentStyle.sceneSectionActiveFrameId.trim()
        ? currentStyle.sceneSectionActiveFrameId
        : "axis:y";
    const nextProductTargets =
      productId && !productTargets.includes(productId)
        ? [productId, ...productTargets]
        : productTargets;
    return {
      visible: true,
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionFrameEnabled: true,
      sceneSectionWindowEnabled: true,
      sceneSectionActiveAxis: "y",
      sceneSectionActiveFrameId: activeFrameId,
      sceneSectionTargetScope: "selected-targets",
      sceneSectionTargetLayerIds: layerTargets.includes(layerId)
        ? layerTargets
        : [...layerTargets, layerId],
      ...(nextProductTargets.length > 0
        ? { sceneSectionTargetProductIds: nextProductTargets }
        : {}),
    };
  };
  const applyCapabilityPreset = (presetId: string) => {
    const preset = capabilityPresets.find(
      (candidate) => candidate.id === presetId,
    );
    if (!preset) return;
    commit({
      visible: true,
      ...seismicCapabilityPresetPatch(preset, products, productId),
    });
    if (preset.mtStylePatch) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        preset.mtStylePatch,
      );
    }
    if (preset.linkedLayerStylePatches) {
      for (const [targetLayerId, patch] of Object.entries(
        preset.linkedLayerStylePatches,
      )) {
        commitLayerStyle(targetLayerId, patch);
      }
    }
  };
  const renderSourceGatedProductItem = (
    gate: SeismicRequiredProductSourceGate,
  ) => (
    <SeismicCapabilityLayerItem
      key={gate.id}
      testId={`seismic-source-gate-${gate.id}`}
      title={gate.label}
      type="source gate"
      inactive
      visible={false}
      visibilityDisabled
      onVisibleChange={() => undefined}
    >
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>File</label>
        <span
          style={{
            flex: 1,
            color: vibrancyTertiaryLabel,
            fontSize: 11,
            opacity: controlOpacity,
          }}
        >
          {gate.filename ?? gate.id}
        </span>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Size</label>
        <span
          style={{
            flex: 1,
            color: vibrancyTertiaryLabel,
            fontSize: 11,
            opacity: controlOpacity,
          }}
        >
          {formatSourceGateBytes(gate.expectedBytes)}
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
          {gate.sourceCitation ?? gate.sourceSubmission ?? "GDR source"}
        </span>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Status</label>
        <span
          style={{
            flex: 1,
            color:
              gate.status === "available" ? "#9fdc8f" : vibrancyTertiaryLabel,
            fontSize: 11,
            opacity: controlOpacity,
          }}
        >
          {gate.status ?? "source-gated"}
        </span>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Member</label>
        <span
          style={{
            flex: 1,
            color: vibrancyTertiaryLabel,
            fontSize: 11,
            opacity: controlOpacity,
          }}
        >
          {gate.sourceZipMember ?? "GDR archive"}
        </span>
      </div>
      {gate.downloadLandingPage ? (
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
          <label style={nestedFieldLabelStyle}>GDR</label>
          <button
            type="button"
            data-testid={`seismic-source-gate-open-${gate.id}`}
            disabled={disabled}
            onClick={() =>
              window.open(
                gate.downloadLandingPage,
                "_blank",
                "noopener,noreferrer",
              )
            }
            style={{
              ...panelStyles.iconButton,
              width: "auto",
              padding: "3px 7px",
              fontSize: 10,
              opacity: controlOpacity,
            }}
          >
            Landing page
          </button>
        </div>
      ) : null}
    </SeismicCapabilityLayerItem>
  );

  return (
    <>
      <SeismicSourceAndRegistrationControls
        products={products}
        selectedProduct={selectedProduct}
        visibleProductCount={products.filter(
          (product) => productVisibility[product.id] === true,
        ).length}
        raymarchProductCount={raymarchProducts.length}
        sourceGatedProducts={sourceGatedProducts}
        currentCapabilityPresetId={currentCapabilityPresetId}
        activePreset={activeCapabilityPreset}
        renderMode={renderMode}
        verticalDatumMode={verticalDatumMode}
        onSetVerticalDatumMode={(value) =>
          commit({ seismicVerticalDatumMode: value })
        }
        layerVisible={seismicLayerVisible}
        onSetLayerVisible={setSeismicLayerVisible}
        isEnv={isEnv}
        overridden={overridden}
        onToggleOverride={onToggleOverride}
        disabled={disabled}
        controlOpacity={controlOpacity}
      />

      <SectionGraphOptionsControls
        layer={layer}
        style={style}
        disabled={disabled}
        controlOpacity={controlOpacity}
        commit={commit}
        commitLayerStyle={commitLayerStyle}
      />

      <SeismicCapabilityLayerItem
        testId="seismic-capability-seismic-rendering"
        title="Seismic rendering"
        type="display"
        visible={seismicLayerVisible}
        visibilityDisabled={disabled}
        onVisibleChange={setSeismicLayerVisible}
      >
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
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-depth-window"
        title="Depth window"
        type="section"
        visible={styleBoolean(
          sceneSectionStyle,
          "sceneSectionWindowEnabled",
          false,
        )}
        visibilityDisabled={disabled}
        onVisibleChange={(visible) =>
          commitSceneSectionStyle(seismicDepthWindowSceneSectionPatch(visible))
        }
      >
        {(() => {
          const yWindow = sceneSectionStyle?.sceneSectionWindowByAxis?.y;
          const yFrame = sceneSectionStyle?.sceneSectionFrameByAxis?.y;
          const windowLabel =
            yWindow !== undefined || yFrame !== undefined
              ? [
                  "y section",
                  yWindow?.bottomElevationM !== undefined
                    ? `bot ${Math.round(yWindow.bottomElevationM)} m`
                    : undefined,
                  yFrame !== undefined ? "frame set" : undefined,
                ]
                  .filter((s): s is string => s !== undefined)
                  .join(" · ")
              : "scene-section y frame";
          return (
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Window</span>
              <input
                data-testid="seismic-capability-depth-window-enabled"
                type="checkbox"
                checked={styleBoolean(sceneSectionStyle, "sceneSectionWindowEnabled", false)}
                disabled={disabled}
                onChange={(e) =>
                  commitSceneSectionStyle(
                    seismicDepthWindowSceneSectionPatch(e.target.checked),
                  )
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
                {windowLabel}
              </span>
            </label>
          );
        })()}
        {linkedSceneSectionPresets.length > 0 ? (
          <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
            <label style={nestedFieldLabelStyle}>Preset</label>
            {linkedSceneSectionPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-testid={`seismic-capability-depth-window-preset-${preset.id}`}
                disabled={disabled}
                onClick={() => applyCapabilityPreset(preset.id)}
                style={{
                  ...panelStyles.iconButton,
                  width: "auto",
                  padding: "3px 7px",
                  fontSize: 10,
                  opacity: controlOpacity,
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        ) : null}
        {activeCapabilityPreset?.summary ? (
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Preset</label>
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              {activeCapabilityPreset.summary}
            </span>
          </div>
        ) : null}
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-isobands"
        title="Isobands"
        type="overlay"
        visible={styleBoolean(style, "sectionIsoEnabled", false)}
        visibilityDisabled={disabled}
        onVisibleChange={(visible) =>
          commit(
            visible
              ? {
                  sectionIsoEnabled: true,
                  sectionIsoBandsVisible: true,
                  sectionIsoLinesVisible: true,
                }
              : { sectionIsoEnabled: false },
          )
        }
      >
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
          nestedContainer={false}
        />
      </SeismicCapabilityLayerItem>

      {sourceGatedProducts.length > 0 ? (
        <SeismicCapabilityLayerItem
          testId="seismic-products-source-gated"
          title="Source-gated products"
          type="source"
          visible={false}
          visibilityDisabled
          onVisibleChange={() => undefined}
        >
          <div style={detailsContentStyle}>
            {sourceGatedProducts.map(renderSourceGatedProductItem)}
          </div>
        </SeismicCapabilityLayerItem>
      ) : null}

    </>
  );
}
