import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "./EditorContext";
import { LayerPanel } from "./LayerPanel";
import {
  DynamicCameraPanel,
  PagePanel,
  UiSettingsPanel,
  VisualStudioPanel,
} from "./PagePanel";
import { OverlayPanel } from "./OverlayPanel";
import { CollapsibleSection } from "./CollapsibleSection";
import { DevModeInspector } from "./DevModeInspector";
import { ENVIRONMENT_SENTINEL } from "./types";
import { usePageController } from "../pages/PageController";
import { AudienceLensControls } from "../audience/AudienceLensControls";
import { type AudienceLensId } from "../audience/audienceLenses";
import {
  CASE_STUDY_B_AUDIENCE_LENSES,
  audienceLensById,
} from "../projectModules/caseStudyB/audienceLenses";
import {
  EDITOR_PILL_TEXT_INSET_PX,
  EDITOR_SCROLL_END_PADDING_Y,
  EDITOR_SECTION_MARGIN_X,
  FROSTED_HAIRLINE,
  FROSTED_PANEL_OUTLINE,
  TECHNICAL_MONO_FONT,
  globalSettingsAccent,
  pageAccentForPage,
  vibrancyLabel,
} from "./styles";
import type { SceneHandle } from "../scene";
import type { EditableStyle, ProjectLayerSpec } from "../pages/types";
import { effectiveStyle, effectiveVisibility } from "../pages/effective";
import { layerDataSection } from "./layerControls/layerPanelConfig";
import {
  UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_SITE_BOUNDARY_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import { topoMapLayerIds } from "../topoMap/settings";

const SIDEBAR_WIDTH = 512;
const FLOATING_PANEL_MARGIN = 44;
const BOTTOM_HUD_SAFE_ZONE = 112;
const EDITOR_INNER_BAR_RADIUS_PX = 22;
const EDITOR_DEFAULT_OUTER_RADIUS_PX =
  EDITOR_INNER_BAR_RADIUS_PX + EDITOR_SECTION_MARGIN_X;
const DEFAULT_SINGLE_CLICK_DELAY_MS = 250;
const DEFAULT_SCROLL_SETTLE_MS = 250;
const DEFAULT_PULSE_PILL_MS = 600;
const DEFAULT_PULSE_TEXT_MS = 480;
const DEFAULT_PULSE_STATIC_MS = 1200;

const UTAH_FORGE_DATA_LAYER_IDS = [
  UTAH_FORGE_SITE_BOUNDARY_LAYER_ID,
  UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  "utah-forge-reference-stage",
] as const;

function clampEditorNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function sceneTargetLayerId(targetId: string): string | null {
  if (targetId.startsWith("layer:")) return targetId.slice("layer:".length);
  if (!targetId.startsWith("product:")) return null;
  const rest = targetId.slice("product:".length);
  const separator = rest.indexOf(":");
  return separator > 0 ? rest.slice(0, separator) : null;
}

function cssEscape(value: string): string {
  const css = window.CSS as { escape?: (value: string) => string } | undefined;
  return css?.escape ? css.escape(value) : value.replace(/["\\]/g, "\\$&");
}

function layerSectionForTarget(
  layers: readonly ProjectLayerSpec[],
  targetId: string,
): ReturnType<typeof layerDataSection> | null {
  const layerId = sceneTargetLayerId(targetId);
  if (!layerId) return null;
  const layer = layers.find((candidate) => candidate.id === layerId);
  return layer ? layerDataSection(layer) : null;
}
const UTAH_FORGE_SECTIONS_CROPPING_LAYER_IDS = [
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
] as const;

function styleOpacityForActiveState(
  layerId: string,
  style: EditableStyle,
): number {
  const genericOpacity =
    typeof style.opacity === "number" && Number.isFinite(style.opacity)
      ? style.opacity
      : 1;
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) {
    const volumeOpacity =
      typeof style.scalarVolumeOpacity === "number" &&
      Number.isFinite(style.scalarVolumeOpacity)
        ? style.scalarVolumeOpacity
        : 1;
    return Math.min(genericOpacity, volumeOpacity);
  }
  return genericOpacity;
}

interface PanelPosition {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

function initialPanelPosition(): PanelPosition {
  if (typeof window === "undefined") {
    return { x: FLOATING_PANEL_MARGIN, y: FLOATING_PANEL_MARGIN };
  }
  return {
    x: Math.max(
      FLOATING_PANEL_MARGIN,
      window.innerWidth - SIDEBAR_WIDTH - FLOATING_PANEL_MARGIN,
    ),
    y: FLOATING_PANEL_MARGIN,
  };
}

const headerStyle: React.CSSProperties = {
  minHeight: 54,
  padding: `0 ${EDITOR_SECTION_MARGIN_X + EDITOR_PILL_TEXT_INSET_PX}px`,
  display: "flex",
  alignItems: "center",
  gap: 16,
  fontSize: 18,
  fontFamily: TECHNICAL_MONO_FONT,
  flex: "none",
  cursor: "grab",
  userSelect: "none",
  color: vibrancyLabel,
  background: "transparent",
  borderBottom: FROSTED_HAIRLINE,
  boxShadow: "none",
};

const sidebarStyle: React.CSSProperties = {
  position: "absolute",
  width: SIDEBAR_WIDTH,
  boxSizing: "border-box",
  height: "auto",
  maxHeight: `calc(100vh - ${FLOATING_PANEL_MARGIN + BOTTOM_HUD_SAFE_ZONE}px)`,
  display: "flex",
  flexDirection: "column",
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  zIndex: 20,
  border: FROSTED_PANEL_OUTLINE,
  borderRadius: EDITOR_DEFAULT_OUTER_RADIUS_PX,
  overflow: "hidden",
  boxShadow: "none",
  outline: "none",
};

const stackStyle: React.CSSProperties = {
  flex: "1 1 auto",
  overflowY: "auto",
  minHeight: 0,
  background: "transparent",
  paddingBottom: EDITOR_SCROLL_END_PADDING_Y,
  boxSizing: "border-box",
};

const previewLensBackdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 80,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  pointerEvents: "auto",
};

const previewLensGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(136px, 1fr))",
  gap: 10,
};

const previewLensButtonStyle: React.CSSProperties = {
  minHeight: 38,
  padding: "7px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  fontWeight: 650,
  letterSpacing: 0,
  lineHeight: 1.1,
};

// DEV NOTES: sidebar structure
// ----------------------------
// This file decides which top-level bars exist and in what order.
//
// The current top-level sections are created near the bottom of EditorRoot:
// - Page Manager   -> PagePanel
// - Camera Dynamics -> DynamicCameraPanel
// - Sections & Cropping -> LayerPanel(section="sectionsCropping")
// - FORGE/Public Data -> LayerPanel(section="public")
// - Customer Data  -> LayerPanel(section="customer")
// - Page GUI       -> OverlayPanel
//
// To rename the main bars, change the `title` prop on CollapsibleSection.
// To change the visual style of those bars, go to styles.ts and edit
// `frostedHeading` or `panelStyles.collapsibleHeader`.
//
// The top app strip with project name and Save is `headerStyle`.
// It is intentionally separate from the collapsible heading bars.
interface Props {
  sceneHandle: SceneHandle;
  activeAudienceLens: AudienceLensId;
  onAudienceLensChange: (lens: AudienceLensId) => void;
}

export function EditorRoot({
  sceneHandle,
  activeAudienceLens,
  onAudienceLensChange,
}: Props) {
  const {
    state,
    togglePresenterMode,
    commitPending,
    selectPage,
    setPageField,
    capturePoseForPage,
    setEnvLayerStyle,
    setPageLayerOverride,
  } = useEditor();
  const { currentIndex, isTransitioning, targetIndex, cameraObjectFocus } =
    usePageController();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [panelPosition, setPanelPosition] = useState(initialPanelPosition);
  const [dragging, setDragging] = useState(false);
  const [previewLensPromptOpen, setPreviewLensPromptOpen] = useState(false);
  const [publicDataOpenSignal, setPublicDataOpenSignal] = useState(0);
  const [publicTopoOpenSignal, setPublicTopoOpenSignal] = useState(0);
  const [sectionsRevealOpenSignal, setSectionsRevealOpenSignal] = useState(0);
  const [sceneRevealTargetId, setSceneRevealTargetId] = useState<string | null>(
    null,
  );
  const sceneRevealTimerRef = useRef<number | null>(null);
  const sceneRevealPulseTimerRef = useRef<number | null>(null);
  const selectedPageIndex =
    state.selectedPageId && state.selectedPageId !== ENVIRONMENT_SENTINEL
      ? state.pages.findIndex((page) => page.id === state.selectedPageId)
      : -1;
  const selectedPage =
    selectedPageIndex >= 0 ? state.pages[selectedPageIndex] : null;
  const selectedPageHasLanded =
    selectedPageIndex >= 0 &&
    selectedPageIndex === currentIndex &&
    !isTransitioning &&
    targetIndex === null;
  const cameraFocusSettings = state.environment.scene?.cameraFocus ?? {};
  const sceneRevealDelayMs = clampEditorNumber(
    cameraFocusSettings.singleClickDelayMs,
    DEFAULT_SINGLE_CLICK_DELAY_MS,
    120,
    500,
  );
  const sceneRevealScrollSettleMs = clampEditorNumber(
    cameraFocusSettings.scrollSettleMs,
    DEFAULT_SCROLL_SETTLE_MS,
    80,
    800,
  );
  const sceneRevealScrollBehavior =
    cameraFocusSettings.revealScrollBehavior === "auto" ? "auto" : "smooth";
  const editorScrollStyle = {
    ...stackStyle,
    "--editor-pulse-pill-ms": `${clampEditorNumber(
      cameraFocusSettings.pulsePillMs,
      DEFAULT_PULSE_PILL_MS,
      200,
      1600,
    )}ms`,
    "--editor-pulse-text-ms": `${clampEditorNumber(
      cameraFocusSettings.pulseTextMs,
      DEFAULT_PULSE_TEXT_MS,
      200,
      1600,
    )}ms`,
    "--editor-pulse-static-ms": `${clampEditorNumber(
      cameraFocusSettings.pulseStaticMs,
      DEFAULT_PULSE_STATIC_MS,
      400,
      3000,
    )}ms`,
  } as React.CSSProperties;
  const globalSettingsSelected = state.selectedPageId === ENVIRONMENT_SENTINEL;
  const isCaseStudyB = state.projectSlug === "case-study-b";
  const publicDataTitle =
    state.projectSlug === "utah-forge" ? "FORGE Data" : "Public Data";
  const hasPublicTopoMap = topoMapLayerIds(state.manifest.layers).length > 0;
  const hasSectionsCropping = state.projectSlug === "utah-forge";
  const forgeDataVisibleLayerIds = selectedPage
    ? effectiveVisibility(state.environment, selectedPage)
    : new Set(state.environment.defaultVisibleLayers);
  const utahForgeActiveLayerIds = (layerIds: readonly string[]) =>
    state.projectSlug === "utah-forge"
      ? layerIds.filter((layerId) => {
          const style = selectedPage
            ? effectiveStyle(state.environment, selectedPage, layerId)
            : (state.environment.layerStyles[layerId] ?? {});
          if (layerId === UTAH_FORGE_SCENE_SECTION_LAYER_ID) {
            return style.sceneSectionEnabled === true;
          }
          if (layerId === UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID) {
            return style.workingAreaFocusEnabled === true;
          }
          if (!forgeDataVisibleLayerIds.has(layerId)) return false;
          return styleOpacityForActiveState(layerId, style) > 0.001;
        })
      : [];
  const forgeDataActiveLayerIds = utahForgeActiveLayerIds(
    UTAH_FORGE_DATA_LAYER_IDS,
  );
  const sectionsCroppingActiveLayerIds = utahForgeActiveLayerIds(
    UTAH_FORGE_SECTIONS_CROPPING_LAYER_IDS,
  );
  const forgeDataActiveSignal =
    forgeDataActiveLayerIds.length > 0
      ? `${selectedPage?.id ?? ENVIRONMENT_SENTINEL}:${forgeDataActiveLayerIds.join(
          ",",
        )}:${publicDataOpenSignal}`
      : publicDataOpenSignal > 0
        ? `event:${publicDataOpenSignal}`
        : undefined;
  const sectionsCroppingActiveSignal =
    sectionsCroppingActiveLayerIds.length > 0
      ? `${selectedPage?.id ?? ENVIRONMENT_SENTINEL}:${sectionsCroppingActiveLayerIds.join(
          ",",
        )}`
      : undefined;
  const selectedPageAccent =
    selectedPageIndex >= 0
      ? pageAccentForPage(
          selectedPage!,
          selectedPageIndex,
          selectedPageHasLanded ? 0.496 : 0.192,
        )
      : globalSettingsSelected
        ? globalSettingsAccent
      : null;
  const editorShellStyle = editorShellStyleFromGui(
    state.environment.scene?.gui,
  );
  const enterPreview = useCallback(() => {
    if (!state.presenterMode && isCaseStudyB) {
      setPreviewLensPromptOpen(true);
      return;
    }
    setPreviewLensPromptOpen(false);
    togglePresenterMode();
  }, [isCaseStudyB, state.presenterMode, togglePresenterMode]);

  const choosePreviewLens = useCallback(
    (lensId: AudienceLensId) => {
      onAudienceLensChange(lensId);
      setPreviewLensPromptOpen(false);
      if (!state.presenterMode) togglePresenterMode();
    },
    [onAudienceLensChange, state.presenterMode, togglePresenterMode],
  );

  const cancelPreviewLensPrompt = useCallback(() => {
    setPreviewLensPromptOpen(false);
  }, []);

  useEffect(() => {
    const handleSeismicProductClick = (event: Event) => {
      const detail = (event as CustomEvent<{
        layerId?: unknown;
        productId?: unknown;
        renderMode?: unknown;
        sliceAxis?: unknown;
        sliceFraction?: unknown;
      }>).detail;
      if (
        !detail ||
        detail.layerId !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID ||
        typeof detail.productId !== "string"
      ) {
        return;
      }

      const page =
        state.selectedPageId &&
        state.selectedPageId !== ENVIRONMENT_SENTINEL
          ? state.pages.find((candidate) => candidate.id === state.selectedPageId)
          : null;
      const envVisibility =
        state.environment.layerStyles[UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID]
          ?.seismicProductVisibility ?? {};
      const pageVisibility =
        page?.layerOverrides?.[UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID]
          ?.seismicProductVisibility ?? {};
      const patch: Partial<EditableStyle> = {
        seismicProductId: detail.productId,
        seismicProductVisibility: {
          ...envVisibility,
          ...pageVisibility,
          [detail.productId]: true,
        },
      };
      if (detail.renderMode === "slice" || detail.renderMode === "raymarch") {
        patch.seismicRenderMode = detail.renderMode;
      }
      if (
        detail.sliceAxis === "inline" ||
        detail.sliceAxis === "crossline" ||
        detail.sliceAxis === "sample" ||
        detail.sliceAxis === "line"
      ) {
        patch.seismicSliceAxis = detail.sliceAxis;
      }
      if (
        typeof detail.sliceFraction === "number" &&
        Number.isFinite(detail.sliceFraction)
      ) {
        patch.seismicSliceFraction = detail.sliceFraction;
      }

      if (page) {
        setPageLayerOverride(
          page.id,
          UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
          patch,
        );
      } else {
        setEnvLayerStyle(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID, patch);
      }
      const sectionStyle = page
        ? page.layerOverrides?.[UTAH_FORGE_SCENE_SECTION_LAYER_ID] ??
          state.environment.layerStyles[UTAH_FORGE_SCENE_SECTION_LAYER_ID]
        : state.environment.layerStyles[UTAH_FORGE_SCENE_SECTION_LAYER_ID];
      if (sectionStyle?.sceneSectionTargetScope === "active-selection") {
        const sectionPatch: Partial<EditableStyle> = {
          sceneSectionTargetProductIds: [detail.productId],
        };
        if (page) {
          setPageLayerOverride(
            page.id,
            UTAH_FORGE_SCENE_SECTION_LAYER_ID,
            sectionPatch,
          );
        } else {
          setEnvLayerStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, sectionPatch);
        }
      }
      setPublicDataOpenSignal((value) => value + 1);
    };
    window.addEventListener(
      "geosee:seismic-product-click",
      handleSeismicProductClick,
    );
    return () =>
      window.removeEventListener(
        "geosee:seismic-product-click",
        handleSeismicProductClick,
      );
  }, [
    setEnvLayerStyle,
    setPageLayerOverride,
    state.environment.layerStyles,
    state.pages,
    state.selectedPageId,
  ]);
  useEffect(() => {
    const handleMtStationClick = (event: Event) => {
      const detail = (event as CustomEvent<{ stationId?: unknown }>).detail;
      if (!detail || typeof detail.stationId !== "string") return;

      const page =
        state.selectedPageId &&
        state.selectedPageId !== ENVIRONMENT_SENTINEL
          ? state.pages.find((candidate) => candidate.id === state.selectedPageId)
          : null;
      const patch: Partial<EditableStyle> = {
        mtStationQcSelectedStationId: detail.stationId,
        mtStationQcPanelOpen: true,
      };
      if (page) {
        setPageLayerOverride(page.id, UTAH_FORGE_MT_STATIONS_LAYER_ID, patch);
      } else {
        setEnvLayerStyle(UTAH_FORGE_MT_STATIONS_LAYER_ID, patch);
      }
      setPublicDataOpenSignal((value) => value + 1);
    };
    window.addEventListener("geosee:mt-station-click", handleMtStationClick);
    return () =>
      window.removeEventListener("geosee:mt-station-click", handleMtStationClick);
  }, [
    setEnvLayerStyle,
    setPageLayerOverride,
    state.pages,
    state.selectedPageId,
  ]);

  useEffect(() => {
    const clearRevealTimers = () => {
      if (sceneRevealTimerRef.current !== null) {
        window.clearTimeout(sceneRevealTimerRef.current);
        sceneRevealTimerRef.current = null;
      }
      if (sceneRevealPulseTimerRef.current !== null) {
        window.clearTimeout(sceneRevealPulseTimerRef.current);
        sceneRevealPulseTimerRef.current = null;
      }
    };
    const findTarget = (targetId: string): HTMLElement | null => {
      const panel = panelRef.current;
      if (!panel) return null;
      const candidates = [targetId];
      const layerId = sceneTargetLayerId(targetId);
      if (layerId && targetId !== `layer:${layerId}`) {
        candidates.push(`layer:${layerId}`);
      }
      for (const candidate of candidates) {
        const node = panel.querySelector<HTMLElement>(
          `[data-editor-target="${cssEscape(candidate)}"]`,
        );
        if (node) return node;
      }
      return null;
    };
    const revealTarget = (targetId: string) => {
      const scheduleRevealWork = (callback: () => void, delayMs: number) => {
        if (sceneRevealPulseTimerRef.current !== null) {
          window.clearTimeout(sceneRevealPulseTimerRef.current);
        }
        sceneRevealPulseTimerRef.current = window.setTimeout(() => {
          sceneRevealPulseTimerRef.current = null;
          callback();
        }, delayMs);
      };
      const pulseTarget = () => {
        const latestTarget = findTarget(targetId);
        if (!latestTarget) return;
        const rawKind = latestTarget.dataset.editorTargetKind;
        const kind =
          rawKind === "text"
            ? "text"
            : rawKind === "container"
              ? "container"
              : "pill";
        latestTarget.removeAttribute("data-editor-pulse");
        void latestTarget.offsetWidth;
        latestTarget.setAttribute("data-editor-pulse", kind);
      };
      const scrollAndPulse = (attempt = 0) => {
        const scroll = panelRef.current?.querySelector<HTMLElement>(
          ".editor-sidebar-scroll",
        );
        const target = findTarget(targetId);
        if (!scroll || !target) {
          if (attempt === 0) {
            scheduleRevealWork(() => scrollAndPulse(1), 80);
          }
          return;
        }
        const scrollRect = scroll.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const nextTop =
          scroll.scrollTop + targetRect.top - scrollRect.top - 12;
        scroll.scrollTo({
          top: Math.max(0, nextTop),
          behavior: sceneRevealScrollBehavior,
        });
        scheduleRevealWork(pulseTarget, sceneRevealScrollSettleMs);
      };
      const section = layerSectionForTarget(state.manifest.layers, targetId);
      if (section === "public") {
        setPublicDataOpenSignal((value) => value + 1);
      } else if (section === "publicTopo") {
        setPublicTopoOpenSignal((value) => value + 1);
      } else if (section === "sectionsCropping") {
        setSectionsRevealOpenSignal((value) => value + 1);
      }
      setSceneRevealTargetId(targetId);
      scheduleRevealWork(() => scrollAndPulse(), 32);
    };
    const handleSceneTargetClick = (event: Event) => {
      const detail = (event as CustomEvent<{ targetId?: unknown }>).detail;
      if (!detail || typeof detail.targetId !== "string") return;
      clearRevealTimers();
      sceneRevealTimerRef.current = window.setTimeout(() => {
        sceneRevealTimerRef.current = null;
        revealTarget(detail.targetId as string);
      }, sceneRevealDelayMs);
    };
    const handleSceneTargetFocus = () => {
      clearRevealTimers();
    };
    window.addEventListener("geosee:scene-target-click", handleSceneTargetClick);
    window.addEventListener("geosee:scene-target-focus", handleSceneTargetFocus);
    return () => {
      clearRevealTimers();
      window.removeEventListener(
        "geosee:scene-target-click",
        handleSceneTargetClick,
      );
      window.removeEventListener(
        "geosee:scene-target-focus",
        handleSceneTargetFocus,
      );
    };
  }, [
    sceneRevealDelayMs,
    sceneRevealScrollBehavior,
    sceneRevealScrollSettleMs,
    state.manifest.layers,
  ]);

  const clampPanelPosition = useCallback((position: PanelPosition) => {
    const panel = panelRef.current;
    const panelWidth = panel?.offsetWidth ?? SIDEBAR_WIDTH;
    const panelHeight =
      panel?.offsetHeight ??
      Math.min(
        760,
        window.innerHeight - FLOATING_PANEL_MARGIN - BOTTOM_HUD_SAFE_ZONE,
      );
    const maxX = Math.max(
      FLOATING_PANEL_MARGIN,
      window.innerWidth - panelWidth - FLOATING_PANEL_MARGIN,
    );
    const maxY = Math.max(
      FLOATING_PANEL_MARGIN,
      window.innerHeight - panelHeight - BOTTOM_HUD_SAFE_ZONE,
    );

    return {
      x: Math.min(Math.max(FLOATING_PANEL_MARGIN, position.x), maxX),
      y: Math.min(Math.max(FLOATING_PANEL_MARGIN, position.y), maxY),
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isSave =
        (e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S");
      if (!isSave) return;
      e.preventDefault();
      if (state.dirty.size > 0 && state.saveStatus !== "saving") {
        void commitPending();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.dirty, state.saveStatus, commitPending]);

  useEffect(() => {
    const onResize = () => {
      setPanelPosition((position) => clampPanelPosition(position));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPanelPosition]);

  const onDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isDragBlocked(event.target)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: panelPosition.x,
        originY: panelPosition.y,
      };
      setDragging(true);
    },
    [panelPosition.x, panelPosition.y],
  );

  const onDragMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      setPanelPosition(
        clampPanelPosition({
          x: drag.originX + event.clientX - drag.startX,
          y: drag.originY + event.clientY - drag.startY,
        }),
      );
    },
    [clampPanelPosition],
  );

  const onDragEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      dragRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  if (state.presenterMode) {
    return (
      <>
        <AudienceLensControls
          sceneHandle={sceneHandle}
          activeLens={activeAudienceLens}
          onLensChange={onAudienceLensChange}
          mode="hidden"
        />
        <FloatingPreviewToggle
          presenterMode={state.presenterMode}
          onClick={enterPreview}
        />
      </>
    );
  }

  return (
    <>
      <style>
        {`
          .editor-action-button {
            transition:
              transform 100ms ease,
              border-color 140ms ease,
              box-shadow 140ms ease,
              opacity 140ms ease;
          }

          .editor-action-button:not(:disabled):hover {
            border-color: rgba(244, 240, 232, 0.46) !important;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.16),
              inset 0 -1px 0 rgba(0, 0, 0, 0.18) !important;
          }

          .editor-action-button:not(:disabled):active {
            transform: translateY(1px) scale(0.985);
          }

          .editor-icon-only-button:not(:disabled):hover {
            border-color: transparent !important;
            box-shadow: none !important;
          }
        `}
      </style>
      <div
        ref={panelRef}
        style={{
          ...sidebarStyle,
          ...editorShellStyle,
          left: panelPosition.x,
          top: panelPosition.y,
        }}
        data-dev-source="src/editor/EditorRoot.tsx:56"
        data-dev-note="sidebarStyle controls the floating editor panel shell: size, bevel, material, and position."
      >
        <div
          style={{
            ...headerStyle,
            cursor: dragging ? "grabbing" : headerStyle.cursor,
          }}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          data-dev-source="src/editor/EditorRoot.tsx:38"
          data-dev-note="headerStyle controls the draggable top strip with project name and Save."
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 500,
              color: vibrancyLabel,
            }}
            title={state.manifest.name}
          >
            {state.manifest.name}
          </div>
          <SaveButton />
        </div>

        <AudienceLensControls
          sceneHandle={sceneHandle}
          activeLens={activeAudienceLens}
          onLensChange={onAudienceLensChange}
        />

        <div
          className="editor-sidebar-scroll"
          style={editorScrollStyle}
          data-dev-source="src/editor/EditorRoot.tsx:50"
          data-dev-note="stackStyle controls the scrollable sidebar content; global.css hides this scrollbar."
        >
          <CollapsibleSection title="Page Manager">
            <PagePanel sceneHandle={sceneHandle} />
          </CollapsibleSection>
          <CollapsibleSection
            title="Visual Studio"
            accentColor={globalSettingsSelected ? globalSettingsAccent : null}
            onActivate={() => selectPage(ENVIRONMENT_SENTINEL)}
          >
            <VisualStudioPanel accentColor={globalSettingsAccent} />
          </CollapsibleSection>
          <CollapsibleSection
            title="UI"
            accentColor={globalSettingsSelected ? globalSettingsAccent : null}
            onActivate={() => selectPage(ENVIRONMENT_SENTINEL)}
          >
            <UiSettingsPanel accentColor={globalSettingsAccent} />
          </CollapsibleSection>
          {selectedPage && (
            <CollapsibleSection
              title="Camera Dynamics"
              accentColor={selectedPageAccent}
              closeSignal={selectedPage.id}
            >
              <DynamicCameraPanel
                page={selectedPage}
                sceneHandle={sceneHandle}
                setPageField={setPageField}
                capturePoseForPage={capturePoseForPage}
                cameraObjectFocus={cameraObjectFocus}
                disabled={isTransitioning}
                pageAccent={pageAccentForPage(
                  selectedPage,
                  Math.max(0, selectedPageIndex),
                  selectedPageHasLanded ? 0.368 : 0.192,
                )}
              />
            </CollapsibleSection>
          )}
          {hasSectionsCropping && (
            <CollapsibleSection
              title="Sections & Cropping"
              openSignal={
                sectionsCroppingActiveSignal && sectionsRevealOpenSignal > 0
                  ? `${sectionsCroppingActiveSignal}:${sectionsRevealOpenSignal}`
                  : (sectionsCroppingActiveSignal ??
                    (sectionsRevealOpenSignal > 0
                      ? sectionsRevealOpenSignal
                      : undefined))
              }
              accentColor={selectedPageAccent}
              closeSignal={selectedPage?.id}
            >
              <LayerPanel
                section="sectionsCropping"
                revealTargetId={sceneRevealTargetId}
              />
            </CollapsibleSection>
          )}
          {hasPublicTopoMap && (
            <CollapsibleSection
              title="Public Topo Map"
              openSignal={
                publicTopoOpenSignal > 0 ? publicTopoOpenSignal : undefined
              }
              accentColor={selectedPageAccent}
              closeSignal={selectedPage?.id}
            >
              <LayerPanel
                section="publicTopo"
                revealTargetId={sceneRevealTargetId}
              />
            </CollapsibleSection>
          )}
          <CollapsibleSection
            title={publicDataTitle}
            openSignal={forgeDataActiveSignal}
            accentColor={selectedPageAccent}
          >
            <LayerPanel section="public" revealTargetId={sceneRevealTargetId} />
          </CollapsibleSection>
          <CollapsibleSection
            title="Overlay Box Manager"
            accentColor={selectedPageAccent}
          >
            <OverlayPanel />
          </CollapsibleSection>
        </div>
        <DevModeInspector />
      </div>
      <FloatingPreviewToggle
        presenterMode={state.presenterMode}
        onClick={enterPreview}
      />
      {previewLensPromptOpen && (
        <PreviewLensPrompt
          activeLens={activeAudienceLens}
          onChoose={choosePreviewLens}
          onCancel={cancelPreviewLensPrompt}
        />
      )}
    </>
  );
}

function SaveButton() {
  const { state, commitPending } = useEditor();
  const dirtyCount = state.dirty.size;
  const isSaving = state.saveStatus === "saving";
  const isError = state.saveStatus === "error";
  const isClean = dirtyCount === 0 && !isError;

  let disabled = false;
  const hasUnsaved = dirtyCount > 0 || isError;

  if (isSaving) {
    disabled = true;
  } else if (isClean) {
    disabled = true;
  }

  return (
    <div
      style={{
        height: 24,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        flex: "none",
      }}
    >
      <span
        style={{
          minWidth: 12,
          height: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "flex-end",
          textAlign: "right",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          color: hasUnsaved ? "#ff6f7f" : "rgba(255, 255, 255, 0.78)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {dirtyCount}
      </span>
      <button
        className="editor-action-button"
        style={{
          width: 24,
          height: 24,
          minWidth: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          borderRadius: 999,
          border: "1px solid transparent",
          background: hasUnsaved
            ? "rgba(255, 111, 127, 0.34)"
            : "rgba(244, 240, 232, 0.066)",
          color: hasUnsaved ? "#fff0f2" : vibrancyLabel,
          opacity: isSaving ? 0.72 : 1,
          cursor: disabled ? "default" : "pointer",
          boxShadow: "none",
          fontFamily: TECHNICAL_MONO_FONT,
          lineHeight: 0,
          boxSizing: "border-box",
        }}
        disabled={disabled}
        onClick={() => void commitPending()}
        title={
          isSaving
            ? "Saving..."
            : isError
              ? state.saveError ?? "Save failed -- click to retry"
              : isClean
                ? "No pending edits"
                : "Commit pending edits to disk (Ctrl+S)"
        }
        aria-label={
          isSaving
            ? "Saving"
            : isClean
              ? "Saved"
              : `Save ${dirtyCount} pending edit${dirtyCount === 1 ? "" : "s"}`
        }
      >
        <SaveDiskIcon />
      </button>
    </div>
  );
}

function PreviewLensPrompt({
  activeLens,
  onChoose,
  onCancel,
}: {
  activeLens: AudienceLensId;
  onChoose: (lens: AudienceLensId) => void;
  onCancel: () => void;
}) {
  const { state } = useEditor();
  const gui = state.environment.scene?.gui ?? {};
  const overlay = gui.overlay ?? {};
  const lensScene = audienceLensById(activeLens).scene;
  const viewerBackground =
    lensScene.background ?? state.environment.scene?.background ?? "#151819";
  const textColor = overlay.textColor ?? vibrancyLabel;
  const backgroundColor = overlay.backgroundColor ?? "#f6f6f6";
  const backgroundAlpha = clamp01(overlay.backgroundAlpha ?? 0.72);
  const borderColor = overlay.borderColor ?? "#ffffff";
  const borderAlpha = clamp01(overlay.borderAlpha ?? 0.58);
  const borderWidth = Math.max(0, overlay.borderWidth ?? 1);
  const radius =
    overlay.bevelRatio === true
      ? (overlay.imageRadius ?? 16) + (overlay.imagePadding ?? 32)
      : (overlay.radius ?? 24);
  const textPadding = Math.max(
    0,
    overlay.textPadding ?? overlay.contentPadding ?? 32,
  );
  const backdropBlur = Math.max(0, overlay.backdropBlurPx ?? 24);
  const backdropSaturation = Math.max(0, overlay.backdropSaturation ?? 180);
  const shadowAlpha = clamp01(overlay.shadowAlpha ?? 0.24);
  const shadowBlur = Math.max(0, overlay.shadowBlur ?? 80);
  const shadowOffsetY = Math.max(0, overlay.shadowOffsetY ?? 24);
  const topHighlightAlpha = clamp01(overlay.topHighlightAlpha ?? 0.7);
  const bottomShadowAlpha = clamp01(overlay.bottomShadowAlpha ?? 0.12);
  const promptBackground = [
    `linear-gradient(180deg, rgba(255, 255, 255, ${
      topHighlightAlpha * 0.1
    }) 0%, rgba(0, 0, 0, ${bottomShadowAlpha}) 100%)`,
    hexToRgba(backgroundColor, backgroundAlpha),
  ].join(", ");
  const promptFilter = `blur(${backdropBlur}px) saturate(${backdropSaturation}%)`;
  const promptStyle: React.CSSProperties = {
    width: "min(620px, calc(100vw - 48px))",
    padding: textPadding,
    border:
      borderWidth > 0
        ? `${borderWidth}px solid ${hexToRgba(borderColor, borderAlpha)}`
        : "none",
    borderRadius: radius,
    background: promptBackground,
    color: textColor,
    boxShadow:
      shadowAlpha > 0 && shadowBlur > 0
        ? `0 ${shadowOffsetY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowAlpha})`
        : "none",
    backdropFilter: promptFilter,
    WebkitBackdropFilter: promptFilter,
    fontFamily: overlay.bodyFontFamily ?? TECHNICAL_MONO_FONT,
  };
  const buttonStyle: React.CSSProperties = {
    ...previewLensButtonStyle,
    border:
      borderWidth > 0
        ? `${borderWidth}px solid ${hexToRgba(borderColor, borderAlpha)}`
        : "none",
    borderRadius: Math.max(7, Math.min(radius, 18)),
    background: promptBackground,
    color: textColor,
    boxShadow: "none",
    backdropFilter: promptFilter,
    WebkitBackdropFilter: promptFilter,
  };

  return (
    <div
      style={{
        ...previewLensBackdropStyle,
        background: viewerBackground,
      }}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        style={promptStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Choose audience lens"
      >
        <div style={previewLensGridStyle}>
          {CASE_STUDY_B_AUDIENCE_LENSES.map((lens) => {
            return (
              <button
                key={lens.id}
                type="button"
                style={buttonStyle}
                title={lens.summary}
                onClick={() => onChoose(lens.id)}
              >
                {lens.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SaveDiskIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M5 3.75h11.3L19 6.45V20.25H5V3.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8 3.75v5.5h7.25v-5.5M8 20.25v-6.25h8v6.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 6.35h3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function FloatingPreviewToggle({
  presenterMode,
  onClick,
}: {
  presenterMode: boolean;
  onClick: () => void;
}) {
  const { state } = useEditor();
  const gui = state.environment.scene?.gui ?? {};
  const navigator = gui.navigator ?? {};
  const overlay = gui.overlay ?? {};
  const navigatorOverride = navigator.useOverride === true;
  const navBottom = navigatorOverride ? navigator.bottom ?? 16 : 16;
  const backgroundColor = navigatorOverride
    ? navigator.backgroundColor ?? overlay.backgroundColor ?? "#f6f6f6"
    : overlay.backgroundColor ?? "#f6f6f6";
  const backgroundAlpha = clamp01(
    navigatorOverride
      ? navigator.backgroundAlpha ?? overlay.backgroundAlpha ?? 0.72
      : overlay.backgroundAlpha ?? 0.72,
  );
  const borderColor = navigatorOverride
    ? navigator.borderColor ?? overlay.borderColor ?? "#ffffff"
    : overlay.borderColor ?? "#ffffff";
  const borderAlpha = clamp01(
    navigatorOverride
      ? navigator.borderAlpha ?? overlay.borderAlpha ?? 0.58
      : overlay.borderAlpha ?? 0.58,
  );
  const borderWidth = Math.max(
    0,
    navigatorOverride
      ? navigator.borderWidth ?? overlay.borderWidth ?? 1
      : overlay.borderWidth ?? 1,
  );
  const backdropBlur = Math.max(
    0,
    navigatorOverride
      ? navigator.backdropBlurPx ?? overlay.backdropBlurPx ?? 24
      : overlay.backdropBlurPx ?? 24,
  );
  const backdropSaturation = Math.max(
    0,
    navigatorOverride
      ? navigator.backdropSaturation ?? overlay.backdropSaturation ?? 180
      : overlay.backdropSaturation ?? 180,
  );
  const textColor = navigatorOverride
    ? navigator.textColor ?? overlay.textColor ?? vibrancyLabel
    : overlay.textColor ?? vibrancyLabel;
  return (
    <button
      style={{
        position: "absolute",
        right: presenterMode ? navBottom : navBottom + 132,
        bottom: navBottom,
        zIndex: 35,
        width: 36,
        height: 36,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        border:
          borderWidth > 0
            ? `${borderWidth}px solid ${hexToRgba(borderColor, borderAlpha)}`
            : "none",
        borderRadius: "50%",
        background: hexToRgba(backgroundColor, backgroundAlpha),
        color: textColor,
        boxShadow: "none",
        backdropFilter: `blur(${backdropBlur}px) saturate(${backdropSaturation}%)`,
        WebkitBackdropFilter: `blur(${backdropBlur}px) saturate(${backdropSaturation}%)`,
        cursor: "pointer",
          fontFamily: TECHNICAL_MONO_FONT,
        fontSize: 0,
      }}
      onClick={onClick}
      title={presenterMode ? "Exit preview" : "Enter preview"}
      aria-label={presenterMode ? "Exit preview" : "Enter preview"}
    >
      {presenterMode ? <ExitPreviewIcon /> : <EnterPreviewIcon />}
    </button>
  );
}

function editorShellStyleFromGui(gui: unknown): React.CSSProperties {
  const maybeGui =
    gui && typeof gui === "object" ? (gui as { overlay?: unknown }) : {};
  const overlay =
    maybeGui.overlay && typeof maybeGui.overlay === "object"
      ? (maybeGui.overlay as Record<string, unknown>)
      : {};
  const backgroundColor =
    typeof overlay.backgroundColor === "string"
      ? overlay.backgroundColor
      : "#121518";
  const backgroundAlpha =
    typeof overlay.backgroundAlpha === "number" ? overlay.backgroundAlpha : 0.55;
  const borderColor =
    typeof overlay.borderColor === "string" ? overlay.borderColor : "#ffffff";
  const borderAlpha =
    typeof overlay.borderAlpha === "number" ? overlay.borderAlpha : 0.2;
  const borderWidth =
    typeof overlay.borderWidth === "number" ? Math.max(0, overlay.borderWidth) : 1;
  const radius =
    typeof overlay.radius === "number"
      ? Math.max(0, overlay.radius) * 2
      : EDITOR_DEFAULT_OUTER_RADIUS_PX;
  const blur =
    typeof overlay.backdropBlurPx === "number"
      ? Math.max(0, overlay.backdropBlurPx)
      : 20;
  const saturation =
    typeof overlay.backdropSaturation === "number"
      ? Math.max(0, overlay.backdropSaturation)
      : 145;
  const shadowAlpha =
    typeof overlay.shadowAlpha === "number" ? clamp01(overlay.shadowAlpha) : 0.24;
  const shadowBlur =
    typeof overlay.shadowBlur === "number" ? Math.max(0, overlay.shadowBlur) : 80;
  const shadowOffsetY =
    typeof overlay.shadowOffsetY === "number"
      ? Math.max(0, overlay.shadowOffsetY)
      : 24;
  return {
    background: hexToRgba(backgroundColor, clamp01(backgroundAlpha)),
    border:
      borderWidth > 0
        ? `${borderWidth}px solid ${hexToRgba(borderColor, clamp01(borderAlpha))}`
        : "none",
    borderRadius: radius,
    boxShadow: `0 ${shadowOffsetY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowAlpha})`,
    backdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
  };
}

function EnterPreviewIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M4.5 5.5h15v9.5h-15V5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 15v3.5M8.5 20h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="m10 8.5 4.8 2.4-4.8 2.4V8.5Z" fill="currentColor" />
    </svg>
  );
}

function ExitPreviewIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return `rgba(246, 246, 246, ${alpha})`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isDragBlocked(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    !!target.closest("button, input, select, textarea, a, [role='button']")
  );
}
