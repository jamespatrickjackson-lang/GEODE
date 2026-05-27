import type React from "react";
import { vibrancyTertiaryLabel } from "../../styles";
import {
  nestedControlRowStyle,
  nestedFieldLabelStyle,
  sliderNumberReadoutStyle,
  type LayerStyleSetter,
  type PageStyleSetter,
} from "../../styleControls";
import type { EditableStyle, PresentationPage } from "../../../pages/types";
import type { SceneHandle } from "../../../scene";
import { IsobandControls } from "../mt/IsobandControls";
import {
  isVelocityProduct,
  seismicColormapFromValue,
  seismicWindowValueLabel,
  type SeismicProductOption,
} from "./seismicModel";

export function SeismicDisplayTuningControls({
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  sceneSectionStyle,
  sceneHandle,
  selectedProduct,
  renderMode,
  amplitudeMin,
  amplitudeMax,
  amplitudeGamma,
  colormap,
  legendVisible,
  removeBackground,
  backgroundCutoff,
  volumeSampleSteps,
  timeScale,
  navigationVisible,
  controlOpacity,
  commit,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  sceneSectionStyle: EditableStyle;
  sceneHandle: SceneHandle;
  selectedProduct: SeismicProductOption | undefined;
  renderMode: "slice" | "raymarch";
  amplitudeMin: number;
  amplitudeMax: number;
  amplitudeGamma: number;
  colormap: NonNullable<EditableStyle["seismicColormap"]>;
  legendVisible: boolean;
  removeBackground: boolean;
  backgroundCutoff: number;
  volumeSampleSteps: number;
  timeScale: number;
  navigationVisible: boolean;
  controlOpacity: number;
  commit: (patch: Partial<EditableStyle>) => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
}) {
  return (
    <>
      <IsobandControls
        style={style}
        disabled={disabled}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        rangeKind="seismic"
        volumePlanes={
          selectedProduct?.raymarchCapable === true && renderMode === "raymarch"
        }
        sceneSectionStyle={sceneSectionStyle}
        sceneHandle={sceneHandle}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
      />

      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>
          {isVelocityProduct(selectedProduct) ? "Vel min" : "Amp min"}
        </label>
        <input
          data-testid="seismic-amplitude-min"
          type="range"
          min={0}
          max={0.98}
          step={0.01}
          value={amplitudeMin}
          disabled={disabled}
          onChange={(e) =>
            commit({ seismicAmplitudeMin: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${amplitudeMin * 100}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>
          {seismicWindowValueLabel(selectedProduct, amplitudeMin)}
        </span>
      </div>

      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>
          {isVelocityProduct(selectedProduct) ? "Vel max" : "Amp max"}
        </label>
        <input
          data-testid="seismic-amplitude-max"
          type="range"
          min={0.02}
          max={1}
          step={0.01}
          value={amplitudeMax}
          disabled={disabled}
          onChange={(e) =>
            commit({ seismicAmplitudeMax: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${amplitudeMax * 100}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>
          {seismicWindowValueLabel(selectedProduct, amplitudeMax)}
        </span>
      </div>

      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Gain curve</label>
        <input
          data-testid="seismic-amplitude-gamma"
          type="range"
          min={0.35}
          max={2.5}
          step={0.05}
          value={amplitudeGamma}
          disabled={disabled}
          onChange={(e) =>
            commit({ seismicAmplitudeGamma: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${
                ((amplitudeGamma - 0.35) / 2.15) * 100
              }%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{amplitudeGamma.toFixed(2)}</span>
      </div>

      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Palette</label>
        <select
          data-testid="seismic-colormap-select"
          value={colormap}
          disabled={disabled}
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
        <span style={nestedFieldLabelStyle}>Legend</span>
        <input
          data-testid="seismic-legend-visible"
          type="checkbox"
          checked={legendVisible}
          disabled={disabled}
          onChange={(e) => commit({ seismicLegendVisible: e.target.checked })}
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
          amplitude controls
        </span>
      </label>

      <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
        <span style={nestedFieldLabelStyle}>White bg</span>
        <input
          data-testid="seismic-remove-background"
          type="checkbox"
          checked={removeBackground}
          disabled={disabled}
          onChange={(e) => commit({ seismicRemoveBackground: e.target.checked })}
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
          data-testid="seismic-background-cutoff"
          type="range"
          min={0}
          max={0.45}
          step={0.01}
          value={backgroundCutoff}
          disabled={disabled || !removeBackground}
          onChange={(e) =>
            commit({ seismicBackgroundCutoff: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: removeBackground ? controlOpacity : 0.35,
              "--editor-slider-fill": `${(backgroundCutoff / 0.45) * 100}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>
          {backgroundCutoff.toFixed(2)}
        </span>
      </div>

      {selectedProduct?.raymarchCapable ? (
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Ray steps</label>
          <input
            data-testid="seismic-volume-sample-steps"
            type="range"
            min={24}
            max={160}
            step={8}
            value={volumeSampleSteps}
            disabled={disabled}
            onChange={(e) =>
              commit({
                seismicVolumeSampleSteps: parseFloat(e.target.value),
              })
            }
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${
                  ((volumeSampleSteps - 24) / 136) * 100
                }%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{volumeSampleSteps}</span>
        </div>
      ) : null}

      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Time scale</label>
        <input
          data-testid="seismic-time-scale"
          type="range"
          min={0.25}
          max={8}
          step={0.25}
          value={timeScale}
          disabled={disabled}
          onChange={(e) => commit({ seismicTimeScale: parseFloat(e.target.value) })}
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${((timeScale - 0.25) / 7.75) * 100}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{timeScale.toFixed(2)}</span>
      </div>

      <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
        <span style={nestedFieldLabelStyle}>Navigation</span>
        <input
          data-testid="seismic-navigation-visible"
          type="checkbox"
          checked={navigationVisible}
          disabled={disabled}
          onChange={(e) => commit({ seismicNavigationVisible: e.target.checked })}
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
          source/receiver lines
        </span>
      </label>
    </>
  );
}
