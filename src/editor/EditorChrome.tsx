import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import type { SceneHandle } from "../scene";
import type { PresentationPage } from "../pages/types";
import {
  PageControllerProvider,
  usePageController,
} from "../pages/PageController";
import {
  PAGE_BOUND_UI_SWITCH_THRESHOLD,
  UTAH_FORGE_LEGEND_EXIT_END,
  UTAH_FORGE_LEGEND_LAYOUT_END,
  UTAH_FORGE_LEGEND_LOCAL_DURATION_MS,
} from "../pages/pageTransitionUiPolicy";
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
  LEGEND_PANEL_WIDTH_PX,
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
  overflow: "visible",
  pointerEvents: "none",
};

const UTAH_FORGE_LEGEND_SLIDE_PX =
  LEGEND_PANEL_WIDTH_PX + LEGEND_PAGE_EDGE_MARGIN_PX;

type UtahForgeLegendId =
  | "seismic"
  | "seismic-presentation"
  | "scene-section"
  | "section-iso"
  | "mt-boundaries"
  | "borehole-logs"
  | "surface-elevation"
  | "mt-resistivity";

const UTAH_FORGE_NON_RESISTIVITY_LEGENDS: readonly UtahForgeLegendId[] = [
  "mt-boundaries",
  "seismic",
  "section-iso",
  "scene-section",
  "borehole-logs",
  "surface-elevation",
  "seismic-presentation",
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
  heightPx: number | null;
}

type UtahForgeLegendPresence = Record<UtahForgeLegendId, boolean>;

const EMPTY_UTAH_FORGE_LEGEND_PRESENCE: UtahForgeLegendPresence = {
  seismic: false,
  "seismic-presentation": false,
  "scene-section": false,
  "section-iso": false,
  "mt-boundaries": false,
  "borehole-logs": false,
  "surface-elevation": false,
  "mt-resistivity": false,
};

interface LocalLegendPresenceTransition {
  sourcePresence: UtahForgeLegendPresence;
  targetPresence: UtahForgeLegendPresence;
  progress: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function legendPresenceKey(presence: UtahForgeLegendPresence): string {
  return UTAH_FORGE_LEGENDS.map((id) => (presence[id] ? "1" : "0")).join("");
}

function useLocalLegendPresenceTransition(
  targetPresence: UtahForgeLegendPresence,
  enabled: boolean,
): LocalLegendPresenceTransition | null {
  const targetPresenceRef = useRef(targetPresence);
  const previousPresenceRef = useRef<UtahForgeLegendPresence | null>(null);
  const frameRef = useRef<number | null>(null);
  const [transition, setTransition] =
    useState<LocalLegendPresenceTransition | null>(null);
  const targetKey = legendPresenceKey(targetPresence);
  targetPresenceRef.current = targetPresence;

  useLayoutEffect(() => {
    const nextTargetPresence = targetPresenceRef.current;
    if (!enabled || typeof window === "undefined") {
      previousPresenceRef.current = nextTargetPresence;
      setTransition(null);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    const previousPresence = previousPresenceRef.current;
    if (previousPresence === null) {
      previousPresenceRef.current = nextTargetPresence;
      return;
    }
    if (legendPresenceKey(previousPresence) === targetKey) return;

    previousPresenceRef.current = nextTargetPresence;
    const sourcePresence = previousPresence;
    const startedAt = window.performance.now();
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const tick = (now: number) => {
      const progress = clamp01(
        (now - startedAt) / UTAH_FORGE_LEGEND_LOCAL_DURATION_MS,
      );
      if (progress >= 1) {
        setTransition(null);
        frameRef.current = null;
        return;
      }
      setTransition({
        sourcePresence,
        targetPresence: nextTargetPresence,
        progress,
      });
      frameRef.current = window.requestAnimationFrame(tick);
    };

    setTransition({
      sourcePresence,
      targetPresence: nextTargetPresence,
      progress: 0,
    });
    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [enabled, targetKey]);

  return transition;
}

function sectionIsoTargetsVisibleNow(sceneHandle: SceneHandle): boolean {
  return sceneHandle.manager.listSectionIsoTargets().some((target) => target.visible);
}

function useStableSectionIsoTargetsVisible(
  sceneHandle: SceneHandle,
  transitionActive: boolean,
  transitionRunId: string | null,
): boolean {
  const snapshotRef = useRef<{
    runId: string | null;
    visible: boolean;
  }>({ runId: null, visible: false });
  const currentVisible = sectionIsoTargetsVisibleNow(sceneHandle);

  if (transitionActive) {
    if (snapshotRef.current.runId !== transitionRunId) {
      snapshotRef.current = {
        runId: transitionRunId,
        visible: currentVisible,
      };
    }
    return snapshotRef.current.visible;
  }

  snapshotRef.current = {
    runId: null,
    visible: currentVisible,
  };
  return currentVisible;
}

function styleBoolean(
  style: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
}

function seismicPresentationPresetVisible(
  state: ReturnType<typeof useEditor>["state"],
  style: Record<string, unknown>,
): boolean {
  const ids = [style.seismicCapabilityPresetId, style.seismicAudiencePresetId]
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return false;
  const layer = state.manifest.layers.find(
    (candidate) => candidate.id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  );
  const metadata = layer?.metadata;
  const collections = [
    metadata?.seismicCapabilityPresets,
    metadata?.seismicAudiencePresets,
  ];
  return ids.some((id) =>
    collections.some((collection) =>
      Array.isArray(collection) &&
      collection.some(
        (candidate) =>
          candidate &&
          typeof candidate === "object" &&
          (candidate as Record<string, unknown>).id === id &&
          (candidate as Record<string, unknown>).presentationBarVisible === true,
      ),
    ),
  );
}

function utahForgeLegendPresenceForPage(
  state: ReturnType<typeof useEditor>["state"],
  page: PresentationPage | null,
  sectionIsoTargetsVisible: boolean,
): UtahForgeLegendPresence {
  if (!page) {
    return {
      seismic: false,
      "seismic-presentation": false,
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
  const seismicLayerVisible = visible.has(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
  const possibleSectionIsoTargetVisible =
    visible.has(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) ||
    visible.has(UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) ||
    seismicLayerVisible;
  const seismicVisible =
    seismicLayerVisible && styleBoolean(seismicStyle, "seismicLegendVisible", true);
  const seismicPresentationExplicitPageOverride =
    page.visibilityOverrides?.[UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID] !== undefined;
  const seismicLegendEnabled = styleBoolean(
    seismicStyle,
    "seismicLegendVisible",
    true,
  );
  const seismicPresentationOptIn =
    seismicStyle.seismicPresentationBarVisible === true ||
    seismicPresentationPresetVisible(state, seismicStyle);
  const seismicPresentationVisible =
    seismicLegendEnabled &&
    (seismicLayerVisible || seismicPresentationExplicitPageOverride || globalSettingsAuthoring) &&
    seismicPresentationOptIn;

  return {
    seismic: seismicPresentationVisible ? false : seismicVisible,
    "seismic-presentation": seismicPresentationVisible,
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

function stableLegendPageOverride(
  id: UtahForgeLegendId,
  sourcePage: PresentationPage | null,
  targetPage: PresentationPage | null,
  transitionProgress: number,
): PresentationPage | null {
  if (id === "mt-resistivity") return null;
  if (!sourcePage || !targetPage) return null;
  return transitionProgress >= PAGE_BOUND_UI_SWITCH_THRESHOLD
    ? targetPage
    : sourcePage;
}

function utahForgeLegendPhaseValues(progress: number): {
  exitT: number;
  layoutT: number;
  enterT: number;
} {
  const t = clamp01(progress);
  return {
    exitT: clamp01(t / UTAH_FORGE_LEGEND_EXIT_END),
    layoutT: clamp01(
      (t - UTAH_FORGE_LEGEND_EXIT_END) /
        (UTAH_FORGE_LEGEND_LAYOUT_END - UTAH_FORGE_LEGEND_EXIT_END),
    ),
    enterT: clamp01((t - UTAH_FORGE_LEGEND_LAYOUT_END) / (1 - UTAH_FORGE_LEGEND_LAYOUT_END)),
  };
}

function utahForgeLegendItemsForPresenceChange({
  sourcePresence,
  targetPresence,
  sourcePage,
  targetPage,
  progress,
  pageTransition,
}: {
  sourcePresence: UtahForgeLegendPresence;
  targetPresence: UtahForgeLegendPresence;
  sourcePage: PresentationPage | null;
  targetPage: PresentationPage | null;
  progress: number;
  pageTransition: boolean;
}): UtahForgeLegendTransitionItem[] {
  const { exitT, layoutT, enterT } = utahForgeLegendPhaseValues(progress);
  return UTAH_FORGE_LEGENDS.flatMap((id): UtahForgeLegendTransitionItem[] => {
    const inSource = sourcePresence[id];
    const inTarget = targetPresence[id];
    if (!inSource && !inTarget) return [];
    if (inSource && inTarget) {
      return [
        {
          id,
          pageOverride: pageTransition
            ? stableLegendPageOverride(id, sourcePage, targetPage, progress)
            : null,
          layoutWeight: 1,
          offsetX: 0,
          interactive: pageTransition
            ? progress > PAGE_BOUND_UI_SWITCH_THRESHOLD
            : true,
          heightPx: null,
        },
      ];
    }
    if (inSource) {
      return [
        {
          id,
          pageOverride: pageTransition ? sourcePage : null,
          layoutWeight: 1 - layoutT,
          offsetX: -UTAH_FORGE_LEGEND_SLIDE_PX * exitT,
          interactive: false,
          heightPx: null,
        },
      ];
    }
    return [
      {
        id,
        pageOverride: pageTransition ? targetPage : null,
        layoutWeight: layoutT,
        offsetX: -UTAH_FORGE_LEGEND_SLIDE_PX * (1 - enterT),
        interactive: progress > PAGE_BOUND_UI_SWITCH_THRESHOLD,
        heightPx: null,
      },
    ];
  });
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
      reapplyCurrentPageState("editor-deferred-flush");
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
  const sectionIsoTargetsVisible = useStableSectionIsoTargetsVisible(
    sceneHandle,
    transitionActive,
    transitionFrame.runId,
  );
  const currentPresence = sourcePage
    ? utahForgeLegendPresenceForPage(
        state,
        sourcePage,
        sectionIsoTargetsVisible,
      )
    : EMPTY_UTAH_FORGE_LEGEND_PRESENCE;
  const transitionTargetPresence =
    transitionActive && targetPage
      ? utahForgeLegendPresenceForPage(
          state,
          targetPage,
          sectionIsoTargetsVisible,
        )
      : null;
  const localPresenceTransition = useLocalLegendPresenceTransition(
    transitionTargetPresence ?? currentPresence,
    !transitionActive && !!sourcePage,
  );

  if (!transitionActive || !sourcePage || !targetPage) {
    const items = localPresenceTransition
      ? utahForgeLegendItemsForPresenceChange({
          sourcePresence: localPresenceTransition.sourcePresence,
          targetPresence: localPresenceTransition.targetPresence,
          sourcePage: null,
          targetPage: null,
          progress: localPresenceTransition.progress,
          pageTransition: false,
        })
      : UTAH_FORGE_LEGENDS.filter((id) => currentPresence[id]).map(
          (id) => ({
            id,
            pageOverride: null,
            layoutWeight: 1,
            offsetX: 0,
            interactive: true,
            heightPx: null,
          }),
        );
    return (
      <UtahForgeLegendStackLayout
        sceneHandle={sceneHandle}
        items={items}
      />
    );
  }

  const t = clamp01(transitionFrame.progress);
  const sourcePresence = utahForgeLegendPresenceForPage(
    state,
    sourcePage,
    sectionIsoTargetsVisible,
  );
  const targetPresence = transitionTargetPresence ?? EMPTY_UTAH_FORGE_LEGEND_PRESENCE;
  const items = utahForgeLegendItemsForPresenceChange({
    sourcePresence,
    targetPresence,
    sourcePage,
    targetPage,
    progress: t,
    pageTransition: true,
  });
  return (
    <UtahForgeLegendStackLayout items={items} sceneHandle={sceneHandle} />
  );
}

function UtahForgeLegendStackLayout({
  items,
  sceneHandle,
}: {
  items: readonly UtahForgeLegendTransitionItem[];
  sceneHandle: SceneHandle;
}) {
  const [heightById, setHeightById] = useState<Record<UtahForgeLegendId, number>>(
    {} as Record<UtahForgeLegendId, number>,
  );
  const setMeasuredHeight = useCallback(
    (id: UtahForgeLegendId, heightPx: number) => {
      if (!Number.isFinite(heightPx) || heightPx <= 0) return;
      setHeightById((current) => {
        if (Math.abs((current[id] ?? 0) - heightPx) < 0.5) return current;
        return {
          ...current,
          [id]: heightPx,
        };
      });
    },
    [],
  );
  const visibleItems = items.filter((item) => item.layoutWeight > 0.001);
  if (visibleItems.length === 0) return null;
  const measuredItems = visibleItems.map((item) => ({
    ...item,
    heightPx: heightById[item.id] ?? item.heightPx,
  }));
  return (
    <div
      style={{
        ...utahForgeLegendStackStyle,
        left: LEGEND_PAGE_EDGE_MARGIN_PX,
        bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX,
      }}
    >
      {measuredItems.map((item, index) => (
        <UtahForgeLegendStackItem
          key={item.id}
          item={item}
          sceneHandle={sceneHandle}
          onMeasured={setMeasuredHeight}
          marginTop={index === 0 ? 0 : LEGEND_STACK_GAP_PX * item.layoutWeight}
        />
      ))}
    </div>
  );
}

function UtahForgeLegendStackItem({
  item,
  marginTop,
  sceneHandle,
  onMeasured,
}: {
  item: UtahForgeLegendTransitionItem;
  marginTop: number;
  sceneHandle: SceneHandle;
  onMeasured: (id: UtahForgeLegendId, heightPx: number) => void;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const content = renderUtahForgeLegendItem(
    item.id,
    item.pageOverride,
    sceneHandle,
  );
  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node || typeof window === "undefined") return;
    const measure = () => {
      onMeasured(item.id, node.getBoundingClientRect().height);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      const frame = window.requestAnimationFrame(measure);
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [item.id, onMeasured]);
  const resolvedHeightPx = item.heightPx;
  const rowClipPath =
    resolvedHeightPx !== null
      ? `inset(0 -${UTAH_FORGE_LEGEND_SLIDE_PX}px 0 -${UTAH_FORGE_LEGEND_SLIDE_PX}px)`
      : undefined;
  return (
    <div
      style={{
        width: LEGEND_PANEL_WIDTH_PX,
        height:
          resolvedHeightPx !== null
            ? `${Math.max(0, resolvedHeightPx * item.layoutWeight).toFixed(1)}px`
            : undefined,
        marginTop,
        overflow: "visible",
        clipPath: rowClipPath,
        WebkitClipPath: rowClipPath,
        pointerEvents: item.interactive ? "auto" : "none",
      }}
    >
      <div
        ref={contentRef}
        style={{
          transform: `translate3d(${item.offsetX.toFixed(1)}px, 0, 0)`,
          willChange: item.offsetX === 0 ? undefined : "transform",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function renderUtahForgeLegendItem(
  id: UtahForgeLegendId,
  pageOverride: PresentationPage | null,
  sceneHandle: SceneHandle,
): ReactNode {
  switch (id) {
    case "seismic":
      return <SeismicVolumeLegend stacked pageOverride={pageOverride} />;
    case "seismic-presentation":
      return (
        <SeismicPresentationLegendBar
          sceneHandle={sceneHandle}
          stacked
          pageOverride={pageOverride}
        />
      );
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
