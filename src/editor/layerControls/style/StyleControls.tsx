import type React from "react";
import { vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  drillingAssayDetailsStyle,
  drillingAssaySummaryStyle,
  EnvStyleRow,
  EzGammaCheckboxRow,
  nestedControlRowStyle,
  nestedFieldLabelStyle,
  styleBoolean,
  styleNumber,
  styleString,
} from "../../styleControls";
import type { EditableStyle } from "../../../pages/types";

const GEOCHEM_ELEMENT_OPTIONS = [
  { value: "cu_ppm", label: "Cu ppm" },
  { value: "au_ppm", label: "Au ppm" },
  { value: "mo_ppm", label: "Mo ppm" },
  { value: "ag_ppm", label: "Ag ppm" },
  { value: "as_ppm", label: "As ppm" },
  { value: "zn_ppm", label: "Zn ppm" },
  { value: "pb_ppm", label: "Pb ppm" },
  { value: "ni_ppm", label: "Ni ppm" },
] as const;

const ezGammaControlsStyle: React.CSSProperties = {
  marginTop: 10,
};

type GeochemElementValue = (typeof GEOCHEM_ELEMENT_OPTIONS)[number]["value"];

export function SurfaceGradientColorInput({
  label,
  value,
  disabled,
  opacity,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  opacity: number;
  onChange: (value: string) => void;
}) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        alignItems: "center",
        gap: 4,
        minWidth: 0,
        color: vibrancyTertiaryLabel,
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      <span>{label}</span>
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          minWidth: 24,
          opacity,
        }}
      />
    </label>
  );
}

export function EnvTextRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1 }}
      />
    </div>
  );
}

export function EzGammaSelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{ flex: 1, minWidth: 0 }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function EzGammaTubeControls({
  title,
  style,
  fields,
  defaults,
  onChange,
}: {
  title: string;
  style: EditableStyle;
  fields: {
    visible: keyof EditableStyle;
    color: keyof EditableStyle;
    opacity: keyof EditableStyle;
    radius: keyof EditableStyle;
    mode: keyof EditableStyle;
  };
  defaults: {
    color: string;
    opacity: number;
    radius: number;
    mode: "solid" | "dashed";
  };
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const mode =
    styleString(style, fields.mode, defaults.mode) === "dashed"
      ? "dashed"
      : "solid";
  return (
    <details style={drillingAssayDetailsStyle}>
      <summary style={drillingAssaySummaryStyle}>{title}</summary>
      <div style={detailsContentStyle}>
        <EzGammaCheckboxRow
          label="Visible"
          checked={styleBoolean(style, fields.visible, true)}
          onChange={(checked) => onChange({ [fields.visible]: checked })}
        />
        <EnvStyleRow
          label="Color"
          inputType="color"
          value={styleString(style, fields.color, defaults.color)}
          onChange={(value) => onChange({ [fields.color]: value })}
        />
        <EnvStyleRow
          label="Opacity"
          inputType="range"
          value={String(styleNumber(style, fields.opacity, defaults.opacity))}
          min={0}
          max={1}
          step={0.02}
          decimals={2}
          onChange={(value) =>
            onChange({ [fields.opacity]: parseFloat(value) })
          }
        />
        <EnvStyleRow
          label="Radius"
          inputType="range"
          value={String(styleNumber(style, fields.radius, defaults.radius))}
          min={0.5}
          max={36}
          step={0.5}
          decimals={1}
          onChange={(value) => onChange({ [fields.radius]: parseFloat(value) })}
        />
        <EzGammaSelectRow
          label="Body"
          value={mode}
          options={[
            { value: "solid", label: "Solid cylinder" },
            { value: "dashed", label: "Dashed cylinder" },
          ]}
          onChange={(value) => onChange({ [fields.mode]: value })}
        />
      </div>
    </details>
  );
}

export function GeochemStyleControls({
  style,
  onChange,
}: {
  style: EditableStyle;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const rawElement = styleString(style, "geochemElement", "cu_ppm");
  const element = GEOCHEM_ELEMENT_OPTIONS.some(
    (option) => option.value === rawElement,
  )
    ? (rawElement as GeochemElementValue)
    : "cu_ppm";
  return (
    <div style={ezGammaControlsStyle}>
      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Graduated symbols</summary>
        <div style={detailsContentStyle}>
          <EzGammaSelectRow
            label="Element"
            value={element}
            options={[...GEOCHEM_ELEMENT_OPTIONS]}
            onChange={(value) => onChange({ geochemElement: value })}
          />
          <EnvStyleRow
            label="Min radius"
            inputType="range"
            value={String(styleNumber(style, "geochemSymbolMinRadiusM", 45))}
            min={5}
            max={300}
            step={5}
            decimals={0}
            onChange={(value) =>
              onChange({ geochemSymbolMinRadiusM: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Max radius"
            inputType="range"
            value={String(styleNumber(style, "geochemSymbolMaxRadiusM", 160))}
            min={20}
            max={600}
            step={5}
            decimals={0}
            onChange={(value) =>
              onChange({ geochemSymbolMaxRadiusM: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Lift"
            inputType="range"
            value={String(styleNumber(style, "geochemLiftM", 24))}
            min={0}
            max={220}
            step={2}
            decimals={0}
            onChange={(value) => onChange({ geochemLiftM: parseFloat(value) })}
          />
          <EnvStyleRow
            label="Thick"
            inputType="range"
            value={String(styleNumber(style, "geochemSymbolThicknessM", 5))}
            min={0.5}
            max={45}
            step={0.5}
            decimals={1}
            onChange={(value) =>
              onChange({ geochemSymbolThicknessM: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Opacity"
            inputType="range"
            value={String(
              styleNumber(
                style,
                "geochemOpacity",
                styleNumber(style, "opacity", 0.92),
              ),
            )}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ geochemOpacity: parseFloat(value) })
            }
          />
          <EzGammaCheckboxRow
            label="Log scale"
            checked={styleBoolean(style, "geochemUseLogScale", true)}
            onChange={(checked) => onChange({ geochemUseLogScale: checked })}
          />
        </div>
      </details>

      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Anomaly palette</summary>
        <div style={detailsContentStyle}>
          <EnvStyleRow
            label="Low"
            inputType="color"
            value={styleString(style, "geochemPaletteLow", "#2b6cb0")}
            onChange={(value) => onChange({ geochemPaletteLow: value })}
          />
          <EnvStyleRow
            label="Mid"
            inputType="color"
            value={styleString(style, "geochemPaletteMid", "#f2cf43")}
            onChange={(value) => onChange({ geochemPaletteMid: value })}
          />
          <EnvStyleRow
            label="High"
            inputType="color"
            value={styleString(style, "geochemPaletteHigh", "#c92a2a")}
            onChange={(value) => onChange({ geochemPaletteHigh: value })}
          />
          <EzGammaCheckboxRow
            label="Outline"
            checked={styleBoolean(style, "geochemShowOutline", true)}
            onChange={(checked) => onChange({ geochemShowOutline: checked })}
          />
          <EnvStyleRow
            label="Outline color"
            inputType="color"
            value={styleString(style, "geochemOutlineColor", "#221f1c")}
            onChange={(value) => onChange({ geochemOutlineColor: value })}
          />
          <EnvStyleRow
            label="Outline opac."
            inputType="range"
            value={String(styleNumber(style, "geochemOutlineOpacity", 0.65))}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ geochemOutlineOpacity: parseFloat(value) })
            }
          />
        </div>
      </details>
    </div>
  );
}

export function HyperspectralStyleControls({
  style,
  onChange,
}: {
  style: EditableStyle;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  return (
    <div style={ezGammaControlsStyle}>
      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Coverage sleeves</summary>
        <div style={detailsContentStyle}>
          <EnvStyleRow
            label="Radius"
            inputType="range"
            value={String(styleNumber(style, "hyperspectralRadiusM", 18))}
            min={2}
            max={90}
            step={1}
            decimals={0}
            onChange={(value) =>
              onChange({ hyperspectralRadiusM: parseFloat(value) })
            }
          />
          <EzGammaCheckboxRow
            label="Endpoints"
            checked={styleBoolean(style, "hyperspectralEndpointVisible", true)}
            onChange={(checked) =>
              onChange({ hyperspectralEndpointVisible: checked })
            }
          />
          <EnvStyleRow
            label="End radius"
            inputType="range"
            value={String(
              styleNumber(style, "hyperspectralEndpointRadiusM", 30),
            )}
            min={2}
            max={140}
            step={1}
            decimals={0}
            onChange={(value) =>
              onChange({ hyperspectralEndpointRadiusM: parseFloat(value) })
            }
          />
        </div>
      </details>
    </div>
  );
}

export function ImageryLidarStyleControls({
  style,
  onChange,
}: {
  style: EditableStyle;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  return (
    <div style={ezGammaControlsStyle}>
      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Footprint markers</summary>
        <div style={detailsContentStyle}>
          <EzGammaCheckboxRow
            label="Corners"
            checked={styleBoolean(style, "imageryCornerVisible", true)}
            onChange={(checked) => onChange({ imageryCornerVisible: checked })}
          />
          <EnvStyleRow
            label="Corner radius"
            inputType="range"
            value={String(styleNumber(style, "imageryCornerRadiusM", 95))}
            min={0}
            max={240}
            step={5}
            decimals={0}
            onChange={(value) =>
              onChange({ imageryCornerRadiusM: parseFloat(value) })
            }
          />
        </div>
      </details>
    </div>
  );
}

export function EzGammaStyleControls({
  style,
  onChange,
}: {
  style: EditableStyle;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  return (
    <div style={ezGammaControlsStyle}>
      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Collar sphere</summary>
        <div style={detailsContentStyle}>
          <EzGammaCheckboxRow
            label="Visible"
            checked={styleBoolean(style, "gammaCollarVisible", true)}
            onChange={(checked) => onChange({ gammaCollarVisible: checked })}
          />
          <EnvStyleRow
            label="Color"
            inputType="color"
            value={styleString(style, "gammaCollarColor", "#9ee4ac")}
            onChange={(value) => onChange({ gammaCollarColor: value })}
          />
          <EnvStyleRow
            label="Opacity"
            inputType="range"
            value={String(styleNumber(style, "gammaCollarOpacity", 0.94))}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ gammaCollarOpacity: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Radius"
            inputType="range"
            value={String(styleNumber(style, "gammaCollarRadiusM", 14))}
            min={2}
            max={60}
            step={1}
            decimals={0}
            onChange={(value) =>
              onChange({ gammaCollarRadiusM: parseFloat(value) })
            }
          />
        </div>
      </details>

      <EzGammaTubeControls
        title="Survey cylinder"
        style={style}
        fields={{
          visible: "gammaSurveyTubeVisible",
          color: "gammaSurveyTubeColor",
          opacity: "gammaSurveyTubeOpacity",
          radius: "gammaSurveyTubeRadiusM",
          mode: "gammaSurveyTubeMode",
        }}
        defaults={{
          color: "#e7ddc7",
          opacity: 0.34,
          radius: 3.6,
          mode: "solid",
        }}
        onChange={onChange}
      />

      <EzGammaTubeControls
        title="Logged overburden"
        style={style}
        fields={{
          visible: "gammaLoggedOverburdenVisible",
          color: "gammaLoggedOverburdenColor",
          opacity: "gammaLoggedOverburdenOpacity",
          radius: "gammaLoggedOverburdenRadiusM",
          mode: "gammaLoggedOverburdenMode",
        }}
        defaults={{
          color: "#d2a35f",
          opacity: 0.42,
          radius: 7.9,
          mode: "solid",
        }}
        onChange={onChange}
      />

      <EzGammaTubeControls
        title="Bedrock cylinder"
        style={style}
        fields={{
          visible: "gammaBedrockIntervalVisible",
          color: "gammaBedrockIntervalColor",
          opacity: "gammaBedrockIntervalOpacity",
          radius: "gammaBedrockIntervalRadiusM",
          mode: "gammaBedrockIntervalMode",
        }}
        defaults={{
          color: "#75c878",
          opacity: 0.46,
          radius: 6.1,
          mode: "solid",
        }}
        onChange={onChange}
      />

      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Contact rings</summary>
        <div style={detailsContentStyle}>
          <EzGammaSelectRow
            label="Shape"
            value={
              styleString(style, "gammaContactShape", "torus") === "coin"
                ? "coin"
                : "torus"
            }
            options={[
              { value: "torus", label: "Torus ring" },
              { value: "coin", label: "Coin disc" },
            ]}
            onChange={(value) => onChange({ gammaContactShape: value })}
          />
          <EzGammaCheckboxRow
            label="Contact 1"
            checked={styleBoolean(style, "gammaContact1Visible", true)}
            onChange={(checked) => onChange({ gammaContact1Visible: checked })}
          />
          <EnvStyleRow
            label="C1 color"
            inputType="color"
            value={styleString(style, "gammaContact1Color", "#fff2bc")}
            onChange={(value) => onChange({ gammaContact1Color: value })}
          />
          <EnvStyleRow
            label="C1 opacity"
            inputType="range"
            value={String(styleNumber(style, "gammaContact1Opacity", 0.86))}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ gammaContact1Opacity: parseFloat(value) })
            }
          />
          <EzGammaCheckboxRow
            label="Contact 2"
            checked={styleBoolean(style, "gammaContact2Visible", true)}
            onChange={(checked) => onChange({ gammaContact2Visible: checked })}
          />
          <EnvStyleRow
            label="C2 color"
            inputType="color"
            value={styleString(style, "gammaContact2Color", "#e6d4a2")}
            onChange={(value) => onChange({ gammaContact2Color: value })}
          />
          <EnvStyleRow
            label="C2 opacity"
            inputType="range"
            value={String(styleNumber(style, "gammaContact2Opacity", 0.55))}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ gammaContact2Opacity: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Radius"
            inputType="range"
            value={String(styleNumber(style, "gammaContactRadiusM", 42))}
            min={6}
            max={120}
            step={1}
            decimals={0}
            onChange={(value) =>
              onChange({ gammaContactRadiusM: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Thick"
            inputType="range"
            value={String(styleNumber(style, "gammaContactThicknessM", 3.2))}
            min={0.4}
            max={18}
            step={0.2}
            decimals={1}
            onChange={(value) =>
              onChange({ gammaContactThicknessM: parseFloat(value) })
            }
          />
        </div>
      </details>

      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Gamma traces</summary>
        <div style={detailsContentStyle}>
          <EzGammaCheckboxRow
            label="Traces"
            checked={styleBoolean(style, "gammaTracesVisible", true)}
            onChange={(checked) => onChange({ gammaTracesVisible: checked })}
          />
          <EzGammaCheckboxRow
            label="Mirror side"
            checked={styleBoolean(style, "gammaMirrorTraceVisible", true)}
            onChange={(checked) =>
              onChange({ gammaMirrorTraceVisible: checked })
            }
          />
          <EzGammaCheckboxRow
            label="Red run"
            checked={styleBoolean(style, "gammaRedTraceVisible", true)}
            onChange={(checked) => onChange({ gammaRedTraceVisible: checked })}
          />
          <EnvStyleRow
            label="Red color"
            inputType="color"
            value={styleString(style, "gammaRedTraceColor", "#f04a45")}
            onChange={(value) => onChange({ gammaRedTraceColor: value })}
          />
          <EzGammaCheckboxRow
            label="Blue run"
            checked={styleBoolean(style, "gammaBlueTraceVisible", true)}
            onChange={(checked) => onChange({ gammaBlueTraceVisible: checked })}
          />
          <EnvStyleRow
            label="Blue color"
            inputType="color"
            value={styleString(style, "gammaBlueTraceColor", "#3576ff")}
            onChange={(value) => onChange({ gammaBlueTraceColor: value })}
          />
          <EnvStyleRow
            label="Trace opac."
            inputType="range"
            value={String(styleNumber(style, "gammaTraceOpacity", 0.92))}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ gammaTraceOpacity: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Trace width"
            inputType="range"
            value={String(
              styleNumber(
                style,
                "gammaTraceWidthPx",
                styleNumber(style, "lineWidth", 2.4),
              ),
            )}
            min={0.25}
            max={14}
            step={0.25}
            decimals={2}
            onChange={(value) =>
              onChange({ gammaTraceWidthPx: parseFloat(value) })
            }
          />
          <EzGammaCheckboxRow
            label="Back panel"
            checked={styleBoolean(style, "gammaPanelVisible", false)}
            onChange={(checked) => onChange({ gammaPanelVisible: checked })}
          />
          <EnvStyleRow
            label="Panel color"
            inputType="color"
            value={styleString(style, "gammaPanelColor", "#1d211a")}
            onChange={(value) => onChange({ gammaPanelColor: value })}
          />
        </div>
      </details>
    </div>
  );
}
