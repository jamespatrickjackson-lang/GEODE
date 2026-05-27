import type React from "react";
import { panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  drillingAssayDetailsStyle,
  drillingAssaySummaryStyle,
  EnvSelectRow,
  EnvStyleRow,
  EzGammaCheckboxRow,
  nestedControlRowStyle,
  nestedFieldLabelStyle,
  styleBoolean,
  styleNumber,
  styleString,
} from "../../styleControls";
import type { AreaOutlineDef, EditableStyle } from "../../../pages/types";
import { LABEL_KIND_OPTIONS } from "../labelKindOptions";

const AREA_OUTLINE_MODE_OPTIONS = [
  { value: "terrain3d", label: "3D terrain" },
  { value: "flat2d", label: "2D flat" },
] as const;

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

const areaOutlineButtonStackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
  margin: "6px 0 10px",
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

export function AreaOutlinesControls({
  outlines,
  viewCenter,
  onChange,
}: {
  outlines: AreaOutlineDef[];
  viewCenter: [number, number];
  onChange: (outlines: AreaOutlineDef[]) => void;
}) {
  const updateOutline = (id: string, patch: Partial<AreaOutlineDef>) => {
    onChange(
      outlines.map((outline) =>
        outline.id === id ? { ...outline, ...patch } : outline,
      ),
    );
  };
  const addOutline = () => {
    const index = outlines.length + 1;
    const id = `area-outline-${Date.now().toString(36)}`;
    onChange([
      ...outlines,
      {
        id,
        label: `Area outline ${index}`,
        center: viewCenter,
        radiusX: 850,
        radiusY: 520,
        rotationDeg: 0,
        liftMeters: 18,
        fillVisible: true,
        fillColor: "#ff8a3d",
        fillOpacity: 0.18,
        outlineVisible: true,
        outlineColor: "#ff8a3d",
        outlineOpacity: 0.95,
        outlineWidthM: 14,
        dashed: true,
        outlineMode: "terrain3d",
        dashLengthM: 170,
        dashGapM: 90,
        labelKind: "area",
      },
    ]);
  };
  const duplicateOutline = (source: AreaOutlineDef, index: number) => {
    const center = source.center ?? viewCenter;
    onChange([
      ...outlines.slice(0, index + 1),
      {
        ...source,
        id: `area-outline-${Date.now().toString(36)}`,
        label: `${source.label || `Area outline ${index + 1}`} duplicate`,
        center: [center[0] + 80, center[1] + 80],
      },
      ...outlines.slice(index + 1),
    ]);
  };
  const removeOutline = (id: string) => {
    onChange(outlines.filter((outline) => outline.id !== id));
  };

  return (
    <div style={ezGammaControlsStyle}>
      <div style={areaOutlineButtonStackStyle}>
        <button
          type="button"
          className="editor-action-button"
          style={panelStyles.button}
          onClick={addOutline}
        >
          Add outline
        </button>
      </div>
      {outlines.length === 0 ? (
        <p style={panelStyles.helpText}>
          Add an outline to rough in a boundary as a ground-parallel ellipse.
        </p>
      ) : null}
      {outlines.map((outline, index) => (
        <details key={outline.id} style={drillingAssayDetailsStyle}>
          <summary style={drillingAssaySummaryStyle}>
            {outline.label || `Area outline ${index + 1}`}
          </summary>
          <div style={detailsContentStyle}>
            <EnvTextRow
              label="Name"
              value={outline.label}
              onChange={(value) => updateOutline(outline.id, { label: value })}
            />
            <EnvStyleRow
              label="Center E"
              inputType="number"
              value={String(Math.round(outline.center?.[0] ?? viewCenter[0]))}
              step={10}
              onChange={(value) => {
                const next = [...(outline.center ?? viewCenter)] as [
                  number,
                  number,
                ];
                next[0] = parseFloat(value);
                updateOutline(outline.id, { center: next });
              }}
            />
            <EnvStyleRow
              label="Center N"
              inputType="number"
              value={String(Math.round(outline.center?.[1] ?? viewCenter[1]))}
              step={10}
              onChange={(value) => {
                const next = [...(outline.center ?? viewCenter)] as [
                  number,
                  number,
                ];
                next[1] = parseFloat(value);
                updateOutline(outline.id, { center: next });
              }}
            />
            <div style={areaOutlineButtonStackStyle}>
              <button
                type="button"
                className="editor-action-button"
                style={panelStyles.button}
                onClick={() =>
                  updateOutline(outline.id, { center: viewCenter })
                }
              >
                Move center
              </button>
            </div>
            <EnvStyleRow
              label="Width X"
              inputType="range"
              value={String(outline.radiusX ?? 850)}
              min={50}
              max={5000}
              step={25}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { radiusX: parseFloat(value) })
              }
            />
            <EnvStyleRow
              label="Width Y"
              inputType="range"
              value={String(outline.radiusY ?? 520)}
              min={50}
              max={5000}
              step={25}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { radiusY: parseFloat(value) })
              }
            />
            <EnvStyleRow
              label="Rotation"
              inputType="range"
              value={String(outline.rotationDeg ?? 0)}
              min={-180}
              max={180}
              step={1}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { rotationDeg: parseFloat(value) })
              }
            />
            <EnvStyleRow
              label="Lift"
              inputType="range"
              value={String(outline.liftMeters ?? 18)}
              min={0}
              max={120}
              step={1}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { liftMeters: parseFloat(value) })
              }
            />
            <EnvSelectRow
              label="Line mode"
              value={outline.outlineMode ?? "terrain3d"}
              options={AREA_OUTLINE_MODE_OPTIONS}
              onChange={(value) =>
                updateOutline(outline.id, { outlineMode: value })
              }
            />

            <details style={drillingAssayDetailsStyle}>
              <summary style={drillingAssaySummaryStyle}>Infill</summary>
              <div style={detailsContentStyle}>
                <EzGammaCheckboxRow
                  label="Visible"
                  checked={outline.fillVisible !== false}
                  onChange={(checked) =>
                    updateOutline(outline.id, { fillVisible: checked })
                  }
                />
                <EnvStyleRow
                  label="Color"
                  inputType="color"
                  value={outline.fillColor ?? "#ff8a3d"}
                  onChange={(value) =>
                    updateOutline(outline.id, { fillColor: value })
                  }
                />
                <EnvStyleRow
                  label="Alpha"
                  inputType="range"
                  value={String(outline.fillOpacity ?? 0.18)}
                  min={0}
                  max={1}
                  step={0.02}
                  decimals={2}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      fillOpacity: parseFloat(value),
                    })
                  }
                />
              </div>
            </details>

            <details style={drillingAssayDetailsStyle}>
              <summary style={drillingAssaySummaryStyle}>Outline</summary>
              <div style={detailsContentStyle}>
                <EzGammaCheckboxRow
                  label="Visible"
                  checked={outline.outlineVisible !== false}
                  onChange={(checked) =>
                    updateOutline(outline.id, { outlineVisible: checked })
                  }
                />
                <EnvStyleRow
                  label="Color"
                  inputType="color"
                  value={outline.outlineColor ?? "#ff8a3d"}
                  onChange={(value) =>
                    updateOutline(outline.id, { outlineColor: value })
                  }
                />
                <EnvStyleRow
                  label="Alpha"
                  inputType="range"
                  value={String(outline.outlineOpacity ?? 0.95)}
                  min={0}
                  max={1}
                  step={0.02}
                  decimals={2}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      outlineOpacity: parseFloat(value),
                    })
                  }
                />
                <EnvStyleRow
                  label="Width"
                  inputType="range"
                  value={String(outline.outlineWidthM ?? 14)}
                  min={1}
                  max={80}
                  step={1}
                  decimals={0}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      outlineWidthM: parseFloat(value),
                    })
                  }
                />
                <EzGammaCheckboxRow
                  label="Dashed"
                  checked={outline.dashed !== false}
                  onChange={(checked) =>
                    updateOutline(outline.id, { dashed: checked })
                  }
                />
                <EnvStyleRow
                  label="Dash len."
                  inputType="range"
                  value={String(outline.dashLengthM ?? 170)}
                  min={10}
                  max={900}
                  step={10}
                  decimals={0}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      dashLengthM: parseFloat(value),
                    })
                  }
                />
                <EnvStyleRow
                  label="Dash gap"
                  inputType="range"
                  value={String(outline.dashGapM ?? 90)}
                  min={0}
                  max={600}
                  step={10}
                  decimals={0}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      dashGapM: parseFloat(value),
                    })
                  }
                />
              </div>
            </details>

            <EnvSelectRow
              label="Label style"
              value={outline.labelKind ?? "area"}
              options={LABEL_KIND_OPTIONS}
              onChange={(value) =>
                updateOutline(outline.id, {
                  labelKind: value as AreaOutlineDef["labelKind"],
                })
              }
            />
            <div style={areaOutlineButtonStackStyle}>
              <button
                type="button"
                className="editor-action-button"
                style={panelStyles.button}
                onClick={() => duplicateOutline(outline, index)}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="editor-action-button"
                style={panelStyles.button}
                onClick={() => removeOutline(outline.id)}
              >
                Remove
              </button>
            </div>
          </div>
        </details>
      ))}
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
