import type React from "react";
import { panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  styleBoolean,
  styleNumber,
  type LayerStyleSetter,
  type PageStyleSetter,
} from "../../styleControls";
import type { EditableStyle, PresentationPage } from "../../../pages/types";
import type { SceneHandle } from "../../../scene";
import { useEditor } from "../../EditorContext";
import { UTAH_FORGE_SCENE_SECTION_LAYER_ID } from "../../../projectModules/utahForge/layerIds";
import { SCALAR_SOURCE_MAX, SCALAR_SOURCE_MIN } from "../scalarSourceRange";

type IsobandRangeKind = "mt" | "seismic";

function isobandAxisRange(axis: "x" | "y" | "z") {
  if (axis === "x") return { min: -140000, max: 140000, label: "X plane" };
  if (axis === "y") return { min: -115000, max: 115000, label: "Y plane" };
  return { min: -122000, max: 4000, label: "Z plane" };
}

function isobandDefaultPlanePosition(axis: "x" | "y" | "z"): number {
  return axis === "x" ? -6000 : axis === "y" ? -10300 : -2200;
}

export function IsobandControls({
  title = "Isobands",
  nestedContainer = true,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  rangeKind,
  volumePlanes,
  sceneSectionStyle,
  sceneHandle,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  title?: string;
  nestedContainer?: boolean;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  rangeKind: IsobandRangeKind;
  volumePlanes?: boolean;
  sceneSectionStyle?: EditableStyle;
  sceneHandle?: SceneHandle;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
}) {
  const { canApplyLiveSceneEdits } = useEditor();
  const enabled = styleBoolean(style, "sectionIsoEnabled", false);
  const linesVisible = styleBoolean(style, "sectionIsoLinesVisible", true);
  const bandsVisible = styleBoolean(style, "sectionIsoBandsVisible", true);
  const sourceOpacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "sectionIsoSourceOpacity", 0)),
  );
  const bandCount = Math.max(
    2,
    Math.min(32, Math.round(styleNumber(style, "sectionIsoLevelCount", 32))),
  );
  const lineWidth = Math.max(
    0,
    Math.min(12, styleNumber(style, "sectionIsoLineWidth", 2.6)),
  );
  const bandOpacity = Math.max(
    0,
    Math.min(0.85, styleNumber(style, "sectionIsoBandOpacity", 0.32)),
  );
  const fillOffset = Math.max(
    -1,
    Math.min(1, styleNumber(style, "sectionIsoFillOffset", 0)),
  );
  const lineStyle = style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid";
  const bandSelection = Array.isArray(style.sectionIsoBandSelection)
    ? style.sectionIsoBandSelection
    : [];
  // sectionIsoLevels makes levelCount interior levels -> levelCount + 1 bands.
  const numBands = bandCount + 1;
  const sourceMin = rangeKind === "seismic" ? 0 : SCALAR_SOURCE_MIN;
  const sourceMax = rangeKind === "seismic" ? 1 : SCALAR_SOURCE_MAX;
  const fallbackMin =
    rangeKind === "seismic"
      ? styleNumber(style, "seismicAmplitudeMin", 0.08)
      : sourceMin;
  const fallbackMax =
    rangeKind === "seismic"
      ? styleNumber(style, "seismicAmplitudeMax", 0.92)
      : sourceMax;
  const isoMin = Math.max(
    sourceMin,
    Math.min(
      sourceMax - 0.001,
      styleNumber(style, "sectionIsoMin", fallbackMin),
    ),
  );
  const isoMax = Math.max(
    isoMin + 0.001,
    Math.min(sourceMax, styleNumber(style, "sectionIsoMax", fallbackMax)),
  );
  const sceneStyle = sceneSectionStyle ?? {};
  const scenePlanes = sceneStyle.sceneSectionPlanes ?? {};
  const activeAxis =
    sceneStyle.sceneSectionActiveAxis === "x" ||
    sceneStyle.sceneSectionActiveAxis === "y" ||
    sceneStyle.sceneSectionActiveAxis === "z"
      ? sceneStyle.sceneSectionActiveAxis
      : "z";
  const activePlane = scenePlanes[activeAxis] ?? {};
  const axisRange = isobandAxisRange(activeAxis);
  const planePosition =
    typeof activePlane.positionM === "number" &&
    Number.isFinite(activePlane.positionM)
      ? activePlane.positionM
      : isobandDefaultPlanePosition(activeAxis);
  const controlOpacity = disabled ? 0.4 : 1;
  const sourceOpacityLabel =
    rangeKind === "mt" ? "Source resistivity opacity" : "Source amplitude opacity";
  const minLabel = rangeKind === "mt" ? "Min log10(Ohm-m)" : "Min amplitude";
  const maxLabel = rangeKind === "mt" ? "Max log10(Ohm-m)" : "Max amplitude";
  const rangeSpan = sourceMax - sourceMin;
  const rangeFill = (value: number) =>
    `${Math.max(0, Math.min(100, ((value - sourceMin) / rangeSpan) * 100))}%`;
  const planeFill = Math.max(
    0,
    Math.min(
      100,
      ((planePosition - axisRange.min) /
        Math.max(1, axisRange.max - axisRange.min)) *
        100,
    ),
  );
  const commit = (patch: Partial<EditableStyle>) => {
    if (disabled) return;
    if (canApplyLiveSceneEdits()) {
      sceneHandle?.manager.applyStyle(layerId, { ...style, ...patch });
    }
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  const commitScene = (patch: Partial<EditableStyle>) => {
    if (disabled || !volumePlanes || !sceneHandle) return;
    const merged = { ...sceneStyle, ...patch };
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, merged);
    }
    if (isEnv) {
      setEnvLayerStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, patch);
    } else if (currentPage) {
      setPageLayerOverride(
        currentPage.id,
        UTAH_FORGE_SCENE_SECTION_LAYER_ID,
        patch,
      );
    }
  };
  const ensureScenePlane = (axis: "x" | "y" | "z") => {
    const targetLayerIds = new Set(
      Array.isArray(sceneStyle.sceneSectionTargetLayerIds)
        ? sceneStyle.sceneSectionTargetLayerIds
        : [],
    );
    targetLayerIds.add(layerId);
    commitScene({
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionActiveAxis: axis,
      sceneSectionTargetScope: "selected-targets",
      sceneSectionTargetLayerIds: Array.from(targetLayerIds),
      sceneSectionHelperVisible: true,
      sceneSectionLegendVisible: true,
      sceneSectionPlanes: {
        ...scenePlanes,
        [axis]: {
          ...(scenePlanes[axis] ?? {}),
          enabled: true,
          positionM:
            typeof scenePlanes[axis]?.positionM === "number"
              ? scenePlanes[axis]?.positionM
              : isobandDefaultPlanePosition(axis),
        },
      },
    });
  };
  const setEnabled = (checked: boolean) => {
    if (checked && volumePlanes) ensureScenePlane(activeAxis);
    commit(
      checked
        ? {
            sectionIsoEnabled: true,
            sectionIsoBandsVisible: true,
            sectionIsoLinesVisible: true,
            sectionIsoLevelCount: 32,
            sectionIsoSourceOpacity: 0,
            sectionIsoMin: fallbackMin,
            sectionIsoMax: Math.max(fallbackMin + 0.001, fallbackMax),
          }
        : { sectionIsoEnabled: false },
    );
  };

  const content = (
    <div style={detailsContentStyle}>
      <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
        <span style={nestedFieldLabelStyle}>View</span>
        <input
          data-testid="layer-isobands-enabled"
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(event) => setEnabled(event.target.checked)}
          style={{ opacity: controlOpacity }}
        />
        <span
          style={{
            flex: 1,
            color: vibrancyTertiaryLabel,
            fontSize: 11,
            opacity: controlOpacity,
          }}
        >
          {volumePlanes ? "section plane iso-bands" : "slice overlay iso-bands"}
        </span>
      </label>

      {volumePlanes ? (
        <>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Section plane</label>
            <select
              data-testid="layer-isobands-volume-axis"
              value={activeAxis}
              disabled={disabled}
              onChange={(event) =>
                ensureScenePlane(event.target.value as "x" | "y" | "z")
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="x">X</option>
              <option value="y">Y</option>
              <option value="z">Z</option>
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Plane position</label>
            <input
              data-testid="layer-isobands-volume-position"
              type="range"
              min={axisRange.min}
              max={axisRange.max}
              step={25}
              value={planePosition}
              disabled={disabled}
              onChange={(event) =>
                commitScene({
                  sceneSectionEnabled: true,
                  sceneSectionActiveAxis: activeAxis,
                  sceneSectionPlanes: {
                    ...scenePlanes,
                    [activeAxis]: {
                      ...(scenePlanes[activeAxis] ?? {}),
                      enabled: true,
                      positionM: parseFloat(event.target.value),
                    },
                  },
                })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${planeFill}%`,
                } as React.CSSProperties
              }
            />
          </div>
        </>
      ) : null}

      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>{sourceOpacityLabel}</label>
        <input
          data-testid="layer-isobands-source-opacity"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={sourceOpacity}
          disabled={disabled || !enabled}
          onChange={(event) =>
            commit({
              sectionIsoSourceOpacity: parseFloat(event.target.value),
            })
          }
          style={
            {
              flex: 1,
              opacity: enabled ? controlOpacity : 0.35,
              "--editor-slider-fill": `${sourceOpacity * 100}%`,
            } as React.CSSProperties
          }
        />
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Iso-band count</label>
        <input
          data-testid="layer-isobands-count"
          type="range"
          min={2}
          max={32}
          step={1}
          value={bandCount}
          disabled={disabled || !enabled}
          onChange={(event) =>
            commit({
              sectionIsoLevelCount: Math.round(
                parseFloat(event.target.value),
              ),
            })
          }
          style={
            {
              flex: 1,
              opacity: enabled ? controlOpacity : 0.35,
              "--editor-slider-fill": `${((bandCount - 2) / 30) * 100}%`,
            } as React.CSSProperties
          }
        />
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>3D bands (cells)</label>
        <div
          data-testid="layer-isobands-3d-select"
          style={{
            flex: 1,
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            opacity: enabled ? controlOpacity : 0.35,
          }}
        >
          {Array.from({ length: numBands }, (_, index) => {
            const selected = bandSelection.includes(index);
            return (
              <button
                key={index}
                type="button"
                title={`Show iso-band ${index} cells in 3D`}
                disabled={disabled || !enabled}
                onClick={() => {
                  const next = new Set(bandSelection);
                  if (next.has(index)) next.delete(index);
                  else next.add(index);
                  commit({
                    sectionIsoBandSelection: Array.from(next).sort(
                      (a, b) => a - b,
                    ),
                  });
                }}
                style={{
                  minWidth: 22,
                  height: 22,
                  padding: "0 5px",
                  borderRadius: 6,
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  background: selected
                    ? "rgba(120, 200, 255, 0.34)"
                    : "rgba(255, 255, 255, 0.05)",
                  color: "inherit",
                  fontSize: 10,
                  fontVariantNumeric: "tabular-nums",
                  cursor: "pointer",
                }}
              >
                {index}
              </button>
            );
          })}
          {bandSelection.length > 0 ? (
            <button
              type="button"
              data-testid="layer-isobands-3d-clear"
              disabled={disabled}
              onClick={() => commit({ sectionIsoBandSelection: [] })}
              style={{
                height: 22,
                padding: "0 8px",
                borderRadius: 6,
                border: "1px solid rgba(255, 131, 112, 0.4)",
                background: "rgba(194, 71, 55, 0.22)",
                color: "inherit",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              clear
            </button>
          ) : null}
        </div>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>{minLabel}</label>
        <input
          data-testid="layer-isobands-min"
          type="range"
          min={sourceMin}
          max={sourceMax}
          step={rangeKind === "seismic" ? 0.01 : 0.01}
          value={isoMin}
          disabled={disabled || !enabled}
          onChange={(event) => {
            const next = parseFloat(event.target.value);
            commit({
              sectionIsoMin: next,
              sectionIsoMax: Math.max(isoMax, next + 0.001),
            });
          }}
          style={
            {
              flex: 1,
              opacity: enabled ? controlOpacity : 0.35,
              "--editor-slider-fill": rangeFill(isoMin),
            } as React.CSSProperties
          }
        />
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>{maxLabel}</label>
        <input
          data-testid="layer-isobands-max"
          type="range"
          min={sourceMin}
          max={sourceMax}
          step={0.01}
          value={isoMax}
          disabled={disabled || !enabled}
          onChange={(event) => {
            const next = parseFloat(event.target.value);
            commit({
              sectionIsoMin: Math.min(isoMin, next - 0.001),
              sectionIsoMax: next,
            });
          }}
          style={
            {
              flex: 1,
              opacity: enabled ? controlOpacity : 0.35,
              "--editor-slider-fill": rangeFill(isoMax),
            } as React.CSSProperties
          }
        />
      </div>
      <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
        <span style={nestedFieldLabelStyle}>Iso-band fill</span>
        <input
          data-testid="layer-isobands-bands-visible"
          type="checkbox"
          checked={bandsVisible}
          disabled={disabled || !enabled}
          onChange={(event) =>
            commit({ sectionIsoBandsVisible: event.target.checked })
          }
          style={{ opacity: enabled ? controlOpacity : 0.35 }}
        />
        <span style={{ flex: 1 }} />
      </label>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Band opacity</label>
        <input
          data-testid="layer-isobands-band-opacity"
          type="range"
          min={0}
          max={0.85}
          step={0.01}
          value={bandOpacity}
          disabled={disabled || !enabled || !bandsVisible}
          onChange={(event) =>
            commit({ sectionIsoBandOpacity: parseFloat(event.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: enabled && bandsVisible ? controlOpacity : 0.35,
              "--editor-slider-fill": `${(bandOpacity / 0.85) * 100}%`,
            } as React.CSSProperties
          }
        />
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Band fill offset</label>
        <input
          data-testid="layer-isobands-fill-offset"
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={fillOffset}
          disabled={disabled || !enabled || !bandsVisible}
          onChange={(event) =>
            commit({ sectionIsoFillOffset: parseFloat(event.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: enabled && bandsVisible ? controlOpacity : 0.35,
              "--editor-slider-fill": `${((fillOffset + 1) / 2) * 100}%`,
            } as React.CSSProperties
          }
        />
      </div>
      <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
        <span style={nestedFieldLabelStyle}>Isolines</span>
        <input
          data-testid="layer-isobands-lines-visible"
          type="checkbox"
          checked={linesVisible}
          disabled={disabled || !enabled}
          onChange={(event) =>
            commit({ sectionIsoLinesVisible: event.target.checked })
          }
          style={{ opacity: enabled ? controlOpacity : 0.35 }}
        />
        <span style={{ flex: 1 }} />
      </label>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Isoline style</label>
        <select
          data-testid="layer-isobands-line-style"
          value={lineStyle}
          disabled={disabled || !enabled || !linesVisible}
          onChange={(event) =>
            commit({
              sectionIsoLineStyle:
                event.target.value === "dashed" ? "dashed" : "solid",
            })
          }
          style={{
            flex: 1,
            minWidth: 0,
            opacity: enabled && linesVisible ? controlOpacity : 0.35,
          }}
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
        </select>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Isoline width</label>
        <input
          data-testid="layer-isobands-line-width"
          type="range"
          min={0}
          max={12}
          step={0.1}
          value={lineWidth}
          disabled={disabled || !enabled || !linesVisible}
          onChange={(event) =>
            commit({ sectionIsoLineWidth: parseFloat(event.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: enabled && linesVisible ? controlOpacity : 0.35,
              "--editor-slider-fill": `${(lineWidth / 12) * 100}%`,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );

  return nestedContainer ? (
    <details style={nestedDetailsStyle} data-testid="layer-isobands-controls">
      <summary style={panelStyles.summary}>{title}</summary>
      {content}
    </details>
  ) : (
    content
  );
}
