import { vibrancyTertiaryLabel } from "../../styles";
import {
  EditorCompactSegmentedRow,
  detailsContentStyle,
  editorDarkSelectStyle,
  nestedControlRowStyle,
  nestedFieldLabelStyle,
} from "../../styleControls";
import type { EditableStyle, ProjectLayerSpec } from "../../../pages/types";
import { UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID } from "../../../projectModules/utahForge/layerIds";
import { SeismicCapabilityLayerItem } from "./SeismicCapabilityLayerItem";
import {
  isVelocityProduct,
  seismicAudienceModeFromStyle,
  seismicAudiencePresets,
  seismicPresetPatch,
  SEISMIC_AUDIENCE_MODE_OPTIONS,
  SEISMIC_DEMO_DISCLOSURE_LABELS,
  type SeismicProductOption,
} from "./seismicModel";

export function SeismicAudienceAndDataConfidenceControls({
  layer,
  style,
  products,
  productId,
  selectedProduct,
  raymarchProductCount,
  renderMode,
  amplitudeMin,
  currentCapabilityPresetId,
  disabled,
  controlOpacity,
  commit,
  commitLayerStyle,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  products: SeismicProductOption[];
  productId: string;
  selectedProduct: SeismicProductOption | undefined;
  raymarchProductCount: number;
  renderMode: "slice" | "raymarch";
  amplitudeMin: number;
  currentCapabilityPresetId: string;
  disabled: boolean;
  controlOpacity: number;
  commit: (patch: Partial<EditableStyle>) => void;
  commitLayerStyle: (targetLayerId: string, patch: Partial<EditableStyle>) => void;
}) {
  const presets = seismicAudiencePresets(layer);
  const audienceMode = seismicAudienceModeFromStyle(style);
  const selectedPreset =
    presets.find((preset) => preset.id === style.seismicAudiencePresetId) ??
    presets.find((preset) => preset.audienceMode === audienceMode) ??
    presets[0];

  const applyPreset = (presetId: string) => {
    const preset = presets.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    commit(seismicPresetPatch(preset, products, productId));
    if (preset.mtStylePatch) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        preset.mtStylePatch,
      );
    }
  };
  const applyAudienceMode = (
    value: NonNullable<EditableStyle["seismicAudienceMode"]>,
  ) => {
    const preset = presets.find((candidate) => candidate.audienceMode === value);
    if (preset) {
      applyPreset(preset.id);
      return;
    }
    commit({ seismicAudienceMode: value });
  };

  return (
    <>
      {presets.length > 0 ? (
        <SeismicCapabilityLayerItem
          testId="seismic-capability-audience"
          title="Audience"
          type="preset"
        >
          <div style={detailsContentStyle}>
            <EditorCompactSegmentedRow
              label="Audience"
              value={audienceMode}
              testId="seismic-audience-mode-select"
              disabled={disabled}
              controlOpacity={controlOpacity}
              ariaLabel="Seismic audience mode"
              options={SEISMIC_AUDIENCE_MODE_OPTIONS}
              onChange={applyAudienceMode}
            />
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Preset</label>
              <select
                data-testid="seismic-audience-preset-select"
                value={selectedPreset?.id ?? ""}
                disabled={disabled}
                onChange={(e) => applyPreset(e.target.value)}
                style={{ ...editorDarkSelectStyle, opacity: controlOpacity }}
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </SeismicCapabilityLayerItem>
      ) : null}

      <SeismicCapabilityLayerItem
        testId="seismic-capability-data-confidence"
        title="Data confidence"
        type="metadata"
      >
        <div
          style={{
            color: vibrancyTertiaryLabel,
            fontSize: 11,
            lineHeight: 1.35,
          }}
        >
          <div>Products: {products.length} processed GUI products</div>
          <div>3D raymarch-capable: {raymarchProductCount}</div>
          <div>RenderMode: {renderMode}</div>
          <div>Audience: {audienceMode}</div>
          <div>
            {isVelocityProduct(selectedProduct) ? "Vel min" : "Amp min"}:{" "}
            {amplitudeMin.toFixed(2)}
          </div>
          <div>
            Active capability: {currentCapabilityPresetId || "manual controls"}
          </div>
          <div>{SEISMIC_DEMO_DISCLOSURE_LABELS.join(" / ")}</div>
        </div>
      </SeismicCapabilityLayerItem>
    </>
  );
}
