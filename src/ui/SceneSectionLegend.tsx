import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../editor/EditorContext";
import {
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
} from "../editor/styles";
import { SectionGraphOptionsControls } from "../editor/layerControls/seismic/SectionGraphOptionsControls";
import {
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import {
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  QUICK_LEGEND_INACTIVE_BACKGROUND,
  colorWithAlpha,
  compactQuickLegendIconButtonBaseStyle,
  compactQuickLegendPrimaryButtonBaseStyle,
  compactQuickLegendRowStyle,
  transparentLegendPanelStyle,
} from "./legendStyles";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import {
  effectiveStyle,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type {
  EditableStyle,
  PresentationPage,
  SceneSectionFrameEntry,
  SceneSectionFrameState,
  SceneSectionPlaneState,
} from "../pages/types";
import { selectedLegendAuthoringPage } from "./legendAuthoringTarget";

const UTAH_FORGE_PROJECT_SLUG = "utah-forge";
const SCENE_SECTION_LAYER_ID = UTAH_FORGE_SCENE_SECTION_LAYER_ID;
const SEISMIC_LAYER_ID = UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID;
const POPOVER_WIDTH_PX = 360;
const POPOVER_MARGIN_PX = 12;
const AXIS_COLORS = {
  x: "#ff6b78",
  y: "#35c7e8",
  z: "#f6d76b",
} as const;
const SCENE_SECTION_AXES = ["x", "y", "z"] as const;
type SceneSectionLegendAxis = (typeof SCENE_SECTION_AXES)[number];
type LegendToggleKind = "flip" | "controls" | "groundTrace" | "axes";
type FaceChannelKey = "seismic" | "volume" | "isobars" | "mtScalar";

const FACE_CHANNELS: Array<{
  key: FaceChannelKey;
  label: string;
}> = [
  { key: "seismic", label: "Seismic" },
  { key: "volume", label: "Volume" },
  { key: "isobars", label: "Isobars" },
  { key: "mtScalar", label: "MT scalar" },
];

const rootStyle: CSSProperties = {
  ...transparentLegendPanelStyle,
  left: LEGEND_PAGE_EDGE_MARGIN_PX,
  bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX + 256,
  padding: 13,
  minWidth: 220,
};

const rowStyle: CSSProperties = {
  ...compactQuickLegendRowStyle,
  marginTop: 8,
};

const firstRowStyle: CSSProperties = {
  ...rowStyle,
  marginTop: 0,
};

const axisGroupStyle: CSSProperties = {
  ...compactQuickLegendRowStyle,
  minWidth: 0,
};

const iconSpacerStyle: CSSProperties = {
  height: 24,
  flex: "0 0 24px",
  width: 24,
};

const closeButtonStyle: CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: 6,
  background: "rgba(255, 255, 255, 0.08)",
  color: "#f6f1e8",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 9,
  padding: "3px 7px",
  cursor: "pointer",
};

const popoverStyle: CSSProperties = {
  position: "fixed",
  width: POPOVER_WIDTH_PX,
  maxWidth: `calc(100vw - ${POPOVER_MARGIN_PX * 2}px)`,
  maxHeight: `calc(100vh - ${POPOVER_MARGIN_PX * 2}px)`,
  overflowY: "auto",
  zIndex: 12,
  padding: 12,
  boxSizing: "border-box",
  background: "rgba(12, 15, 18, 0.9)",
  border: FROSTED_HAIRLINE,
  borderRadius: 8,
  boxShadow: "0 18px 44px rgba(0, 0, 0, 0.38)",
  backdropFilter: "blur(20px) saturate(145%)",
  WebkitBackdropFilter: "blur(20px) saturate(145%)",
};

const popoverHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
  color: "#f6f1e8",
  fontSize: 10,
  fontWeight: 700,
};

const faceChannelRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 6,
  marginBottom: 10,
};

const faceChannelButtonStyle = (active: boolean): CSSProperties => ({
  border: "1px solid rgba(255, 255, 255, 0.22)",
  borderRadius: 6,
  background: active ? "rgba(53, 199, 232, 0.88)" : "rgba(255, 255, 255, 0.07)",
  color: active ? "#061016" : "#f6f1e8",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 9,
  minHeight: 24,
  padding: "4px 7px",
  cursor: "pointer",
});

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function styleBoolean(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
}

function frameBoolean(
  frame: SceneSectionFrameState,
  key: keyof SceneSectionFrameState,
  fallback: boolean,
): boolean {
  const value = frame[key];
  return typeof value === "boolean" ? value : fallback;
}

function sectionButtonLabel(
  label: string,
  axis: SceneSectionLegendAxis,
): string {
  const trimmed = label.replace(/\s*frame\s*$/i, "").trim();
  return trimmed || `${axis.toUpperCase()} Section`;
}

function axisButtonStyle(color: string, active: boolean): CSSProperties {
  return {
    ...compactQuickLegendPrimaryButtonBaseStyle,
    background: colorWithAlpha(color, active ? 1 : 0.36),
    boxShadow: "none",
  };
}

function iconButtonStyle(color: string, available: boolean): CSSProperties {
  return {
    ...compactQuickLegendIconButtonBaseStyle,
    background: available
      ? colorWithAlpha(color, 1)
      : QUICK_LEGEND_INACTIVE_BACKGROUND,
    opacity: available ? 1 : 0.82,
    cursor: available ? "pointer" : "default",
    boxShadow: "none",
  };
}

function LegendToggleIcon({ kind }: { kind: LegendToggleKind }) {
  if (kind === "flip") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path
          d="M8 8 4 12l4 4M4 12h16M16 8l4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "controls") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path
          d="M5 7h14M5 12h14M5 17h14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="9" cy="7" r="2" fill="currentColor" />
        <circle cx="15" cy="12" r="2" fill="currentColor" />
        <circle cx="11" cy="17" r="2" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "groundTrace") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path
          d="M4 15c3-6 5 3 8-3s5 3 8-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 18h14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.72"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d="M6 18V5M6 18h13M6 9h4M11 18v-4M16 18v-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function builtInFrameId(axis: SceneSectionLegendAxis): string {
  return `axis:${axis}`;
}

function builtInFrameLabel(axis: SceneSectionLegendAxis): string {
  return `${axis.toUpperCase()} Section`;
}

function builtInFrameEntries(
  style: EditableStyle,
  axis: SceneSectionLegendAxis,
  planePatch: Partial<SceneSectionPlaneState> = {},
  framePatch: Partial<SceneSectionFrameState> = {},
): SceneSectionFrameEntry[] {
  const explicit = Array.isArray(style.sceneSectionFrames)
    ? style.sceneSectionFrames
    : [];
  const explicitById = new Map(
    explicit
      .filter((entry) => typeof entry?.id === "string" && entry.id.trim())
      .map((entry) => [entry.id, entry] as const),
  );
  const builtIns = SCENE_SECTION_AXES.map((entryAxis) => {
    const id = builtInFrameId(entryAxis);
    const entry = explicitById.get(id);
    const nextPlane = {
      ...(entry?.plane ?? {}),
      ...(style.sceneSectionPlanes?.[entryAxis] ?? {}),
      ...(entryAxis === axis ? planePatch : {}),
    };
    const nextFrame = {
      ...(style.sceneSectionFrameByAxis?.[entryAxis] ?? {}),
      ...(entry?.frame ?? {}),
      ...(entryAxis === axis ? framePatch : {}),
    };
    return {
      id,
      label:
        typeof entry?.label === "string" && entry.label.trim()
          ? entry.label
          : builtInFrameLabel(entryAxis),
      axis: entryAxis,
      plane: nextPlane,
      frame: nextFrame,
    };
  });
  const custom = explicit.filter(
    (entry) =>
      entry &&
      typeof entry.id === "string" &&
      entry.id.trim() &&
      !entry.id.startsWith("axis:"),
  );
  return [...builtIns, ...custom];
}

function axisModel(style: EditableStyle, axis: SceneSectionLegendAxis) {
  const entry = Array.isArray(style.sceneSectionFrames)
    ? style.sceneSectionFrames.find((candidate) => candidate?.id === builtInFrameId(axis))
    : null;
  const plane = {
    ...(entry?.plane ?? {}),
    ...(style.sceneSectionPlanes?.[axis] ?? {}),
  };
  const frame = {
    ...(style.sceneSectionFrameByAxis?.[axis] ?? {}),
    ...(entry?.frame ?? {}),
  };
  const controlsVisible =
    typeof frame.controlsVisible === "boolean"
      ? frame.controlsVisible
      : entry?.legendVisible === false
        ? false
        : styleBoolean(style, "sceneSectionHelperVisible", true);
  return {
    label:
      typeof entry?.label === "string" && entry.label.trim()
        ? entry.label
        : builtInFrameLabel(axis),
    plane,
    frame,
    shown: plane.enabled === true,
    flipped: plane.invert === true,
    controlsVisible,
    groundTraceVisible: frameBoolean(
      frame,
      "groundTraceVisible",
      styleBoolean(style, "sceneSectionGroundTraceVisible", true),
    ),
    axesVisible: frameBoolean(
      frame,
      "axesVisible",
      styleBoolean(style, "sceneSectionAxesVisible", true),
    ),
  };
}

function faceChannels(style: EditableStyle) {
  const configured = style.sceneSectionFaceChannels ?? {};
  return {
    seismic: configured.seismic !== false,
    volume: configured.volume === true,
    isobars: configured.isobars === true,
    mtScalar: configured.mtScalar === true,
  };
}

function positionForLegend(
  legend: HTMLElement | null,
  popover: HTMLElement | null,
): { left: number; top: number } {
  const margin = POPOVER_MARGIN_PX;
  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const legendRect = legend?.getBoundingClientRect();
  const popoverWidth = Math.min(
    POPOVER_WIDTH_PX,
    Math.max(220, viewportWidth - margin * 2),
  );
  const popoverHeight = Math.min(
    popover?.getBoundingClientRect().height ?? 360,
    Math.max(180, viewportHeight - margin * 2),
  );
  const left = (legendRect?.right ?? margin) + 10;
  const top = (legendRect?.top ?? margin) + 24;
  return {
    left: clamp(left, margin, viewportWidth - popoverWidth - margin),
    top: clamp(top, margin, viewportHeight - popoverHeight - margin),
  };
}

export function SceneSectionLegend({
  stacked = false,
  pageOverride = null,
}: {
  stacked?: boolean;
  pageOverride?: PresentationPage | null;
}) {
  const {
    state,
    sceneHandle,
    setEnvLayerStyle,
    setPageLayerOverride,
    canApplyLiveSceneEdits,
  } = useEditor();
  const { pages, currentIndex, transitionFrame } = usePageController();
  const rootRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [runtimeFaceChannels, setRuntimeFaceChannels] = useState<ReturnType<
    typeof faceChannels
  > | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({
    left: POPOVER_MARGIN_PX,
    top: POPOVER_MARGIN_PX,
  });

  useEffect(() => {
    if (!popoverOpen) return;
    const update = () =>
      setPopoverPosition(positionForLegend(rootRef.current, popoverRef.current));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [popoverOpen]);

  if (state.projectSlug !== UTAH_FORGE_PROJECT_SLUG) return null;

  const allAuthoringPages = [...state.pages, ...state.archivedPages];
  const targetIndex = transitionFrame.targetIndex;
  const controllerPage =
    pageOverride ??
    pages[targetIndex ?? transitionFrame.sourceIndex] ??
    pages[transitionFrame.sourceIndex] ??
    pages[currentIndex];
  const editingEnvironment = state.selectedPageId === ENVIRONMENT_SENTINEL;
  const authoringPage = selectedLegendAuthoringPage(state);
  const selectedPage =
    !pageOverride &&
    !editingEnvironment &&
    !transitionFrame.active &&
    state.selectedPageId
      ? allAuthoringPages.find((candidate) => candidate.id === state.selectedPageId)
      : null;
  const page =
    pageOverride ??
    (transitionFrame.active && targetIndex !== null
      ? controllerPage
      : selectedPage ?? controllerPage);
  const writePage = authoringPage ?? page;
  const pageEnvironment = page
    ? resolveEnvironmentForPage(state.environment, allAuthoringPages, page)
    : state.environment;
  const style = editingEnvironment
    ? state.environment.layerStyles[SCENE_SECTION_LAYER_ID] ?? {}
    : page
      ? effectiveStyle(pageEnvironment, page, SCENE_SECTION_LAYER_ID)
      : pageEnvironment.layerStyles[SCENE_SECTION_LAYER_ID] ?? {};
  const seismicLayer = state.manifest.layers.find(
    (candidate) => candidate.id === SEISMIC_LAYER_ID,
  );
  const seismicStyle = editingEnvironment
    ? state.environment.layerStyles[SEISMIC_LAYER_ID] ?? {}
    : page
      ? effectiveStyle(pageEnvironment, page, SEISMIC_LAYER_ID)
      : pageEnvironment.layerStyles[SEISMIC_LAYER_ID] ?? {};
  if (style.sceneSectionEnabled !== true) return null;
  if (!styleBoolean(style, "sceneSectionLegendVisible", true)) return null;

  const styleForLayer = (targetLayerId: string): EditableStyle => {
    if (targetLayerId === SCENE_SECTION_LAYER_ID) return style;
    if (targetLayerId === SEISMIC_LAYER_ID) return seismicStyle;
    return editingEnvironment
      ? state.environment.layerStyles[targetLayerId] ?? {}
      : page
        ? effectiveStyle(pageEnvironment, page, targetLayerId)
        : pageEnvironment.layerStyles[targetLayerId] ?? {};
  };

  const commitLayerStyle = (
    targetLayerId: string,
    patch: Partial<EditableStyle>,
  ) => {
    const merged = { ...styleForLayer(targetLayerId), ...patch };
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(targetLayerId, merged);
    }
    if (editingEnvironment) {
      setEnvLayerStyle(targetLayerId, patch);
    } else if (writePage) {
      setPageLayerOverride(writePage.id, targetLayerId, patch);
    } else {
      setEnvLayerStyle(targetLayerId, patch);
    }
  };
  const commit = (patch: Partial<EditableStyle>) => {
    commitLayerStyle(SCENE_SECTION_LAYER_ID, patch);
  };
  const commitSeismicStyle = (patch: Partial<EditableStyle>) => {
    commitLayerStyle(SEISMIC_LAYER_ID, patch);
  };
  const commitRuntimeLayerStyle = (
    targetLayerId: string,
    patch: Partial<EditableStyle>,
  ) => {
    if (!canApplyLiveSceneEdits()) return;
    sceneHandle.manager.applyStyle(targetLayerId, {
      ...styleForLayer(targetLayerId),
      ...patch,
    });
  };
  const setFaceChannel = (channel: FaceChannelKey, active: boolean) => {
    const current = runtimeFaceChannels ?? faceChannels(style);
    const nextChannels = {
      ...current,
      [channel]: active,
    };
    setRuntimeFaceChannels(nextChannels);
    commitRuntimeLayerStyle(SCENE_SECTION_LAYER_ID, {
      sceneSectionFaceChannels: nextChannels,
    });
    commitRuntimeLayerStyle(SEISMIC_LAYER_ID, {
      seismicSliceThroughVolume: nextChannels.seismic,
      seismicRenderMode: nextChannels.volume ? "raymarch" : "slice",
      sectionIsoEnabled: nextChannels.isobars || nextChannels.mtScalar,
      seismicIsoSource: nextChannels.mtScalar
        ? "mt-resistivity"
        : "seismic-amplitude",
    });
  };
  const setAxisPlanePatch = (
    axis: SceneSectionLegendAxis,
    planePatch: Partial<SceneSectionPlaneState>,
  ) => {
    const nextPlane = {
      ...(style.sceneSectionPlanes?.[axis] ?? {}),
      ...planePatch,
    };
    commit({
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionActiveAxis: axis,
      sceneSectionActiveFrameId: builtInFrameId(axis),
      sceneSectionPlanes: {
        ...(style.sceneSectionPlanes ?? {}),
        [axis]: nextPlane,
      },
      sceneSectionFrames: builtInFrameEntries(style, axis, planePatch),
    });
  };
  const setAxisFramePatch = (
    axis: SceneSectionLegendAxis,
    framePatch: Partial<SceneSectionFrameState>,
  ) => {
    const nextFrame = {
      ...(style.sceneSectionFrameByAxis?.[axis] ?? {}),
      ...framePatch,
    };
    commit({
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionActiveAxis: axis,
      sceneSectionActiveFrameId: builtInFrameId(axis),
      sceneSectionFrameEnabled: true,
      sceneSectionFrameByAxis: {
        ...(style.sceneSectionFrameByAxis ?? {}),
        [axis]: nextFrame,
      },
      sceneSectionFrames: builtInFrameEntries(style, axis, {}, framePatch),
    });
  };
  const activeFaceChannels = runtimeFaceChannels ?? faceChannels(style);

  return (
    <>
      <aside
        ref={rootRef}
        style={{
          ...rootStyle,
          ...(stacked
            ? { position: "relative", left: "auto", bottom: "auto" }
            : {}),
        }}
        aria-label="Utah FORGE scene section plane legend"
      >
        {SCENE_SECTION_AXES.map((axis, index) => {
          const model = axisModel(style, axis);
          const axisColor = AXIS_COLORS[axis];
          const axisLabel = sectionButtonLabel(model.label, axis);
          return (
            <div key={axis} style={index === 0 ? firstRowStyle : rowStyle}>
              <div style={axisGroupStyle}>
                <button
                  type="button"
                  aria-label={`${axisLabel} Show`}
                  aria-pressed={model.shown}
                  title={`${axisLabel} Show`}
                  data-testid={`scene-section-legend-${axis}-show`}
                  onClick={() =>
                    setAxisPlanePatch(axis, {
                      enabled: !model.shown,
                    })
                  }
                  style={axisButtonStyle(axisColor, model.shown)}
                >
                  {axisLabel}
                </button>
                <button
                  type="button"
                  aria-label={`${axisLabel} Section Options`}
                  aria-expanded={popoverOpen}
                  aria-pressed={popoverOpen}
                  title="Section Options"
                  disabled={!seismicLayer}
                  data-testid={`scene-section-legend-${axis}-section-options`}
                  onClick={() => setPopoverOpen((current) => !current)}
                  style={iconButtonStyle(axisColor, Boolean(seismicLayer))}
                >
                  <LegendToggleIcon kind="controls" />
                </button>
              <button
                type="button"
                aria-label={`${axisLabel} Flip`}
                aria-pressed={model.flipped}
                title="Flip side"
                disabled={!model.shown}
                data-testid={`scene-section-legend-${axis}-flip`}
                onClick={() =>
                  setAxisPlanePatch(axis, {
                    invert: !model.flipped,
                  })
                }
                style={iconButtonStyle(axisColor, model.shown)}
              >
                <LegendToggleIcon kind="flip" />
              </button>
              <button
                type="button"
                aria-label={`${axisLabel} Scale axes`}
                aria-pressed={model.axesVisible}
                title="Scale axes"
                disabled={!model.shown}
                data-testid={`scene-section-legend-${axis}-axes-visible`}
                onClick={() =>
                  setAxisFramePatch(axis, {
                    axesVisible: !model.axesVisible,
                  })
                }
                style={iconButtonStyle(axisColor, model.shown)}
              >
                <LegendToggleIcon kind="axes" />
              </button>
              {axis !== "z" ? (
                <button
                  type="button"
                  aria-label={`${axisLabel} Ground trace`}
                  aria-pressed={model.groundTraceVisible}
                  title="Ground trace"
                  disabled={!model.shown}
                  data-testid={`scene-section-legend-${axis}-ground-trace-visible`}
                  onClick={() =>
                    setAxisFramePatch(axis, {
                      groundTraceVisible: !model.groundTraceVisible,
                    })
                  }
                  style={iconButtonStyle(axisColor, model.shown)}
                >
                  <LegendToggleIcon kind="groundTrace" />
                </button>
              ) : (
                <span aria-hidden="true" style={iconSpacerStyle} />
              )}
            </div>
          </div>
        );
      })}
    </aside>
    {popoverOpen && seismicLayer && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            data-testid="scene-section-options-popout"
            style={{
              ...popoverStyle,
              left: popoverPosition.left,
              top: popoverPosition.top,
            }}
          >
            <div style={popoverHeaderStyle}>
              <strong style={{ fontSize: 10 }}>Section Options</strong>
              <button
                type="button"
                data-testid="scene-section-options-popout-close"
                onClick={() => setPopoverOpen(false)}
                style={closeButtonStyle}
              >
                Close
              </button>
            </div>
            <div
              data-testid="scene-section-face-channel-controls"
              style={faceChannelRowStyle}
            >
              {FACE_CHANNELS.map((channel) => {
                const active = activeFaceChannels[channel.key];
                return (
                  <button
                    key={channel.key}
                    type="button"
                    aria-pressed={active}
                    data-testid={`scene-section-face-channel-${channel.key}`}
                    onClick={() => setFaceChannel(channel.key, !active)}
                    style={faceChannelButtonStyle(active)}
                  >
                    {channel.label}
                  </button>
                );
              })}
            </div>
            <SectionGraphOptionsControls
              compact
              layer={seismicLayer}
              style={seismicStyle}
              disabled={false}
              commit={commitSeismicStyle}
              commitLayerStyle={commitLayerStyle}
            />
          </div>,
          document.body,
        )
      : null}
    </>
  );
}
