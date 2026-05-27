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
} from "../pages/effective";
import type { PresentationPage, ProjectLayerSpec } from "../pages/types";
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
  type LayerDataSection,
  type LayerGroupDef,
} from "./layerControls/layerPanelConfig";
import { layerHasRenderableControl } from "./layerControls/layerLabels";
import {
  UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID,
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_SITE_BOUNDARY_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import { isTopoMapGraticuleLayer, isTopoMapSurfaceLayer, resolveTopoMapSettings, topoMapLayerIds } from "../topoMap/settings";

interface LayerPanelGroupsProps {
  section: LayerDataSection;
  renderLayer: (layer: ProjectLayerSpec, index?: number) => React.ReactNode;
}

export function LayerPanelGroups({ section, renderLayer }: LayerPanelGroupsProps) {
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
