import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../editor/EditorContext";
import {
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
} from "../editor/styles";
import {
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  legendCheckboxStyle,
  legendControlRowStyle,
  resolveLegendTextColors,
  transparentLegendPanelStyle,
} from "./legendStyles";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import {
  effectiveStyle,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { EditableStyle, PresentationPage } from "../pages/types";
import { selectedLegendAuthoringPage } from "./legendAuthoringTarget";
import type {
  ScalarSectionIsoTarget,
  SectionIsoTargetGroup,
} from "../scene/SceneManager";

const UTAH_FORGE_PROJECT_SLUG = "utah-forge";
const POPOVER_WIDTH_PX = 312;
const POPOVER_MARGIN_PX = 12;

const rootStyle: CSSProperties = {
  ...transparentLegendPanelStyle,
  padding: 13,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.15,
  fontWeight: 700,
};

const rowStyle: CSSProperties = {
  display: "grid",
  marginTop: 10,
  fontSize: 10,
};

const toggleStackStyle: CSSProperties = {
  display: "grid",
};

const toggleLabelStyle: CSSProperties = {
  ...legendControlRowStyle(),
};

const firstToggleLabelStyle: CSSProperties = {
  ...toggleLabelStyle,
  marginTop: 0,
};

const closeButtonStyle: CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: 6,
  background: "rgba(255, 255, 255, 0.08)",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 9,
  padding: "3px 7px",
  cursor: "pointer",
};

const selectStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: 6,
  background: "rgba(255, 255, 255, 0.08)",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 10,
  padding: "5px 7px",
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
  background: "rgba(12, 15, 18, 0.88)",
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
  fontSize: 10,
  fontWeight: 700,
};

const popoverGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 9,
};

const fullRowStyle: CSSProperties = {
  gridColumn: "1 / -1",
};

const fineControlLabelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 9,
  lineHeight: 1.1,
};

const rangeStyle: CSSProperties = {
  width: "100%",
  accentColor: "#ff637a",
};

const targetListStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  maxHeight: 150,
  overflowY: "auto",
  padding: 8,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 7,
  background: "rgba(255, 255, 255, 0.04)",
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function styleNumber(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: number,
): number {
  const value = style[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function styleBoolean(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
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
    popover?.getBoundingClientRect().height ?? 320,
    Math.max(180, viewportHeight - margin * 2),
  );
  const left = (legendRect?.right ?? margin) + 10;
  const top = (legendRect?.top ?? margin) + 24;
  return {
    left: clamp(left, margin, viewportWidth - popoverWidth - margin),
    top: clamp(top, margin, viewportHeight - popoverHeight - margin),
  };
}

function targetSignature(targets: ScalarSectionIsoTarget[]): string {
  return targets
    .map((target) =>
      [
        target.targetKey,
        target.group,
        target.label,
        target.kind,
        target.visible ? "1" : "0",
        target.scalarMin.toFixed(4),
        target.scalarMax.toFixed(4),
      ].join("|"),
    )
    .join(";");
}

function fillRangeStyle(value: number): CSSProperties {
  return {
    ...rangeStyle,
    accentColor: value < 0 ? "#f4f5f7" : "#1b1e22",
    background:
      "linear-gradient(90deg, #ffffff 0%, rgba(255, 255, 255, 0.18) 50%, #050607 100%)",
    borderRadius: 999,
  };
}

function formatValue(value: number): string {
  return value.toFixed(2);
}

function targetGroups(
  targets: ScalarSectionIsoTarget[],
): Array<{ id: SectionIsoTargetGroup; label: string }> {
  const groups = new Map<SectionIsoTargetGroup, string>();
  for (const target of targets) {
    groups.set(target.group, target.groupLabel);
  }
  return Array.from(groups.entries()).map(([id, label]) => ({ id, label }));
}

function defaultDisplayMin(
  style: EditableStyle,
  group: SectionIsoTargetGroup,
  fallback: number,
): number {
  if (group === "seismic-sections") {
    return styleNumber(style, "seismicAmplitudeMin", fallback);
  }
  if (
    group === "mt-volume-cuts" ||
    group === "resistivity-on-seismic-sections" ||
    group === "resistivity-on-seismic-volume-cuts"
  ) {
    return styleNumber(
      style,
      "scalarVolumeThresholdMin",
      styleNumber(style, "scalarDisplayMin", fallback),
    );
  }
  return styleNumber(style, "scalarDisplayMin", fallback);
}

function defaultDisplayMax(
  style: EditableStyle,
  group: SectionIsoTargetGroup,
  fallback: number,
): number {
  if (group === "seismic-sections") {
    return styleNumber(style, "seismicAmplitudeMax", fallback);
  }
  if (
    group === "mt-volume-cuts" ||
    group === "resistivity-on-seismic-sections" ||
    group === "resistivity-on-seismic-volume-cuts"
  ) {
    return styleNumber(
      style,
      "scalarVolumeThresholdMax",
      styleNumber(style, "scalarDisplayMax", fallback),
    );
  }
  return styleNumber(style, "scalarDisplayMax", fallback);
}

function groupSupportsVolumeToggle(group: SectionIsoTargetGroup): boolean {
  return (
    group === "mt-volume-cuts" ||
    group === "seismic-volume-cuts" ||
    group === "resistivity-on-seismic-volume-cuts"
  );
}

export function SectionIsoLegend({
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
  const [targets, setTargets] = useState<ScalarSectionIsoTarget[]>([]);
  const [activeGroup, setActiveGroup] = useState<SectionIsoTargetGroup | "">("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({
    left: POPOVER_MARGIN_PX,
    top: POPOVER_MARGIN_PX,
  });

  useEffect(() => {
    let lastSignature = "";
    const update = () => {
      const next = sceneHandle.manager
        .listSectionIsoTargets()
        .filter((target) => target.visible);
      const nextSignature = targetSignature(next);
      if (nextSignature !== lastSignature) {
        lastSignature = nextSignature;
        setTargets(next);
      }
    };
    update();
    const interval = window.setInterval(update, 650);
    return () => window.clearInterval(interval);
  }, [sceneHandle.manager]);

  useEffect(() => {
    const groups = targetGroups(targets);
    if (groups.length === 0) return;
    if (!groups.some((group) => group.id === activeGroup)) {
      setActiveGroup(groups[0].id);
    }
  }, [activeGroup, targets]);

  useEffect(() => {
    if (!popoverOpen) return;
    const update = () =>
      setPopoverPosition(positionForLegend(rootRef.current, popoverRef.current));
    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, [popoverOpen, targets]);

  if (state.projectSlug !== UTAH_FORGE_PROJECT_SLUG) return null;
  const legendTextColors = resolveLegendTextColors(
    state.environment.scene?.gui?.overlay,
  );
  if (targets.length === 0) return null;

  const groups = targetGroups(targets);
  const resolvedGroup =
    groups.find((group) => group.id === activeGroup)?.id ?? groups[0]?.id;
  if (!resolvedGroup) return null;
  const activeTargets = targets.filter((target) => target.group === resolvedGroup);
  if (activeTargets.length === 0) return null;

  const layerId = activeTargets[0].layerId;
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
      ? state.pages.find((candidate) => candidate.id === state.selectedPageId)
      : null;
  const page =
    pageOverride ??
    (transitionFrame.active && targetIndex !== null
      ? controllerPage
      : selectedPage ?? controllerPage);
  const writePage = authoringPage ?? page;
  const pageEnvironment = page
    ? resolveEnvironmentForPage(state.environment, state.pages, page)
    : state.environment;
  const style = editingEnvironment
    ? state.environment.layerStyles[layerId] ?? {}
    : page
      ? effectiveStyle(pageEnvironment, page, layerId)
      : pageEnvironment.layerStyles[layerId] ?? {};

  const sourceMin = Math.min(...activeTargets.map((target) => target.scalarMin));
  const sourceMax = Math.max(...activeTargets.map((target) => target.scalarMax));
  const displayMin = defaultDisplayMin(style, resolvedGroup, activeTargets[0].scalarMin);
  const displayMax = Math.max(
    defaultDisplayMax(style, resolvedGroup, activeTargets[0].scalarMax),
    displayMin + 0.000001,
  );
  const isoMin = clamp(
    styleNumber(style, "sectionIsoMin", displayMin),
    sourceMin,
    sourceMax,
  );
  const isoMax = clamp(
    Math.max(styleNumber(style, "sectionIsoMax", displayMax), isoMin + 0.01),
    isoMin + 0.01,
    sourceMax,
  );
  const levelCount = Math.round(
    clamp(styleNumber(style, "sectionIsoLevelCount", 5), 2, 32),
  );
  const lineWidth = clamp(styleNumber(style, "sectionIsoLineWidth", 2.6), 0, 12);
  const bandOpacity = clamp(
    styleNumber(style, "sectionIsoBandOpacity", 0.32),
    0,
    0.85,
  );
  const fillOffset = clamp(styleNumber(style, "sectionIsoFillOffset", 0), -1, 1);
  const lineStyle = style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid";
  const enabled = style.sectionIsoEnabled === true;
  const linesVisible = styleBoolean(style, "sectionIsoLinesVisible", true);
  const bandsVisible = styleBoolean(style, "sectionIsoBandsVisible", true);
  const sourceOpacity = clamp(
    styleNumber(style, "sectionIsoSourceOpacity", 0),
    0,
    1,
  );
  const showVolume = sourceOpacity > 0.001;
  const supportsVolumeToggle = groupSupportsVolumeToggle(resolvedGroup);
  const targetIds =
    typeof style.sectionIsoTargetIds === "object" &&
    style.sectionIsoTargetIds !== null
      ? (style.sectionIsoTargetIds as Record<string, boolean>)
      : {};
  const commit = (patch: Partial<EditableStyle>) => {
    const merged = { ...style, ...patch };
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(layerId, merged);
    }
    if (editingEnvironment) {
      setEnvLayerStyle(layerId, patch);
    } else if (writePage) {
      setPageLayerOverride(writePage.id, layerId, patch);
    } else {
      setEnvLayerStyle(layerId, patch);
    }
  };
  const targetSelectionVisible = (ids: Record<string, boolean>) =>
    activeTargets.some((target) => ids[target.targetKey] !== false);
  const overlayVisibleForPatch = (patch: Partial<EditableStyle>) => {
    const nextLinesVisible =
      typeof patch.sectionIsoLinesVisible === "boolean"
        ? patch.sectionIsoLinesVisible
        : linesVisible;
    const nextBandsVisible =
      typeof patch.sectionIsoBandsVisible === "boolean"
        ? patch.sectionIsoBandsVisible
        : bandsVisible;
    const nextTargetIds =
      typeof patch.sectionIsoTargetIds === "object" &&
      patch.sectionIsoTargetIds !== null
        ? (patch.sectionIsoTargetIds as Record<string, boolean>)
        : targetIds;
    return (
      (nextLinesVisible || nextBandsVisible) &&
      targetSelectionVisible(nextTargetIds)
    );
  };
  const commitIsoOverlayPatch = (patch: Partial<EditableStyle>) => {
    commit({
      sectionIsoEnabled: overlayVisibleForPatch(patch),
      ...patch,
    });
  };
  const setTargetSelected = (target: ScalarSectionIsoTarget, checked: boolean) => {
    const nextTargetIds = {
      ...targetIds,
      [target.targetKey]: checked,
    };
    commit({
      sectionIsoEnabled:
        checked || enabled
          ? overlayVisibleForPatch({ sectionIsoTargetIds: nextTargetIds })
          : false,
      sectionIsoTargetIds: nextTargetIds,
    });
  };

  return (
    <aside
      ref={rootRef}
      style={{
        ...rootStyle,
        ...(stacked
          ? { position: "relative" }
          : {
              left: LEGEND_PAGE_EDGE_MARGIN_PX,
              bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX + 160,
            }),
      }}
      aria-label="Scalar section ISO legend"
      data-testid="section-iso-legend"
    >
      <h2 style={{ ...titleStyle, color: legendTextColors.heading }}>
        Section ISO
      </h2>
      <div style={{ ...rowStyle, color: legendTextColors.body }}>
        <div style={toggleStackStyle}>
          <label style={firstToggleLabelStyle}>
            <input
              type="checkbox"
              data-testid="section-iso-toggle"
              checked={enabled}
              onChange={(event) =>
                commit({ sectionIsoEnabled: event.currentTarget.checked })
              }
              style={legendCheckboxStyle(enabled, {
                checkedColor: legendTextColors.heading,
              })}
            />
            ISO overlay
          </label>
          {supportsVolumeToggle ? (
            <label style={toggleLabelStyle}>
              <input
                type="checkbox"
                data-testid="section-iso-show-volume"
                checked={showVolume}
                onChange={(event) =>
                  commit({
                    sectionIsoSourceOpacity: event.currentTarget.checked ? 1 : 0,
                  })
                }
                style={legendCheckboxStyle(showVolume, {
                  checkedColor: legendTextColors.heading,
                })}
              />
              Show volume
            </label>
          ) : null}
          <label style={toggleLabelStyle}>
            <input
              type="checkbox"
              data-testid="section-iso-configure"
              checked={popoverOpen}
              onChange={(event) =>
                setPopoverOpen(event.currentTarget.checked)
              }
              style={legendCheckboxStyle(popoverOpen, {
                checkedColor: legendTextColors.heading,
              })}
            />
            Options
          </label>
        </div>
      </div>
      {popoverOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              style={{
                ...popoverStyle,
                left: popoverPosition.left,
                top: popoverPosition.top,
                color: legendTextColors.body,
              }}
              data-testid="section-iso-popout"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div style={{ ...popoverHeaderStyle, color: legendTextColors.heading }}>
                <span>Section ISO</span>
                <button
                  type="button"
                  style={{ ...closeButtonStyle, color: legendTextColors.body }}
                  onClick={() => setPopoverOpen(false)}
                >
                  Close
                </button>
              </div>
              <div style={popoverGridStyle}>
                {groups.length > 0 ? (
                  <label
                    style={{
                      ...fineControlLabelStyle,
                      ...fullRowStyle,
                      color: legendTextColors.body,
                    }}
                  >
                    Dataset
                    <select
                      value={resolvedGroup}
                      data-testid="section-iso-popout-dataset"
                      style={{ ...selectStyle, color: legendTextColors.body }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        setActiveGroup(
                          event.currentTarget.value as SectionIsoTargetGroup,
                        )
                      }
                    >
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
                  Lines
                  <input
                    type="checkbox"
                    data-testid="section-iso-lines-visible"
                    checked={linesVisible}
                    onChange={(event) =>
                      commitIsoOverlayPatch({
                        sectionIsoLinesVisible: event.currentTarget.checked,
                      })
                    }
                    style={legendCheckboxStyle(linesVisible, {
                      checkedColor: legendTextColors.heading,
                    })}
                  />
                </label>
                <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
                  Bands
                  <input
                    type="checkbox"
                    data-testid="section-iso-bands-visible"
                    checked={bandsVisible}
                    onChange={(event) =>
                      commitIsoOverlayPatch({
                        sectionIsoBandsVisible: event.currentTarget.checked,
                      })
                    }
                    style={legendCheckboxStyle(bandsVisible, {
                      checkedColor: legendTextColors.heading,
                    })}
                  />
                </label>
                <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
                  Min {formatValue(isoMin)}
                  <input
                    type="range"
                    min={sourceMin}
                    max={sourceMax}
                    step={0.01}
                    value={isoMin}
                    data-testid="section-iso-min"
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      commitIsoOverlayPatch({
                        sectionIsoMin: clamp(
                          Number.parseFloat(event.currentTarget.value),
                          sourceMin,
                          isoMax - 0.01,
                        ),
                      })
                    }
                    style={rangeStyle}
                  />
                </label>
                <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
                  Max {formatValue(isoMax)}
                  <input
                    type="range"
                    min={sourceMin}
                    max={sourceMax}
                    step={0.01}
                    value={isoMax}
                    data-testid="section-iso-max"
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      commitIsoOverlayPatch({
                        sectionIsoMax: clamp(
                          Number.parseFloat(event.currentTarget.value),
                          isoMin + 0.01,
                          sourceMax,
                        ),
                      })
                    }
                    style={rangeStyle}
                  />
                </label>
                <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
                  Bands {levelCount}
                  <input
                    type="range"
                    min={2}
                    max={32}
                    step={1}
                    value={levelCount}
                    data-testid="section-iso-level-count"
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      commitIsoOverlayPatch({
                        sectionIsoLevelCount: Math.round(
                          Number.parseFloat(event.currentTarget.value),
                        ),
                      })
                    }
                    style={rangeStyle}
                  />
                </label>
                <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
                  Style
                  <select
                    value={lineStyle}
                    data-testid="section-iso-line-style"
                    style={{ ...selectStyle, color: legendTextColors.body }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      commitIsoOverlayPatch({
                        sectionIsoLineStyle:
                          event.currentTarget.value === "dashed" ? "dashed" : "solid",
                      })
                    }
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                  </select>
                </label>
                <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
                  Line {lineWidth.toFixed(1)}px
                  <input
                    type="range"
                    min={0}
                    max={12}
                    step={0.1}
                    value={lineWidth}
                    data-testid="section-iso-line-width"
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      commitIsoOverlayPatch({
                        sectionIsoLineWidth: clamp(
                          Number.parseFloat(event.currentTarget.value),
                          0,
                          12,
                        ),
                      })
                    }
                    style={rangeStyle}
                  />
                </label>
                <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
                  Band {Math.round(bandOpacity * 100)}%
                  <input
                    type="range"
                    min={0}
                    max={0.85}
                    step={0.01}
                    value={bandOpacity}
                    data-testid="section-iso-band-opacity"
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      commitIsoOverlayPatch({
                        sectionIsoBandOpacity: clamp(
                          Number.parseFloat(event.currentTarget.value),
                          0,
                          0.85,
                        ),
                      })
                    }
                    style={rangeStyle}
                  />
                </label>
                <label
                  style={{
                    ...fineControlLabelStyle,
                    ...fullRowStyle,
                    color: legendTextColors.body,
                  }}
                >
                  Fill {fillOffset === 0 ? "0%" : `${Math.round(fillOffset * 100)}%`}
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={fillOffset}
                    data-testid="section-iso-fill-offset"
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      commitIsoOverlayPatch({
                        sectionIsoFillOffset: clamp(
                          Number.parseFloat(event.currentTarget.value),
                          -1,
                          1,
                        ),
                      })
                    }
                    style={fillRangeStyle(fillOffset)}
                  />
                </label>
                <div
                  style={{
                    ...fineControlLabelStyle,
                    ...fullRowStyle,
                    color: legendTextColors.body,
                  }}
                >
                  Targets
                  <div style={targetListStyle}>
                    {activeTargets.map((target) => (
                      <label
                        key={target.targetKey}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          alignItems: "center",
                          gap: 8,
                          color: targetIds[target.targetKey] === false
                            ? legendTextColors.subtext
                            : legendTextColors.body,
                        }}
                      >
                        <span>{target.label}</span>
                        <input
                          type="checkbox"
                          data-testid={`section-iso-target-${target.sectionId}`}
                          checked={targetIds[target.targetKey] !== false}
                          onChange={(event) =>
                            setTargetSelected(target, event.currentTarget.checked)
                          }
                          style={legendCheckboxStyle(
                            targetIds[target.targetKey] !== false,
                            { checkedColor: legendTextColors.heading },
                          )}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </aside>
  );
}
