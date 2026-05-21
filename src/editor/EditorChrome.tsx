import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { SceneHandle } from "../scene";
import {
  PageControllerProvider,
  type PreviewLayerOverrideFields,
  usePageController,
} from "../pages/PageController";
import { NavControls } from "../ui/NavControls";
import { useEditor } from "./EditorContext";
import { EditorRoot } from "./EditorRoot";
import { ENVIRONMENT_SENTINEL } from "./types";
import { OverlayDisplay } from "../presenter/OverlayDisplay";
import { PresenterLogo } from "../presenter/PresenterLogo";
import { LightModeToggle } from "../ui/LightModeToggle";
import { SceneLabels } from "../ui/SceneLabels";
import { AssayLegend } from "../ui/AssayLegend";
import { ResistivityLegend } from "../ui/ResistivityLegend";
import { SectionIsoLegend } from "../ui/SectionIsoLegend";
import { SeismicVolumeLegend } from "../ui/SeismicVolumeLegend";
import { SurfaceElevationLegend } from "../ui/SurfaceElevationLegend";
import { SceneSectionLegend } from "../ui/SceneSectionLegend";
import { ScaleBar } from "../ui/ScaleBar";
import {
  applyAudienceLensSceneToEnvironment,
  applyAudienceLensToState,
  audienceLensById,
  type AudienceLensId,
} from "../audience/audienceLenses";

const UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID =
  "utah-forge-mt-resistivity-full-density";
const UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID =
  "utah-forge-mt-resistivity-slices";
const UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID =
  "utah-forge-mt-resistivity-preview";
const UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID =
  "utah-forge-mt-resistivity-volume";
const UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID =
  "utah-forge-mt-resistivity-threshold-surfaces";
const UTAH_FORGE_MT_STATIONS_LAYER_ID = "utah-forge-mt-stations";
const UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID = "utah-forge-phase3-seismic-browser";
const UTAH_FORGE_SCENE_SECTION_LAYER_ID = "utah-forge-scene-section-planes";
const UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID = "utah-forge-working-area-focus";

const MT_SCALAR_WINDOW_FIELDS = [
  "scalarFocusMin",
  "scalarFocusMax",
  "scalarBlendMin",
  "scalarBlendMax",
  "scalarEdgeHighlight",
  "scalarEdgeLowerValue",
  "scalarEdgeUpperValue",
  "scalarEdgeLineWidth",
  "scalarEdgeAverage",
  "scalarEdgeFillOffset",
  "scalarEdgeLineStyle",
  "scalarNoiseThreshold",
  "scalarDistanceLightStrength",
  "sectionIsoEnabled",
  "sectionIsoLinesVisible",
  "sectionIsoBandsVisible",
  "sectionIsoTargetIds",
  "sectionIsoMin",
  "sectionIsoMax",
  "sectionIsoLevelCount",
  "sectionIsoLineWidth",
  "sectionIsoLineStyle",
  "sectionIsoBandOpacity",
  "sectionIsoFillOffset",
  "sectionIsoSourceOpacity",
] as const;

const MT_VOLUME_PREVIEW_FIELDS = [
  ...MT_SCALAR_WINDOW_FIELDS,
  "scalarVolumeProductId",
  "scalarVolumeRenderMode",
  "scalarVolumeOpacity",
  "scalarVolumeDensity",
  "scalarVolumeSampleSteps",
  "scalarVolumeTransferMode",
  "scalarVolumeThresholdMin",
  "scalarVolumeThresholdMax",
  "scalarVolumeMaskVisible",
  "scalarLegendVisible",
  "opacity",
] as const;

const MT_FULL_DENSITY_PREVIEW_FIELDS = [
  "scalarInclusionMode",
  "scalarDistanceLightStrength",
  "sectionIsoEnabled",
  "sectionIsoLinesVisible",
  "sectionIsoBandsVisible",
  "sectionIsoTargetIds",
  "sectionIsoMin",
  "sectionIsoMax",
  "sectionIsoLevelCount",
  "sectionIsoLineWidth",
  "sectionIsoLineStyle",
  "sectionIsoBandOpacity",
  "sectionIsoFillOffset",
  "sectionIsoSourceOpacity",
] as const;

const MT_THRESHOLD_PREVIEW_FIELDS = [
  "mtThresholdSurfaceVisibility",
  "mtThresholdSurfaceWireframe",
  "opacity",
] as const;

const MT_STATION_PREVIEW_FIELDS = [
  "mtStationQcSelectedStationId",
  "mtStationQcPanelOpen",
  "pointMarkerRadiusM",
  "pointMarkerLiftM",
  "pointMarkerLabelLiftM",
] as const;

const SEISMIC_BROWSER_PREVIEW_FIELDS = [
  "seismicProductId",
  "seismicProductVisibility",
  "seismicRenderMode",
  "seismicSliceAxis",
  "seismicSliceFraction",
  "seismicAmplitudeMin",
  "seismicAmplitudeMax",
  "seismicAmplitudeGamma",
  "seismicColormap",
  "seismicRemoveBackground",
  "seismicBackgroundCutoff",
  "seismicVolumeSampleSteps",
  "seismicTimeScale",
  "seismicNavigationVisible",
  "seismicNavigationRoleVisibility",
  "seismicLegendVisible",
  "sectionIsoEnabled",
  "sectionIsoLinesVisible",
  "sectionIsoBandsVisible",
  "sectionIsoTargetIds",
  "sectionIsoMin",
  "sectionIsoMax",
  "sectionIsoLevelCount",
  "sectionIsoLineWidth",
  "sectionIsoLineStyle",
  "sectionIsoBandOpacity",
  "sectionIsoFillOffset",
  "sectionIsoSourceOpacity",
  "opacity",
] as const;

const SCENE_SECTION_PREVIEW_FIELDS = [
  "sceneSectionEnabled",
  "sceneSectionMode",
  "sceneSectionTargetScope",
  "sceneSectionActiveAxis",
  "sceneSectionPlanes",
  "sceneSectionTargetLayerIds",
  "sceneSectionTargetProductIds",
  "sceneSectionHelperVisible",
  "sceneSectionLegendVisible",
] as const;

const WORKING_AREA_FOCUS_PREVIEW_FIELDS = [
  "workingAreaFocusEnabled",
  "workingAreaFocusMode",
  "workingAreaFocusBoundsLayerId",
  "workingAreaFocusTargetLayerIds",
  "workingAreaFocusOutsideOpacityByLayerId",
  "workingAreaFocusHelperVisible",
] as const;

const utahForgeLegendStackStyle: CSSProperties = {
  position: "absolute",
  zIndex: 11,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 12,
  maxHeight: "calc(100vh - 104px)",
  overflowY: "auto",
  pointerEvents: "none",
};

const UTAH_FORGE_PREVIEW_LAYER_OVERRIDE_FIELDS: PreviewLayerOverrideFields = {
  [UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID]:
    MT_FULL_DENSITY_PREVIEW_FIELDS,
  [UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID]: MT_SCALAR_WINDOW_FIELDS,
  [UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID]: MT_SCALAR_WINDOW_FIELDS,
  [UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID]: MT_VOLUME_PREVIEW_FIELDS,
  [UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID]: MT_THRESHOLD_PREVIEW_FIELDS,
  [UTAH_FORGE_MT_STATIONS_LAYER_ID]: MT_STATION_PREVIEW_FIELDS,
  [UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID]: SEISMIC_BROWSER_PREVIEW_FIELDS,
  [UTAH_FORGE_SCENE_SECTION_LAYER_ID]: SCENE_SECTION_PREVIEW_FIELDS,
  [UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID]: WORKING_AREA_FOCUS_PREVIEW_FIELDS,
};

export function EditorChrome({
  sceneHandle,
  onReturnHome,
}: {
  sceneHandle: SceneHandle;
  onReturnHome: () => void;
}) {
  const { state } = useEditor();
  const [activeAudienceLens, setActiveAudienceLens] =
    useState<AudienceLensId>("investor");
  const gui = state.environment.scene?.gui ?? {};
  const navigator = gui.navigator ?? {};
  const legendInset =
    navigator.useOverride === true ? (navigator.bottom ?? 34) : 34;
  const presentationStateTransform = useCallback(
    (
      environment: typeof state.environment,
      page: (typeof state.pages)[number],
      context: { previewEnvironmentBase: boolean },
    ) => {
      if (state.projectSlug !== "case-study-b") return { environment, page };
      const lens = audienceLensById(activeAudienceLens);
      if (context.previewEnvironmentBase) {
        return {
          environment: applyAudienceLensSceneToEnvironment(environment, lens),
          page,
        };
      }
      return applyAudienceLensToState(environment, page, lens);
    },
    [activeAudienceLens, state.projectSlug],
  );
  return (
    <PageControllerProvider
      pages={state.pages}
      environment={state.environment}
      sceneHandle={sceneHandle}
      previewEnvironmentBase={state.selectedPageId === ENVIRONMENT_SENTINEL}
      previewLayerOverrideFields={
        state.projectSlug === "utah-forge"
          ? UTAH_FORGE_PREVIEW_LAYER_OVERRIDE_FIELDS
          : undefined
      }
      presentationStateTransform={presentationStateTransform}
      allowPageCameraMarker={
        state.selectedPageId !== ENVIRONMENT_SENTINEL && !state.presenterMode
      }
    >
      <SelectedPageMirror />
      <NavControls />
      <ScaleBar sceneHandle={sceneHandle} />
      <EditorRoot
        sceneHandle={sceneHandle}
        activeAudienceLens={activeAudienceLens}
        onAudienceLensChange={setActiveAudienceLens}
      />
      <LightModeToggle sceneHandle={sceneHandle} onReturnHome={onReturnHome} />
      <AssayLegend sceneHandle={sceneHandle} />
      {state.projectSlug === "utah-forge" ? (
        <div
          style={{
            ...utahForgeLegendStackStyle,
            left: legendInset,
            bottom: legendInset + 34,
          }}
        >
          <SeismicVolumeLegend stacked />
          <SectionIsoLegend stacked />
          <ResistivityLegend stacked />
          <SurfaceElevationLegend stacked />
        </div>
      ) : (
        <>
          <ResistivityLegend />
          <SectionIsoLegend />
          <SeismicVolumeLegend />
          <SurfaceElevationLegend />
        </>
      )}
      <SceneSectionLegend />
      <SceneLabels sceneHandle={sceneHandle} />
      <PresenterLogo />
      {/* Overlay container is always mounted. In editor mode it's draggable
          + resizable so the user can position per-page layout (saved to
          page.overlayLayout). In presenter mode it's inert -- read-only at
          the saved layout. Pages without overlay content render nothing. */}
      <OverlayDisplay />
    </PageControllerProvider>
  );
}

// Mirrors PageController.currentIndex to EditorContext.selectedPageId only when
// the camera page changes. It intentionally does not react to selectedPageId
// changes, because page-list clicks should be allowed to mark a clicked/target
// page immediately while the camera is still travelling there.
// Skips the mirror when the user has explicitly selected Global Settings.
function SelectedPageMirror() {
  const { pages, currentIndex } = usePageController();
  const { state, selectPage } = useEditor();
  const selectedPageIdRef = useRef(state.selectedPageId);

  useEffect(() => {
    selectedPageIdRef.current = state.selectedPageId;
  }, [state.selectedPageId]);

  useEffect(() => {
    const selectedPageId = selectedPageIdRef.current;
    if (selectedPageId === ENVIRONMENT_SENTINEL) return;
    const id = pages[currentIndex]?.id;
    if (id && id !== selectedPageId) selectPage(id);
  }, [pages, currentIndex, selectPage]);
  return null;
}
