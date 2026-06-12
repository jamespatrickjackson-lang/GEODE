import { useEditor } from "./EditorContext";
import { LayerPanelGroups } from "./LayerPanelGroups";
import { ENVIRONMENT_SENTINEL } from "./types";
import {
  panelStyles,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "./styles";
import {
  detailsContentStyle,
  editorDarkSelectStyle,
  EnvStyleRow,
  LayerBooleanStyleControl,
  LayerColorStyleControl,
  LayerNumberStyleControl,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  PageStyleRow,
  styleNumber,
} from "./styleControls";
import {
  firstLayerItemStyle,
  layerControlsStyle,
  layerItemStyle,
} from "./layerControls/layout/layoutStyles";
import {
  ATMOSPHERE_VOLUME_FIELDS,
  BOREHOLE_LOG_FIELDS,
  CLASSIFICATIONS,
  CONFIDENTIALITIES,
  CONTOUR_DISTANCE_STYLE_CONTROLS,
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
  LINE_WIDTH_LAYER_DEFAULTS,
  MT_THRESHOLD_SURFACE_FIELDS,
  MT_TOP_SURFACE_FIELDS,
  MT_VOLUME_FIELDS,
  normalizeLabelKind,
  scalarControlTargetLabel,
  SCALAR_LEGEND_FIELD,
  SCALAR_RAMP_FIELDS,
  SEISMIC_BROWSER_FIELDS,
  SURFACE_GRADIENT_FIELDS,
  UTAH_FORGE_SCALAR_LAYER_IDS,
  type LayerDataSection,
} from "./layerControls/layerPanelConfig";
import {
  AtmosphereVolumeControls,
  atmosphereVolumePatchFromStyle,
} from "./layerControls/atmosphere/AtmosphereVolumeControls";
import {
  editorLayerLabel,
  editorLayerTypeLabel,
} from "./layerControls/layerLabels";
import {
  mtThresholdSurfacePatchFromStyle,
  mtTopSurfacePatchFromStyle,
  mtVolumePatchFromStyle,
  scalarRampPatchFromStyle,
  surfaceGradientPatchFromStyle,
} from "./layerControls/layerPatchBuilders";
import { GeologySubUnitsPanel } from "./layerControls/geology/GeologySubUnitsPanel";
import {
  seismicBrowserPatchFromStyle,
  SeismicBrowserControls,
} from "./layerControls/seismic/SeismicControls";
import {
  EnvAffectedByFogRow,
  EnvLabelKindRow,
  EnvLabelPointerSideRow,
  EnvLabelPointerVisibleRow,
  EnvShowLabelsRow,
  PageAffectedByFogRow,
  PageLabelKindRow,
  PageLabelPointerSideRow,
  PageLabelPointerVisibleRow,
  PageShowLabelsRow,
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
  EzGammaStyleControls,
  GeochemStyleControls,
  HyperspectralStyleControls,
  ImageryLidarStyleControls,
} from "./layerControls/style/StyleControls";
import { AreaOutlinesControls } from "./layerControls/style/AreaOutlinesControls";
import {
  PointMarkerControls,
  ScalarPointDrawReadout,
  ScalarRampControls,
} from "./layerControls/scalar/ScalarControls";
import {
  BoreholeLogsControls,
  boreholeLogPatchFromStyle,
} from "./layerControls/wells/BoreholeLogsControls";
import {
  effectiveStyle,
  isStyleFieldOverridden,
  isVisibilityOverridden,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type {
  EditableStyle,
  ProjectLayerSpec,
} from "../pages/types";
import { pageSelectionHasLanded, selectedAuthoringPage } from "./authoringTarget";
import { SCENE_ORIGIN } from "../constants";
import {
  UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID,
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
} from "../projectModules/utahForge/layerIds";
import {
  SHAHBAZI_GROUND_CONTOUR_LAYER_ID,
  SHAHBAZI_GROUND_SURFACE_LAYER_ID,
} from "../projectModules/shahbazi/layerIds";
import {
  isTopoMapGraticuleLayer,
  isTopoMapLayer,
  isTopoMapSurfaceLayer,
} from "../topoMap/settings";

interface BoreholePriorityEntry {
  id?: unknown;
  displayLabel?: unknown;
  label?: unknown;
  sourceStatus?: unknown;
  renderStatus?: unknown;
  claimStatus?: unknown;
  sourceRecordIds?: unknown;
  sourceLocation?: unknown;
  sourceCandidates?: unknown;
}

function metadataString(
  metadata: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const value = metadata[key];
  return typeof value === "string" ? value : fallback;
}

function boreholePriorityRegistry(
  metadata: Record<string, unknown>,
): BoreholePriorityEntry[] {
  const demoBoreholes = metadata.demoBoreholes;
  if (!demoBoreholes || typeof demoBoreholes !== "object") return [];
  const registry = (demoBoreholes as { priorityRegistry?: unknown })
    .priorityRegistry;
  return Array.isArray(registry) ? registry : [];
}

function boreholeEntryLabel(entry: BoreholePriorityEntry): string {
  if (typeof entry.displayLabel === "string" && entry.displayLabel.trim()) {
    return entry.displayLabel;
  }
  if (typeof entry.label === "string" && entry.label.trim()) {
    return entry.label;
  }
  return typeof entry.id === "string" ? entry.id : "Bore hole";
}

function boreholeEntryText(entry: BoreholePriorityEntry, key: string): string {
  const value = entry[key as keyof BoreholePriorityEntry];
  return typeof value === "string" ? value : "";
}

function boreholeSourceRecordLabel(entry: BoreholePriorityEntry): string {
  if (Array.isArray(entry.sourceRecordIds) && entry.sourceRecordIds.length > 0) {
    return entry.sourceRecordIds
      .filter((value): value is string => typeof value === "string")
      .join(", ");
  }
  const location = entry.sourceLocation;
  if (
    location &&
    typeof location === "object" &&
    typeof (location as { id?: unknown }).id === "string"
  ) {
    return (location as { id: string }).id;
  }
  if (Array.isArray(entry.sourceCandidates) && entry.sourceCandidates.length > 0) {
    return entry.sourceCandidates
      .map((candidate) =>
        candidate &&
        typeof candidate === "object" &&
        typeof (candidate as { id?: unknown }).id === "string"
          ? (candidate as { id: string }).id
          : "",
      )
      .filter(Boolean)
      .join(", ");
  }
  return "none";
}

const layerVisibilityButtonBaseStyle = {
  ...panelStyles.iconButton,
  width: 24,
  height: 24,
  flex: "0 0 24px",
  marginLeft: 8,
  marginRight: 12,
  padding: 0,
  border: "1px solid transparent",
  background: "transparent",
  boxShadow: "none",
  color: vibrancySecondaryLabel,
};

const layerVisibilitySvgStyle = {
  width: 13,
  height: 13,
  display: "block",
  flex: "none",
};

function layerVisibilityButtonStyle(
  visible: boolean,
  overridden: boolean,
) {
  return {
    ...layerVisibilityButtonBaseStyle,
    background: "transparent",
    boxShadow: "none",
    color: overridden
      ? "rgba(143, 215, 255, 0.92)"
      : visible
        ? vibrancyLabel
        : vibrancyTertiaryLabel,
    opacity: visible ? 1 : 0.72,
    border: "1px solid transparent",
  };
}

const elevatedDetailsContentStyle = {
  ...detailsContentStyle,
  padding: "4px 0 0 0",
};

const layerInputHeadingStyle = {
  margin: "10px 0 3px",
  color: "rgba(244, 240, 232, 0.62)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase" as const,
};

function LayerEyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={layerVisibilitySvgStyle}
    >
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}
function LayerEyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={layerVisibilitySvgStyle}
    >
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M2.5 12s3.5-6 9.5-6c1.3 0 2.5.28 3.55.73M21.5 12s-3.5 6-9.5 6c-1.31 0-2.51-.28-3.58-.74"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// LayerPanel has two modes driven by selectedPageId:
//   "environment"      -> editing the base; controls write env.layerStyles
//                         and env.defaultVisibleLayers directly.
//   "<page id>"        -> editing a presentation page. Each control has a
//                         small page-value checkbox; if off, the row shows
//                         the base value (greyed); if on, the control is
//                         active and edits page.layerOverrides.

export function LayerPanel({
  section = "customer",
  revealTargetId = null,
}: {
  section?: LayerDataSection;
  revealTargetId?: string | null;
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
    setAuthoringScene,
  } = useEditor();

  const isEnv = state.selectedPageId === ENVIRONMENT_SENTINEL;
  const currentPage = isEnv ? null : selectedAuthoringPage(state);
  const currentPageEnvironment = currentPage
    ? resolveEnvironmentForPage(
        state.environment,
        [...state.pages, ...state.archivedPages],
        currentPage,
      )
    : state.environment;
  const {
    currentIndex,
    isTransitioning,
    targetIndex,
    authoringPreviewPageId,
  } = usePageController();
  const selectedPageIndex = currentPage
    ? state.pages.findIndex((p) => p.id === currentPage.id)
    : -1;
  const selectedPageHasLanded =
    currentPage && selectedPageIndex < 0
      ? authoringPreviewPageId === currentPage.id
      : pageSelectionHasLanded({
          selectedPageIndex,
          currentIndex,
          isTransitioning,
          targetIndex,
        });
  const pageStyleControlsDisabled =
    !isEnv && (!currentPage || !selectedPageHasLanded);
  const setSelectedPageSceneOverride = setAuthoringScene;

  const renderLayer = (layer: ProjectLayerSpec, index = 0) => {
    const meta = layer.metadata as Record<string, unknown>;
    const boreholeEntries = boreholePriorityRegistry(meta);
    const envStyle = currentPageEnvironment.layerStyles[layer.id] ?? {};
    const envVisible = currentPageEnvironment.defaultVisibleLayers.includes(
      layer.id,
    );
    const effectiveLayerVisible = currentPage
      ? isVisibilityOverridden(currentPage, layer.id)
        ? currentPage.visibilityOverrides?.[layer.id] === true
        : envVisible
      : envVisible;
    const pageVisibilityOverridden = currentPage
      ? isVisibilityOverridden(currentPage, layer.id)
      : false;
    const toggleLayerVisibility = () => {
      if (isEnv) {
        toggleEnvDefaultVisible(layer.id);
        return;
      }
      if (!currentPage) return;
      if (pageStyleControlsDisabled) return;
      const nextVisible = !effectiveLayerVisible;
      setPageVisibilityOverride(currentPage.id, layer.id, nextVisible);
    };
    const ensureLayerVisible = () => {
      if (effectiveLayerVisible) return;
      if (isEnv) {
        toggleEnvDefaultVisible(layer.id);
        return;
      }
      if (!currentPage) return;
      if (pageStyleControlsDisabled) return;
      setPageVisibilityOverride(currentPage.id, layer.id, true);
    };
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
    const isAtmosphereVolume = layer.type === "atmosphere-volume";
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
    const isUtahForgeBoreholeLogs =
      layer.id === UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID;
    const hasSpecializedOpacityOwner =
      isUtahForgeMtVolume ||
      isUtahForgeMtThresholdSurfaces ||
      isAtmosphereVolume;
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
      currentPageEnvironment.scene?.fog?.density ?? DEFAULT_FOG_DENSITY;
    const envAffectedByFog = envStyle.affectedByFog !== false;
    const effectiveLayerStyle = currentPage
      ? effectiveStyle(currentPageEnvironment, currentPage, layer.id)
      : envStyle;
    const effectiveSceneSectionStyle = currentPage
      ? effectiveStyle(
          currentPageEnvironment,
          currentPage,
          UTAH_FORGE_SCENE_SECTION_LAYER_ID,
        )
      : (currentPageEnvironment.layerStyles[UTAH_FORGE_SCENE_SECTION_LAYER_ID] ??
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
    const atmosphereVolumeOverridden =
      currentPage !== null &&
      ATMOSPHERE_VOLUME_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );
    const boreholeLogsOverridden =
      currentPage !== null &&
      BOREHOLE_LOG_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );

    return (
      <div
        key={layer.id}
        data-editor-target={`layer:${layer.id}`}
        data-editor-target-kind="container"
        data-editor-target-level="layer"
        data-dev-source="src/editor/LayerPanel.tsx:937"
        data-dev-note="layerItemStyle controls spacing and separators for individual layer rows."
        style={{
          ...layerItemStyle,
          ...(index === 0 ? firstLayerItemStyle : {}),
        }}
      >
        <div style={panelStyles.sectionHeader}>
          <div
            style={{
              ...panelStyles.checkboxRow,
              flex: "1 1 auto",
              minWidth: 0,
              overflow: "hidden",
            }}
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
            <span
              style={{
                ...panelStyles.layerType,
                color: effectiveLayerVisible
                  ? vibrancySecondaryLabel
                  : vibrancyTertiaryLabel,
              }}
            >
              ({editorLayerTypeLabel(layer)})
            </span>
          </div>
          <button
            type="button"
            className="editor-action-button editor-icon-only-button"
            style={{
              ...layerVisibilityButtonStyle(
                effectiveLayerVisible,
                pageVisibilityOverridden,
              ),
              ...(pageStyleControlsDisabled
                ? { cursor: "not-allowed", opacity: 0.45 }
                : {}),
            }}
            disabled={pageStyleControlsDisabled}
            onClick={(event) => {
              event.stopPropagation();
              toggleLayerVisibility();
            }}
            title={effectiveLayerVisible ? "Hide layer" : "Show layer"}
            aria-label={effectiveLayerVisible ? "Hide layer" : "Show layer"}
            aria-pressed={effectiveLayerVisible}
          >
            {effectiveLayerVisible ? <LayerEyeIcon /> : <LayerEyeOffIcon />}
          </button>
        </div>

        <div
          style={layerControlsStyle}
          data-dev-source="src/editor/LayerPanel.tsx:946"
          data-dev-note="layerControlsStyle controls indentation of Visible, Appearance, Labels, and Provenance under each layer."
        >
          {effectiveLayerVisible ? (
            <>
              {!isAreaOutlines ? (
                <details
                  open={isUtahForgeFullDensityScalarLayer ? true : undefined}
                  style={
                    isUtahForgeFullDensityScalarLayer
                      ? {
                          ...nestedDetailsStyle,
                          marginTop: 4,
                          paddingLeft: 0,
                        }
                      : nestedDetailsStyle
                  }
                >
                  {isUtahForgeFullDensityScalarLayer ? null : (
                    <summary style={panelStyles.summary}>Appearance</summary>
                  )}
                  <div
                    style={
                      isUtahForgeFullDensityScalarLayer
                        ? elevatedDetailsContentStyle
                        : detailsContentStyle
                    }
                  >
                    {!isAtmosphereVolume &&
                    !isUtahForgeSeismicBrowser &&
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
                    ) : !isAtmosphereVolume &&
                      !isUtahForgeSeismicBrowser &&
                      !isPublicTerrainSurface &&
                      currentPage ? (
                      <PageStyleRow
                        label={hasInfillAndOutline ? "Infill color" : "Color"}
                        inputType="color"
                        inheritedValue={
                          effectiveStyle(
                            currentPageEnvironment,
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

                    {isAtmosphereVolume ? (
                      <AtmosphereVolumeControls
                        layerId={layer.id}
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        isEnv={isEnv}
                        currentPage={currentPage}
                        disabled={!isEnv && !atmosphereVolumeOverridden}
                        overridden={atmosphereVolumeOverridden}
                        onToggleOverride={
                          currentPage
                            ? (enabled) => {
                                if (enabled) {
                                  setPageLayerOverride(
                                    currentPage.id,
                                    layer.id,
                                    atmosphereVolumePatchFromStyle(
                                      effectiveLayerStyle,
                                    ),
                                  );
                                } else {
                                  for (const field of ATMOSPHERE_VOLUME_FIELDS) {
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
                        clearPageLayerOverride={clearPageLayerOverride}
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
                            currentPageEnvironment,
                            currentPage,
                            layer.id,
                          ).fillOpacity as number | undefined) ??
                            (effectiveStyle(
                              currentPageEnvironment,
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
                            currentPageEnvironment,
                            currentPage,
                            layer.id,
                          ).outlineColor as string | undefined) ??
                          (effectiveStyle(
                            currentPageEnvironment,
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
                            currentPageEnvironment,
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

                    {isUtahForgeFullDensityScalarLayer ? (
                      <div style={layerInputHeadingStyle}>Output</div>
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
                        label="Resistivity legend"
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
                        label="Distance brightness"
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
                      <>
                        <div style={layerInputHeadingStyle}>QA</div>
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
                      </>
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
                            currentPageEnvironment,
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

                    {!isPublicSurfaceContextLayer &&
                    !isUtahForgeFullDensityScalarLayer &&
                    isEnv ? (
                      <EnvAffectedByFogRow
                        value={envAffectedByFog}
                        onToggle={() =>
                          setEnvLayerStyle(layer.id, {
                            affectedByFog: !envAffectedByFog,
                          })
                        }
                      />
                    ) : !isPublicSurfaceContextLayer &&
                      !isUtahForgeFullDensityScalarLayer &&
                      currentPage ? (
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
                    !isUtahForgeFullDensityScalarLayer &&
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
                      !isUtahForgeFullDensityScalarLayer &&
                      effectiveAffectedByFog &&
                      currentPage ? (
                      <PageStyleRow
                        label="Fog dens."
                        inputType="range"
                        inheritedValue={String(
                          ((effectiveStyle(
                            currentPageEnvironment,
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
                            currentPageEnvironment,
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

                    {isAreaOutlines ? (
                      <AreaOutlinesControls
                        outlines={currentPageEnvironment.scene?.areaOutlines ?? []}
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
                          setSelectedPageSceneOverride({
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
                            currentPageEnvironment,
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
                  {isEnv || currentPage ? (
                    <AreaOutlinesControls
                      outlines={currentPageEnvironment.scene?.areaOutlines ?? []}
                      viewCenter={[
                        Math.round(
                          sceneHandle.controls.target.x + SCENE_ORIGIN.easting,
                        ),
                        Math.round(
                          sceneHandle.controls.target.y + SCENE_ORIGIN.northing,
                        ),
                      ]}
                      onChange={(outlines) =>
                        setSelectedPageSceneOverride({
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
                  sceneHandle={sceneHandle}
                  setEnvLayerStyle={setEnvLayerStyle}
                  setPageLayerOverride={setPageLayerOverride}
                  clearPageLayerOverride={clearPageLayerOverride}
                />
              ) : null}

              {isUtahForgeBoreholeLogs ? (
                <BoreholeLogsControls
                  style={isEnv ? envStyle : effectiveLayerStyle}
                  disabled={!isEnv && !boreholeLogsOverridden}
                  isEnv={isEnv}
                  currentPage={currentPage}
                  layerId={layer.id}
                  onToggleOverride={
                    currentPage
                      ? (enabled) => {
                          if (enabled) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              boreholeLogPatchFromStyle(effectiveLayerStyle),
                            );
                          } else {
                            for (const field of BOREHOLE_LOG_FIELDS) {
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
                  ensureLayerVisible={ensureLayerVisible}
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
                              currentPageEnvironment,
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
                              currentPageEnvironment,
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
                              currentPageEnvironment,
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
                                currentPageEnvironment,
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
                              currentPageEnvironment,
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
                              currentPageEnvironment,
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
                              currentPageEnvironment,
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
                                currentPageEnvironment,
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
                              currentPageEnvironment,
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
                              currentPageEnvironment,
                              currentPage,
                              layer.id,
                            ).labelKind,
                          ) === "landTitle" &&
                          labelPointerVisibleControlValue(
                            effectiveStyle(
                              currentPageEnvironment,
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

              {boreholeEntries.length > 0 ? (
                <details style={nestedDetailsStyle}>
                  <summary style={panelStyles.summary}>Bore Holes</summary>
                  <div style={detailsContentStyle}>
                    {boreholeEntries.map((entry, entryIndex) => {
                      const key =
                        typeof entry.id === "string"
                          ? entry.id
                          : `borehole-${entryIndex}`;
                      return (
                        <div
                          key={key}
                          style={{
                            padding: "8px 0",
                            borderTop:
                              entryIndex === 0
                                ? "none"
                                : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div
                            style={{
                              color: vibrancyLabel,
                              fontSize: 12,
                              fontWeight: 700,
                              lineHeight: 1.35,
                            }}
                          >
                            {boreholeEntryLabel(entry)}
                          </div>
                          <div
                            style={{
                              color: vibrancySecondaryLabel,
                              fontSize: 11,
                              lineHeight: 1.35,
                              marginTop: 4,
                            }}
                          >
                            Source: {boreholeEntryText(entry, "sourceStatus") ||
                              "unknown"}{" "}
                            | Render: {boreholeEntryText(entry, "renderStatus") ||
                              "unknown"}{" "}
                            | Claim: {boreholeEntryText(entry, "claimStatus") ||
                              "unknown"}
                          </div>
                          <div
                            style={{
                              color: vibrancyTertiaryLabel,
                              fontSize: 11,
                              lineHeight: 1.35,
                              marginTop: 3,
                            }}
                          >
                            Source rows: {boreholeSourceRecordLabel(entry)}
                          </div>
                        </div>
                      );
                    })}
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
                      value={metadataString(meta, "sourceFile")}
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
                      value={metadataString(meta, "sourceDate")}
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
                      value={metadataString(meta, "sourceOrigin")}
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
                      value={metadataString(meta, "classification", "observation")}
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          classification: e.target.value,
                        })
                      }
                      style={editorDarkSelectStyle}
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
                      value={metadataString(meta, "confidentiality", "public")}
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          confidentiality: e.target.value,
                        })
                      }
                      style={editorDarkSelectStyle}
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

  return (
    <LayerPanelGroups
      section={section}
      renderLayer={renderLayer}
      revealTargetId={revealTargetId}
    />
  );
}
