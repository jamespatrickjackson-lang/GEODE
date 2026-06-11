import { Fragment } from "react";
import type React from "react";
import { useEditor } from "./EditorContext";
import { usePageController } from "../pages/PageController";
import { ENVIRONMENT_SENTINEL } from "./types";
import { globalSettingsAccent, pageAccentForPage, panelStyles } from "./styles";
import {
  effectiveStyle,
  effectiveVisibility,
  isVisibilityOverridden,
  resolveEnvironmentForPage,
} from "../pages/effective";
import type {
  EditableStyle,
  PresentationPage,
  ProjectLayerSpec,
} from "../pages/types";
import { TopoMapPanel } from "./topoMap/TopoMapPanel";
import { SiteDetailsPanel } from "./SiteDetailsPanel";
import {
  DrillingAssayPanel,
  LayerGroup,
  LayerGroupFogControl,
  PageEnvironmentOverridePanel,
  TopoDetailDistancePanel,
} from "./layerControls/layout/LayoutControls";
import { AddSceneOverlayForm, SceneOverlayRow } from "./layerControls/overlays/SceneOverlayControls";
import { SceneSectionPlanesContainer, SeismicCapabilityLayerContainers } from "./layerControls/seismic/SeismicControls";
import { WorkingAreaFocusContainer } from "./layerControls/workingArea/WorkingAreaFocusContainer";
import {
  CASE_STUDY_B_CUSTOMER_LAYER_GROUPS,
  CASE_STUDY_B_PUBLIC_LAYER_GROUPS,
  CUSTOMER_LAYER_GROUPS,
  DEFAULT_FOG_DENSITY,
  layerDataSection,
  layerStyleOpacityForActiveState,
  PUBLIC_LAYER_GROUPS,
  PUBLIC_TOPO_LAYER_GROUP_TITLE,
  UTAH_FORGE_CUSTOMER_LAYER_GROUPS,
  UTAH_FORGE_PUBLIC_LAYER_GROUPS,
  UTAH_FORGE_SECTIONS_CROPPING_LAYER_GROUPS,
  type LayerDataSection,
  type LayerGroupDef,
} from "./layerControls/layerPanelConfig";
import { layerHasRenderableControl } from "./layerControls/layerLabels";
import {
  UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_SITE_BOUNDARY_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import { isTopoMapGraticuleLayer, isTopoMapSurfaceLayer, resolveTopoMapSettings, topoMapLayerIds } from "../topoMap/settings";
import { pageSelectionHasLanded, selectedAuthoringPage } from "./authoringTarget";

interface LayerPanelGroupsProps {
  section: LayerDataSection;
  renderLayer: (layer: ProjectLayerSpec, index?: number) => React.ReactNode;
  revealTargetId?: string | null;
}

function metadataRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isTopoEnvironmentCloudLayer(layer: ProjectLayerSpec): boolean {
  if (layer.type !== "atmosphere-volume") return false;
  const metadata = metadataRecord(layer.metadata);
  const geoSeeTool = metadataRecord(metadata?.geoSeeTool);
  const localAtmosphereVolume = metadataRecord(
    metadata?.localAtmosphereVolume,
  );
  return (
    (geoSeeTool?.id === "topo-map" &&
      geoSeeTool?.role === "environment-clouds") ||
    localAtmosphereVolume?.renderingRole === "topo-environment-cloud-impostor"
  );
}

function defaultUnverifiedUtm12Registration() {
  return {
    horizontalCrs: "EPSG:26912",
    verticalDatum: "scene-local atmosphere volume bounds in metres above project scene datum",
    units: "m",
    coordinateBasis: "utm",
    origin: {
      easting_m: 341467.35,
      northing_m: 4273374.5,
      elevation_m: 0,
    },
    rotationDeg: 0,
    registrationStatus: "unverified",
    accuracyClaimStatus: "CRS/datum review required",
    notes:
      "Local atmosphere visual volume inherits the project UTM scene frame for authoring only; exact weather or plume CRS is not claimed.",
  };
}

export function LayerPanelGroups({
  section,
  renderLayer,
  revealTargetId = null,
}: LayerPanelGroupsProps) {
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
    setAuthoringScene,
    addProjectLayer,
    removeProjectLayer,
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
  const topoAuthoringEnvironment = currentPageEnvironment;
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

  const byId = new Map(state.manifest.layers.map((layer) => [layer.id, layer]));
  const addAtmosphereLayer = (
    style: Partial<EditableStyle> = {},
    sourceLayer?: ProjectLayerSpec | null,
  ): string => {
    const existingIds = new Set(state.manifest.layers.map((layer) => layer.id));
    let index =
      state.manifest.layers.filter(isTopoEnvironmentCloudLayer).length + 1;
    let id = `topo-cloud-volume-${index}`;
    while (existingIds.has(id)) {
      index += 1;
      id = `topo-cloud-volume-${index}`;
    }
    const center: [number, number, number] = [
      typeof style.atmosphereBoundsCenterX === "number"
        ? style.atmosphereBoundsCenterX
        : 0,
      typeof style.atmosphereBoundsCenterY === "number"
        ? style.atmosphereBoundsCenterY
        : 0,
      typeof style.atmosphereBoundsCenterZ === "number"
        ? style.atmosphereBoundsCenterZ
        : 40,
    ];
    const size: [number, number, number] = [
      typeof style.atmosphereBoundsSizeX === "number"
        ? style.atmosphereBoundsSizeX
        : 120,
      typeof style.atmosphereBoundsSizeY === "number"
        ? style.atmosphereBoundsSizeY
        : 120,
      typeof style.atmosphereBoundsSizeZ === "number"
        ? style.atmosphereBoundsSizeZ
        : 70,
    ];
    const subtype =
      style.atmosphereSubtype === "ground-fog" ||
      style.atmosphereSubtype === "steam-plume" ||
      style.atmosphereSubtype === "mist" ||
      style.atmosphereSubtype === "cloud-bank"
        ? style.atmosphereSubtype
        : "cloud-bank";
    const layer: ProjectLayerSpec = {
      id,
      label: sourceLayer
        ? `${sourceLayer.label || "Cloud volume"} copy`
        : `Cloud volume ${index}`,
      type: "atmosphere-volume",
      files: {},
      metadata: {
        classification: "environmental",
        crsRegistration: defaultUnverifiedUtm12Registration(),
        geoSeeTool: {
          id: "topo-map",
          role: "environment-clouds",
          settingsScope: "layer",
        },
        localAtmosphereVolume: {
          subtype,
          bounds: {
            mode: style.atmosphereBoundsMode ?? "box",
            center,
            size,
          },
          artifactFamily: "local-atmosphere",
          renderingRole: "topo-environment-cloud-impostor",
          computationRole: "visual-context",
          notes: "Authored from Topo > Environment > Clouds.",
        },
      },
    };
    addProjectLayer(layer, style, true);
    return id;
  };
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
  const projectSectionsCroppingLayerGroups =
    state.projectSlug === "utah-forge"
      ? UTAH_FORGE_SECTIONS_CROPPING_LAYER_GROUPS
      : ([] as const satisfies readonly LayerGroupDef[]);
  const projectLayerGroups = [
    ...projectPublicLayerGroups,
    ...projectPublicTopoLayerGroups,
    ...projectSectionsCroppingLayerGroups,
    ...projectCustomerLayerGroups,
  ];
  const layerGroups =
    section === "public"
      ? projectPublicLayerGroups
      : section === "publicTopo"
        ? projectPublicTopoLayerGroups
        : section === "sectionsCropping"
          ? projectSectionsCroppingLayerGroups
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
              currentPageEnvironment,
              currentPage,
              UTAH_FORGE_SCENE_SECTION_LAYER_ID,
            )
          : (currentPageEnvironment.layerStyles[UTAH_FORGE_SCENE_SECTION_LAYER_ID] ??
            {})
      : {};
  const sceneSectionDisabled =
    state.projectSlug === "utah-forge" && pageStyleControlsDisabled;
  const workingAreaFocusStyle =
    state.projectSlug === "utah-forge"
      ? isEnv
        ? (state.environment.layerStyles[
            UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID
          ] ?? {})
        : currentPage
          ? effectiveStyle(
              currentPageEnvironment,
              currentPage,
              UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
            )
          : (state.environment.layerStyles[
              UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID
            ] ?? {})
      : {};
  const workingAreaFocusDisabled =
    state.projectSlug === "utah-forge" && pageStyleControlsDisabled;
  const publicTopoSettings = resolveTopoMapSettings({
    manifest: state.manifest,
    environment: topoAuthoringEnvironment,
    page: currentPage,
  });
  const publicTopoTerrainLayer = publicTopoSettings.surfaceLayer;
  const publicTopoTerrainLayerId = publicTopoSettings.surfaceLayerId;
  const publicTopoTerrainEnvVisible =
    topoAuthoringEnvironment.defaultVisibleLayers.includes(
      publicTopoTerrainLayerId,
    );
  const publicTopoTerrainEffectiveVisible = currentPage
    ? isVisibilityOverridden(currentPage, publicTopoTerrainLayerId)
      ? currentPage.visibilityOverrides?.[publicTopoTerrainLayerId] === true
      : publicTopoTerrainEnvVisible
    : publicTopoTerrainEnvVisible;
  const effectiveVisibleLayerIds = currentPage
    ? effectiveVisibility(currentPageEnvironment, currentPage)
    : new Set(currentPageEnvironment.defaultVisibleLayers);
  const activeOpenSignalPrefix = isEnv
    ? ENVIRONMENT_SENTINEL
    : (currentPage?.id ?? "no-page");
  const activeLayerOpenSignal = (layerIds: readonly string[]) => {
    if (
      state.projectSlug !== "utah-forge" ||
      (section !== "public" && section !== "sectionsCropping")
    ) {
      return undefined;
    }
    const activeIds = layerIds.filter((layerId) => {
      if (!effectiveVisibleLayerIds.has(layerId)) return false;
      const style = currentPage
        ? effectiveStyle(currentPageEnvironment, currentPage, layerId)
        : (currentPageEnvironment.layerStyles[layerId] ?? {});
      return layerStyleOpacityForActiveState(layerId, style) > 0.001;
    });
    return activeIds.length > 0
      ? `${activeOpenSignalPrefix}:${activeIds.join(",")}`
      : undefined;
  };
  const revealLayerId = (() => {
    if (!revealTargetId) return null;
    if (revealTargetId.startsWith("layer:")) {
      return revealTargetId.slice("layer:".length);
    }
    if (revealTargetId.startsWith("product:")) {
      const rest = revealTargetId.slice("product:".length);
      const separator = rest.indexOf(":");
      return separator > 0 ? rest.slice(0, separator) : null;
    }
    return null;
  })();
  const sceneSectionOpenSignal =
    state.projectSlug === "utah-forge" &&
    section === "sectionsCropping" &&
    sceneSectionStyle.sceneSectionEnabled === true
      ? `${activeOpenSignalPrefix}:${UTAH_FORGE_SCENE_SECTION_LAYER_ID}`
      : undefined;
  const workingAreaFocusOpenSignal =
    state.projectSlug === "utah-forge" &&
    section === "sectionsCropping" &&
    workingAreaFocusStyle.workingAreaFocusEnabled === true
      ? `${activeOpenSignalPrefix}:${UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID}`
      : undefined;

  return (
    <div
      style={panelStyles.body}
      data-dev-source="src/editor/LayerPanel.tsx:398"
      data-dev-note="LayerPanel renders Data/Forge, Sections, Topo, or customer data controls, depending on its section prop."
    >
      {!isEnv && !currentPage && (
        <div style={panelStyles.muted}>
          Select global settings or a page in Pages.
        </div>
      )}
      {section === "customer" && currentPage && (
        <PageEnvironmentOverridePanel
          page={currentPage}
          setPageField={setPageField}
          accentColor={selectedPageAccent}
        />
      )}
      {state.projectSlug === "utah-forge" &&
      section === "sectionsCropping" ? (
        <LayerGroup
          title="Scene section planes"
          devSource="src/editor/LayerPanel.tsx:scene-section"
          devNote="Scene section planes are a virtual Sections tool; controls patch a virtual layer style and SceneManager applies it across targeted visible scene objects."
          accentColor={selectedPageAccent}
          openSignal={
            sceneSectionOpenSignal &&
            revealLayerId === UTAH_FORGE_SCENE_SECTION_LAYER_ID &&
            revealTargetId
              ? `${sceneSectionOpenSignal}:${revealTargetId}`
              : (sceneSectionOpenSignal ??
                (revealLayerId === UTAH_FORGE_SCENE_SECTION_LAYER_ID
                  ? revealTargetId
                  : undefined))
          }
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
              ? effectiveStyle(currentPageEnvironment, currentPage, seismicLayer.id)
              : (currentPageEnvironment.layerStyles[seismicLayer.id] ?? {})
          : {};
        const seismicLayerVisible = seismicLayer
          ? effectiveVisibleLayerIds.has(seismicLayer.id)
          : false;
        const ensureSeismicLayerVisible = () => {
          if (!seismicLayer || seismicLayerVisible) return;
          if (isEnv) {
            toggleEnvDefaultVisible(seismicLayer.id);
            return;
          }
          if (!currentPage) return;
          if (pageStyleControlsDisabled) return;
          setPageVisibilityOverride(currentPage.id, seismicLayer.id, true);
        };
        const seismicCapabilityDisabled = pageStyleControlsDisabled;
        const groupOpenSignal = activeLayerOpenSignal(
          layers.map((layer) => layer.id),
        );
        const revealGroupOpenSignal =
          revealLayerId && layers.some((layer) => layer.id === revealLayerId)
            ? revealTargetId
            : undefined;
        const resolvedGroupOpenSignal =
          groupOpenSignal && revealGroupOpenSignal
            ? `${groupOpenSignal}:${revealGroupOpenSignal}`
            : (groupOpenSignal ?? revealGroupOpenSignal);
        if (
          state.projectSlug === "utah-forge" &&
          section === "public" &&
          group.title === "Foundation"
        ) {
          return null;
        }
        if (layers.length === 0) return null;
        if (
          state.projectSlug === "utah-forge" &&
          section === "public" &&
          group.title === "Site Details"
        ) {
          const boreholeLayer = byId.get(UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID);
          const boundaryLayer = byId.get(UTAH_FORGE_SITE_BOUNDARY_LAYER_ID);
          const boreholeStyle = isEnv
            ? (state.environment.layerStyles[
                UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID
              ] ?? {})
            : currentPage
              ? effectiveStyle(
                  currentPageEnvironment,
                  currentPage,
                  UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID,
                )
              : (currentPageEnvironment.layerStyles[
                  UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID
                ] ?? {});
          return (
            <LayerGroup
              key={group.title}
              title="Site Details"
              devSource="src/editor/LayerPanel.tsx:site-details"
              devNote="Site Details contains the FORGE site boundary, demo boreholes, and schematic orientation block."
              accentColor={selectedPageAccent}
              openSignal={resolvedGroupOpenSignal}
            >
              <SiteDetailsPanel
                boreholeLayer={boreholeLayer}
                boundaryLayer={boundaryLayer}
                renderLayer={renderLayer}
                style={boreholeStyle}
                isEnv={isEnv}
                currentPage={currentPage}
                setEnvLayerStyle={setEnvLayerStyle}
                setPageLayerOverride={setPageLayerOverride}
                disabled={pageStyleControlsDisabled}
                activeSignalPrefix={activeOpenSignalPrefix}
                boreholeLayerActive={
                  activeLayerOpenSignal([UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID]) !==
                  undefined
                }
              />
            </LayerGroup>
          );
        }
        if (
          state.projectSlug === "utah-forge" &&
          section === "sectionsCropping" &&
          group.title === "Working area"
        ) {
          const sectionsCroppingOpenSignal =
            resolvedGroupOpenSignal ?? workingAreaFocusOpenSignal;
          return (
            <LayerGroup
              key={group.title}
              title="Working area"
              devSource="src/editor/LayerPanel.tsx:sections-cropping-working-area"
              devNote="Working area groups the Phase 3 boundary controls and the Working Area Focus crop/focus tool under Sections."
              accentColor={selectedPageAccent}
              openSignal={sectionsCroppingOpenSignal}
            >
              {renderedLayers.map(renderLayer)}
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
            environment: topoAuthoringEnvironment,
            scene: topoAuthoringEnvironment.scene ?? {},
            isEnv,
            currentPage,
            setEnvLayerStyle,
            setPageLayerOverride,
            clearPageLayerOverride,
            setEnvScene: setAuthoringScene,
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
            atmosphereLayers: state.manifest.layers.filter(
              isTopoEnvironmentCloudLayer,
            ),
            addAtmosphereLayer,
            removeAtmosphereLayer: removeProjectLayer,
            setLayerProvenance,
          };

          return (
            <Fragment key={group.title}>
              {publicTopoTerrainLayer ? (
                <LayerGroup
                  title="Topo Settings"
                  manifestId="topo.group.surface"
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
              {publicTopoTerrainLayer ? (
                <LayerGroup
                  title="Satellite image settings"
                  manifestId="topo.group.satellite"
                  devSource="src/editor/LayerPanel.tsx:topo-satellite"
                  devNote="Satellite image settings contains satellite opacity, image adjustment, image sun response, and outside-image fill controls for the public topo map tool."
                  accentColor={selectedPageAccent}
                >
                  <TopoMapPanel
                    {...topoPanelProps}
                    section="satellite"
                    nestedContainers={false}
                  />
                </LayerGroup>
              ) : null}
              {publicTopoTerrainLayer ? (
                <LayerGroup
                  title="Extents"
                  manifestId="topo.group.extents"
                  devSource="src/editor/LayerPanel.tsx:topo-extents"
                  devNote="Extents contains map footprint, clipping, material edge fade, and edge outline controls for the public topo map tool."
                  accentColor={selectedPageAccent}
                >
                  <TopoMapPanel
                    {...topoPanelProps}
                    section="extents"
                    nestedContainers={false}
                  />
                </LayerGroup>
              ) : null}
              {publicTopoTerrainLayer ? (
                <LayerGroup
                  title="Environment"
                  manifestId="topo.group.environment"
                  devSource="src/editor/LayerPanel.tsx:topo-environment"
                  devNote="Environment contains the cloud, sun, light, sky-image, and fog controls for the public topo map tool."
                  accentColor={selectedPageAccent}
                >
                  <TopoMapPanel
                    {...topoPanelProps}
                    section="environment"
                    nestedContainers={false}
                  />
                </LayerGroup>
              ) : null}
              {publicTopoSettings.graticuleLayers.length > 0 ? (
                <LayerGroup
                  title="Longitude / latitude grid"
                  manifestId="topo.group.graticule"
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
                  manifestId="topo.group.title"
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
            openSignal={resolvedGroupOpenSignal}
          >
            {group.title !== PUBLIC_TOPO_LAYER_GROUP_TITLE ? (
              <LayerGroupFogControl
                layerIds={layers.map((layer) => layer.id)}
                isEnv={isEnv}
                currentPage={currentPage}
                environment={currentPageEnvironment}
                globalFogDensity={
                  currentPageEnvironment.scene?.fog?.density ?? DEFAULT_FOG_DENSITY
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
                ensureLayerVisible={ensureSeismicLayerVisible}
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
          openSignal={(() => {
            const activeSignal = activeLayerOpenSignal(
              otherLayers.map((layer) => layer.id),
            );
            const revealSignal =
              revealLayerId &&
              otherLayers.some((layer) => layer.id === revealLayerId)
                ? revealTargetId
                : undefined;
            return activeSignal && revealSignal
              ? `${activeSignal}:${revealSignal}`
              : (activeSignal ?? revealSignal);
          })()}
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
