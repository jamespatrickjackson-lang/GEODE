import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../editor/EditorContext";
import {
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "../editor/styles";
import { transparentLegendPanelStyle } from "./legendStyles";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import { effectiveStyle } from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { EditableStyle, PresentationPage } from "../pages/types";
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

const subtitleStyle: CSSProperties = {
  marginTop: 5,
  color: vibrancySecondaryLabel,
  fontSize: 10,
  lineHeight: 1.25,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginTop: 10,
  color: vibrancySecondaryLabel,
  fontSize: 10,
};

const closeButtonStyle: CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: 6,
  background: "rgba(255, 255, 255, 0.08)",
  color: vibrancySecondaryLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 9,
  padding: "3px 7px",
  cursor: "pointer",
};

const configureButtonStyle: CSSProperties = {
  ...closeButtonStyle,
  color: vibrancyLabel,
};

const selectStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: 6,
  background: "rgba(255, 255, 255, 0.08)",
  color: vibrancyLabel,
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
  color: vibrancyLabel,
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
  color: vibrancyLabel,
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
  color: vibrancySecondaryLabel,
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
  if (group === "mt-volume-cuts") {
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
  if (group === "mt-volume-cuts") {
    return styleNumber(
      style,
      "scalarVolumeThresholdMax",
      styleNumber(style, "scalarDisplayMax", fallback),
    );
  }
  return styleNumber(style, "scalarDisplayMax", fallback);
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
  } = useEditor();
  const { pages, currentIndex, targetIndex } = usePageController();
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
  if (targets.length === 0) return null;

  const groups = targetGroups(targets);
  const resolvedGroup =
    groups.find((group) => group.id === activeGroup)?.id ?? groups[0]?.id;
  if (!resolvedGroup) return null;
  const activeTargets = targets.filter((target) => target.group === resolvedGroup);
  if (activeTargets.length === 0) return null;

  const layerId = activeTargets[0].layerId;
  const controllerPage =
    pageOverride ?? pages[targetIndex ?? currentIndex] ?? pages[currentIndex];
  const editingEnvironment = state.selectedPageId === ENVIRONMENT_SENTINEL;
  const selectedPage =
    !pageOverride && !editingEnvironment && state.selectedPageId
      ? state.pages.find((candidate) => candidate.id === state.selectedPageId)
      : null;
  const page =
    pageOverride ??
    (targetIndex !== null ? controllerPage : selectedPage ?? controllerPage);
  const style = editingEnvironment
    ? state.environment.layerStyles[layerId] ?? {}
    : page
      ? effectiveStyle(state.environment, page, layerId)
      : state.environment.layerStyles[layerId] ?? {};

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
  const targetIds =
    typeof style.sectionIsoTargetIds === "object" &&
    style.sectionIsoTargetIds !== null
      ? (style.sectionIsoTargetIds as Record<string, boolean>)
      : {};
  const selectedCount = targets.filter(
    (target) => target.group === resolvedGroup,
  ).filter(
    (target) => targetIds[target.targetKey] !== false,
  ).length;
  const gui = state.environment.scene?.gui ?? {};
  const navigator = gui.navigator ?? {};
  const inset = navigator.useOverride === true ? navigator.bottom ?? 34 : 34;

  const commit = (patch: Partial<EditableStyle>) => {
    const merged = { ...style, ...patch };
    sceneHandle.manager.applyStyle(layerId, merged);
    if (editingEnvironment || !page) {
      setEnvLayerStyle(layerId, patch);
    } else {
      setPageLayerOverride(page.id, layerId, patch);
    }
  };
  const setTargetSelected = (target: ScalarSectionIsoTarget, checked: boolean) => {
    commit({
      sectionIsoTargetIds: {
        ...targetIds,
        [target.targetKey]: checked,
      },
    });
  };

  return (
    <aside
      ref={rootRef}
      style={{
        ...rootStyle,
        ...(stacked
          ? { position: "relative" }
          : { left: inset, bottom: inset + 194 }),
      }}
      aria-label="Scalar section ISO legend"
      data-testid="section-iso-legend"
    >
      <h2 style={titleStyle}>Section ISO</h2>
      <div style={subtitleStyle}>
        {selectedCount}/{activeTargets.length} {groups.find((group) => group.id === resolvedGroup)?.label ?? "sections"}
      </div>
      {groups.length > 1 ? (
        <select
          value={resolvedGroup}
          data-testid="section-iso-dataset"
          style={{ ...selectStyle, marginTop: 9 }}
          onChange={(event) =>
            setActiveGroup(event.currentTarget.value as SectionIsoTargetGroup)
          }
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
      ) : null}
      <div style={rowStyle}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <input
            type="checkbox"
            data-testid="section-iso-toggle"
            checked={enabled}
            onChange={(event) =>
              commit({ sectionIsoEnabled: event.currentTarget.checked })
            }
          />
          ISO overlay
        </label>
        <button
          type="button"
          style={configureButtonStyle}
          data-testid="section-iso-configure"
          onClick={() => setPopoverOpen((open) => !open)}
        >
          Options
        </button>
      </div>
      {popoverOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              style={{
                ...popoverStyle,
                left: popoverPosition.left,
                top: popoverPosition.top,
              }}
              data-testid="section-iso-popout"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div style={popoverHeaderStyle}>
                <span>Section ISO</span>
                <button
                  type="button"
                  style={closeButtonStyle}
                  onClick={() => setPopoverOpen(false)}
                >
                  Close
                </button>
              </div>
              <div style={popoverGridStyle}>
                {groups.length > 1 ? (
                  <label style={{ ...fineControlLabelStyle, ...fullRowStyle }}>
                    Dataset
                    <select
                      value={resolvedGroup}
                      data-testid="section-iso-popout-dataset"
                      style={selectStyle}
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
                <label style={fineControlLabelStyle}>
                  Lines
                  <input
                    type="checkbox"
                    data-testid="section-iso-lines-visible"
                    checked={linesVisible}
                    onChange={(event) =>
                      commit({ sectionIsoLinesVisible: event.currentTarget.checked })
                    }
                  />
                </label>
                <label style={fineControlLabelStyle}>
                  Bands
                  <input
                    type="checkbox"
                    data-testid="section-iso-bands-visible"
                    checked={bandsVisible}
                    onChange={(event) =>
                      commit({ sectionIsoBandsVisible: event.currentTarget.checked })
                    }
                  />
                </label>
                <label style={fineControlLabelStyle}>
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
                      commit({
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
                <label style={fineControlLabelStyle}>
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
                      commit({
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
                <label style={fineControlLabelStyle}>
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
                      commit({
                        sectionIsoLevelCount: Math.round(
                          Number.parseFloat(event.currentTarget.value),
                        ),
                      })
                    }
                    style={rangeStyle}
                  />
                </label>
                <label style={fineControlLabelStyle}>
                  Style
                  <select
                    value={lineStyle}
                    data-testid="section-iso-line-style"
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      commit({
                        sectionIsoLineStyle:
                          event.currentTarget.value === "dashed" ? "dashed" : "solid",
                      })
                    }
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                  </select>
                </label>
                <label style={fineControlLabelStyle}>
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
                      commit({
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
                <label style={fineControlLabelStyle}>
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
                      commit({
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
                <label style={{ ...fineControlLabelStyle, ...fullRowStyle }}>
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
                      commit({
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
                <div style={{ ...fineControlLabelStyle, ...fullRowStyle }}>
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
                            ? vibrancyTertiaryLabel
                            : vibrancySecondaryLabel,
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
