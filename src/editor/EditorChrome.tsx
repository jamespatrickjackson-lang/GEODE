import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { SceneHandle } from "../scene";
import {
  PageControllerProvider,
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
import { LEGEND_STACK_GAP_PX } from "../ui/legendStyles";
import {
  applyAudienceLensSceneToEnvironment,
  applyAudienceLensToState,
  type AudienceLensId,
} from "../audience/audienceLenses";
import { audienceLensById } from "../projectModules/caseStudyB/audienceLenses";
import { UTAH_FORGE_PREVIEW_LAYER_OVERRIDE_FIELDS } from "../projectModules/utahForge/editorPreviewFields";

const utahForgeLegendStackStyle: CSSProperties = {
  position: "absolute",
  zIndex: 11,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: LEGEND_STACK_GAP_PX,
  maxHeight: "calc(100vh - 104px)",
  overflowY: "auto",
  pointerEvents: "none",
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
          <SceneSectionLegend stacked />
          <SectionIsoLegend stacked />
          <ResistivityLegend stacked />
          <SurfaceElevationLegend stacked />
        </div>
      ) : (
        <>
          <ResistivityLegend />
          <SceneSectionLegend />
          <SectionIsoLegend />
          <SeismicVolumeLegend />
          <SurfaceElevationLegend />
        </>
      )}
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
