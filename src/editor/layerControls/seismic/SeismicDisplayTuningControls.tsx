import { vibrancyTertiaryLabel } from "../../styles";
import {
  editorDarkSelectStyle,
  nestedControlRowStyle,
  nestedFieldLabelStyle,
} from "../../styleControls";
import { TransientSlider } from "../../TransientSlider";
import type { EditableStyle } from "../../../pages/types";
import {
  isVelocityProduct,
  seismicColormapFromValue,
  seismicWindowValueLabel,
  type SeismicProductOption,
} from "./seismicModel";

export function SeismicDisplayTuningControls({
  disabled,
  selectedProduct,
  amplitudeMin,
  amplitudeMax,
  amplitudeGamma,
  colormap,
  legendVisible,
  presentationBarVisible,
  removeBackground,
  backgroundCutoff,
  volumeSampleSteps,
  timeScale,
  controlOpacity,
  commit,
}: {
  disabled: boolean;
  selectedProduct: SeismicProductOption | undefined;
  amplitudeMin: number;
  amplitudeMax: number;
  amplitudeGamma: number;
  colormap: NonNullable<EditableStyle["seismicColormap"]>;
  legendVisible: boolean;
  presentationBarVisible: boolean;
  removeBackground: boolean;
  backgroundCutoff: number;
  volumeSampleSteps: number;
  timeScale: number;
  controlOpacity: number;
  commit: (patch: Partial<EditableStyle>) => void;
}) {
  return (
    <>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>
          {isVelocityProduct(selectedProduct) ? "Vel min" : "Amp min"}
        </label>
        <TransientSlider
          testId="seismic-amplitude-min"
          min={0}
          max={0.98}
          step={0.01}
          value={amplitudeMin}
          disabled={disabled}
          onChange={(value) => commit({ seismicAmplitudeMin: value })}
          format={(value) => seismicWindowValueLabel(selectedProduct, value)}
          style={{ flex: 1, opacity: controlOpacity }}
        />
      </div>

      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>
          {isVelocityProduct(selectedProduct) ? "Vel max" : "Amp max"}
        </label>
        <TransientSlider
          testId="seismic-amplitude-max"
          min={0.02}
          max={1}
          step={0.01}
          value={amplitudeMax}
          disabled={disabled}
          onChange={(value) => commit({ seismicAmplitudeMax: value })}
          format={(value) => seismicWindowValueLabel(selectedProduct, value)}
          style={{ flex: 1, opacity: controlOpacity }}
        />
      </div>

      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Gain curve</label>
        <TransientSlider
          testId="seismic-amplitude-gamma"
          min={0.35}
          max={2.5}
          step={0.05}
          value={amplitudeGamma}
          disabled={disabled}
          onChange={(value) => commit({ seismicAmplitudeGamma: value })}
          format={(value) => value.toFixed(2)}
          style={{ flex: 1, opacity: controlOpacity }}
        />
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
          style={{ ...editorDarkSelectStyle, opacity: controlOpacity }}
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
        <span style={nestedFieldLabelStyle}>Presentation bar</span>
        <input
          data-testid="seismic-presentation-bar-visible"
          type="checkbox"
          checked={presentationBarVisible}
          disabled={disabled}
          onChange={(e) =>
            commit({ seismicPresentationBarVisible: e.target.checked })
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
          claim-safe readouts
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
        <TransientSlider
          testId="seismic-background-cutoff"
          min={0}
          max={0.45}
          step={0.01}
          value={backgroundCutoff}
          disabled={disabled || !removeBackground}
          onChange={(value) => commit({ seismicBackgroundCutoff: value })}
          format={(value) => value.toFixed(2)}
          style={{ flex: 1, opacity: removeBackground ? controlOpacity : 0.35 }}
        />
      </div>

      {selectedProduct?.raymarchCapable ? (
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Ray steps</label>
          <TransientSlider
            testId="seismic-volume-sample-steps"
            min={24}
            max={160}
            step={8}
            value={volumeSampleSteps}
            disabled={disabled}
            onChange={(value) => commit({ seismicVolumeSampleSteps: value })}
            format={(value) => value.toFixed(0)}
            style={{ flex: 1, opacity: controlOpacity }}
          />
        </div>
      ) : null}

      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Time scale</label>
        <TransientSlider
          testId="seismic-time-scale"
          min={0.25}
          max={8}
          step={0.25}
          value={timeScale}
          disabled={disabled}
          onChange={(value) => commit({ seismicTimeScale: value })}
          format={(value) => value.toFixed(2)}
          style={{ flex: 1, opacity: controlOpacity }}
        />
      </div>
    </>
  );
}
