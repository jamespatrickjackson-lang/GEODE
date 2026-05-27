import { Fragment } from "react";
import { useEditor } from "./EditorContext";
import { usePageController } from "../pages/PageController";
import { ENVIRONMENT_SENTINEL } from "./types";
import {
  globalSettingsAccent,
  pageAccentForPage,
  panelStyles,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "./styles";
import { TopoMapPanel } from "./topoMap/TopoMapPanel";
import { SiteDetailsPanel } from "./SiteDetailsPanel";
import {
  detailsContentStyle,
  EnvStyleRow,
  EnvVisibilityRow,
  LayerBooleanStyleControl,
  LayerColorStyleControl,
  LayerNumberStyleControl,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  PageStyleRow,
  PageVisibilityRow,
  styleNumber,
} from "./styleControls";
import {
  DrillingAssayPanel,
  LayerGroup,
  LayerGroupFogControl,
  PageEnvironmentOverridePanel,
  TopoDetailDistancePanel,
} from "./layerControls/layout/LayoutControls";
import {
  firstLayerItemStyle,
  layerControlsStyle,
  layerItemStyle,
} from "./layerControls/layout/layoutStyles";
import {
  CASE_STUDY_B_CUSTOMER_LAYER_GROUPS,
  CASE_STUDY_B_PUBLIC_LAYER_GROUPS,
  CLASSIFICATIONS,
  CONFIDENTIALITIES,
  CONTOUR_DISTANCE_STYLE_CONTROLS,
  CUSTOMER_LAYER_GROUPS,
  DEFAULT_FOG_DENSITY,
  FOG_DENSITY_UI_MAX,
  FOG_DENSITY_UI_MIN,
  FOG_DENSITY_UI_STEP,
  LAND_TITLE_LABEL_FILL_DEFAULT,
  LAND_TITLE_LABEL_FILL_OPACITY_DEFAULT,
  LAND_TITLE_LABEL_OUTLINE_OPACITY_DEFAULT,
  labelFillColorControlValue,
  labelFillOpacityControlValue,
  labelOutlineColorControlValue,
  labelOutlineOpacityControlValue,
  labelPointerVisibleControlValue,
  labelTextControlValue,
  layerDataSection,
  layerStyleOpacityForActiveState,
  LINE_WIDTH_LAYER_DEFAULTS,
  MT_THRESHOLD_SURFACE_FIELDS,
  MT_TOP_SURFACE_FIELDS,
  MT_VOLUME_FIELDS,
  normalizeLabelKind,
  PUBLIC_LAYER_GROUPS,
  PUBLIC_TOPO_LAYER_GROUP_TITLE,
  scalarControlTargetLabel,
  SCALAR_LEGEND_FIELD,
  SCALAR_RAMP_FIELDS,
  SEISMIC_BROWSER_FIELDS,
  SURFACE_GRADIENT_FIELDS,
  UTAH_FORGE_CUSTOMER_LAYER_GROUPS,
  UTAH_FORGE_PUBLIC_LAYER_GROUPS,
  UTAH_FORGE_SCALAR_LAYER_IDS,
  type LayerDataSection,
  type LayerGroupDef,
} from "./layerControls/layerPanelConfig";
import {
  editorLayerLabel,
  layerHasRenderableControl,
} from "./layerControls/layerLabels";
import {
  mtThresholdSurfacePatchFromStyle,
  mtTopSurfacePatchFromStyle,
  mtVolumePatchFromStyle,
  scalarRampPatchFromStyle,
  surfaceGradientPatchFromStyle,
} from "./layerControls/layerPatchBuilders";
import { SceneOverlayRow, AddSceneOverlayForm } from "./layerControls/overlays/SceneOverlayControls";
import { GeologySubUnitsPanel } from "./layerControls/geology/GeologySubUnitsPanel";
import {
  SceneSectionPlanesContainer,
  seismicBrowserPatchFromStyle,
  SeismicBrowserControls,
  SeismicCapabilityLayerContainers,
} from "./layerControls/seismic/SeismicControls";
import { WorkingAreaFocusContainer } from "./layerControls/workingArea/WorkingAreaFocusContainer";
import {
  EnvAffectedByFogRow,
  EnvLabelKindRow,
  EnvLabelPointerSideRow,
  EnvLabelPointerVisibleRow,
  EnvShowLabelsRow,
  EnvTreeVisibilityToggle,
  PageAffectedByFogRow,
  PageLabelKindRow,
  PageLabelPointerSideRow,
  PageLabelPointerVisibleRow,
  PageShowLabelsRow,
  PageTreeVisibilityToggle,
} from "./layerControls/env/EnvRows";
import {
  MtStationQcControls,
  MtThresholdSurfaceControls,
  MtTopSurfaceControls,
  MtVolumeControls,
  ResistivitySliceControls,
  SurfaceGradientControls,
} from "./layerControls/mt/MtControls";
import {
  AreaOutlinesControls,
  EzGammaStyleControls,
  GeochemStyleControls,
  HyperspectralStyleControls,
  ImageryLidarStyleControls,
} from "./layerControls/style/StyleControls";
import {
  PointMarkerControls,
  ScalarPointDrawReadout,
  ScalarRampControls,
} from "./layerControls/scalar/ScalarControls";
import {
  effectiveStyle,
  effectiveVisibility,
  isStyleFieldOverridden,
  isVisibilityOverridden,
} from "../pages/effective";
import type {
  EditableStyle,
  PresentationPage,
  ProjectLayerSpec,
} from "../pages/types";
import { SCENE_ORIGIN } from "../constants";
import {
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_SITE_BOUNDARY_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import {
  SHAHBAZI_GROUND_CONTOUR_LAYER_ID,
  SHAHBAZI_GROUND_SURFACE_LAYER_ID,
} from "../projectModules/shahbazi/layerIds";
import {
  isTopoMapGraticuleLayer,
  isTopoMapLayer,
  isTopoMapSurfaceLayer,
  resolveTopoMapSettings,
  topoMapLayerIds,
} from "../topoMap/settings";

// LayerPanel has two modes driven by selectedPageId:
//   "environment"      -> editing the base; controls write env.layerStyles
//                         and env.defaultVisibleLayers directly. No
//                         inherited/overridden state.
//   "<page id>"        -> editing a presentation page. Each control has a
//                         small override checkbox; if off, the row shows
//                         the inherited value (greyed); if on, the control
//                         is active and edits page.layerOverrides.

export function LayerPanel({
  section = "customer",
}: {
  section?: LayerDataSection;
}) {
  const {
    state,
    sceneHandle,
    setEnvLayerStyle,
    toggleEnvDefaultVisible,
    setLayerProvenance,
    setPageLayerOverride,
    clearPageLayerOverride,
    setPageVisibilityOverride,
    clearPageVisibilityOverride,
    setPageField,
    setEnvScene,
  } = useEditor();

  const isEnv = state.selectedPageId === ENVIRONMENT_SENTINEL;
  const currentPage = isEnv
    ? null
    : (state.pages.find((p) => p.id === state.selectedPageId) ?? null);
  const { currentIndex, isTransitioning, targetIndex } = usePageController();
  const selectedPageIndex = currentPage
    ? state.pages.findIndex((p) => p.id === currentPage.id)
    : -1;
  const selectedPageHasLanded =
    selectedPageIndex >= 0 &&
    selectedPageIndex === currentIndex &&
    !isTransitioning &&
    targetIndex === null;
  const selectedPageAccent =
    selectedPageIndex >= 0
      ? pageAccentForPage(
          currentPage!,
          selectedPageIndex,
          selectedPageHasLanded ? 0.496 : 0.192,
        )
      : isEnv
        ? globalSettingsAccent
        : null;

  const renderLayer = (layer: ProjectLayerSpec, index = 0) => {
    const meta = layer.metadata as Record<string, string | undefined>;
    const envStyle = state.environment.layerStyles[layer.id] ?? {};
    const envVisible = state.environment.defaultVisibleLayers.includes(
      layer.id,
    );
    const effectiveLayerVisible = currentPage
      ? isVisibilityOverridden(currentPage, layer.id)
        ? currentPage.visibilityOverrides?.[layer.id] === true
        : envVisible
      : envVisible;
    const isGeology = layer.id === "bedrock-geology";
    const isTrees = layer.id === "trees-vri";
    const isEzGamma = layer.id === "ez-gamma-2024";
    const isGeochem = layer.id === "geochem-soils-2024";
    const isHyperspectral = layer.id === "hyperspectral-coverage-2024";
    const isImageryLidar = layer.id === "imagery-lidar-aoi-2024";
    const isAreaOutlines = layer.id === "area-outlines";
    const isShahbaziGroundSurface =
      layer.id === SHAHBAZI_GROUND_SURFACE_LAYER_ID;
    const isShahbaziGroundContours =
      layer.id === SHAHBAZI_GROUND_CONTOUR_LAYER_ID;
    const isPointCloud = layer.type === "pointcloud";
    const isUtahForgeStationMarkers =
      layer.id === UTAH_FORGE_MT_STATIONS_LAYER_ID;
    const isUtahForgeScalarLayer = UTAH_FORGE_SCALAR_LAYER_IDS.has(layer.id);
    const isUtahForgeFullDensityScalarLayer =
      layer.id === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID;
    const isUtahForgeTopSurface =
      layer.id === UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID;
    const isUtahForgeResistivitySlices =
      layer.id === UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID;
    const isUtahForgeMtVolume =
      layer.id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID;
    const isUtahForgeMtThresholdSurfaces =
      layer.id === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID;
    const isUtahForgeSeismicBrowser =
      layer.id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID;
    const hasSpecializedOpacityOwner =
      isUtahForgeSeismicBrowser ||
      isUtahForgeMtVolume ||
      isUtahForgeMtThresholdSurfaces;
    const isTopoMapGraticule = isTopoMapGraticuleLayer(layer);
    const isPublicTerrainSurface = isTopoMapSurfaceLayer(layer);
    const isPublicSurfaceContextLayer = isTopoMapLayer(layer);
    const isLakes = layer.id === "hydrography-lakes";
    const isUtahForgeSurfaceGuide =
      layer.id === UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID ||
      layer.id === UTAH_FORGE_SITE_BOUNDARY_LAYER_ID;
    const hasInfillAndOutline =
      isLakes || isImageryLidar || isUtahForgeSurfaceGuide;
    const isStreams = layer.id === "hydrography-streams";
    const lineWidthDefault = isTopoMapGraticule
      ? 1.15
      : LINE_WIDTH_LAYER_DEFAULTS[layer.id];
    const supportsLineWidth = lineWidthDefault !== undefined;
    const globalFogDensity =
      state.environment.scene?.fog?.density ?? DEFAULT_FOG_DENSITY;
    const envAffectedByFog = envStyle.affectedByFog !== false;
    const effectiveLayerStyle = currentPage
      ? effectiveStyle(state.environment, currentPage, layer.id)
      : envStyle;
    const effectiveSceneSectionStyle = currentPage
      ? effectiveStyle(
          state.environment,
          currentPage,
          UTAH_FORGE_SCENE_SECTION_LAYER_ID,
        )
      : (state.environment.layerStyles[UTAH_FORGE_SCENE_SECTION_LAYER_ID] ??
        {});
    const effectiveAffectedByFog = effectiveLayerStyle.affectedByFog !== false;
    const surfaceGradientOverridden =
      currentPage !== null &&
      SURFACE_GRADIENT_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );
    const scalarRampOverridden =
      currentPage !== null &&
      SCALAR_RAMP_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );
    const mtTopSurfaceOverridden =
      currentPage !== null &&
      MT_TOP_SURFACE_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );
    const mtVolumeOverridden =
      currentPage !== null &&
      MT_VOLUME_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );
    const mtThresholdSurfaceOverridden =
      currentPage !== null &&
      MT_THRESHOLD_SURFACE_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );
    const seismicBrowserOverridden =
      currentPage !== null &&
      SEISMIC_BROWSER_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );

    return (
      <div
        key={layer.id}
        data-dev-source="src/editor/LayerPanel.tsx:937"
        data-dev-note="layerItemStyle controls spacing and separators for individual layer rows."
        style={{
          ...layerItemStyle,
          ...(index === 0 ? firstLayerItemStyle : {}),
        }}
      >
        <div style={panelStyles.sectionHeader}>
          <div
            style={panelStyles.checkboxRow}
            data-dev-source="src/editor/styles.ts:82"
            data-dev-note="panelStyles.checkboxRow controls layer-title row alignment."
          >
            <span
              style={{
                ...panelStyles.layerLabel,
                color: effectiveLayerVisible
                  ? vibrancyLabel
                  : vibrancyTertiaryLabel,
              }}
              data-dev-text-source="src/editor/LayerPanel.tsx:116"
            >
              {editorLayerLabel(layer)}
            </span>
          </div>
          <span
            style={{
              ...panelStyles.layerType,
              color: effectiveLayerVisible
                ? vibrancySecondaryLabel
                : vibrancyTertiaryLabel,
            }}
          >
            {layer.type}
          </span>
        </div>

        <div
          style={layerControlsStyle}
          data-dev-source="src/editor/LayerPanel.tsx:946"
          data-dev-note="layerControlsStyle controls indentation of Visible, Appearance, Labels, and Provenance under each layer."
        >
          {isTrees && isEnv ? (
            <EnvTreeVisibilityToggle
              visible={envVisible}
              onToggle={() => toggleEnvDefaultVisible(layer.id)}
            />
          ) : isTrees && currentPage ? (
            <PageTreeVisibilityToggle
              page={currentPage}
              layerId={layer.id}
              envVisible={envVisible}
              onSet={(v) =>
                setPageVisibilityOverride(currentPage.id, layer.id, v)
              }
              onClear={() =>
                clearPageVisibilityOverride(currentPage.id, layer.id)
              }
            />
          ) : isEnv ? (
            <EnvVisibilityRow
              visible={envVisible}
              onToggle={() => toggleEnvDefaultVisible(layer.id)}
            />
          ) : currentPage ? (
            <PageVisibilityRow
              page={currentPage}
              layerId={layer.id}
              envVisible={envVisible}
              onSet={(v) =>
                setPageVisibilityOverride(currentPage.id, layer.id, v)
              }
              onClear={() =>
                clearPageVisibilityOverride(currentPage.id, layer.id)
              }
            />
          ) : null}

          {effectiveLayerVisible ? (
            <>
              {!isAreaOutlines ? (
                <details style={nestedDetailsStyle}>
                  <summary style={panelStyles.summary}>Appearance</summary>
                  <div style={detailsContentStyle}>
                    {!isUtahForgeSeismicBrowser &&
                    !isPublicTerrainSurface &&
                    isEnv ? (
                      <EnvStyleRow
                        label={hasInfillAndOutline ? "Infill color" : "Color"}
                        inputType="color"
                        value={(envStyle.color as string) ?? "#cccccc"}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, { color: v })
                        }
                      />
                    ) : !isUtahForgeSeismicBrowser &&
                      !isPublicTerrainSurface &&
                      currentPage ? (
                      <PageStyleRow
                        label={hasInfillAndOutline ? "Infill color" : "Color"}
                        inputType="color"
                        inheritedValue={
                          effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).color as string | undefined
                        }
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "color",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]?.color as
                            | string
                            | undefined
                        }
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            color: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "color",
                          )
                        }
                      />
                    ) : null}

                    {hasInfillAndOutline && isEnv ? (
                      <EnvStyleRow
                        label="Infill opacity"
                        inputType="range"
                        value={String(
                          (envStyle.fillOpacity as number | undefined) ??
                            (envStyle.opacity as number | undefined) ??
                            1,
                        )}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            fillOpacity: parseFloat(v),
                          })
                        }
                      />
                    ) : hasInfillAndOutline && currentPage ? (
                      <PageStyleRow
                        label="Infill opacity"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).fillOpacity as number | undefined) ??
                            (effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).opacity as number | undefined) ??
                            1,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "fillOpacity",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.fillOpacity !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .fillOpacity,
                              )
                            : undefined
                        }
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            fillOpacity: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "fillOpacity",
                          )
                        }
                      />
                    ) : null}

                    {hasInfillAndOutline && isEnv ? (
                      <EnvStyleRow
                        label="Outline color"
                        inputType="color"
                        value={
                          (envStyle.outlineColor as string | undefined) ??
                          (envStyle.color as string | undefined) ??
                          "#111111"
                        }
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, { outlineColor: v })
                        }
                      />
                    ) : hasInfillAndOutline && currentPage ? (
                      <PageStyleRow
                        label="Outline color"
                        inputType="color"
                        inheritedValue={
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).outlineColor as string | undefined) ??
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).color as string | undefined)
                        }
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "outlineColor",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.outlineColor as string | undefined
                        }
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            outlineColor: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "outlineColor",
                          )
                        }
                      />
                    ) : null}

                    {!hasSpecializedOpacityOwner && isEnv ? (
                      <EnvStyleRow
                        label={
                          hasInfillAndOutline ? "Outline opacity" : "Opacity"
                        }
                        inputType="range"
                        value={String(
                          (envStyle.opacity as number | undefined) ?? 1,
                        )}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, { opacity: parseFloat(v) })
                        }
                      />
                    ) : !hasSpecializedOpacityOwner && currentPage ? (
                      <PageStyleRow
                        label={
                          hasInfillAndOutline ? "Outline opacity" : "Opacity"
                        }
                        inputType="range"
                        inheritedValue={String(
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).opacity as number | undefined) ?? 1,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "opacity",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]?.opacity !==
                          undefined
                            ? String(
                                currentPage.layerOverrides[layer.id].opacity,
                              )
                            : undefined
                        }
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            opacity: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "opacity",
                          )
                        }
                      />
                    ) : null}

                    {isShahbaziGroundSurface ? (
                      <SurfaceGradientControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        disabled={!isEnv && !surfaceGradientOverridden}
                        isPageOverride={!isEnv}
                        overridden={surfaceGradientOverridden}
                        onToggleOverride={
                          currentPage
                            ? (enabled) => {
                                if (enabled) {
                                  setPageLayerOverride(
                                    currentPage.id,
                                    layer.id,
                                    surfaceGradientPatchFromStyle(
                                      effectiveLayerStyle,
                                    ),
                                  );
                                } else {
                                  for (const field of SURFACE_GRADIENT_FIELDS) {
                                    clearPageLayerOverride(
                                      currentPage.id,
                                      layer.id,
                                      field,
                                    );
                                  }
                                }
                              }
                            : undefined
                        }
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isUtahForgeScalarLayer ? (
                      <ScalarRampControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        targetLabel={scalarControlTargetLabel(layer.id)}
                        fullDensityMode={isUtahForgeFullDensityScalarLayer}
                        disabled={!isEnv && !scalarRampOverridden}
                        isPageOverride={!isEnv}
                        overridden={scalarRampOverridden}
                        volumeThresholdMode={isUtahForgeMtVolume}
                        onToggleOverride={
                          currentPage
                            ? (enabled) => {
                                if (enabled) {
                                  setPageLayerOverride(
                                    currentPage.id,
                                    layer.id,
                                    scalarRampPatchFromStyle(
                                      effectiveLayerStyle,
                                    ),
                                  );
                                } else {
                                  for (const field of SCALAR_RAMP_FIELDS) {
                                    clearPageLayerOverride(
                                      currentPage.id,
                                      layer.id,
                                      field,
                                    );
                                  }
                                }
                              }
                            : undefined
                        }
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isUtahForgeTopSurface ? (
                      <MtTopSurfaceControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        disabled={!isEnv && !mtTopSurfaceOverridden}
                        isPageOverride={!isEnv}
                        overridden={mtTopSurfaceOverridden}
                        onToggleOverride={
                          currentPage
                            ? (enabled) => {
                                if (enabled) {
                                  setPageLayerOverride(
                                    currentPage.id,
                                    layer.id,
                                    mtTopSurfacePatchFromStyle(
                                      effectiveLayerStyle,
                                    ),
                                  );
                                } else {
                                  for (const field of MT_TOP_SURFACE_FIELDS) {
                                    clearPageLayerOverride(
                                      currentPage.id,
                                      layer.id,
                                      field,
                                    );
                                  }
                                }
                              }
                            : undefined
                        }
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isUtahForgeScalarLayer ? (
                      <LayerBooleanStyleControl
                        label="Value legend"
                        field={SCALAR_LEGEND_FIELD}
                        fallback={true}
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        isEnv={isEnv}
                        currentPage={currentPage}
                        layerId={layer.id}
                        setEnvLayerStyle={setEnvLayerStyle}
                        setPageLayerOverride={setPageLayerOverride}
                        clearPageLayerOverride={clearPageLayerOverride}
                      />
                    ) : null}

                    {isUtahForgeFullDensityScalarLayer ? (
                      <LayerNumberStyleControl
                        label="Distance light"
                        field="scalarDistanceLightStrength"
                        fallback={0.35}
                        min={0}
                        max={1}
                        step={0.01}
                        decimals={2}
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        isEnv={isEnv}
                        currentPage={currentPage}
                        layerId={layer.id}
                        setEnvLayerStyle={setEnvLayerStyle}
                        setPageLayerOverride={setPageLayerOverride}
                        clearPageLayerOverride={clearPageLayerOverride}
                      />
                    ) : null}

                    {isUtahForgeFullDensityScalarLayer ? (
                      <ScalarPointDrawReadout
                        sceneHandle={sceneHandle}
                        layerId={layer.id}
                        inclusionMode={
                          effectiveLayerStyle.scalarInclusionMode ===
                          "thresholded"
                            ? "thresholded"
                            : "all-valid"
                        }
                      />
                    ) : null}

                    {isUtahForgeStationMarkers ? (
                      <>
                        <PointMarkerControls
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <MtStationQcControls
                          layer={layer}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                      </>
                    ) : null}

                    {isPointCloud && isEnv ? (
                      <EnvStyleRow
                        label="Point size"
                        inputType="range"
                        value={String(
                          (envStyle.pointSizePx as number | undefined) ?? 4,
                        )}
                        min={1}
                        max={12}
                        step={0.25}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            pointSizePx: parseFloat(v),
                          })
                        }
                      />
                    ) : isPointCloud && currentPage ? (
                      <PageStyleRow
                        label="Point size"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).pointSizePx as number | undefined) ?? 4,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "pointSizePx",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.pointSizePx !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .pointSizePx,
                              )
                            : undefined
                        }
                        min={1}
                        max={12}
                        step={0.25}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            pointSizePx: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "pointSizePx",
                          )
                        }
                      />
                    ) : null}

                    {isTrees && isEnv ? (
                      <EnvStyleRow
                        label="Edge cut"
                        inputType="range"
                        value={String(
                          (envStyle.forestEdgeThreshold as
                            | number
                            | undefined) ?? 0.5,
                        )}
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            forestEdgeThreshold: parseFloat(v),
                          })
                        }
                      />
                    ) : isTrees && currentPage ? (
                      <PageStyleRow
                        label="Edge cut"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.forestEdgeThreshold as
                            | number
                            | undefined) ?? 0.5,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "forestEdgeThreshold",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.forestEdgeThreshold !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .forestEdgeThreshold,
                              )
                            : undefined
                        }
                        fallbackValue="0.5"
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            forestEdgeThreshold: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "forestEdgeThreshold",
                          )
                        }
                      />
                    ) : null}

                    {isTrees && isEnv ? (
                      <EnvStyleRow
                        label="Edge soft"
                        inputType="range"
                        value={String(
                          (envStyle.forestEdgeSoftness as number | undefined) ??
                            0.035,
                        )}
                        min={0}
                        max={0.25}
                        step={0.005}
                        decimals={3}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            forestEdgeSoftness: parseFloat(v),
                          })
                        }
                      />
                    ) : isTrees && currentPage ? (
                      <PageStyleRow
                        label="Edge soft"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.forestEdgeSoftness as
                            | number
                            | undefined) ?? 0.035,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "forestEdgeSoftness",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.forestEdgeSoftness !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .forestEdgeSoftness,
                              )
                            : undefined
                        }
                        fallbackValue="0.035"
                        min={0}
                        max={0.25}
                        step={0.005}
                        decimals={3}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            forestEdgeSoftness: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "forestEdgeSoftness",
                          )
                        }
                      />
                    ) : null}

                    {!isPublicSurfaceContextLayer && isEnv ? (
                      <EnvAffectedByFogRow
                        value={envAffectedByFog}
                        onToggle={() =>
                          setEnvLayerStyle(layer.id, {
                            affectedByFog: !envAffectedByFog,
                          })
                        }
                      />
                    ) : !isPublicSurfaceContextLayer && currentPage ? (
                      <PageAffectedByFogRow
                        page={currentPage}
                        layerId={layer.id}
                        envValue={envStyle.affectedByFog !== false}
                        onSet={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            affectedByFog: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "affectedByFog",
                          )
                        }
                      />
                    ) : null}

                    {!isPublicSurfaceContextLayer &&
                    envAffectedByFog &&
                    isEnv ? (
                      <EnvStyleRow
                        label="Fog dens."
                        inputType="range"
                        value={String(
                          ((envStyle.fogDensity as number | undefined) ??
                            globalFogDensity) * 10000,
                        )}
                        min={FOG_DENSITY_UI_MIN}
                        max={FOG_DENSITY_UI_MAX}
                        step={FOG_DENSITY_UI_STEP}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            fogDensity: parseFloat(v) / 10000,
                          })
                        }
                      />
                    ) : !isPublicSurfaceContextLayer &&
                      effectiveAffectedByFog &&
                      currentPage ? (
                      <PageStyleRow
                        label="Fog dens."
                        inputType="range"
                        inheritedValue={String(
                          ((effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).fogDensity as number | undefined) ??
                            globalFogDensity) * 10000,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "fogDensity",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]?.fogDensity !==
                          undefined
                            ? String(
                                (currentPage.layerOverrides[layer.id]
                                  .fogDensity as number) * 10000,
                              )
                            : undefined
                        }
                        fallbackValue={String(globalFogDensity * 10000)}
                        min={FOG_DENSITY_UI_MIN}
                        max={FOG_DENSITY_UI_MAX}
                        step={FOG_DENSITY_UI_STEP}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            fogDensity: parseFloat(v) / 10000,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "fogDensity",
                          )
                        }
                      />
                    ) : null}

                    {supportsLineWidth && !isEzGamma && isEnv ? (
                      <EnvStyleRow
                        label="Line width"
                        inputType="range"
                        value={String(
                          (envStyle.lineWidth as number | undefined) ??
                            lineWidthDefault,
                        )}
                        min={0.5}
                        max={6}
                        step={0.25}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            lineWidth: parseFloat(v),
                          })
                        }
                      />
                    ) : supportsLineWidth && !isEzGamma && currentPage ? (
                      <PageStyleRow
                        label="Line width"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).lineWidth as number | undefined) ??
                            lineWidthDefault,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "lineWidth",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]?.lineWidth !==
                          undefined
                            ? String(
                                currentPage.layerOverrides[layer.id].lineWidth,
                              )
                            : undefined
                        }
                        fallbackValue={String(lineWidthDefault)}
                        min={0.5}
                        max={6}
                        step={0.25}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            lineWidth: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "lineWidth",
                          )
                        }
                      />
                    ) : null}

                    {isTopoMapGraticule ? (
                      <>
                        <LayerBooleanStyleControl
                          label="Labels"
                          field="graticuleLabelVisible"
                          fallback={true}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <LayerNumberStyleControl
                          label="Label size"
                          field="graticuleLabelSizeM"
                          fallback={9000}
                          min={1500}
                          max={60000}
                          step={500}
                          decimals={0}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <LayerNumberStyleControl
                          label="Surface lift"
                          field="graticuleLiftM"
                          fallback={24}
                          min={0}
                          max={500}
                          step={4}
                          decimals={0}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <LayerBooleanStyleControl
                          label="Edge fade aware"
                          field="graticuleEdgeFadeAware"
                          fallback={true}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <LayerNumberStyleControl
                          label="Edge strength"
                          field="graticuleEdgeFadeStrength"
                          fallback={1}
                          min={0}
                          max={1}
                          step={0.05}
                          decimals={2}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-strength"
                        />
                        <LayerColorStyleControl
                          label="Edge line"
                          field="graticuleEdgeLineColor"
                          fallback="#ffffff"
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-line-color"
                        />
                        <LayerNumberStyleControl
                          label="Edge line weight"
                          field="graticuleEdgeLineWidth"
                          fallback={4.75}
                          min={0.1}
                          max={32}
                          step={0.25}
                          decimals={2}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-line-width"
                        />
                        <LayerColorStyleControl
                          label="Edge label"
                          field="graticuleEdgeLabelColor"
                          fallback="#ffffff"
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-label-color"
                        />
                        <LayerBooleanStyleControl
                          label="Fade labels"
                          field="graticuleEdgeLabelVisible"
                          fallback={true}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <LayerNumberStyleControl
                          label="Label offset"
                          field="graticuleEdgeLabelOffsetM"
                          fallback={90000}
                          min={0}
                          max={160000}
                          step={1000}
                          decimals={0}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-label-offset"
                        />
                        <LayerNumberStyleControl
                          label="Label gap"
                          field="graticuleEdgeLabelGapM"
                          fallback={22000}
                          min={-100000}
                          max={100000}
                          step={1000}
                          decimals={0}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-label-gap"
                        />
                      </>
                    ) : null}

                    {isShahbaziGroundContours
                      ? CONTOUR_DISTANCE_STYLE_CONTROLS.map((control) =>
                          isEnv ? (
                            <EnvStyleRow
                              key={control.field}
                              label={control.label}
                              inputType="range"
                              value={String(
                                styleNumber(
                                  envStyle,
                                  control.field,
                                  control.fallback,
                                ),
                              )}
                              min={control.min}
                              max={control.max}
                              step={control.step}
                              decimals={control.decimals}
                              onChange={(v) =>
                                setEnvLayerStyle(layer.id, {
                                  [control.field]: parseFloat(v),
                                } as Partial<EditableStyle>)
                              }
                            />
                          ) : currentPage ? (
                            <PageStyleRow
                              key={control.field}
                              label={control.label}
                              inputType="range"
                              inheritedValue={String(
                                styleNumber(
                                  effectiveLayerStyle,
                                  control.field,
                                  control.fallback,
                                ),
                              )}
                              isOverridden={isStyleFieldOverridden(
                                currentPage,
                                layer.id,
                                control.field,
                              )}
                              overrideValue={
                                currentPage.layerOverrides?.[layer.id]?.[
                                  control.field
                                ] !== undefined
                                  ? String(
                                      currentPage.layerOverrides[layer.id][
                                        control.field
                                      ],
                                    )
                                  : undefined
                              }
                              fallbackValue={String(control.fallback)}
                              min={control.min}
                              max={control.max}
                              step={control.step}
                              decimals={control.decimals}
                              onOverride={(v) =>
                                setPageLayerOverride(currentPage.id, layer.id, {
                                  [control.field]: parseFloat(v),
                                } as Partial<EditableStyle>)
                              }
                              onClear={() =>
                                clearPageLayerOverride(
                                  currentPage.id,
                                  layer.id,
                                  control.field,
                                )
                              }
                            />
                          ) : null,
                        )
                      : null}

                    {isEzGamma && isEnv ? (
                      <EnvStyleRow
                        label="Track offset"
                        inputType="range"
                        value={String(
                          (envStyle.gammaTrackOffsetM as number | undefined) ??
                            36,
                        )}
                        min={0}
                        max={220}
                        step={5}
                        decimals={0}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            gammaTrackOffsetM: parseFloat(v),
                          })
                        }
                      />
                    ) : isEzGamma && currentPage ? (
                      <PageStyleRow
                        label="Track offset"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.gammaTrackOffsetM as
                            | number
                            | undefined) ?? 36,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "gammaTrackOffsetM",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.gammaTrackOffsetM !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .gammaTrackOffsetM,
                              )
                            : undefined
                        }
                        fallbackValue="36"
                        min={0}
                        max={220}
                        step={5}
                        decimals={0}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            gammaTrackOffsetM: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "gammaTrackOffsetM",
                          )
                        }
                      />
                    ) : null}

                    {isEzGamma && isEnv ? (
                      <EnvStyleRow
                        label="Track width"
                        inputType="range"
                        value={String(
                          (envStyle.gammaTrackWidthM as number | undefined) ??
                            78,
                        )}
                        min={20}
                        max={220}
                        step={5}
                        decimals={0}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            gammaTrackWidthM: parseFloat(v),
                          })
                        }
                      />
                    ) : isEzGamma && currentPage ? (
                      <PageStyleRow
                        label="Track width"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.gammaTrackWidthM as
                            | number
                            | undefined) ?? 78,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "gammaTrackWidthM",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.gammaTrackWidthM !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .gammaTrackWidthM,
                              )
                            : undefined
                        }
                        fallbackValue="78"
                        min={20}
                        max={220}
                        step={5}
                        decimals={0}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            gammaTrackWidthM: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "gammaTrackWidthM",
                          )
                        }
                      />
                    ) : null}

                    {isEzGamma && isEnv ? (
                      <EnvStyleRow
                        label="Depth scale"
                        inputType="range"
                        value={String(
                          (envStyle.gammaDepthScale as number | undefined) ?? 1,
                        )}
                        min={0.2}
                        max={1.8}
                        step={0.05}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            gammaDepthScale: parseFloat(v),
                          })
                        }
                      />
                    ) : isEzGamma && currentPage ? (
                      <PageStyleRow
                        label="Depth scale"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.gammaDepthScale as
                            | number
                            | undefined) ?? 1,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "gammaDepthScale",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.gammaDepthScale !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .gammaDepthScale,
                              )
                            : undefined
                        }
                        fallbackValue="1"
                        min={0.2}
                        max={1.8}
                        step={0.05}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            gammaDepthScale: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "gammaDepthScale",
                          )
                        }
                      />
                    ) : null}

                    {isEzGamma && isEnv ? (
                      <EnvStyleRow
                        label="Panel opacity"
                        inputType="range"
                        value={String(
                          (envStyle.gammaPanelOpacity as number | undefined) ??
                            0,
                        )}
                        min={0}
                        max={1}
                        step={0.05}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            gammaPanelOpacity: parseFloat(v),
                          })
                        }
                      />
                    ) : isEzGamma && currentPage ? (
                      <PageStyleRow
                        label="Panel opacity"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.gammaPanelOpacity as
                            | number
                            | undefined) ?? 0,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "gammaPanelOpacity",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.gammaPanelOpacity !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .gammaPanelOpacity,
                              )
                            : undefined
                        }
                        fallbackValue="0"
                        min={0}
                        max={1}
                        step={0.05}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            gammaPanelOpacity: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "gammaPanelOpacity",
                          )
                        }
                      />
                    ) : null}

                    {isEzGamma ? (
                      <EzGammaStyleControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isGeochem ? (
                      <GeochemStyleControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isHyperspectral ? (
                      <HyperspectralStyleControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isImageryLidar ? (
                      <ImageryLidarStyleControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isAreaOutlines && isEnv ? (
                      <AreaOutlinesControls
                        outlines={state.environment.scene?.areaOutlines ?? []}
                        viewCenter={[
                          Math.round(
                            sceneHandle.controls.target.x +
                              SCENE_ORIGIN.easting,
                          ),
                          Math.round(
                            sceneHandle.controls.target.y +
                              SCENE_ORIGIN.northing,
                          ),
                        ]}
                        onChange={(outlines) =>
                          setEnvScene({
                            areaOutlines: outlines,
                          })
                        }
                      />
                    ) : null}

                    {isStreams && isEnv ? (
                      <EnvStyleRow
                        label="Terrain shade"
                        inputType="range"
                        value={String(
                          (envStyle.terrainShadowInfluence as
                            | number
                            | undefined) ?? 0.09,
                        )}
                        min={0}
                        max={1}
                        step={0.05}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            terrainShadowInfluence: parseFloat(v),
                          })
                        }
                      />
                    ) : isStreams && currentPage ? (
                      <PageStyleRow
                        label="Terrain shade"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).terrainShadowInfluence as number | undefined) ??
                            0.09,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "terrainShadowInfluence",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.terrainShadowInfluence !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .terrainShadowInfluence,
                              )
                            : undefined
                        }
                        fallbackValue="0.09"
                        min={0}
                        max={1}
                        step={0.05}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            terrainShadowInfluence: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "terrainShadowInfluence",
                          )
                        }
                      />
                    ) : null}
                  </div>
                </details>
              ) : (
                <div style={detailsContentStyle}>
                  {isEnv ? (
                    <AreaOutlinesControls
                      outlines={state.environment.scene?.areaOutlines ?? []}
                      viewCenter={[
                        Math.round(
                          sceneHandle.controls.target.x + SCENE_ORIGIN.easting,
                        ),
                        Math.round(
                          sceneHandle.controls.target.y + SCENE_ORIGIN.northing,
                        ),
                      ]}
                      onChange={(outlines) =>
                        setEnvScene({
                          areaOutlines: outlines,
                        })
                      }
                    />
                  ) : null}
                </div>
              )}

              {isUtahForgeResistivitySlices ? (
                <ResistivitySliceControls
                  style={isEnv ? envStyle : effectiveLayerStyle}
                  isEnv={isEnv}
                  currentPage={currentPage}
                  layerId={layer.id}
                  setEnvLayerStyle={setEnvLayerStyle}
                  setPageLayerOverride={setPageLayerOverride}
                  clearPageLayerOverride={clearPageLayerOverride}
                />
              ) : null}

              {isUtahForgeMtVolume ? (
                <MtVolumeControls
                  layer={layer}
                  style={isEnv ? envStyle : effectiveLayerStyle}
                  disabled={!isEnv && !mtVolumeOverridden}
                  isEnv={isEnv}
                  currentPage={currentPage}
                  layerId={layer.id}
                  sceneSectionStyle={effectiveSceneSectionStyle}
                  sceneHandle={sceneHandle}
                  setEnvLayerStyle={setEnvLayerStyle}
                  setPageLayerOverride={setPageLayerOverride}
                  clearPageLayerOverride={clearPageLayerOverride}
                  onToggleOverride={
                    currentPage
                      ? (enabled) => {
                          if (enabled) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              mtVolumePatchFromStyle(effectiveLayerStyle),
                            );
                          } else {
                            for (const field of MT_VOLUME_FIELDS) {
                              clearPageLayerOverride(
                                currentPage.id,
                                layer.id,
                                field,
                              );
                            }
                          }
                        }
                      : undefined
                  }
                />
              ) : null}

              {isUtahForgeMtThresholdSurfaces ? (
                <MtThresholdSurfaceControls
                  layer={layer}
                  style={isEnv ? envStyle : effectiveLayerStyle}
                  disabled={!isEnv && !mtThresholdSurfaceOverridden}
                  isEnv={isEnv}
                  currentPage={currentPage}
                  layerId={layer.id}
                  setEnvLayerStyle={setEnvLayerStyle}
                  setPageLayerOverride={setPageLayerOverride}
                  clearPageLayerOverride={clearPageLayerOverride}
                  onToggleOverride={
                    currentPage
                      ? (enabled) => {
                          if (enabled) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              mtThresholdSurfacePatchFromStyle(
                                effectiveLayerStyle,
                              ),
                            );
                          } else {
                            for (const field of MT_THRESHOLD_SURFACE_FIELDS) {
                              clearPageLayerOverride(
                                currentPage.id,
                                layer.id,
                                field,
                              );
                            }
                          }
                        }
                      : undefined
                  }
                />
              ) : null}

              {isUtahForgeSeismicBrowser ? (
                <SeismicBrowserControls
                  layer={layer}
                  style={isEnv ? envStyle : effectiveLayerStyle}
                  disabled={!isEnv && currentPage === null}
                  isEnv={isEnv}
                  currentPage={currentPage}
                  layerId={layer.id}
                  overridden={seismicBrowserOverridden}
                  sceneSectionStyle={effectiveSceneSectionStyle}
                  sceneHandle={sceneHandle}
                  onToggleOverride={
                    currentPage
                      ? (enabled) => {
                          if (enabled) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              seismicBrowserPatchFromStyle(
                                effectiveLayerStyle,
                                layer,
                              ),
                            );
                          } else {
                            for (const field of SEISMIC_BROWSER_FIELDS) {
                              clearPageLayerOverride(
                                currentPage.id,
                                layer.id,
                                field,
                              );
                            }
                          }
                        }
                      : undefined
                  }
                  setEnvLayerStyle={setEnvLayerStyle}
                  setPageLayerOverride={setPageLayerOverride}
                />
              ) : null}

              {isTrees ? (
                <details style={nestedDetailsStyle}>
                  <summary style={panelStyles.summary}>Emboss</summary>
                  <div style={detailsContentStyle}>
                    {isEnv ? (
                      <EnvStyleRow
                        label="Height"
                        inputType="range"
                        value={String(
                          (envStyle.forestEmbossHeight as number | undefined) ??
                            0,
                        )}
                        min={0}
                        max={100}
                        step={1}
                        decimals={0}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            forestEmbossHeight: parseFloat(v),
                          })
                        }
                      />
                    ) : currentPage ? (
                      <PageStyleRow
                        label="Height"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.forestEmbossHeight as
                            | number
                            | undefined) ?? 0,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "forestEmbossHeight",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.forestEmbossHeight !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .forestEmbossHeight,
                              )
                            : undefined
                        }
                        fallbackValue="0"
                        min={0}
                        max={100}
                        step={1}
                        decimals={0}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            forestEmbossHeight: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "forestEmbossHeight",
                          )
                        }
                      />
                    ) : null}
                  </div>
                </details>
              ) : null}

              {!isAreaOutlines ? (
                <details style={nestedDetailsStyle}>
                  <summary style={panelStyles.summary}>Labels</summary>
                  <div style={detailsContentStyle}>
                    {isEnv ? (
                      <>
                        <EnvStyleRow
                          label="Text color"
                          inputType="color"
                          value={labelTextControlValue(envStyle)}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, { labelTextColor: v })
                          }
                        />
                        <EnvStyleRow
                          label="Text opacity"
                          inputType="range"
                          value={String(
                            (envStyle.labelTextOpacity as number | undefined) ??
                              1,
                          )}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, {
                              labelTextOpacity: parseFloat(v),
                            })
                          }
                        />
                        <EnvStyleRow
                          label="Outline color"
                          inputType="color"
                          value={labelOutlineColorControlValue(envStyle)}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, { labelOutlineColor: v })
                          }
                        />
                        <EnvStyleRow
                          label="Outline opacity"
                          inputType="range"
                          value={String(
                            labelOutlineOpacityControlValue(envStyle),
                          )}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, {
                              labelOutlineOpacity: parseFloat(v),
                            })
                          }
                        />
                        <EnvStyleRow
                          label="Fill color"
                          inputType="color"
                          value={labelFillColorControlValue(envStyle)}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, { labelFillColor: v })
                          }
                        />
                        <EnvStyleRow
                          label="Fill opacity"
                          inputType="range"
                          value={String(labelFillOpacityControlValue(envStyle))}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, {
                              labelFillOpacity: parseFloat(v),
                            })
                          }
                        />
                      </>
                    ) : currentPage ? (
                      <>
                        <PageStyleRow
                          label="Text color"
                          inputType="color"
                          inheritedValue={labelTextControlValue(
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ),
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelTextColor",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelTextColor as string | undefined
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelTextColor: v,
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelTextColor",
                            )
                          }
                        />
                        <PageStyleRow
                          label="Text opacity"
                          inputType="range"
                          inheritedValue={String(
                            (effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).labelTextOpacity as number | undefined) ?? 1,
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelTextOpacity",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelTextOpacity !== undefined
                              ? String(
                                  currentPage.layerOverrides[layer.id]
                                    .labelTextOpacity,
                                )
                              : undefined
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelTextOpacity: parseFloat(v),
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelTextOpacity",
                            )
                          }
                        />
                        <PageStyleRow
                          label="Outline color"
                          inputType="color"
                          inheritedValue={labelOutlineColorControlValue(
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ),
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelOutlineColor",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelOutlineColor as string | undefined
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelOutlineColor: v,
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelOutlineColor",
                            )
                          }
                        />
                        <PageStyleRow
                          label="Outline opacity"
                          inputType="range"
                          inheritedValue={String(
                            labelOutlineOpacityControlValue(
                              effectiveStyle(
                                state.environment,
                                currentPage,
                                layer.id,
                              ),
                            ),
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelOutlineOpacity",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelOutlineOpacity !== undefined
                              ? String(
                                  currentPage.layerOverrides[layer.id]
                                    .labelOutlineOpacity,
                                )
                              : undefined
                          }
                          fallbackValue={
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).labelKind === "landTitle"
                              ? String(LAND_TITLE_LABEL_OUTLINE_OPACITY_DEFAULT)
                              : "1"
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelOutlineOpacity: parseFloat(v),
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelOutlineOpacity",
                            )
                          }
                        />
                        <PageStyleRow
                          label="Fill color"
                          inputType="color"
                          inheritedValue={labelFillColorControlValue(
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ),
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelFillColor",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelFillColor as string | undefined
                          }
                          fallbackValue={
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).labelKind === "landTitle"
                              ? LAND_TITLE_LABEL_FILL_DEFAULT
                              : "#14161c"
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelFillColor: v,
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelFillColor",
                            )
                          }
                        />
                        <PageStyleRow
                          label="Fill opacity"
                          inputType="range"
                          inheritedValue={String(
                            labelFillOpacityControlValue(
                              effectiveStyle(
                                state.environment,
                                currentPage,
                                layer.id,
                              ),
                            ),
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelFillOpacity",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelFillOpacity !== undefined
                              ? String(
                                  currentPage.layerOverrides[layer.id]
                                    .labelFillOpacity,
                                )
                              : undefined
                          }
                          fallbackValue={
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).labelKind === "landTitle"
                              ? String(LAND_TITLE_LABEL_FILL_OPACITY_DEFAULT)
                              : "0.72"
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelFillOpacity: parseFloat(v),
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelFillOpacity",
                            )
                          }
                        />
                      </>
                    ) : null}

                    {isEnv ? (
                      <EnvLabelKindRow
                        value={normalizeLabelKind(envStyle.labelKind)}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, { labelKind: v })
                        }
                      />
                    ) : currentPage ? (
                      <PageLabelKindRow
                        page={currentPage}
                        layerId={layer.id}
                        envValue={normalizeLabelKind(envStyle.labelKind)}
                        onSet={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            labelKind: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "labelKind",
                          )
                        }
                      />
                    ) : null}

                    {isEnv ? (
                      <EnvLabelPointerVisibleRow
                        value={labelPointerVisibleControlValue(envStyle)}
                        onToggle={() =>
                          setEnvLayerStyle(layer.id, {
                            labelPointerVisible:
                              !labelPointerVisibleControlValue(envStyle),
                          })
                        }
                      />
                    ) : currentPage ? (
                      <PageLabelPointerVisibleRow
                        page={currentPage}
                        layerId={layer.id}
                        envValue={labelPointerVisibleControlValue(envStyle)}
                        onSet={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            labelPointerVisible: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "labelPointerVisible",
                          )
                        }
                      />
                    ) : null}

                    {(
                      isEnv
                        ? normalizeLabelKind(envStyle.labelKind) ===
                            "landTitle" &&
                          labelPointerVisibleControlValue(envStyle)
                        : currentPage &&
                          normalizeLabelKind(
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).labelKind,
                          ) === "landTitle" &&
                          labelPointerVisibleControlValue(
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ),
                          )
                    ) ? (
                      isEnv ? (
                        <EnvLabelPointerSideRow
                          value={
                            envStyle.labelPointerSide === "left" ||
                            envStyle.labelPointerSide === "right"
                              ? envStyle.labelPointerSide
                              : "auto"
                          }
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, { labelPointerSide: v })
                          }
                        />
                      ) : currentPage ? (
                        <PageLabelPointerSideRow
                          page={currentPage}
                          layerId={layer.id}
                          envValue={
                            envStyle.labelPointerSide === "left" ||
                            envStyle.labelPointerSide === "right"
                              ? envStyle.labelPointerSide
                              : "auto"
                          }
                          onSet={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelPointerSide: v,
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelPointerSide",
                            )
                          }
                        />
                      ) : null
                    ) : null}

                    {isEnv ? (
                      <EnvShowLabelsRow
                        value={envStyle.showLabels === true}
                        onToggle={() =>
                          setEnvLayerStyle(layer.id, {
                            showLabels: !(envStyle.showLabels === true),
                          })
                        }
                      />
                    ) : currentPage ? (
                      <PageShowLabelsRow
                        page={currentPage}
                        layerId={layer.id}
                        envValue={envStyle.showLabels === true}
                        onSet={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            showLabels: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "showLabels",
                          )
                        }
                      />
                    ) : null}
                  </div>
                </details>
              ) : null}

              <details style={nestedDetailsStyle}>
                <summary style={panelStyles.summary}>Provenance</summary>
                <div style={detailsContentStyle}>
                  <div style={nestedControlRowStyle}>
                    <label style={nestedFieldLabelStyle}>Source file</label>
                    <input
                      type="text"
                      value={meta.sourceFile ?? ""}
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          sourceFile: e.target.value,
                        })
                      }
                      style={panelStyles.textInput}
                    />
                  </div>
                  <div style={nestedControlRowStyle}>
                    <label style={nestedFieldLabelStyle}>Source date</label>
                    <input
                      type="text"
                      value={meta.sourceDate ?? ""}
                      placeholder="YYYY-MM-DD or source range"
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          sourceDate: e.target.value,
                        })
                      }
                      style={panelStyles.textInput}
                    />
                  </div>
                  <div style={nestedControlRowStyle}>
                    <label style={nestedFieldLabelStyle}>Origin</label>
                    <input
                      type="text"
                      value={meta.sourceOrigin ?? ""}
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          sourceOrigin: e.target.value,
                        })
                      }
                      style={panelStyles.textInput}
                    />
                  </div>
                  <div style={nestedControlRowStyle}>
                    <label style={nestedFieldLabelStyle}>Classification</label>
                    <select
                      value={meta.classification ?? "observation"}
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          classification: e.target.value,
                        })
                      }
                    >
                      {CLASSIFICATIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={nestedControlRowStyle}>
                    <label style={nestedFieldLabelStyle}>Confidentiality</label>
                    <select
                      value={meta.confidentiality ?? "public"}
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          confidentiality: e.target.value,
                        })
                      }
                    >
                      {CONFIDENTIALITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </details>

              {isGeology && isEnv && (
                <GeologySubUnitsPanel layerStyle={envStyle} />
              )}
            </>
          ) : null}
        </div>
      </div>
    );
  };

  const byId = new Map(state.manifest.layers.map((layer) => [layer.id, layer]));
  const projectPublicLayerGroups =
    state.projectSlug === "case-study-b"
      ? CASE_STUDY_B_PUBLIC_LAYER_GROUPS
      : state.projectSlug === "utah-forge"
        ? UTAH_FORGE_PUBLIC_LAYER_GROUPS
        : PUBLIC_LAYER_GROUPS;
  const publicTopoLayerIds = topoMapLayerIds(state.manifest.layers);
  const projectPublicTopoLayerGroups =
    publicTopoLayerIds.length > 0
      ? ([
          {
            title: PUBLIC_TOPO_LAYER_GROUP_TITLE,
            ids: publicTopoLayerIds,
          },
        ] as const satisfies readonly LayerGroupDef[])
      : ([] as const satisfies readonly LayerGroupDef[]);
  const projectCustomerLayerGroups =
    state.projectSlug === "case-study-b"
      ? CASE_STUDY_B_CUSTOMER_LAYER_GROUPS
      : state.projectSlug === "utah-forge"
        ? UTAH_FORGE_CUSTOMER_LAYER_GROUPS
        : CUSTOMER_LAYER_GROUPS;
  const projectLayerGroups = [
    ...projectPublicLayerGroups,
    ...projectPublicTopoLayerGroups,
    ...projectCustomerLayerGroups,
  ];
  const layerGroups =
    section === "public"
      ? projectPublicLayerGroups
      : section === "publicTopo"
        ? projectPublicTopoLayerGroups
        : projectCustomerLayerGroups;
  const groupedIds = new Set<string>(
    projectLayerGroups.flatMap((group) => group.ids),
  );
  const otherLayers = state.manifest.layers.filter(
    (layer) =>
      layerHasRenderableControl(layer) &&
      !groupedIds.has(layer.id) &&
      layerDataSection(layer) === section,
  );
  const utahForgeSeismicLayer =
    state.projectSlug === "utah-forge"
      ? byId.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID)
      : undefined;
  const sceneSectionStyle =
    state.projectSlug === "utah-forge"
      ? isEnv
        ? (state.environment.layerStyles[UTAH_FORGE_SCENE_SECTION_LAYER_ID] ??
          {})
        : currentPage
          ? effectiveStyle(
              state.environment,
              currentPage,
              UTAH_FORGE_SCENE_SECTION_LAYER_ID,
            )
          : (state.environment.layerStyles[UTAH_FORGE_SCENE_SECTION_LAYER_ID] ??
            {})
      : {};
  const sceneSectionDisabled =
    state.projectSlug === "utah-forge" && !isEnv && currentPage === null;
  const workingAreaFocusStyle =
    state.projectSlug === "utah-forge"
      ? isEnv
        ? (state.environment.layerStyles[
            UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID
          ] ?? {})
        : currentPage
          ? effectiveStyle(
              state.environment,
              currentPage,
              UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
            )
          : (state.environment.layerStyles[
              UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID
            ] ?? {})
      : {};
  const workingAreaFocusDisabled =
    state.projectSlug === "utah-forge" && !isEnv && currentPage === null;
  const publicTopoSettings = resolveTopoMapSettings({
    manifest: state.manifest,
    environment: state.environment,
    page: currentPage,
  });
  const publicTopoTerrainLayer = publicTopoSettings.surfaceLayer;
  const publicTopoTerrainLayerId = publicTopoSettings.surfaceLayerId;
  const publicTopoTerrainEnvVisible =
    state.environment.defaultVisibleLayers.includes(publicTopoTerrainLayerId);
  const publicTopoTerrainEffectiveVisible = currentPage
    ? isVisibilityOverridden(currentPage, publicTopoTerrainLayerId)
      ? currentPage.visibilityOverrides?.[publicTopoTerrainLayerId] === true
      : publicTopoTerrainEnvVisible
    : publicTopoTerrainEnvVisible;
  const effectiveVisibleLayerIds = currentPage
    ? effectiveVisibility(state.environment, currentPage)
    : new Set(state.environment.defaultVisibleLayers);
  const activeOpenSignalPrefix = isEnv
    ? ENVIRONMENT_SENTINEL
    : (currentPage?.id ?? "no-page");
  const activeLayerOpenSignal = (layerIds: readonly string[]) => {
    if (state.projectSlug !== "utah-forge" || section !== "public") {
      return undefined;
    }
    const activeIds = layerIds.filter((layerId) => {
      if (!effectiveVisibleLayerIds.has(layerId)) return false;
      const style = currentPage
        ? effectiveStyle(state.environment, currentPage, layerId)
        : (state.environment.layerStyles[layerId] ?? {});
      return layerStyleOpacityForActiveState(layerId, style) > 0.001;
    });
    return activeIds.length > 0
      ? `${activeOpenSignalPrefix}:${activeIds.join(",")}`
      : undefined;
  };
  const sceneSectionOpenSignal =
    state.projectSlug === "utah-forge" &&
    section === "public" &&
    sceneSectionStyle.sceneSectionEnabled === true
      ? `${activeOpenSignalPrefix}:${UTAH_FORGE_SCENE_SECTION_LAYER_ID}`
      : undefined;

  return (
    <div
      style={panelStyles.body}
      data-dev-source="src/editor/LayerPanel.tsx:398"
      data-dev-note="LayerPanel renders either Public Data or Customer Data layer controls, depending on its section prop."
    >
      {!isEnv && !currentPage && (
        <div style={panelStyles.muted}>
          Select Global Settings or a page in the Page Manager.
        </div>
      )}
      {section === "customer" && currentPage && (
        <PageEnvironmentOverridePanel
          page={currentPage}
          setPageField={setPageField}
          accentColor={selectedPageAccent}
        />
      )}
      {state.projectSlug === "utah-forge" && section === "public" ? (
        <LayerGroup
          title="Scene section planes"
          devSource="src/editor/LayerPanel.tsx:scene-section"
          devNote="Scene section planes are a virtual FORGE Data tool; controls patch a virtual layer style and SceneManager applies it across targeted visible scene objects."
          accentColor={selectedPageAccent}
          defaultOpen={!!sceneSectionOpenSignal}
          openSignal={sceneSectionOpenSignal}
        >
          <SceneSectionPlanesContainer
            seismicLayer={utahForgeSeismicLayer}
            allLayers={state.manifest.layers}
            style={sceneSectionStyle}
            disabled={sceneSectionDisabled}
            isEnv={isEnv}
            currentPage={currentPage}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
            sceneHandle={sceneHandle}
          />
        </LayerGroup>
      ) : null}
      {layerGroups.map((group) => {
        const layers = group.ids
          .map((id) => byId.get(id))
          .filter(
            (layer): layer is ProjectLayerSpec =>
              !!layer && layerHasRenderableControl(layer),
          );
        const renderedLayers =
          section === "publicTopo" &&
          group.title === PUBLIC_TOPO_LAYER_GROUP_TITLE
            ? layers.filter(
                (layer) =>
                  !isTopoMapSurfaceLayer(layer) &&
                  !isTopoMapGraticuleLayer(layer),
              )
            : layers;
        const seismicLayer =
          state.projectSlug === "utah-forge" &&
          section === "public" &&
          group.title === "Seismic analysis"
            ? byId.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID)
            : undefined;
        const seismicLayerStyle = seismicLayer
          ? isEnv
            ? (state.environment.layerStyles[seismicLayer.id] ?? {})
            : currentPage
              ? effectiveStyle(state.environment, currentPage, seismicLayer.id)
              : (state.environment.layerStyles[seismicLayer.id] ?? {})
          : {};
        const seismicCapabilityDisabled = !isEnv && currentPage === null;
        const groupOpenSignal = activeLayerOpenSignal(
          layers.map((layer) => layer.id),
        );
        if (layers.length === 0) return null;
        if (
          state.projectSlug === "utah-forge" &&
          section === "public" &&
          group.title === "Site Details"
        ) {
          const boreholeLayer = byId.get(UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID);
          const workingAreaLayer = byId.get(
            UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
          );
          const boundaryLayer = byId.get(UTAH_FORGE_SITE_BOUNDARY_LAYER_ID);
          const boreholeStyle = isEnv
            ? (state.environment.layerStyles[
                UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID
              ] ?? {})
            : currentPage
              ? effectiveStyle(
                  state.environment,
                  currentPage,
                  UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID,
                )
              : (state.environment.layerStyles[
                  UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID
                ] ?? {});
          const workingAreaFocusOpenSignal =
            workingAreaFocusStyle.workingAreaFocusEnabled === true
              ? `${activeOpenSignalPrefix}:${UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID}`
              : undefined;
          const siteDetailsOpenSignal =
            groupOpenSignal ?? workingAreaFocusOpenSignal;
          return (
            <LayerGroup
              key={group.title}
              title="Site Details"
              devSource="src/editor/LayerPanel.tsx:site-details"
              devNote="Site Details contains the FORGE site boundary, demo boreholes, and schematic orientation block."
              accentColor={selectedPageAccent}
              defaultOpen={!!siteDetailsOpenSignal}
              openSignal={siteDetailsOpenSignal}
            >
              <SiteDetailsPanel
                boreholeLayer={boreholeLayer}
                workingAreaLayer={workingAreaLayer}
                boundaryLayer={boundaryLayer}
                renderLayer={renderLayer}
                style={boreholeStyle}
                isEnv={isEnv}
                currentPage={currentPage}
                setEnvLayerStyle={setEnvLayerStyle}
                setPageLayerOverride={setPageLayerOverride}
                activeSignalPrefix={activeOpenSignalPrefix}
                boreholeLayerActive={
                  activeLayerOpenSignal([UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID]) !==
                  undefined
                }
              />
              <WorkingAreaFocusContainer
                allLayers={state.manifest.layers}
                style={workingAreaFocusStyle}
                disabled={workingAreaFocusDisabled}
                isEnv={isEnv}
                currentPage={currentPage}
                setEnvLayerStyle={setEnvLayerStyle}
                setPageLayerOverride={setPageLayerOverride}
                sceneHandle={sceneHandle}
              />
            </LayerGroup>
          );
        }
        if (
          section === "publicTopo" &&
          group.title === PUBLIC_TOPO_LAYER_GROUP_TITLE
        ) {
          const topoPanelProps = {
            settings: publicTopoSettings,
            environment: state.environment,
            scene: state.environment.scene ?? {},
            isEnv,
            currentPage,
            setEnvLayerStyle,
            setPageLayerOverride,
            clearPageLayerOverride,
            setEnvScene,
            projectRoot: state.projectRoot,
            terrainEnvVisible: publicTopoTerrainEnvVisible,
            terrainEffectiveVisible: publicTopoTerrainEffectiveVisible,
            toggleTerrainEnvVisible: () =>
              toggleEnvDefaultVisible(publicTopoTerrainLayerId),
            setPageTerrainVisible: (visible: boolean) => {
              if (currentPage) {
                setPageVisibilityOverride(
                  currentPage.id,
                  publicTopoTerrainLayerId,
                  visible,
                );
              }
            },
            clearPageTerrainVisible: () => {
              if (currentPage) {
                clearPageVisibilityOverride(
                  currentPage.id,
                  publicTopoTerrainLayerId,
                );
              }
            },
            toggleEnvDefaultVisible,
            setPageVisibilityOverride,
            clearPageVisibilityOverride,
            publicSurfaceLayerIds: layers.map((layer) => layer.id),
            setLayerProvenance,
          };

          return (
            <Fragment key={group.title}>
              {publicTopoTerrainLayer ? (
                <LayerGroup
                  title="Topo Settings"
                  devSource="src/editor/LayerPanel.tsx:topo-settings"
                  devNote="Topo Settings contains the global topo surface controls for the public topo map tool."
                  accentColor={selectedPageAccent}
                >
                  <TopoMapPanel
                    {...topoPanelProps}
                    section="surface"
                    nestedContainers={false}
                  />
                </LayerGroup>
              ) : null}
              {publicTopoSettings.graticuleLayers.length > 0 ? (
                <LayerGroup
                  title="Longitude / latitude grid"
                  devSource="src/editor/LayerPanel.tsx:topo-graticule"
                  devNote="Longitude / latitude grid contains the graticule visibility and style controls for the public topo map tool."
                  accentColor={selectedPageAccent}
                >
                  <TopoMapPanel
                    {...topoPanelProps}
                    section="graticule"
                    nestedContainers={false}
                  />
                </LayerGroup>
              ) : null}
              {publicTopoTerrainLayer ? (
                <LayerGroup
                  title="Title block"
                  devSource="src/editor/LayerPanel.tsx:topo-title-block"
                  devNote="Title block contains the branding controls for the public topo map tool."
                  accentColor={selectedPageAccent}
                >
                  <TopoMapPanel
                    {...topoPanelProps}
                    section="title"
                    nestedContainers={false}
                  />
                </LayerGroup>
              ) : null}
              {renderedLayers.length > 0 ? (
                <LayerGroup
                  title="Reference layers"
                  devSource="src/editor/LayerPanel.tsx:topo-reference-layers"
                  devNote="Reference layers contains roads, streams, waterbodies, and shared distance fade controls for the public topo map tool."
                  accentColor={selectedPageAccent}
                >
                  <TopoDetailDistancePanel
                    scene={state.environment.scene ?? {}}
                    setEnvScene={setEnvScene}
                  />
                  {renderedLayers.map(renderLayer)}
                </LayerGroup>
              ) : null}
            </Fragment>
          );
        }
        return (
          <LayerGroup
            key={group.title}
            title={group.title}
            devSource="src/editor/LayerPanel.tsx:880"
            devNote="layerGroupSummaryStyle controls layer-category subheading pills like Topo map tile and Drilling."
            accentColor={selectedPageAccent}
            defaultOpen={!!groupOpenSignal}
            openSignal={groupOpenSignal}
          >
            {group.title !== PUBLIC_TOPO_LAYER_GROUP_TITLE ? (
              <LayerGroupFogControl
                layerIds={layers.map((layer) => layer.id)}
                isEnv={isEnv}
                currentPage={currentPage}
                environment={state.environment}
                globalFogDensity={
                  state.environment.scene?.fog?.density ?? DEFAULT_FOG_DENSITY
                }
                onSetEnv={(layerId, affectedByFog) =>
                  setEnvLayerStyle(layerId, { affectedByFog })
                }
                onSetPage={(pageId, layerId, affectedByFog) =>
                  setPageLayerOverride(pageId, layerId, { affectedByFog })
                }
                onSetEnvDensity={(layerId, fogDensity) =>
                  setEnvLayerStyle(layerId, { fogDensity })
                }
                onSetPageDensity={(pageId, layerId, fogDensity) =>
                  setPageLayerOverride(pageId, layerId, { fogDensity })
                }
              />
            ) : null}
            {section === "publicTopo" &&
            publicTopoTerrainLayer &&
            group.title === PUBLIC_TOPO_LAYER_GROUP_TITLE ? (
              <TopoMapPanel
                settings={publicTopoSettings}
                environment={state.environment}
                scene={state.environment.scene ?? {}}
                isEnv={isEnv}
                currentPage={currentPage}
                setEnvLayerStyle={setEnvLayerStyle}
                setPageLayerOverride={setPageLayerOverride}
                clearPageLayerOverride={clearPageLayerOverride}
                setEnvScene={setEnvScene}
                projectRoot={state.projectRoot}
                terrainEnvVisible={publicTopoTerrainEnvVisible}
                terrainEffectiveVisible={publicTopoTerrainEffectiveVisible}
                toggleTerrainEnvVisible={() =>
                  toggleEnvDefaultVisible(publicTopoTerrainLayerId)
                }
                setPageTerrainVisible={(visible) => {
                  if (currentPage) {
                    setPageVisibilityOverride(
                      currentPage.id,
                      publicTopoTerrainLayerId,
                      visible,
                    );
                  }
                }}
                clearPageTerrainVisible={() => {
                  if (currentPage) {
                    clearPageVisibilityOverride(
                      currentPage.id,
                      publicTopoTerrainLayerId,
                    );
                  }
                }}
                toggleEnvDefaultVisible={toggleEnvDefaultVisible}
                setPageVisibilityOverride={setPageVisibilityOverride}
                clearPageVisibilityOverride={clearPageVisibilityOverride}
                publicSurfaceLayerIds={layers.map((layer) => layer.id)}
                setLayerProvenance={setLayerProvenance}
              />
            ) : null}
            {group.title === PUBLIC_TOPO_LAYER_GROUP_TITLE && (
              <TopoDetailDistancePanel
                scene={state.environment.scene ?? {}}
                setEnvScene={setEnvScene}
              />
            )}
            {group.title === "Assay Samples" && isEnv && (
              <DrillingAssayPanel
                scene={state.environment.scene ?? {}}
                setEnvScene={setEnvScene}
              />
            )}
            {group.title === "Topo details" && (
              <TopoDetailDistancePanel
                scene={state.environment.scene ?? {}}
                setEnvScene={setEnvScene}
              />
            )}
            {renderedLayers.map(renderLayer)}
            {seismicLayer && layerHasRenderableControl(seismicLayer) ? (
              <SeismicCapabilityLayerContainers
                layer={seismicLayer}
                style={seismicLayerStyle}
                disabled={seismicCapabilityDisabled}
                isEnv={isEnv}
                currentPage={currentPage}
                layerId={seismicLayer.id}
                setEnvLayerStyle={setEnvLayerStyle}
                setPageLayerOverride={setPageLayerOverride}
                sceneHandle={sceneHandle}
              />
            ) : null}
          </LayerGroup>
        );
      })}
      {section === "customer" && (
        <SceneOverlaysReadOnly
          currentPage={currentPage}
          accentColor={selectedPageAccent}
        />
      )}
      {otherLayers.length > 0 && (
        <LayerGroup
          title="Other"
          devSource="src/editor/LayerPanel.tsx:880"
          devNote="layerGroupSummaryStyle controls layer-category subheading pills."
          accentColor={selectedPageAccent}
          defaultOpen={!!activeLayerOpenSignal(
            otherLayers.map((layer) => layer.id),
          )}
          openSignal={activeLayerOpenSignal(
            otherLayers.map((layer) => layer.id),
          )}
        >
          {otherLayers.map(renderLayer)}
        </LayerGroup>
      )}
    </div>
  );
}

function SceneOverlaysReadOnly({
  currentPage,
  accentColor,
}: {
  currentPage: PresentationPage | null;
  accentColor?: string | null;
}) {
  const { state } = useEditor();
  const overlays = state.environment.sceneOverlays ?? {};
  const ids = Object.keys(overlays);
  if (ids.length === 0) return null;
  const isEnv = state.selectedPageId === ENVIRONMENT_SENTINEL;
  return (
    <LayerGroup
      title="Topo overlays"
      devSource="src/editor/LayerPanel.tsx:1039"
      devNote="Topo overlays groups environment-registered scene overlay controls under a Layers subheading."
      accentColor={accentColor}
    >
      {ids.map((id) => (
        <SceneOverlayRow
          key={id}
          id={id}
          isEnv={isEnv}
          currentPage={currentPage}
        />
      ))}
      {isEnv && <AddSceneOverlayForm />}
    </LayerGroup>
  );
}
