import type { CSSProperties } from "react";
import { useEditor } from "../editor/EditorContext";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import {
  effectiveStyle,
  effectiveVisibility,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { EditableStyle } from "../pages/types";
import {
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import { resolveTopoMapSettings } from "../topoMap/settings";
import {
  LEGEND_PAGE_EDGE_MARGIN_PX,
  LEGEND_PANEL_WIDTH_PX,
  resolveLegendTextColors,
} from "./legendStyles";
import { selectedLegendAuthoringPage } from "./legendAuthoringTarget";
import {
  buildSeismicPresentationLegendModel,
  seismicPresentationColor,
  type SeismicPresentationSliceAxis,
} from "./seismicPresentationLegendModel";
import type { SceneHandle } from "../scene";

const titleStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: 0,
  whiteSpace: "nowrap",
};

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
  whiteSpace: "nowrap",
};

const chipStyle: CSSProperties = {
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const segmentGroupStyle: CSSProperties = {
  display: "inline-flex",
  gap: 4,
  minWidth: 0,
};

const sliderStyle: CSSProperties = {
  width: 132,
  minWidth: 96,
  flex: "1 1 132px",
};

function styleBoolean(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
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
}: {
  sceneHandle: SceneHandle;
}) {
  const {
    state,
    setEnvLayerStyle,
    setPageLayerOverride,
    canApplyLiveSceneEdits,
  } = useEditor();
  const { pages, currentIndex, transitionFrame } = usePageController();
  const layer = state.manifest.layers.find(
    (candidate) => candidate.id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  );
  if (!layer) return null;

  const targetIndex = transitionFrame.targetIndex;
  const controllerPage =
    pages[targetIndex ?? transitionFrame.sourceIndex] ??
    pages[transitionFrame.sourceIndex] ??
    pages[currentIndex] ??
    null;
  const authoringPage = selectedLegendAuthoringPage(state);
  const selectedPage =
    state.selectedPageId !== ENVIRONMENT_SENTINEL &&
    !transitionFrame.active &&
    state.selectedPageId
      ? state.pages.find((candidate) => candidate.id === state.selectedPageId) ?? null
      : null;
  const page = transitionFrame.active && targetIndex !== null
    ? controllerPage
    : selectedPage ?? controllerPage;
  const writePage = authoringPage ?? page;
  const allPages = [...state.pages, ...state.archivedPages];
  const pageEnvironment = page
    ? resolveEnvironmentForPage(state.environment, allPages, page)
    : state.environment;
  const visible = page
    ? effectiveVisibility(pageEnvironment, page)
    : new Set(state.environment.defaultVisibleLayers);

  const style = page
    ? effectiveStyle(pageEnvironment, page, UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID)
    : pageEnvironment.layerStyles[UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID] ?? {};
  const activePreset = activePresetForStyle(layer, style);
  const presetPresentationBarVisible =
    activePreset &&
    typeof activePreset === "object" &&
    (activePreset as { presentationBarVisible?: unknown }).presentationBarVisible === true;
  if (!visible.has(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) && style.seismicPresentationBarVisible !== true) {
    return null;
  }
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
  const editorSettings = state.environment.scene?.gui?.editor ?? {};
  const rightInset = state.presenterMode
    ? 76
    : (editorSettings.panelWidthPx ?? 512) + (editorSettings.panelMarginPx ?? 20) + 24;
  const leftInset = LEGEND_PAGE_EDGE_MARGIN_PX + LEGEND_PANEL_WIDTH_PX + 26;

  const patchStyle = (patch: Partial<EditableStyle>) => {
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID, {
        ...style,
        ...patch,
      });
    }
    if (writePage) {
      setPageLayerOverride(writePage.id, UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID, patch);
    } else {
      setEnvLayerStyle(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID, patch);
    }
  };

  const setSliceAxis = (axis: SeismicPresentationSliceAxis) => {
    patchStyle({ seismicSliceAxis: axis });
  };

  return (
    <aside
      aria-label="Utah FORGE seismic presentation legend bar"
      data-testid="seismic-presentation-legend-bar"
      style={{
        position: "absolute",
        zIndex: 19,
        left: leftInset,
        right: Math.max(76, rightInset),
        bottom: 72,
        minWidth: 360,
        maxWidth: 880,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        boxSizing: "border-box",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid rgba(255, 255, 255, 0.18)",
        background: "rgba(5, 9, 14, 0.68)",
        boxShadow: "0 10px 28px rgba(0, 0, 0, 0.24)",
        backdropFilter: "blur(10px) saturate(130%)",
        WebkitBackdropFilter: "blur(10px) saturate(130%)",
        pointerEvents: "auto",
        color: legendTextColors.body,
      }}
    >
      <div style={{ display: "grid", gap: 5, minWidth: 210, flex: "1 1 210px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ ...titleStyle, color: legendTextColors.heading }}>
            Presentation-enhanced PSDM surrogate
          </span>
          <span
            style={{
              ...chipStyle,
              color: "#071016",
              background: "rgba(143, 215, 255, 0.86)",
            }}
          >
            {model.provenanceTag}
          </span>
        </div>
        <div
          style={{
            fontSize: 10,
            lineHeight: 1.15,
            color: legendTextColors.subtext,
          }}
        >
          GDR 1141, unenhanced source - {model.productLabel}
        </div>
      </div>

      <div style={{ display: "grid", gap: 4, minWidth: 160, flex: "1 1 160px" }}>
        <div style={{ ...compactLabelStyle, color: legendTextColors.subtext }}>
          {model.amplitudeLabel}
        </div>
        <div
          aria-label={`${model.amplitudeMinLabel} ${model.amplitudeMaxLabel}`}
          style={{
            height: 9,
            borderRadius: 999,
            border: "1px solid rgba(255, 255, 255, 0.24)",
            background: `linear-gradient(90deg, ${seismicPresentationColor(
              0,
              model.colormap,
            )} 0%, ${seismicPresentationColor(0.5, model.colormap)} 50%, ${seismicPresentationColor(
              1,
              model.colormap,
            )} 100%)`,
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
            color: legendTextColors.body,
            fontSize: 10,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>{model.amplitudeMinLabel}</span>
          <span style={{ textAlign: "center" }}>{model.amplitudeMidLabel}</span>
          <span style={{ textAlign: "right" }}>{model.amplitudeMaxLabel}</span>
        </div>
      </div>

      {infoBlock({
        label: model.velocityReferenceLabel,
        value: `${model.velocityMinLabel}-${model.velocityMaxLabel}`,
        colors: legendTextColors,
      })}
      {infoBlock({
        label: "Datum",
        value: "Depth metres / 1,800 m",
        colors: legendTextColors,
      })}
      {infoBlock({
        label: "Context",
        value: `Scale 1 km / N / ${model.verticalExaggerationLabel}`,
        colors: legendTextColors,
      })}

      <div
        style={{
          display: "grid",
          gap: 5,
          minWidth: 220,
          flex: "1 1 240px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ ...compactLabelStyle, color: legendTextColors.subtext }}>
            Slice scrub
          </span>
          <span style={{ ...compactValueStyle, color: legendTextColors.heading }}>
            {model.sliceReadout}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                onClick={() => setSliceAxis(axis as SeismicPresentationSliceAxis)}
                style={segmentButtonStyle(model.sliceAxis === axis, legendTextColors)}
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
                seismicSliceFraction: Number.parseFloat(event.currentTarget.value),
              })
            }
            style={
              {
                ...sliderStyle,
                "--editor-slider-fill": `${model.sliceFraction * 100}%`,
              } as CSSProperties
            }
          />
        </div>
      </div>
    </aside>
  );
}
