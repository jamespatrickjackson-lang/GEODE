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
  type PageStyleClearer,
  type PageStyleSetter,
} from "../../styleControls";
import type { EditableStyle, PresentationPage, ProjectLayerSpec } from "../../../pages/types";
import type { SceneHandle } from "../../../scene";
import { SCALAR_SOURCE_MAX, SCALAR_SOURCE_MIN } from "../scalarSourceRange";
import { IsobandControls } from "./IsobandControls";
function prefixMtDimension(label: string, dimension: "2D" | "3D"): string {
  const trimmed = label.trim();
  if (/^(2D|3D)\b/i.test(trimmed)) return trimmed;
  return `${dimension} ${trimmed}`;
}

interface MtVolumeProductOption {
  id: string;
  label: string;
  description?: string;
}

function mtVolumeProductOptions(
  layer: ProjectLayerSpec,
): MtVolumeProductOption[] {
  const raw = (layer.metadata as { volumeProducts?: unknown }).volumeProducts;
  if (Array.isArray(raw)) {
    const options: MtVolumeProductOption[] = [];
    for (const item of raw) {
      const product = item as {
        id?: unknown;
        label?: unknown;
        description?: unknown;
      };
      if (typeof product.id !== "string") continue;
      options.push({
        id: product.id,
        label:
          typeof product.label === "string"
            ? prefixMtDimension(product.label, "3D")
            : prefixMtDimension(product.id, "3D"),
        description:
          typeof product.description === "string"
            ? product.description
            : undefined,
      });
    }
    if (options.length > 0) return options;
  }
  return [
    {
      id: "mt-resistivity-forge-focused-volume",
      label: "3D MT resistivity FORGE-focused volume",
    },
    {
      id: "mt-resistivity-full-extent-volume",
      label: "3D MT resistivity full-source volume",
    },
  ];
}

export function MtVolumeControls({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  sceneSectionStyle,
  sceneHandle,
  onToggleOverride,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  sceneSectionStyle: EditableStyle;
  sceneHandle: SceneHandle;
  onToggleOverride?: (enabled: boolean) => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const options = mtVolumeProductOptions(layer);
  const fallbackProduct =
    options[0]?.id ?? "mt-resistivity-forge-focused-volume";
  const selected = options.some(
    (option) => option.id === style.scalarVolumeProductId,
  )
    ? (style.scalarVolumeProductId as string)
    : fallbackProduct;
  const opacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "scalarVolumeOpacity", 0.48)),
  );
  const density = Math.max(
    0,
    Math.min(2, styleNumber(style, "scalarVolumeDensity", 0.72)),
  );
  const sampleSteps = Math.max(
    24,
    Math.min(192, styleNumber(style, "scalarVolumeSampleSteps", 112)),
  );
  const transferMode =
    style.scalarVolumeTransferMode === "soft" ||
    style.scalarVolumeTransferMode === "dense"
      ? style.scalarVolumeTransferMode
      : "balanced";
  const thresholdMin = Math.max(
    SCALAR_SOURCE_MIN,
    Math.min(
      SCALAR_SOURCE_MAX - 0.01,
      styleNumber(style, "scalarVolumeThresholdMin", SCALAR_SOURCE_MIN),
    ),
  );
  const thresholdMax = Math.max(
    thresholdMin + 0.01,
    Math.min(
      SCALAR_SOURCE_MAX,
      styleNumber(style, "scalarVolumeThresholdMax", SCALAR_SOURCE_MAX),
    ),
  );
  const maskVisible = styleBoolean(style, "scalarVolumeMaskVisible", true);
  const controlOpacity = disabled ? 0.4 : 1;
  const commit = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  const range = SCALAR_SOURCE_MAX - SCALAR_SOURCE_MIN;
  const fill = (value: number) =>
    `${Math.max(0, Math.min(100, ((value - SCALAR_SOURCE_MIN) / range) * 100))}%`;

  return (
    <>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>3D MT Resistivity Volume</summary>
        <div style={detailsContentStyle}>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Volume product</label>
            {!isEnv ? (
              <input
                type="checkbox"
                checked={!disabled}
                onChange={(e) => onToggleOverride?.(e.target.checked)}
                title="Override environment MT volume controls for this page"
              />
            ) : null}
            <select
              data-testid="mt-volume-product-select"
              value={selected}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  scalarVolumeProductId: e.target.value,
                  scalarVolumeRenderMode: "raymarch",
                })
              }
              style={{ flex: 1, opacity: controlOpacity }}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Volume opacity</label>
            <input
              data-testid="mt-volume-opacity"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={opacity}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  scalarVolumeOpacity: parseFloat(e.target.value),
                  opacity: parseFloat(e.target.value),
                })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${opacity * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Volume attenuation</label>
            <input
              data-testid="mt-volume-density"
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={density}
              disabled={disabled}
              onChange={(e) =>
                commit({ scalarVolumeDensity: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${(density / 2) * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Ray samples</label>
            <input
              data-testid="mt-volume-samples"
              type="range"
              min={24}
              max={192}
              step={4}
              value={sampleSteps}
              disabled={disabled}
              onChange={(e) =>
                commit({ scalarVolumeSampleSteps: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${((sampleSteps - 24) / (192 - 24)) * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Transfer function</label>
            <select
              data-testid="mt-volume-transfer"
              value={transferMode}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  scalarVolumeTransferMode: e.target
                    .value as EditableStyle["scalarVolumeTransferMode"],
                })
              }
              style={{ flex: 1, opacity: controlOpacity }}
            >
              <option value="soft">Soft</option>
              <option value="balanced">Balanced</option>
              <option value="dense">Dense</option>
            </select>
          </div>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Empty-cell mask</span>
            <input
              data-testid="mt-volume-mask-visible"
              type="checkbox"
              checked={maskVisible}
              disabled={disabled}
              onChange={(e) =>
                commit({ scalarVolumeMaskVisible: e.target.checked })
              }
              style={{ opacity: controlOpacity }}
            />
            <span
              style={{ flex: 1, color: vibrancyTertiaryLabel, fontSize: 11 }}
            >
              hide empty voxels
            </span>
          </label>
        </div>
      </details>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>Volume threshold window</summary>
        <div style={detailsContentStyle}>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Min log10(Ohm-m)</label>
            <input
              data-testid="mt-volume-threshold-min"
              type="range"
              min={SCALAR_SOURCE_MIN}
              max={SCALAR_SOURCE_MAX}
              step={0.01}
              value={thresholdMin}
              disabled={disabled}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                commit({
                  scalarVolumeThresholdMin: next,
                  scalarVolumeThresholdMax: Math.max(thresholdMax, next + 0.01),
                });
              }}
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": fill(thresholdMin),
                } as React.CSSProperties
              }
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Max log10(Ohm-m)</label>
            <input
              data-testid="mt-volume-threshold-max"
              type="range"
              min={SCALAR_SOURCE_MIN}
              max={SCALAR_SOURCE_MAX}
              step={0.01}
              value={thresholdMax}
              disabled={disabled}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                commit({
                  scalarVolumeThresholdMin: Math.min(thresholdMin, next - 0.01),
                  scalarVolumeThresholdMax: next,
                });
              }}
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": fill(thresholdMax),
                } as React.CSSProperties
              }
            />
          </div>
        </div>
      </details>
      <IsobandControls
        title="3D iso-resistivity bands"
        style={style}
        disabled={disabled}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        rangeKind="mt"
        volumePlanes
        sceneSectionStyle={sceneSectionStyle}
        sceneHandle={sceneHandle}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
      />
    </>
  );
}

