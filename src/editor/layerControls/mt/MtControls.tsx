import { useEffect, useState } from "react";
import type React from "react";
import { FROSTED_HAIRLINE, panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  EnvSelectRow,
  EzGammaCheckboxRow,
  LayerBooleanStyleControl,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  overrideTagActiveStyle,
  overrideTagStyle,
  sliderNumberReadoutStyle,
  styleBoolean,
  styleNumber,
  styleString,
  type LayerStyleSetter,
  type PageStyleClearer,
  type PageStyleSetter,
} from "../../styleControls";
import type { EditableStyle, PresentationPage, ProjectLayerSpec } from "../../../pages/types";
import type { SceneHandle } from "../../../scene";
import { appAssetUrl } from "../../../projects/projectPathsRuntime";
import {
  DEFAULT_MT_RESISTIVITY_SLICE_ID,
  MT_RESISTIVITY_SLICE_PRODUCTS,
  mtResistivitySliceById,
} from "../../../mtResistivity/sliceProducts";
import { SurfaceGradientColorInput } from "../style/StyleControls";
import { IsobandControls } from "./IsobandControls";
import {
  SURFACE_GRADIENT_DEFAULT_HIGH,
  SURFACE_GRADIENT_DEFAULT_LOW,
  SURFACE_GRADIENT_DEFAULT_MID,
} from "../surfaceGradientDefaults";

const miniInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72px minmax(0, 1fr)",
  gap: "4px 8px",
  alignItems: "baseline",
  margin: "6px 0",
  color: vibrancyTertiaryLabel,
  fontSize: 11,
  lineHeight: 1.25,
};

export function SurfaceGradientControls({
  style,
  disabled,
  isPageOverride,
  overridden,
  onToggleOverride,
  onChange,
}: {
  style: EditableStyle;
  disabled: boolean;
  isPageOverride: boolean;
  overridden: boolean;
  onToggleOverride?: (enabled: boolean) => void;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const lowColor = styleString(
    style,
    "surfaceGradientLowColor",
    SURFACE_GRADIENT_DEFAULT_LOW,
  );
  const midColor = styleString(
    style,
    "surfaceGradientMidColor",
    SURFACE_GRADIENT_DEFAULT_MID,
  );
  const highColor = styleString(
    style,
    "surfaceGradientHighColor",
    SURFACE_GRADIENT_DEFAULT_HIGH,
  );
  const midpoint = Math.max(
    0.05,
    Math.min(0.95, styleNumber(style, "surfaceGradientMidpoint", 0.5)),
  );
  const contrast = Math.max(
    0.35,
    Math.min(2.5, styleNumber(style, "surfaceGradientContrast", 1)),
  );
  const midpointFill = Math.max(0, Math.min(100, midpoint * 100));
  const contrastFill = Math.max(
    0,
    Math.min(100, ((contrast - 0.35) / (2.5 - 0.35)) * 100),
  );
  const controlOpacity = disabled ? 0.4 : 1;
  const gradientBackground = `linear-gradient(90deg, ${lowColor} 0%, ${midColor} ${midpointFill.toFixed(
    1,
  )}%, ${highColor} 100%)`;

  return (
    <>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Gradient</label>
        {isPageOverride ? (
          <input
            type="checkbox"
            checked={overridden}
            onChange={(e) => onToggleOverride?.(e.target.checked)}
            title="Override environment surface gradient for this page"
          />
        ) : null}
        <div
          style={{
            flex: 1,
            height: 14,
            borderRadius: 999,
            border: FROSTED_HAIRLINE,
            background: gradientBackground,
            opacity: controlOpacity,
          }}
        />
        {isPageOverride ? (
          <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
            {overridden ? "overridden" : "inherited"}
          </span>
        ) : null}
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Colors</label>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          <SurfaceGradientColorInput
            label="Low"
            value={lowColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ surfaceGradientLowColor: value })}
          />
          <SurfaceGradientColorInput
            label="Mid"
            value={midColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ surfaceGradientMidColor: value })}
          />
          <SurfaceGradientColorInput
            label="High"
            value={highColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ surfaceGradientHighColor: value })}
          />
        </div>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Midpoint</label>
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.01}
          value={midpoint}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              surfaceGradientMidpoint: parseFloat(e.target.value),
            })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${midpointFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{midpoint.toFixed(2)}</span>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Nuance</label>
        <input
          type="range"
          min={0.35}
          max={2.5}
          step={0.05}
          value={contrast}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              surfaceGradientContrast: parseFloat(e.target.value),
            })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${contrastFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{contrast.toFixed(2)}</span>
      </div>
    </>
  );
}


export function MtTopSurfaceControls({
  style,
  disabled,
  isPageOverride,
  overridden,
  onToggleOverride,
  onChange,
}: {
  style: EditableStyle;
  disabled: boolean;
  isPageOverride: boolean;
  overridden: boolean;
  onToggleOverride?: (enabled: boolean) => void;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const lift = Math.max(
    -3000,
    Math.min(3000, styleNumber(style, "meshSurfaceLiftM", 0)),
  );
  const wireframe = styleBoolean(style, "meshWireframe", false);
  const roughness = Math.max(
    0,
    Math.min(1, styleNumber(style, "meshRoughness", 0.72)),
  );
  const metalness = Math.max(
    0,
    Math.min(1, styleNumber(style, "meshMetalness", 0.02)),
  );
  const controlOpacity = disabled ? 0.4 : 1;
  const liftFill = ((lift + 3000) / 6000) * 100;

  return (
    <>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Top surface</label>
        {isPageOverride ? (
          <input
            type="checkbox"
            checked={overridden}
            onChange={(e) => onToggleOverride?.(e.target.checked)}
            title="Override environment top-surface variables for this page"
          />
        ) : null}
        <span
          style={{
            flex: 1,
            color: vibrancyTertiaryLabel,
            fontSize: 11,
            opacity: controlOpacity,
          }}
        >
          inferred MT topology
        </span>
        {isPageOverride ? (
          <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
            {overridden ? "overridden" : "inherited"}
          </span>
        ) : null}
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Surface lift</label>
        <input
          type="range"
          min={-3000}
          max={3000}
          step={25}
          value={lift}
          disabled={disabled}
          onChange={(e) =>
            onChange({ meshSurfaceLiftM: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${liftFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{lift.toFixed(0)} m</span>
      </div>
      <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
        <span style={nestedFieldLabelStyle}>Wireframe</span>
        <input
          type="checkbox"
          checked={wireframe}
          disabled={disabled}
          onChange={(e) => onChange({ meshWireframe: e.target.checked })}
          style={{ opacity: controlOpacity }}
        />
        <span style={{ flex: 1 }} />
      </label>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Roughness</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={roughness}
          disabled={disabled}
          onChange={(e) =>
            onChange({ meshRoughness: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${roughness * 100}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{roughness.toFixed(2)}</span>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Metalness</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={metalness}
          disabled={disabled}
          onChange={(e) =>
            onChange({ meshMetalness: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${metalness * 100}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{metalness.toFixed(2)}</span>
      </div>
    </>
  );
}


interface MtStationQcVariant {
  variant: string;
  frequencyHzMin: number | null;
  frequencyHzMax: number | null;
  spectraBlockCount: number;
  directResponseSections?: string[];
  responseCurvesAvailable?: boolean;
}

interface MtStationQcStation {
  stationId: string;
  displayName?: string;
  selectedVariant?: string;
  variants?: MtStationQcVariant[];
  qc?: {
    variantCount?: number;
    spectraBlockCount?: number;
    spectraRowCount?: number;
    frequencyHzMin?: number | null;
    frequencyHzMax?: number | null;
    responseCurvesAvailable?: boolean;
    responseCurveStatus?: string;
  };
}

interface MtStationQcPayload {
  stationCount: number;
  ediFileCount: number;
  spectraStations: number;
  responseCurveStations: number;
  frequencyHzRange: [number, number] | null;
  stations: MtStationQcStation[];
}

export function MtStationQcControls({
  layer,
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const [qc, setQc] = useState<MtStationQcPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const stationQcPath = (layer as { supportFiles?: Record<string, string> })
    .supportFiles?.stationQc;

  useEffect(() => {
    let cancelled = false;
    if (!stationQcPath) {
      setQc(null);
      setLoadError("Station QC artifact is not registered.");
      return;
    }
    fetch(appAssetUrl(stationQcPath))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<MtStationQcPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        setQc(payload);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setQc(null);
        setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [stationQcPath]);

  const selectedStationId =
    typeof style.mtStationQcSelectedStationId === "string"
      ? style.mtStationQcSelectedStationId
      : (qc?.stations?.[0]?.stationId ?? "");
  const selected = qc?.stations?.find(
    (station) => station.stationId === selectedStationId,
  );
  const commit = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };

  return (
    <details style={nestedDetailsStyle}>
      <summary style={panelStyles.summary}>2D MT station response / QC</summary>
      <div style={detailsContentStyle}>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Station</label>
          <select
            data-testid="mt-station-qc-select"
            value={selectedStationId}
            onChange={(e) =>
              commit({ mtStationQcSelectedStationId: e.target.value })
            }
            style={{ flex: 1 }}
          >
            {(qc?.stations ?? []).map((station) => (
              <option key={station.stationId} value={station.stationId}>
                {station.stationId}
              </option>
            ))}
          </select>
        </div>
        <div style={miniInfoGridStyle}>
          <span>Stations</span>
          <strong>{qc?.stationCount ?? "--"}</strong>
          <span>EDI files</span>
          <strong>{qc?.ediFileCount ?? "--"}</strong>
          <span>Freq. range</span>
          <strong>
            {qc?.frequencyHzRange
              ? `${qc.frequencyHzRange[0].toExponential(2)}-${qc.frequencyHzRange[1].toFixed(2)} Hz`
              : "--"}
          </strong>
          <span>Curves</span>
          <strong>{qc?.responseCurveStations ?? 0}</strong>
        </div>
        {selected ? (
          <div style={miniInfoGridStyle}>
            <span>Selected</span>
            <strong>{selected.stationId}</strong>
            <span>Variants</span>
            <strong>
              {selected.qc?.variantCount ?? selected.variants?.length ?? "--"}
            </strong>
            <span>Spectra</span>
            <strong>{selected.qc?.spectraBlockCount ?? "--"}</strong>
            <span>Coverage</span>
            <strong>
              {selected.qc?.frequencyHzMin && selected.qc?.frequencyHzMax
                ? `${selected.qc.frequencyHzMin.toExponential(2)}-${selected.qc.frequencyHzMax.toFixed(2)} Hz`
                : "--"}
            </strong>
          </div>
        ) : null}
        <div style={{ ...panelStyles.muted, lineHeight: 1.35 }}>
          {selected?.qc?.responseCurveStatus ??
            loadError ??
            "Spectra metadata is parsed; apparent resistivity/phase curves are shown only when directly present in source EDI."}
        </div>
      </div>
    </details>
  );
}

export function ResistivitySliceControls({
  style,
  isEnv,
  currentPage,
  layerId,
  sceneHandle,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
}: {
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  sceneHandle: SceneHandle;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const visibility =
    typeof style.resistivitySliceVisibility === "object" &&
    style.resistivitySliceVisibility !== null
      ? (style.resistivitySliceVisibility as Record<string, boolean>)
      : {};
  const sliceMode = style.resistivitySliceMode === "single" ? "single" : "stack";
  const selectedSliceId =
    mtResistivitySliceById(style.resistivitySelectedSliceId)?.id ??
    DEFAULT_MT_RESISTIVITY_SLICE_ID;
  const selectedSliceIndex = Math.max(
    0,
    MT_RESISTIVITY_SLICE_PRODUCTS.findIndex(
      (product) => product.id === selectedSliceId,
    ),
  );
  const selectedSlice =
    MT_RESISTIVITY_SLICE_PRODUCTS[selectedSliceIndex] ??
    MT_RESISTIVITY_SLICE_PRODUCTS[0];
  const sliceSelectOptions = MT_RESISTIVITY_SLICE_PRODUCTS.map((product) => ({
    value: product.id,
    label: product.label,
  }));
  const updateSliceStyle = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  const setSelectedSlice = (id: string) => {
    updateSliceStyle({
      resistivitySliceMode: "single",
      resistivitySelectedSliceId: id,
    });
  };
  const setSliceVisible = (id: string, checked: boolean) => {
    const next = { ...visibility, [id]: checked };
    updateSliceStyle({ resistivitySliceVisibility: next });
  };

  return (
    <>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>2D slice products</summary>
        <div style={detailsContentStyle}>
          <EnvSelectRow<"stack" | "single">
            label="Mode"
            value={sliceMode}
            testId="mt-slice-mode"
            options={[
              { value: "stack", label: "Stack" },
              { value: "single", label: "Single slice" },
            ]}
            onChange={(value) =>
              updateSliceStyle({
                resistivitySliceMode: value,
                resistivitySelectedSliceId: selectedSliceId,
              })
            }
          />
          <EnvSelectRow<string>
            label="Active slice"
            value={selectedSlice.id}
            testId="mt-slice-select"
            options={sliceSelectOptions}
            onChange={setSelectedSlice}
          />
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Depth slider</label>
            <input
              type="range"
              min={0}
              max={MT_RESISTIVITY_SLICE_PRODUCTS.length - 1}
              step={1}
              value={selectedSliceIndex}
              data-testid="mt-slice-depth-slider"
              onChange={(event) => {
                const next =
                  MT_RESISTIVITY_SLICE_PRODUCTS[
                    Number.parseInt(event.target.value, 10)
                  ] ?? MT_RESISTIVITY_SLICE_PRODUCTS[0];
                setSelectedSlice(next.id);
              }}
              style={{ flex: 1 }}
            />
            <span style={sliderNumberReadoutStyle}>{selectedSlice.label}</span>
          </div>
          <LayerBooleanStyleControl
            label="Horiz. slices"
            field="resistivityHorizontalSlicesVisible"
            fallback={true}
            style={style}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
            clearPageLayerOverride={clearPageLayerOverride}
          />
          <LayerBooleanStyleControl
            label="Vertical sections"
            field="resistivityVerticalSectionsVisible"
            fallback={true}
            style={style}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
            clearPageLayerOverride={clearPageLayerOverride}
          />
          <LayerBooleanStyleControl
            label="Top trace"
            field="resistivitySectionTopTraceVisible"
            fallback={true}
            style={style}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
            clearPageLayerOverride={clearPageLayerOverride}
          />
          <details style={nestedDetailsStyle}>
            <summary style={panelStyles.summary}>Slice visibility</summary>
            <div style={detailsContentStyle}>
              {MT_RESISTIVITY_SLICE_PRODUCTS.map((option) => (
                <EzGammaCheckboxRow
                  key={option.id}
                  label={option.label}
                  checked={visibility[option.id] !== false}
                  onChange={(checked) => setSliceVisible(option.id, checked)}
                />
              ))}
              {!isEnv && currentPage ? (
                <button
                  type="button"
                  style={panelStyles.secondaryButton}
                  onClick={() =>
                    clearPageLayerOverride(
                      currentPage.id,
                      layerId,
                      "resistivitySliceVisibility",
                    )
                  }
                >
                  Clear page slice override
                </button>
              ) : null}
            </div>
          </details>
        </div>
      </details>
      <IsobandControls
        title="2D isobands"
        style={style}
        disabled={false}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        rangeKind="mt"
        sceneHandle={sceneHandle}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
      />
    </>
  );
}

export { IsobandControls } from "./IsobandControls";
export { MtThresholdSurfaceControls } from "./MtThresholdSurfaceControls";
export { MtVolumeControls } from "./MtVolumeControls";
