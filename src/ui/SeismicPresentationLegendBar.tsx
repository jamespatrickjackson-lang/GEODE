import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../editor/EditorContext";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import {
  effectiveStyle,
  effectiveVisibility,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { EditableStyle, PresentationPage } from "../pages/types";
import {
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import { resolveTopoMapSettings } from "../topoMap/settings";
import {
  compactQuickLegendIconButtonBaseStyle,
  compactQuickLegendPrimaryButtonBaseStyle,
  compactQuickLegendRowStyle,
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  QUICK_LEGEND_INACTIVE_BACKGROUND,
  resolveLegendTextColors,
  transparentLegendPanelStyle,
} from "./legendStyles";
import {
  legendWritesLanded,
  selectedLegendAuthoringPage,
} from "./legendAuthoringTarget";
import {
  buildSeismicPresentationLegendModel,
  seismicPresentationColor,
  type SeismicPresentationSliceAxis,
} from "./seismicPresentationLegendModel";
import type { SceneHandle } from "../scene";

const SEISMIC_POPOVER_WIDTH_PX = 320;
const SEISMIC_POPOVER_MARGIN_PX = 12;
const SEISMIC_POPOVER_Z_INDEX = 40;

const compactLabelStyle: CSSProperties = {
  fontSize: 9,
  lineHeight: 1,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const compactValueStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.15,
  fontVariantNumeric: "tabular-nums",
  overflowWrap: "anywhere",
};

const segmentGroupStyle: CSSProperties = {
  display: "inline-flex",
  gap: 4,
  minWidth: 0,
};

const sliceSliderStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
};

const rootBaseStyle: CSSProperties = {
  ...transparentLegendPanelStyle,
  fontFamily: transparentLegendPanelStyle.fontFamily,
};

const headerRowStyle: CSSProperties = {
  ...compactQuickLegendRowStyle,
};

const amplitudeBodyStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 10,
};

const amplitudeRampStyle: CSSProperties = {
  height: 13,
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.22)",
  overflow: "hidden",
};

const amplitudeRampWrapStyle: CSSProperties = {
  position: "relative",
  height: 28,
  touchAction: "none",
};

const amplitudeTicksStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  marginTop: -10,
  fontSize: 10,
  lineHeight: 1.25,
  fontVariantNumeric: "tabular-nums",
};

const sliceControlsStyle: CSSProperties = {
  display: "grid",
  gap: 7,
};

function nameButtonStyle(visible: boolean): CSSProperties {
  return {
    ...compactQuickLegendPrimaryButtonBaseStyle,
    background: visible ? "#f4f5f7" : QUICK_LEGEND_INACTIVE_BACKGROUND,
    opacity: visible ? 1 : 0.82,
    cursor: "pointer",
  };
}

const paletteSelectStyle: CSSProperties = {
  appearance: "auto",
  WebkitAppearance: "menulist",
  border: 0,
  borderRadius: 999,
  height: 28,
  minWidth: 80,
  flex: "1 1 80px",
  boxSizing: "border-box",
  padding: "0 10px",
  background: "#f4f5f7",
  color: "#101216",
  fontFamily: transparentLegendPanelStyle.fontFamily,
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1,
  cursor: "pointer",
};

function iconButtonStyle(active: boolean): CSSProperties {
  return {
    ...compactQuickLegendIconButtonBaseStyle,
    background: active ? "#f4f5f7" : "rgba(244, 245, 247, 0.56)",
    color: "#101216",
  };
}

const popoverStyle: CSSProperties = {
  position: "fixed",
  width: SEISMIC_POPOVER_WIDTH_PX,
  maxWidth: `calc(100vw - ${SEISMIC_POPOVER_MARGIN_PX * 2}px)`,
  maxHeight: `calc(100vh - ${SEISMIC_POPOVER_MARGIN_PX * 2}px)`,
  overflowY: "auto",
  zIndex: SEISMIC_POPOVER_Z_INDEX,
  padding: 12,
  boxSizing: "border-box",
  background: "rgba(12, 15, 18, 0.9)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
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
  fontSize: 10,
  fontWeight: 700,
};

const closeButtonStyle: CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: 6,
  background: "rgba(255, 255, 255, 0.08)",
  fontFamily: transparentLegendPanelStyle.fontFamily,
  fontSize: 9,
  padding: "3px 7px",
  cursor: "pointer",
};

const controlsCloseRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: 8,
};

const panelBlockStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: 12,
};

const infoGridStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

function styleBoolean(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
}

function seismicPopoverPositionForLegend(
  anchor: HTMLElement | null,
  popover: HTMLElement | null,
): { left: number; top: number } {
  const anchorRect = anchor?.getBoundingClientRect();
  const popoverRect = popover?.getBoundingClientRect();
  const width = popoverRect?.width ?? SEISMIC_POPOVER_WIDTH_PX;
  const height = popoverRect?.height ?? 220;
  const left = anchorRect
    ? anchorRect.left
    : SEISMIC_POPOVER_MARGIN_PX;
  const top = anchorRect
    ? anchorRect.top - height - 8
    : SEISMIC_POPOVER_MARGIN_PX;
  return {
    left: Math.min(
      Math.max(SEISMIC_POPOVER_MARGIN_PX, left),
      window.innerWidth - width - SEISMIC_POPOVER_MARGIN_PX,
    ),
    top: Math.min(
      Math.max(SEISMIC_POPOVER_MARGIN_PX, top),
      window.innerHeight - height - SEISMIC_POPOVER_MARGIN_PX,
    ),
  };
}

function paletteLabel(
  palette: NonNullable<EditableStyle["seismicColormap"]>,
): string {
  if (palette === "grayscale") return "Gray";
  if (palette === "velocity") return "Velocity";
  return "Blue-red";
}

function SeismicLegendIcon({
  kind,
}: {
  kind: "controls" | "info";
}) {
  if (kind === "info") {
    return (
      <span
        aria-hidden="true"
        style={{
          fontFamily: "Georgia, serif",
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        i
      </span>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M5 7h14M5 12h14M5 17h14" />
      <path d="M8 7v0M15 12v0M11 17v0" />
    </svg>
  );
}

function activePresetForStyle(
  layer: { metadata?: Record<string, unknown> } | undefined,
  style: EditableStyle,
): unknown {
  const ids = [style.seismicCapabilityPresetId, style.seismicAudiencePresetId].filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  const metadata = layer?.metadata;
  const collections = [
    metadata?.seismicCapabilityPresets,
    metadata?.seismicAudiencePresets,
  ];
  for (const id of ids) {
    for (const collection of collections) {
      if (!Array.isArray(collection)) continue;
      const preset = collection.find(
        (candidate) =>
          candidate &&
          typeof candidate === "object" &&
          (candidate as Record<string, unknown>).id === id,
      );
      if (preset) return preset;
    }
  }
  return undefined;
}

function segmentButtonStyle(
  selected: boolean,
  colors: { heading: string; body: string },
): CSSProperties {
  return {
    border: `1px solid ${
      selected ? "rgba(255, 255, 255, 0.72)" : "rgba(255, 255, 255, 0.22)"
    }`,
    borderRadius: 999,
    background: selected ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.06)",
    color: selected ? colors.heading : colors.body,
    padding: "4px 8px",
    fontSize: 10,
    lineHeight: 1,
    fontWeight: 800,
    cursor: "pointer",
  };
}

function infoBlock({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: { subtext: string; body: string };
}) {
  return (
    <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
      <div style={{ ...compactLabelStyle, color: colors.subtext }}>{label}</div>
      <div style={{ ...compactValueStyle, color: colors.body }}>{value}</div>
    </div>
  );
}

export function SeismicPresentationLegendBar({
  sceneHandle,
  stacked = false,
  pageOverride = null,
}: {
  sceneHandle: SceneHandle;
  stacked?: boolean;
  pageOverride?: PresentationPage | null;
}) {
  const {
    state,
    setEnvLayerStyle,
    toggleEnvDefaultVisible,
    setPageLayerOverride,
    setPageVisibilityOverride,
    canApplyLiveSceneEdits,
  } = useEditor();
  const { pages, currentIndex, transitionFrame } = usePageController();
  const rootRef = useRef<HTMLElement | null>(null);
  const controlsPopoverRef = useRef<HTMLDivElement | null>(null);
  const infoPopoverRef = useRef<HTMLDivElement | null>(null);
  const [controlsPopoverOpen, setControlsPopoverOpen] = useState(false);
  const [infoPopoverOpen, setInfoPopoverOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({
    left: SEISMIC_POPOVER_MARGIN_PX,
    top: SEISMIC_POPOVER_MARGIN_PX,
  });
  useEffect(() => {
    if (!controlsPopoverOpen && !infoPopoverOpen) return;
    const update = () => {
      setPopoverPosition(
        seismicPopoverPositionForLegend(
          rootRef.current,
          controlsPopoverOpen ? controlsPopoverRef.current : infoPopoverRef.current,
        ),
      );
    };
    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, [controlsPopoverOpen, infoPopoverOpen]);

  const layer = state.manifest.layers.find(
    (candidate) => candidate.id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  );
  if (!layer) return null;

  const targetIndex = transitionFrame.targetIndex;
  const controllerPage =
    pageOverride ??
    pages[targetIndex ?? transitionFrame.sourceIndex] ??
    pages[transitionFrame.sourceIndex] ??
    pages[currentIndex] ??
    null;
  const authoringPage = selectedLegendAuthoringPage(state);
  const editingEnvironment =
    !state.presenterMode && state.selectedPageId === ENVIRONMENT_SENTINEL;
  const selectedPage =
    !pageOverride &&
    !editingEnvironment &&
    !transitionFrame.active &&
    state.selectedPageId
      ? state.pages.find((candidate) => candidate.id === state.selectedPageId) ?? null
      : null;
  const page = pageOverride ??
    (transitionFrame.active && targetIndex !== null
      ? controllerPage
      : selectedPage ?? controllerPage);
  const writePage = authoringPage ?? page;
  const writesEnabled = legendWritesLanded({
    transitionActive: transitionFrame.active,
    targetIndex,
    authoringPage,
    displayedPage: pageOverride ?? pages[currentIndex] ?? null,
    editingEnvironment,
  });
  const allPages = [...state.pages, ...state.archivedPages];
  const pageEnvironment = page
    ? resolveEnvironmentForPage(state.environment, allPages, page)
    : state.environment;
  const visible = editingEnvironment
    ? new Set(state.environment.defaultVisibleLayers)
    : page
    ? effectiveVisibility(pageEnvironment, page)
    : new Set(state.environment.defaultVisibleLayers);
  const layerVisible = visible.has(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
  const explicitPageOverride =
    writePage?.visibilityOverrides?.[UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID] !== undefined;

  const style = editingEnvironment
    ? state.environment.layerStyles[UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID] ?? {}
    : page
    ? effectiveStyle(pageEnvironment, page, UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID)
    : pageEnvironment.layerStyles[UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID] ?? {};
  const activePreset = activePresetForStyle(layer, style);
  const presetPresentationBarVisible =
    activePreset &&
    typeof activePreset === "object" &&
    (activePreset as { presentationBarVisible?: unknown }).presentationBarVisible === true;
  if (!layerVisible && !explicitPageOverride && !editingEnvironment) return null;
  if (!styleBoolean(style, "seismicLegendVisible", true)) {
    return null;
  }
  if (style.seismicPresentationBarVisible !== true && !presetPresentationBarVisible) {
    return null;
  }

  const productId =
    typeof style.seismicProductId === "string"
      ? style.seismicProductId
      : typeof layer?.metadata?.defaultSeismicProductId === "string"
        ? layer.metadata.defaultSeismicProductId
        : "";
  const productVisibility =
    typeof style.seismicProductVisibility === "object" &&
    style.seismicProductVisibility !== null
      ? (style.seismicProductVisibility as Record<string, boolean>)
      : {};
  if (Object.keys(productVisibility).length > 0 && productVisibility[productId] !== true) {
    return null;
  }

  const topoMapSettings = resolveTopoMapSettings({
    manifest: state.manifest,
    environment: pageEnvironment,
    page,
  });
  const legendTextColors = resolveLegendTextColors(
    state.environment.scene?.gui?.overlay,
  );
  const model = buildSeismicPresentationLegendModel({
    layer,
    style,
    activePreset,
    verticalExaggeration: topoMapSettings.terrain.verticalExaggeration,
  });
  const patchStyle = (patch: Partial<EditableStyle>) => {
    if (!writesEnabled) return;
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID, {
        ...style,
        ...patch,
      });
    }
    if (editingEnvironment) {
      setEnvLayerStyle(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID, patch);
    } else if (writePage) {
      setPageLayerOverride(writePage.id, UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID, patch);
    } else {
      setEnvLayerStyle(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID, patch);
    }
  };

  const setSliceAxis = (axis: SeismicPresentationSliceAxis) => {
    patchStyle({ seismicSliceAxis: axis });
  };
  const setLayerVisible = (nextVisible: boolean) => {
    if (!writesEnabled) return;
    if (!nextVisible) {
      setControlsPopoverOpen(false);
      setInfoPopoverOpen(false);
    }
    if (editingEnvironment) {
      const currentlyVisible = state.environment.defaultVisibleLayers.includes(
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
      );
      if (currentlyVisible !== nextVisible) {
        toggleEnvDefaultVisible(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
      }
    } else if (writePage) {
      setPageVisibilityOverride(
        writePage.id,
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        nextVisible,
      );
    }
  };

  return (
    <>
      <aside
        ref={rootRef}
        aria-label="Utah FORGE seismic presentation legend bar"
        data-testid="seismic-presentation-legend-bar"
        style={{
          ...rootBaseStyle,
          ...(stacked
            ? { position: "relative" }
            : {
                left: LEGEND_PAGE_EDGE_MARGIN_PX,
                bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX,
              }),
        }}
      >
        <div style={headerRowStyle}>
          <button
            type="button"
            data-testid="seismic-presentation-legend-name"
            aria-label="Toggle seismic amplitude"
            aria-pressed={layerVisible}
            title={layerVisible ? "Hide Seismic Amp" : "Show Seismic Amp"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setLayerVisible(!layerVisible)}
            style={nameButtonStyle(layerVisible)}
          >
            Seismic Amp
          </button>
          <select
            aria-label="Seismic amplitude color map"
            data-testid="seismic-presentation-palette-select"
            title="Color map"
            value={model.colormap}
            style={paletteSelectStyle}
            onChange={(event) =>
              patchStyle({
                seismicColormap: event.currentTarget
                  .value as EditableStyle["seismicColormap"],
              })
            }
          >
            <option value="blue-white-red">{paletteLabel("blue-white-red")}</option>
            <option value="grayscale">{paletteLabel("grayscale")}</option>
            <option value="velocity">{paletteLabel("velocity")}</option>
          </select>
          <button
            type="button"
            aria-label="Seismic amplitude controls"
            aria-expanded={controlsPopoverOpen}
            data-testid="seismic-presentation-legend-controls-toggle"
            title="Seismic amplitude controls"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setControlsPopoverOpen((open) => !open);
              setInfoPopoverOpen(false);
            }}
            style={iconButtonStyle(controlsPopoverOpen)}
          >
            <SeismicLegendIcon kind="controls" />
          </button>
          <button
            type="button"
            aria-label="Seismic amplitude information"
            aria-expanded={infoPopoverOpen}
            data-testid="seismic-presentation-legend-info-toggle"
            title="Seismic amplitude information"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setInfoPopoverOpen((open) => !open);
              setControlsPopoverOpen(false);
            }}
            style={iconButtonStyle(infoPopoverOpen)}
          >
            <SeismicLegendIcon kind="info" />
          </button>
        </div>
        {layerVisible ? (
          <div style={amplitudeBodyStyle}>
            <div style={amplitudeRampWrapStyle}>
              <div
                data-testid="seismic-presentation-amplitude-ramp"
                aria-label={`${model.amplitudeMinLabel} ${model.amplitudeMaxLabel}`}
                style={{
                  ...amplitudeRampStyle,
                  background: `linear-gradient(90deg, ${seismicPresentationColor(
                    0,
                    model.colormap,
                  )} 0%, ${seismicPresentationColor(0.5, model.colormap)} 50%, ${seismicPresentationColor(
                    1,
                    model.colormap,
                  )} 100%)`,
                }}
              />
            </div>
            <div
              data-testid="seismic-presentation-amplitude-ticks"
              style={{ ...amplitudeTicksStyle, color: legendTextColors.body }}
            >
              <span>{model.amplitudeMinLabel}</span>
              <span style={{ textAlign: "center" }}>
                {model.amplitudeMidLabel}
              </span>
              <span style={{ textAlign: "right" }}>
                {model.amplitudeMaxLabel}
              </span>
            </div>
          </div>
        ) : null}
      </aside>

      {controlsPopoverOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={controlsPopoverRef}
              data-testid="seismic-presentation-legend-controls-popout"
              style={{
                ...popoverStyle,
                left: popoverPosition.left,
                top: popoverPosition.top,
                color: legendTextColors.body,
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div style={controlsCloseRowStyle}>
                <button
                  type="button"
                  style={{ ...closeButtonStyle, color: legendTextColors.body }}
                  onClick={() => setControlsPopoverOpen(false)}
                >
                  Close
                </button>
              </div>
              <div style={sliceControlsStyle}>
                <div
                  role="group"
                  aria-label="Seismic presentation slice axis"
                  data-testid="seismic-presentation-slice-axis"
                  style={segmentGroupStyle}
                >
                  {[
                    ["inline", "IL"],
                    ["crossline", "XL"],
                    ["sample", "Depth"],
                  ].map(([axis, label]) => (
                    <button
                      key={axis}
                      type="button"
                      aria-pressed={model.sliceAxis === axis}
                      data-testid={`seismic-presentation-slice-axis-${axis}`}
                      onClick={() =>
                        setSliceAxis(axis as SeismicPresentationSliceAxis)
                      }
                      style={segmentButtonStyle(
                        model.sliceAxis === axis,
                        legendTextColors,
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  data-testid="seismic-presentation-slice-fraction"
                  aria-label="Seismic presentation slice fraction"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={model.sliceFraction}
                  onChange={(event) =>
                    patchStyle({
                      seismicSliceFraction: Number.parseFloat(
                        event.currentTarget.value,
                      ),
                    })
                  }
                  style={
                    {
                      ...sliceSliderStyle,
                      "--editor-slider-fill": `${model.sliceFraction * 100}%`,
                    } as CSSProperties
                  }
                />
              </div>
              <div style={panelBlockStyle}>
                <div style={{ ...compactValueStyle, color: legendTextColors.heading }}>
                  Presentation-enhanced PSDM surrogate
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    width: "max-content",
                    borderRadius: 999,
                    padding: "4px 8px",
                    background: "rgba(143, 215, 255, 0.86)",
                    color: "#071016",
                    fontSize: 10,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  {model.provenanceTag}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    lineHeight: 1.25,
                    color: legendTextColors.subtext,
                  }}
                >
                  GDR 1141, unenhanced source - {model.productLabel}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {infoPopoverOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={infoPopoverRef}
              data-testid="seismic-presentation-legend-info-popout"
              style={{
                ...popoverStyle,
                left: popoverPosition.left,
                top: popoverPosition.top,
                color: legendTextColors.body,
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div style={{ ...popoverHeaderStyle, color: legendTextColors.heading }}>
                <span>Seismic Amplitude Info</span>
                <button
                  type="button"
                  style={{ ...closeButtonStyle, color: legendTextColors.body }}
                  onClick={() => setInfoPopoverOpen(false)}
                >
                  Close
                </button>
              </div>
              <div style={infoGridStyle}>
                {infoBlock({
                  label: "Source",
                  value: "GDR 1141, unenhanced source",
                  colors: legendTextColors,
                })}
                {infoBlock({
                  label: "Product",
                  value: model.productLabel,
                  colors: legendTextColors,
                })}
                {infoBlock({
                  label: "Provenance",
                  value: model.provenanceTag,
                  colors: legendTextColors,
                })}
                {infoBlock({
                  label: model.velocityReferenceLabel,
                  value: `${model.velocityMinLabel}-${model.velocityMaxLabel}`,
                  colors: legendTextColors,
                })}
                {infoBlock({
                  label: "Datum",
                  value: model.datumLabel,
                  colors: legendTextColors,
                })}
                {infoBlock({
                  label: "Context",
                  value: `Scale 1 km / N / ${model.verticalExaggerationLabel}`,
                  colors: legendTextColors,
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
