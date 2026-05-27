import type React from "react";
import { panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  sliderNumberReadoutStyle,
} from "../../styleControls";
import type { EditableStyle } from "../../../pages/types";
import {
  isVelocityProduct,
  seismicColormapFromValue,
  seismicWindowValueLabel,
  type SeismicProductOption,
} from "./seismicModel";

interface SeismicProductDisplayVariablesProps {
  product: SeismicProductOption;
  active: boolean;
  disabled: boolean;
  controlOpacity: number;
  sliceAxis: NonNullable<EditableStyle["seismicSliceAxis"]>;
  sliceFraction: number;
  seismicOpacity: number;
  amplitudeMin: number;
  amplitudeMax: number;
  amplitudeGamma: number;
  colormap: NonNullable<EditableStyle["seismicColormap"]>;
  removeBackground: boolean;
  backgroundCutoff: number;
  volumeSampleSteps: number;
  timeScale: number;
  commit: (patch: Partial<EditableStyle>) => void;
}

export function SeismicProductDisplayVariables({
  product,
  active,
  disabled,
  controlOpacity,
  sliceAxis,
  sliceFraction,
  seismicOpacity,
  amplitudeMin,
  amplitudeMax,
  amplitudeGamma,
  colormap,
  removeBackground,
  backgroundCutoff,
  volumeSampleSteps,
  timeScale,
  commit,
}: SeismicProductDisplayVariablesProps) {
  const windowMinLabel = isVelocityProduct(product) ? "Vel min" : "Amp min";
  const windowMaxLabel = isVelocityProduct(product) ? "Vel max" : "Amp max";
  const productControlActive = (_product: SeismicProductOption) => active;
  return (
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>Product variables</summary>
        <div style={detailsContentStyle}>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Slice</label>
            <select
              data-testid={`seismic-capability-slice-axis-${product.id}`}
              value={productControlActive(product) ? sliceAxis : "inline"}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({
                  seismicSliceAxis: e.target.value as NonNullable<
                    EditableStyle["seismicSliceAxis"]
                  >,
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="inline">Inline</option>
              <option value="crossline">Crossline</option>
              <option value="sample">Time/depth plane</option>
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Position</label>
            <input
              data-testid={`seismic-capability-slice-position-${product.id}`}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sliceFraction}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicSliceFraction: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${sliceFraction * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sliceFraction.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Opacity</label>
            <input
              data-testid={`seismic-capability-opacity-${product.id}`}
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={seismicOpacity}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) => commit({ opacity: parseFloat(e.target.value) })}
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${seismicOpacity * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicOpacity.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>{windowMinLabel}</label>
            <input
              data-testid={`seismic-capability-amplitude-min-${product.id}`}
              type="range"
              min={0}
              max={0.98}
              step={0.01}
              value={amplitudeMin}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicAmplitudeMin: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${amplitudeMin * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(product, amplitudeMin)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>{windowMaxLabel}</label>
            <input
              data-testid={`seismic-capability-amplitude-max-${product.id}`}
              type="range"
              min={0.02}
              max={1}
              step={0.01}
              value={amplitudeMax}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicAmplitudeMax: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${amplitudeMax * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(product, amplitudeMax)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Gain curve</label>
            <input
              data-testid={`seismic-capability-amplitude-gamma-${product.id}`}
              type="range"
              min={0.35}
              max={2.5}
              step={0.05}
              value={amplitudeGamma}
              disabled={disabled || !productControlActive(product)}
              onInput={(e) =>
                commit({
                  seismicAmplitudeGamma: parseFloat(
                    (e.currentTarget as HTMLInputElement).value,
                  ),
                })
              }
              onChange={(e) =>
                commit({ seismicAmplitudeGamma: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${((amplitudeGamma - 0.35) / 2.15) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {amplitudeGamma.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Palette</label>
            <select
              data-testid={`seismic-capability-colormap-${product.id}`}
              value={colormap}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({
                  seismicColormap: seismicColormapFromValue(e.target.value),
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="blue-white-red">Blue-white-red</option>
              <option value="grayscale">Grayscale</option>
              <option value="velocity">Velocity</option>
            </select>
          </div>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>White bg</span>
            <input
              data-testid={`seismic-capability-remove-background-${product.id}`}
              type="checkbox"
              checked={removeBackground}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicRemoveBackground: e.target.checked })
              }
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
              remove neutral fill
            </span>
          </label>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Zero mute</label>
            <input
              data-testid={`seismic-capability-background-cutoff-${product.id}`}
              type="range"
              min={0}
              max={0.45}
              step={0.01}
              value={backgroundCutoff}
              disabled={
                disabled || !productControlActive(product) || !removeBackground
              }
              onChange={(e) =>
                commit({ seismicBackgroundCutoff: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity:
                    productControlActive(product) && removeBackground
                      ? controlOpacity
                      : 0.35,
                  "--editor-slider-fill": `${(backgroundCutoff / 0.45) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {backgroundCutoff.toFixed(2)}
            </span>
          </div>
          {product.raymarchCapable ? (
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Ray steps</label>
              <input
                data-testid={`seismic-capability-volume-sample-steps-${product.id}`}
                type="range"
                min={24}
                max={160}
                step={8}
                value={volumeSampleSteps}
                disabled={disabled || !productControlActive(product)}
                onInput={(e) =>
                  commit({
                    seismicVolumeSampleSteps: parseFloat(
                      (e.currentTarget as HTMLInputElement).value,
                    ),
                  })
                }
                onChange={(e) =>
                  commit({
                    seismicVolumeSampleSteps: parseFloat(e.target.value),
                  })
                }
                style={
                  {
                    flex: 1,
                    opacity: productControlActive(product)
                      ? controlOpacity
                      : 0.35,
                    "--editor-slider-fill": `${((volumeSampleSteps - 24) / 136) * 100}%`,
                  } as React.CSSProperties
                }
              />
              <span style={sliderNumberReadoutStyle}>{volumeSampleSteps}</span>
            </div>
          ) : null}
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Time scale</label>
            <input
              data-testid={`seismic-capability-time-scale-${product.id}`}
              type="range"
              min={0.25}
              max={8}
              step={0.25}
              value={timeScale}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicTimeScale: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${((timeScale - 0.25) / 7.75) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{timeScale.toFixed(2)}</span>
          </div>
        </div>
      </details>
    );

}
