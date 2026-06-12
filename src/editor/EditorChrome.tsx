import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { SceneHandle } from "../scene";
import type { PresentationPage } from "../pages/types";
import {
  PageControllerProvider,
  usePageController,
} from "../pages/PageController";
import { NavControls } from "../ui/NavControls";
import { useEditor } from "./EditorContext";
import { ENVIRONMENT_SENTINEL } from "./types";
import { OverlayDisplay } from "../presenter/OverlayDisplay";
import { PresenterLogo } from "../presenter/PresenterLogo";
import { LightModeToggle } from "../ui/LightModeToggle";
import { SceneLabels } from "../ui/SceneLabels";
import { AssayLegend } from "../ui/AssayLegend";
import { ResistivityLegend } from "../ui/ResistivityLegend";
import { BoreholeLogsLegend } from "../ui/BoreholeLogsLegend";
import { MtSurfaceBoundaryLegend } from "../ui/MtSurfaceBoundaryLegend";
import { SectionIsoLegend } from "../ui/SectionIsoLegend";
import { SeismicPresentationLegendBar } from "../ui/SeismicPresentationLegendBar";
import { SeismicVolumeLegend } from "../ui/SeismicVolumeLegend";
import { SurfaceElevationLegend } from "../ui/SurfaceElevationLegend";
import { SceneSectionLegend } from "../ui/SceneSectionLegend";
import { ScaleBar } from "../ui/ScaleBar";
import { CaptureChromeGate } from "../capture/CaptureChromeGate";
import { CaptureDirectorProvider } from "../capture/CaptureDirectorProvider";
import { CaptureDirectorToolbar } from "../capture/CaptureDirectorToolbar";
import {
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  LEGEND_STACK_GAP_PX,
} from "../ui/legendStyles";
import {
  effectiveStyle,
  effectiveVisibility,
  resolveEnvironmentForPage,
} from "../pages/effective";
import {
  applyAudienceLensSceneToEnvironment,
  applyAudienceLensToState,
  type AudienceLensId,
} from "../audience/audienceLenses";
import { audienceLensById } from "../projectModules/caseStudyB/audienceLenses";
import { UTAH_FORGE_PREVIEW_LAYER_OVERRIDE_FIELDS } from "../projectModules/utahForge/editorPreviewFields";
import {
  UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_POINT_CLOUD_LEGEND_LAYER_IDS,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import { resolveTopoMapSettings } from "../topoMap/settings";

const EditorRoot = lazy(() =>
  import("./EditorRoot").then((module) => ({
    default: module.EditorRoot,
  })),
);

const utahForgeLegendStackStyle: CSSProperties = {
  position: "absolute",
  zIndex: 22,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  maxHeight: `calc(100vh - ${
    LEGEND_BOTTOM_EDGE_OFFSET_PX + LEGEND_PAGE_EDGE_MARGIN_PX
  }px)`,
  overflowY: "auto",
  pointerEvents: "none",
};

const UTAH_FORGE_LEGEND_SLIDE_PX = 64;
const UTAH_FORGE_LEGEND_EXIT_END = 0.34;
const UTAH_FORGE_LEGEND_LAYOUT_END = 0.68;

type UtahForgeLegendId =
  | "seismic"
  | "scene-section"
  | "section-iso"
  | "mt-boundaries"
  | "borehole-logs"
  | "surface-elevation"
  | "mt-resistivity";

const UTAH_FORGE_NON_RESISTIVITY_LEGENDS: readonly UtahForgeLegendId[] = [
  "seismic",
  "scene-section",
  "section-iso",
  "mt-boundaries",
  "borehole-logs",
  "surface-elevation",
];

const UTAH_FORGE_LEGENDS: readonly UtahForgeLegendId[] = [
  ...UTAH_FORGE_NON_RESISTIVITY_LEGENDS,
  "mt-resistivity",
];

const UTAH_FORGE_MT_RESISTIVITY_LEGEND_LAYER_IDS = [
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
] as const;

interface UtahForgeLegendTransitionItem {
  id: UtahForgeLegendId;
  pageOverride: PresentationPage | null;
  layoutWeight: number;
  offsetX: number;
  interactive: boolean;
}

type UtahForgeLegendPresence = Record<UtahForgeLegendId, boolean>;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function styleBoolean(
  style: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
}

function utahForgeLegendPresenceForPage(
  state: ReturnType<typeof useEditor>["state"],
  page: PresentationPage | null,
  sectionIsoTargetsVisible: boolean,
): UtahForgeLegendPresence {
  if (!page) {
    return {
      seismic: false,
      "scene-section": false,
      "section-iso": false,
      "mt-boundaries": false,
      "borehole-logs": false,
      "surface-elevation": false,
      "mt-resistivity": false,
    };
  }
  const environment = resolveEnvironmentForPage(
    state.environment,
    [...state.pages, ...state.archivedPages],
    page,
  );
  const visible = effectiveVisibility(environment, page);
  const styleFor = (layerId: string) =>
    effectiveStyle(environment, page, layerId);
  const scalarVisible = UTAH_FORGE_MT_RESISTIVITY_LEGEND_LAYER_IDS.some(
    (layerId) => visible.has(layerId),
  );
  const pointCloudExplicitPageOverride =
    UTAH_FORGE_MT_RESISTIVITY_POINT_CLOUD_LEGEND_LAYER_IDS.some(
      (layerId) => page.visibilityOverrides?.[layerId] !== undefined,
    );
  const globalSettingsAuthoring =
    state.projectSlug === "utah-forge" &&
    state.selectedPageId === ENVIRONMENT_SENTINEL;
  const seismicStyle = styleFor(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
  const sceneSectionStyle = styleFor(UTAH_FORGE_SCENE_SECTION_LAYER_ID);
  const thresholdStyle = styleFor(UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID);
  const boreholeLogStyle = styleFor(UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID);
  const topoMapSettings = resolveTopoMapSettings({
    manifest: state.manifest,
    environment,
    page,
  });
  const terrain = topoMapSettings.terrain;
  const surfaceElevationVisible =
    terrain.surfaceElevationEnabled === true &&
    terrain.surfaceElevationLegendVisible !== false &&
    (!topoMapSettings.surfaceLayerId ||
      visible.has(topoMapSettings.surfaceLayerId));
  const possibleSectionIsoTargetVisible =
    visible.has(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) ||
    visible.has(UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) ||
    visible.has(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);

  return {
    seismic:
      visible.has(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) &&
      styleBoolean(seismicStyle, "seismicLegendVisible", true),
    "scene-section":
      sceneSectionStyle.sceneSectionEnabled === true &&
      styleBoolean(sceneSectionStyle, "sceneSectionLegendVisible", true),
    "section-iso": possibleSectionIsoTargetVisible && sectionIsoTargetsVisible,
    "mt-boundaries":
      visible.has(UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID) &&
      thresholdStyle.mtSurfaceBoundaryLegendVisible !== false,
    "borehole-logs":
      (visible.has(UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID) ||
        page.visibilityOverrides?.[UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID] !==
          undefined) &&
      boreholeLogStyle.boreholeLogLegendVisible !== false,
    "surface-elevation": surfaceElevationVisible,
    "mt-resistivity":
      scalarVisible || pointCloudExplicitPageOverride || globalSettingsAuthoring,
  };
}

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
      authoringPages={[...state.pages, ...state.archivedPages]}
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
      <CaptureDirectorProvider sceneHandle={sceneHandle}>
        <EditorLiveApplyTransitionBridge />
        <SelectedPageMirror />
        <CaptureChromeGate group="navControls">
          <NavControls />
        </CaptureChromeGate>
        <CaptureChromeGate group="legends">
          <ScaleBarWithTransitionState sceneHandle={sceneHandle} />
        </CaptureChromeGate>
        <CaptureChromeGate group="editorSidebar">
          <Suspense fallback={null}>
            <EditorRoot
              sceneHandle={sceneHandle}
              activeAudienceLens={activeAudienceLens}
              onAudienceLensChange={setActiveAudienceLens}
            />
          </Suspense>
        </CaptureChromeGate>
        <CaptureChromeGate group="authoringControls">
          <LightModeToggle sceneHandle={sceneHandle} onReturnHome={onReturnHome} />
        </CaptureChromeGate>
        <CaptureChromeGate group="legends">
          <AssayLegend sceneHandle={sceneHandle} />
          {state.projectSlug === "utah-forge" ? (
            <>
              <UtahForgeLegendStack sceneHandle={sceneHandle} />
              <SeismicPresentationLegendBar sceneHandle={sceneHandle} />
            </>
          ) : (
            <>
              <ResistivityLegend />
              <MtSurfaceBoundaryLegend />
              <SceneSectionLegend />
              <SectionIsoLegend />
              <SeismicVolumeLegend />
              <SeismicPresentationLegendBar sceneHandle={sceneHandle} />
              <SurfaceElevationLegend />
            </>
          )}
        </CaptureChromeGate>
        <CaptureChromeGate group="sceneLabels">
          <SceneLabels sceneHandle={sceneHandle} />
        </CaptureChromeGate>
        <CaptureChromeGate group="logo">
          <PresenterLogo />
        </CaptureChromeGate>
        {/* Overlay container is always mounted. In editor mode it's draggable
            + resizable so the user can position per-page layout (saved to
            page.overlayLayout). In presenter mode it's inert -- read-only at
            the saved layout. Pages without overlay content render nothing. */}
        <CaptureChromeGate group="presenterOverlay">
          <OverlayDisplay />
        </CaptureChromeGate>
        <CaptureDirectorToolbar />
      </CaptureDirectorProvider>
    </PageControllerProvider>
  );
}

function EditorLiveApplyTransitionBridge() {
  const {
    isTransitioning,
    targetIndex,
    reapplyCurrentPageState,
  } = usePageController();
  const { setLiveApplyTransitionActive, flushDeferredLiveSceneEdits } =
    useEditor();
  const active = isTransitioning && targetIndex !== null;
  useEffect(() => {
    setLiveApplyTransitionActive(active);
    if (!active && flushDeferredLiveSceneEdits()) {
      reapplyCurrentPageState();
    }
    return () => setLiveApplyTransitionActive(false);
  }, [
    active,
    flushDeferredLiveSceneEdits,
    reapplyCurrentPageState,
    setLiveApplyTransitionActive,
  ]);
  return null;
}

function ScaleBarWithTransitionState({
  sceneHandle,
}: {
  sceneHandle: SceneHandle;
}) {
  const { isTransitioning, transitionFrame } = usePageController();
  const transitionActive = isTransitioning && transitionFrame.active;
  return (
    <ScaleBar
      sceneHandle={sceneHandle}
      transitionActive={transitionActive}
    />
  );
}

function UtahForgeLegendStack({
  sceneHandle,
}: {
  sceneHandle: SceneHandle;
}) {
  const { state } = useEditor();
  const {
    pages,
    currentIndex,
    transitionFrame,
  } = usePageController();
  const frameSourcePage = pages[transitionFrame.sourceIndex] ?? null;
  const frameTargetPage =
    typeof transitionFrame.targetIndex === "number"
      ? pages[transitionFrame.targetIndex] ?? null
      : null;
  const transitionActive =
    transitionFrame.active &&
    !!frameSourcePage &&
    !!frameTargetPage &&
    frameSourcePage.id !== frameTargetPage.id;
  const sourcePage = transitionActive
    ? frameSourcePage
    : pages[currentIndex] ?? null;
  const targetPage = transitionActive ? frameTargetPage : null;
  const sectionIsoTargetsVisible = sceneHandle.manager
    .listSectionIsoTargets()
    .some((target) => target.visible);

  if (!transitionActive || !sourcePage || !targetPage) {
    const currentPresence = utahForgeLegendPresenceForPage(
      state,
      sourcePage,
      sectionIsoTargetsVisible,
    );
    return (
      <UtahForgeLegendStackLayout
        items={UTAH_FORGE_LEGENDS.filter((id) => currentPresence[id]).map(
          (id) => ({
            id,
            pageOverride: null,
            layoutWeight: 1,
            offsetX: 0,
            interactive: true,
          }),
        )}
      />
    );
  }

  const t = clamp01(transitionFrame.progress);
  const exitT = clamp01(t / UTAH_FORGE_LEGEND_EXIT_END);
  const layoutT = clamp01(
    (t - UTAH_FORGE_LEGEND_EXIT_END) /
      (UTAH_FORGE_LEGEND_LAYOUT_END - UTAH_FORGE_LEGEND_EXIT_END),
  );
  const enterT = clamp01(
    (t - UTAH_FORGE_LEGEND_LAYOUT_END) /
      (1 - UTAH_FORGE_LEGEND_LAYOUT_END),
  );
  const sourcePresence = utahForgeLegendPresenceForPage(
    state,
    sourcePage,
    sectionIsoTargetsVisible,
  );
  const targetPresence = utahForgeLegendPresenceForPage(
    state,
    targetPage,
    sectionIsoTargetsVisible,
  );
  const items = UTAH_FORGE_LEGENDS.flatMap((id): UtahForgeLegendTransitionItem[] => {
    const inSource = sourcePresence[id];
    const inTarget = targetPresence[id];
    if (!inSource && !inTarget) return [];
    if (inSource && inTarget) {
      return [
        {
          id,
          pageOverride: id === "mt-resistivity" ? null : targetPage,
          layoutWeight: 1,
          offsetX: 0,
          interactive: t > 0.92,
        },
      ];
    }
    if (inSource) {
      return [
        {
          id,
          pageOverride: sourcePage,
          layoutWeight: 1 - layoutT,
          offsetX: -UTAH_FORGE_LEGEND_SLIDE_PX * exitT,
          interactive: false,
        },
      ];
    }
    return [
      {
        id,
        pageOverride: targetPage,
        layoutWeight: layoutT,
        offsetX: -UTAH_FORGE_LEGEND_SLIDE_PX * (1 - enterT),
        interactive: t > 0.92,
      },
    ];
  });
  return (
    <UtahForgeLegendStackLayout items={items} />
  );
}

function UtahForgeLegendStackLayout({
  items,
}: {
  items: readonly UtahForgeLegendTransitionItem[];
}) {
  const visibleItems = items.filter((item) => item.layoutWeight > 0.001);
  if (visibleItems.length === 0) return null;
  return (
    <div
      style={{
        ...utahForgeLegendStackStyle,
        left: LEGEND_PAGE_EDGE_MARGIN_PX,
        bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX,
      }}
    >
      {visibleItems.map((item, index) => (
        <UtahForgeLegendStackItem
          key={item.id}
          item={item}
          marginTop={index === 0 ? 0 : LEGEND_STACK_GAP_PX * item.layoutWeight}
        />
      ))}
    </div>
  );
}

function UtahForgeLegendStackItem({
  item,
  marginTop,
}: {
  item: UtahForgeLegendTransitionItem;
  marginTop: number;
}) {
  const content = renderUtahForgeLegendItem(item.id, item.pageOverride);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: `${Math.max(0.001, item.layoutWeight).toFixed(3)}fr`,
        marginTop,
        pointerEvents: item.interactive ? "auto" : "none",
      }}
    >
      <div
        style={{
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            transform: `translate3d(${item.offsetX.toFixed(1)}px, 0, 0)`,
            willChange: item.offsetX === 0 ? undefined : "transform",
          }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

function renderUtahForgeLegendItem(
  id: UtahForgeLegendId,
  pageOverride: PresentationPage | null,
): ReactNode {
  switch (id) {
    case "seismic":
      return <SeismicVolumeLegend stacked pageOverride={pageOverride} />;
    case "scene-section":
      return <SceneSectionLegend stacked pageOverride={pageOverride} />;
    case "section-iso":
      return <SectionIsoLegend stacked pageOverride={pageOverride} />;
    case "mt-boundaries":
      return <MtSurfaceBoundaryLegend stacked pageOverride={pageOverride} />;
    case "borehole-logs":
      return <BoreholeLogsLegend stacked pageOverride={pageOverride} />;
    case "surface-elevation":
      return <SurfaceElevationLegend stacked pageOverride={pageOverride} />;
    case "mt-resistivity":
      return <ResistivityLegend stacked pageOverride={pageOverride} />;
    default:
      return null;
  }
}

// Mirrors PageController.currentIndex to EditorContext.selectedPageId only when
// the camera page changes. It intentionally does not react to selectedPageId
// changes, because page-list clicks should be allowed to mark a clicked/target
// page immediately while the camera is still travelling there.
// Skips the mirror when the user has explicitly selected Global Settings.
function SelectedPageMirror() {
  const { pages, currentIndex, authoringPreviewPageId } = usePageController();
  const { state, selectPage } = useEditor();
  const selectedPageIdRef = useRef(state.selectedPageId);

  useEffect(() => {
    selectedPageIdRef.current = state.selectedPageId;
  }, [state.selectedPageId]);

  useEffect(() => {
    const selectedPageId = selectedPageIdRef.current;
    if (selectedPageId === ENVIRONMENT_SENTINEL) return;
    if (authoringPreviewPageId) return;
    const id = pages[currentIndex]?.id;
    if (id && id !== selectedPageId) selectPage(id);
  }, [pages, currentIndex, selectPage, authoringPreviewPageId]);
  return null;
}
