import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useRef } from "react";
import { useEditor } from "../editor/EditorContext";
import {
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  legendCheckboxStyle,
  legendControlRowStyle,
  resolveLegendTextColors,
  transparentLegendPanelStyle,
} from "./legendStyles";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import { effectiveStyle, effectiveVisibility } from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { EditableStyle, PresentationPage } from "../pages/types";

const UTAH_FORGE_PROJECT_SLUG = "utah-forge";
const SEISMIC_LAYER_ID = "utah-forge-phase3-seismic-browser";
const HANDLE_GAP = 0.01;
const LEGEND_HANDLE_FILL = "#f4f5f7";

const rootStyle: CSSProperties = {
  ...transparentLegendPanelStyle,
  left: LEGEND_PAGE_EDGE_MARGIN_PX,
  bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX + 450,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.15,
  fontWeight: 700,
};

const subtitleStyle: CSSProperties = {
  marginTop: 5,
  fontSize: 10,
  lineHeight: 1.25,
};

const rampWrapStyle: CSSProperties = {
  position: "relative",
  height: 23,
  marginTop: 10,
  touchAction: "none",
};

const rampStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 13,
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.22)",
  overflow: "hidden",
};

const ticksStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  marginTop: 8,
  fontSize: 10,
  lineHeight: 1.25,
  fontVariantNumeric: "tabular-nums",
};

const fineControlsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  marginTop: 10,
};

const fineControlLabelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 9,
  lineHeight: 1.1,
};

const footerStyle: CSSProperties = {
  marginTop: 9,
  fontSize: 10,
  lineHeight: 1.25,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function styleNumber(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: number,
): number {
  const value = style[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function styleBoolean(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
}

function amplitudeColor(t: number, palette: EditableStyle["seismicColormap"]): string {
  const c = clamp(t, 0, 1);
  if (palette === "grayscale") {
    const channel = Math.round(c * 255);
    return `rgb(${channel}, ${channel}, ${channel})`;
  }
  if (palette === "velocity") {
    if (c < 0.33) {
      const k = c / 0.33;
      const r = Math.round(23 + (51 - 23) * k);
      const g = Math.round(59 + (182 - 59) * k);
      const b = Math.round(154 + (215 - 154) * k);
      return `rgb(${r}, ${g}, ${b})`;
    }
    if (c < 0.66) {
      const k = (c - 0.33) / 0.33;
      const r = Math.round(51 + (244 - 51) * k);
      const g = Math.round(182 + (223 - 182) * k);
      const b = Math.round(215 + (99 - 215) * k);
      return `rgb(${r}, ${g}, ${b})`;
    }
    const k = (c - 0.66) / 0.34;
    const r = Math.round(244 + (211 - 244) * k);
    const g = Math.round(223 + (75 - 223) * k);
    const b = Math.round(99 + (45 - 99) * k);
    return `rgb(${r}, ${g}, ${b})`;
  }
  if (c < 0.5) {
    const k = c / 0.5;
    const r = Math.round(36 + (244 - 36) * k);
    const g = Math.round(86 + (247 - 86) * k);
    const b = Math.round(201 + (255 - 201) * k);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const k = (c - 0.5) / 0.5;
  const r = Math.round(244 + (217 - 244) * k);
  const g = Math.round(247 + (54 - 247) * k);
  const b = Math.round(255 + (47 - 255) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

function handleStyle(leftPercent: number, inner: boolean): CSSProperties {
  return {
    position: "absolute",
    left: `${leftPercent}%`,
    top: 0,
    width: 7,
    height: 20,
    borderRadius: 999,
    transform: "translateX(-50%)",
    background: LEGEND_HANDLE_FILL,
    border: "1px solid rgba(0, 0, 0, 0.48)",
    padding: 0,
    cursor: "ew-resize",
    pointerEvents: "auto",
    zIndex: inner ? 4 : 3,
    boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.32)",
    touchAction: "none",
  };
}

function sliderStyle(value: number, min: number, max: number): CSSProperties {
  return {
    width: "100%",
    "--editor-slider-fill": `${clamp(((value - min) / (max - min)) * 100, 0, 100)}%`,
  } as CSSProperties;
}

interface SeismicLegendProductInfo {
  label: string;
  productKind?: string;
  domainKind?: string;
  amplitudeStats?: {
    min?: number;
    max?: number;
    p02?: number;
    p98?: number;
    mean?: number;
  };
}

function productInfo(
  layer: { metadata?: Record<string, unknown> } | undefined,
  id: string,
): SeismicLegendProductInfo {
  const products = layer?.metadata?.seismicProducts;
  if (!Array.isArray(products)) return { label: id };
  const product = products.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      (candidate as Record<string, unknown>).id === id,
  ) as Record<string, unknown> | undefined;
  const label = typeof product?.label === "string" ? product.label : id;
  return {
    label: label
      .replace(/\bFORGE\s*3D\b/gi, "3D")
      .replace(/\bForge3D\b/g, "3D")
      .replace(/\bForge3d\b/g, "3D")
      .replace(/\s+/g, " ")
      .trim(),
    productKind:
      typeof product?.productKind === "string" ? product.productKind : undefined,
    domainKind:
      typeof product?.domainKind === "string" ? product.domainKind : undefined,
    amplitudeStats:
      product?.amplitudeStats &&
      typeof product.amplitudeStats === "object" &&
      !Array.isArray(product.amplitudeStats)
        ? (product.amplitudeStats as SeismicLegendProductInfo["amplitudeStats"])
        : undefined,
  };
}

function seismicColormapFromStyle(
  value: EditableStyle["seismicColormap"],
): NonNullable<EditableStyle["seismicColormap"]> {
  return value === "grayscale" || value === "velocity"
    ? value
    : "blue-white-red";
}

function velocityValueLabel(
  stats: SeismicLegendProductInfo["amplitudeStats"],
  normalized: number,
): string {
  const min = typeof stats?.p02 === "number" ? stats.p02 : stats?.min;
  const max = typeof stats?.p98 === "number" ? stats.p98 : stats?.max;
  if (typeof min !== "number" || typeof max !== "number" || max <= min) {
    return normalized.toFixed(2);
  }
  return `${Math.round(min + (max - min) * normalized).toLocaleString()} m/s`;
}

type AmplitudeHandle = "min" | "max";

export function SeismicVolumeLegend({
  stacked = false,
  pageOverride = null,
}: {
  stacked?: boolean;
  pageOverride?: PresentationPage | null;
}) {
  const { state, sceneHandle, setEnvLayerStyle, setPageLayerOverride } =
    useEditor();
  const { pages, currentIndex, transitionFrame } = usePageController();
  const rampRef = useRef<HTMLDivElement | null>(null);
  if (state.projectSlug !== UTAH_FORGE_PROJECT_SLUG) return null;
  const legendTextColors = resolveLegendTextColors(
    state.environment.scene?.gui?.overlay,
  );

  const targetIndex = transitionFrame.targetIndex;
  const controllerPage =
    pageOverride ??
    pages[targetIndex ?? transitionFrame.sourceIndex] ??
    pages[transitionFrame.sourceIndex] ??
    pages[currentIndex];
  const editingEnvironment = state.selectedPageId === ENVIRONMENT_SENTINEL;
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
  const visible = editingEnvironment
    ? new Set(state.environment.defaultVisibleLayers)
    : page
      ? effectiveVisibility(state.environment, page)
      : new Set<string>();
  if (!visible.has(SEISMIC_LAYER_ID)) return null;

  const layer = state.manifest.layers.find((candidate) => candidate.id === SEISMIC_LAYER_ID);
  const style = editingEnvironment
    ? state.environment.layerStyles[SEISMIC_LAYER_ID] ?? {}
    : page
      ? effectiveStyle(state.environment, page, SEISMIC_LAYER_ID)
      : state.environment.layerStyles[SEISMIC_LAYER_ID] ?? {};
  if (!styleBoolean(style, "seismicLegendVisible", true)) return null;

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

  const selectedProductInfo = productInfo(layer, productId);
  const isVelocity =
    selectedProductInfo.productKind === "velocity" ||
    selectedProductInfo.domainKind === "velocity-time";
  const palette = seismicColormapFromStyle(style.seismicColormap);
  const ampMin = clamp(styleNumber(style, "seismicAmplitudeMin", 0.08), 0, 0.98);
  const ampMax = clamp(
    Math.max(ampMin + HANDLE_GAP, styleNumber(style, "seismicAmplitudeMax", 0.92)),
    ampMin + HANDLE_GAP,
    1,
  );
  const opacity = clamp(styleNumber(style, "opacity", 0.62), 0, 1);
  const gamma = clamp(styleNumber(style, "seismicAmplitudeGamma", 1), 0.35, 2.5);
  const backgroundCutoff = clamp(
    styleNumber(style, "seismicBackgroundCutoff", 0.16),
    0,
    0.45,
  );
  const sampleSteps = clamp(
    styleNumber(style, "seismicVolumeSampleSteps", 96),
    24,
    160,
  );
  const removeBackground = styleBoolean(style, "seismicRemoveBackground", false);
  const minPercent = ampMin * 100;
  const maxPercent = ampMax * 100;
  const displayMode = style.seismicRenderMode === "raymarch" ? "Raymarch volume" : "Section slice";
  const lowTick = isVelocity
    ? velocityValueLabel(selectedProductInfo.amplitudeStats, ampMin)
    : ampMin.toFixed(2);
  const midTick = isVelocity
    ? velocityValueLabel(selectedProductInfo.amplitudeStats, (ampMin + ampMax) / 2)
    : ((ampMin + ampMax) / 2).toFixed(2);
  const highTick = isVelocity
    ? velocityValueLabel(selectedProductInfo.amplitudeStats, ampMax)
    : ampMax.toFixed(2);

  const patchStyle = (patch: Partial<EditableStyle>) => {
    sceneHandle.manager.applyStyle(SEISMIC_LAYER_ID, { ...style, ...patch });
    if (editingEnvironment || !page) {
      setEnvLayerStyle(SEISMIC_LAYER_ID, patch);
    } else {
      setPageLayerOverride(page.id, SEISMIC_LAYER_ID, patch);
    }
  };
  const valueFromClientX = (clientX: number): number | null => {
    const rect = rampRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  };
  const setAmplitude = (handle: AmplitudeHandle, value: number) => {
    if (handle === "min") {
      patchStyle({ seismicAmplitudeMin: clamp(value, 0, ampMax - HANDLE_GAP) });
    } else {
      patchStyle({ seismicAmplitudeMax: clamp(value, ampMin + HANDLE_GAP, 1) });
    }
  };
  const beginDrag =
    (handle: AmplitudeHandle) =>
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const firstValue = valueFromClientX(event.clientX);
      if (firstValue !== null) setAmplitude(handle, firstValue);
      const onMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const nextValue = valueFromClientX(moveEvent.clientX);
        if (nextValue !== null) setAmplitude(handle, nextValue);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    };

  return (
    <aside
      style={{
        ...rootStyle,
        ...(stacked ? { position: "relative", left: "auto", bottom: "auto" } : {}),
      }}
      aria-label="Utah FORGE seismic volume legend"
    >
      <h2 style={{ ...titleStyle, color: legendTextColors.heading }}>
        {isVelocity ? "Seismic velocity" : "Seismic amplitude"}
      </h2>
      <div style={{ ...subtitleStyle, color: legendTextColors.subtext }}>
        {displayMode} - {isVelocity ? "interval velocity model" : "source-normalized amplitude"}
      </div>
      <div
        ref={rampRef}
        style={rampWrapStyle}
        data-testid="seismic-legend-track"
      >
        <div
          style={{
            ...rampStyle,
            background: `linear-gradient(90deg, ${amplitudeColor(
              0,
              palette,
            )} 0%, ${amplitudeColor(0.5, palette)} 50%, ${amplitudeColor(
              1,
              palette,
            )} 100%)`,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 0,
              width: `${minPercent}%`,
              top: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.62)",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: `${maxPercent}%`,
              right: 0,
              top: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.62)",
            }}
          />
        </div>
        <button
          type="button"
          aria-label="Seismic amplitude minimum"
          data-testid="seismic-legend-amp-min"
          onPointerDown={beginDrag("min")}
          style={handleStyle(minPercent, false)}
        />
        <button
          type="button"
          aria-label="Seismic amplitude maximum"
          data-testid="seismic-legend-amp-max"
          onPointerDown={beginDrag("max")}
          style={handleStyle(maxPercent, false)}
        />
      </div>
      <div style={{ ...ticksStyle, color: legendTextColors.body }}>
        <span>{lowTick}</span>
        <span style={{ textAlign: "center" }}>{midTick}</span>
        <span style={{ textAlign: "right" }}>{highTick}</span>
      </div>
      <div style={{ ...footerStyle, color: legendTextColors.subtext }}>
        {selectedProductInfo.label}
        {isVelocity ? (
          <>
            <br />
            Velocity window {lowTick}-{highTick}
          </>
        ) : null}
      </div>
      <div style={fineControlsStyle}>
        <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
          Opacity {Math.round(opacity * 100)}%
          <input
            data-testid="seismic-legend-opacity"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(event) => patchStyle({ opacity: parseFloat(event.target.value) })}
            style={sliderStyle(opacity, 0, 1)}
          />
        </label>
        <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
          Gain {gamma.toFixed(2)}
          <input
            data-testid="seismic-legend-gamma"
            type="range"
            min={0.35}
            max={2.5}
            step={0.05}
            value={gamma}
            onChange={(event) =>
              patchStyle({ seismicAmplitudeGamma: parseFloat(event.target.value) })
            }
            style={sliderStyle(gamma, 0.35, 2.5)}
          />
        </label>
        <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
          Steps {Math.round(sampleSteps)}
          <input
            data-testid="seismic-legend-sample-steps"
            type="range"
            min={24}
            max={160}
            step={8}
            value={sampleSteps}
            onChange={(event) =>
              patchStyle({
                seismicVolumeSampleSteps: parseFloat(event.target.value),
              })
            }
            style={sliderStyle(sampleSteps, 24, 160)}
          />
        </label>
      </div>
      <div style={{ ...fineControlsStyle, gridTemplateColumns: "1fr 1fr" }}>
        <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
          Palette
          <select
            data-testid="seismic-legend-palette"
            value={palette}
            style={{ color: legendTextColors.body }}
            onChange={(event) =>
              patchStyle({
                seismicColormap:
                  seismicColormapFromStyle(
                    event.target.value as EditableStyle["seismicColormap"],
                  ),
              })
            }
          >
            <option value="blue-white-red">Blue-white-red</option>
            <option value="grayscale">Grayscale</option>
            <option value="velocity">Velocity</option>
          </select>
        </label>
        <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
          Zero mute {backgroundCutoff.toFixed(2)}
          <input
            data-testid="seismic-legend-background-cutoff"
            type="range"
            min={0}
            max={0.45}
            step={0.01}
            value={backgroundCutoff}
            disabled={!removeBackground}
            onChange={(event) =>
              patchStyle({
                seismicBackgroundCutoff: parseFloat(event.target.value),
              })
            }
            style={sliderStyle(backgroundCutoff, 0, 0.45)}
          />
        </label>
      </div>
      <label
        style={{
          ...legendControlRowStyle(),
          color: legendTextColors.body,
          fontSize: 10,
        }}
      >
        <input
          data-testid="seismic-legend-remove-background"
          type="checkbox"
          checked={removeBackground}
          onChange={(event) =>
            patchStyle({ seismicRemoveBackground: event.target.checked })
          }
          style={legendCheckboxStyle(removeBackground, {
            checkedColor: legendTextColors.heading,
          })}
        />
        Remove neutral background
      </label>
    </aside>
  );
}
