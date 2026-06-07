import type React from "react";
import type { EditableStyle, PresentationPage } from "../../../pages/types";
import { TransientSlider } from "../../TransientSlider";
import {
  type LayerStyleSetter,
  type PageStyleClearer,
  type PageStyleSetter,
  nestedControlRowStyle,
  nestedFieldLabelStyle,
  OverrideStateIndicator,
  styleBoolean,
  styleNumber,
  styleString,
} from "../../styleControls";
import { vibrancySecondaryLabel } from "../../styles";

type AtmosphereSubtype = NonNullable<EditableStyle["atmosphereSubtype"]>;
type AtmosphereBoundsMode = NonNullable<EditableStyle["atmosphereBoundsMode"]>;

type AtmosphereNumberField =
  | "atmosphereBoundsCenterX"
  | "atmosphereBoundsCenterY"
  | "atmosphereBoundsCenterZ"
  | "atmosphereBoundsSizeX"
  | "atmosphereBoundsSizeY"
  | "atmosphereBoundsSizeZ"
  | "atmosphereDensity"
  | "atmosphereSoftness"
  | "atmospherePuffCount"
  | "atmospherePuffScaleM"
  | "atmosphereScaleJitter"
  | "atmosphereVerticalFalloff"
  | "atmosphereEdgeFade"
  | "atmosphereSeed"
  | "atmosphereDriftSpeedMps"
  | "atmosphereDriftDirectionX"
  | "atmosphereDriftDirectionY"
  | "atmosphereDriftDirectionZ"
  | "atmosphereRenderOrder"
  | "opacity";

type AtmosphereBooleanField =
  | "atmosphereDriftEnabled"
  | "atmosphereDepthTest"
  | "atmosphereBoundsHelperVisible";

const SUBTYPE_OPTIONS = [
  { value: "mist", label: "Mist" },
  { value: "ground-fog", label: "Ground fog" },
  { value: "cloud-bank", label: "Cloud bank" },
  { value: "steam-plume", label: "Steam plume" },
] as const satisfies readonly { value: AtmosphereSubtype; label: string }[];

const BOUNDS_MODE_OPTIONS = [
  { value: "box", label: "Box" },
  { value: "ellipsoid", label: "Ellipsoid" },
] as const satisfies readonly { value: AtmosphereBoundsMode; label: string }[];

const sectionLabelStyle: React.CSSProperties = {
  color: vibrancySecondaryLabel,
  fontSize: 11,
  fontWeight: 700,
  margin: "10px 0 4px",
};

const fieldLabelStyle: React.CSSProperties = {
  ...nestedFieldLabelStyle,
  width: 112,
};

const controlSectionStyle: React.CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 6,
  margin: "8px 0",
  overflow: "hidden",
  background: "rgba(255, 255, 255, 0.035)",
};

const controlSectionSummaryStyle: React.CSSProperties = {
  ...sectionLabelStyle,
  cursor: "pointer",
  listStyle: "none",
  margin: 0,
  padding: "7px 9px",
};

const controlSectionContentStyle: React.CSSProperties = {
  padding: "2px 8px 8px",
};

function patchField(
  field: keyof EditableStyle,
  value: EditableStyle[keyof EditableStyle],
): Partial<EditableStyle> {
  return { [field]: value } as Partial<EditableStyle>;
}

function normalSubtype(value: string): AtmosphereSubtype {
  return SUBTYPE_OPTIONS.some((option) => option.value === value)
    ? (value as AtmosphereSubtype)
    : "mist";
}

function normalBoundsMode(value: string): AtmosphereBoundsMode {
  return BOUNDS_MODE_OPTIONS.some((option) => option.value === value)
    ? (value as AtmosphereBoundsMode)
    : "box";
}

function ControlOverrideRow({
  overridden,
  disabled,
  onToggle,
}: {
  overridden: boolean;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
      <span style={fieldLabelStyle}>Page override</span>
      <input
        type="checkbox"
        checked={overridden}
        disabled={disabled}
        data-testid="atmosphere-volume-override"
        onChange={(event) => onToggle(event.target.checked)}
      />
      <OverrideStateIndicator active={overridden} />
    </label>
  );
}

function SelectRow<T extends string>({
  label,
  value,
  options,
  disabled,
  testId,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled: boolean;
  testId: string;
  onChange: (value: T) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={fieldLabelStyle}>{label}</label>
      <select
        value={value}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value as T)}
        style={{ flex: 1, minWidth: 0, opacity: disabled ? 0.45 : 1 }}
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

function ColorRow({
  label,
  value,
  disabled,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  testId: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={fieldLabelStyle}>{label}</label>
      <input
        type="color"
        value={value}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
        style={{ opacity: disabled ? 0.45 : 1 }}
      />
    </div>
  );
}

function NumberRow({
  label,
  value,
  min,
  max,
  step,
  decimals,
  disabled,
  testId,
  inputMode = "range",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  disabled: boolean;
  testId: string;
  inputMode?: "range" | "number";
  onChange: (value: number) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={fieldLabelStyle}>{label}</label>
      {inputMode === "range" ? (
        <TransientSlider
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          testId={testId}
          onChange={onChange}
          format={(next) => next.toFixed(decimals)}
          style={{ flex: 1, opacity: disabled ? 0.45 : 1 }}
        />
      ) : (
        <input
          type="number"
          value={String(value)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          data-testid={testId}
          onChange={(event) => {
            const next = parseFloat(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          style={{ flex: 1, minWidth: 0, opacity: disabled ? 0.45 : 1 }}
        />
      )}
    </div>
  );
}

function BooleanRow({
  label,
  checked,
  disabled,
  testId,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  testId: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
      <span style={fieldLabelStyle}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function ControlSection({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <details open style={controlSectionStyle} data-testid={testId}>
      <summary style={controlSectionSummaryStyle}>{label}</summary>
      <div style={controlSectionContentStyle}>{children}</div>
    </details>
  );
}

export function atmosphereVolumePatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    atmosphereSubtype: normalSubtype(
      styleString(style, "atmosphereSubtype", "mist"),
    ),
    atmosphereBoundsMode: normalBoundsMode(
      styleString(style, "atmosphereBoundsMode", "box"),
    ),
    color: styleString(style, "color", "#dfe4e8"),
    opacity: styleNumber(style, "opacity", 0.28),
    atmosphereDensity: styleNumber(style, "atmosphereDensity", 0.45),
    atmosphereSoftness: styleNumber(style, "atmosphereSoftness", 0.75),
    atmospherePuffCount: styleNumber(style, "atmospherePuffCount", 72),
    atmospherePuffScaleM: styleNumber(style, "atmospherePuffScaleM", 28),
    atmosphereScaleJitter: styleNumber(style, "atmosphereScaleJitter", 0.55),
    atmosphereBoundsCenterX: styleNumber(style, "atmosphereBoundsCenterX", 0),
    atmosphereBoundsCenterY: styleNumber(style, "atmosphereBoundsCenterY", 0),
    atmosphereBoundsCenterZ: styleNumber(style, "atmosphereBoundsCenterZ", 40),
    atmosphereBoundsSizeX: styleNumber(style, "atmosphereBoundsSizeX", 120),
    atmosphereBoundsSizeY: styleNumber(style, "atmosphereBoundsSizeY", 120),
    atmosphereBoundsSizeZ: styleNumber(style, "atmosphereBoundsSizeZ", 70),
    atmosphereEdgeFade: styleNumber(style, "atmosphereEdgeFade", 0.85),
    atmosphereVerticalFalloff: styleNumber(
      style,
      "atmosphereVerticalFalloff",
      0.7,
    ),
    atmosphereSeed: styleNumber(style, "atmosphereSeed", 101),
    atmosphereDriftEnabled: styleBoolean(
      style,
      "atmosphereDriftEnabled",
      false,
    ),
    atmosphereDriftSpeedMps: styleNumber(
      style,
      "atmosphereDriftSpeedMps",
      5,
    ),
    atmosphereDriftDirectionX: styleNumber(
      style,
      "atmosphereDriftDirectionX",
      1,
    ),
    atmosphereDriftDirectionY: styleNumber(
      style,
      "atmosphereDriftDirectionY",
      0,
    ),
    atmosphereDriftDirectionZ: styleNumber(
      style,
      "atmosphereDriftDirectionZ",
      0,
    ),
    atmosphereDepthTest: styleBoolean(style, "atmosphereDepthTest", true),
    atmosphereRenderOrder: styleNumber(style, "atmosphereRenderOrder", 20),
    atmosphereBoundsHelperVisible: styleBoolean(
      style,
      "atmosphereBoundsHelperVisible",
      false,
    ),
  };
}

export function AtmosphereVolumeControls({
  layerId,
  style,
  isEnv,
  currentPage,
  disabled = false,
  overridden = false,
  onToggleOverride,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  layerId: string;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  disabled?: boolean;
  overridden?: boolean;
  onToggleOverride?: (enabled: boolean) => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const controlDisabled = disabled || (!isEnv && !overridden);
  const commit = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
      return;
    }
    if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  const patchNumber = (field: AtmosphereNumberField, value: number) => {
    commit(patchField(field, value));
  };
  const patchBoolean = (field: AtmosphereBooleanField, value: boolean) => {
    commit(patchField(field, value));
  };
  const subtype = normalSubtype(styleString(style, "atmosphereSubtype", "mist"));
  const boundsMode = normalBoundsMode(
    styleString(style, "atmosphereBoundsMode", "box"),
  );
  const driftEnabled = styleBoolean(style, "atmosphereDriftEnabled", false);

  return (
    <div data-testid="atmosphere-volume-controls">
      {!isEnv && onToggleOverride ? (
        <ControlOverrideRow
          overridden={overridden}
          disabled={false}
          onToggle={onToggleOverride}
        />
      ) : null}

      <ControlSection
        label="Appearance"
        testId="atmosphere-volume-appearance-container"
      >
        <SelectRow
          label="Subtype"
          value={subtype}
          options={SUBTYPE_OPTIONS}
          disabled={controlDisabled}
          testId="atmosphere-volume-subtype"
          onChange={(value) => commit({ atmosphereSubtype: value })}
        />
        <ColorRow
          label="Color"
          value={styleString(style, "color", "#dfe4e8")}
          disabled={controlDisabled}
          testId="atmosphere-volume-color"
          onChange={(value) => commit({ color: value })}
        />
        <NumberRow
          label="Opacity"
          value={styleNumber(style, "opacity", 0.28)}
          min={0}
          max={1}
          step={0.02}
          decimals={2}
          disabled={controlDisabled}
          testId="atmosphere-volume-opacity"
          onChange={(value) => patchNumber("opacity", value)}
        />
        <NumberRow
          label="Density"
          value={styleNumber(style, "atmosphereDensity", 0.45)}
          min={0}
          max={1}
          step={0.01}
          decimals={2}
          disabled={controlDisabled}
          testId="atmosphere-volume-density"
          onChange={(value) => patchNumber("atmosphereDensity", value)}
        />
        <NumberRow
          label="Softness"
          value={styleNumber(style, "atmosphereSoftness", 0.75)}
          min={0.05}
          max={1}
          step={0.01}
          decimals={2}
          disabled={controlDisabled}
          testId="atmosphere-volume-softness"
          onChange={(value) => patchNumber("atmosphereSoftness", value)}
        />
      </ControlSection>

      <ControlSection label="Puffs" testId="atmosphere-volume-puffs-container">
        <NumberRow
          label="Puff count"
          value={styleNumber(style, "atmospherePuffCount", 72)}
          min={1}
          max={240}
          step={1}
          decimals={0}
          disabled={controlDisabled}
          testId="atmosphere-volume-puff-count"
          onChange={(value) => patchNumber("atmospherePuffCount", value)}
        />
        <NumberRow
          label="Puff scale"
          value={styleNumber(style, "atmospherePuffScaleM", 28)}
          min={1}
          max={5000}
          step={5}
          decimals={0}
          disabled={controlDisabled}
          testId="atmosphere-volume-puff-scale-m"
          onChange={(value) => patchNumber("atmospherePuffScaleM", value)}
        />
        <NumberRow
          label="Scale jitter"
          value={styleNumber(style, "atmosphereScaleJitter", 0.55)}
          min={0}
          max={2}
          step={0.01}
          decimals={2}
          disabled={controlDisabled}
          testId="atmosphere-volume-scale-jitter"
          onChange={(value) => patchNumber("atmosphereScaleJitter", value)}
        />
      </ControlSection>

      <ControlSection label="Bounds" testId="atmosphere-volume-bounds-container">
        <BooleanRow
          label="On-screen"
          checked={styleBoolean(style, "atmosphereBoundsHelperVisible", false)}
          disabled={controlDisabled}
          testId="atmosphere-volume-handles-visible"
          onChange={(value) =>
            patchBoolean("atmosphereBoundsHelperVisible", value)
          }
        />
        <SelectRow
          label="Bounds"
          value={boundsMode}
          options={BOUNDS_MODE_OPTIONS}
          disabled={controlDisabled}
          testId="atmosphere-volume-bounds-mode"
          onChange={(value) => commit({ atmosphereBoundsMode: value })}
        />
      <NumberRow
        label="Center X"
        value={styleNumber(style, "atmosphereBoundsCenterX", 0)}
        min={-1000000}
        max={1000000}
        step={1}
        decimals={0}
        inputMode="number"
        disabled={controlDisabled}
        testId="atmosphere-volume-bounds-center-x"
        onChange={(value) => patchNumber("atmosphereBoundsCenterX", value)}
      />
      <NumberRow
        label="Center Y"
        value={styleNumber(style, "atmosphereBoundsCenterY", 0)}
        min={-1000000}
        max={1000000}
        step={1}
        decimals={0}
        inputMode="number"
        disabled={controlDisabled}
        testId="atmosphere-volume-bounds-center-y"
        onChange={(value) => patchNumber("atmosphereBoundsCenterY", value)}
      />
      <NumberRow
        label="Center Z"
        value={styleNumber(style, "atmosphereBoundsCenterZ", 40)}
        min={-1000000}
        max={1000000}
        step={1}
        decimals={0}
        inputMode="number"
        disabled={controlDisabled}
        testId="atmosphere-volume-bounds-center-z"
        onChange={(value) => patchNumber("atmosphereBoundsCenterZ", value)}
      />
      <NumberRow
        label="Size X"
        value={styleNumber(style, "atmosphereBoundsSizeX", 120)}
        min={0}
        max={1000000}
        step={1}
        decimals={0}
        inputMode="number"
        disabled={controlDisabled}
        testId="atmosphere-volume-bounds-size-x"
        onChange={(value) => patchNumber("atmosphereBoundsSizeX", value)}
      />
      <NumberRow
        label="Size Y"
        value={styleNumber(style, "atmosphereBoundsSizeY", 120)}
        min={0}
        max={1000000}
        step={1}
        decimals={0}
        inputMode="number"
        disabled={controlDisabled}
        testId="atmosphere-volume-bounds-size-y"
        onChange={(value) => patchNumber("atmosphereBoundsSizeY", value)}
      />
      <NumberRow
        label="Size Z"
        value={styleNumber(style, "atmosphereBoundsSizeZ", 70)}
        min={0}
        max={1000000}
        step={1}
        decimals={0}
        inputMode="number"
        disabled={controlDisabled}
        testId="atmosphere-volume-bounds-size-z"
        onChange={(value) => patchNumber("atmosphereBoundsSizeZ", value)}
      />

      </ControlSection>

      <ControlSection
        label="Falloff"
        testId="atmosphere-volume-falloff-container"
      >
      <NumberRow
        label="Edge fade"
        value={styleNumber(style, "atmosphereEdgeFade", 0.85)}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        disabled={controlDisabled}
        testId="atmosphere-volume-edge-fade"
        onChange={(value) => patchNumber("atmosphereEdgeFade", value)}
      />
      <NumberRow
        label="Vertical falloff"
        value={styleNumber(style, "atmosphereVerticalFalloff", 0.7)}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        disabled={controlDisabled}
        testId="atmosphere-volume-vertical-falloff"
        onChange={(value) => patchNumber("atmosphereVerticalFalloff", value)}
      />
      <NumberRow
        label="Seed"
        value={styleNumber(style, "atmosphereSeed", 101)}
        min={1}
        max={1000000}
        step={1}
        decimals={0}
        inputMode="number"
        disabled={controlDisabled}
        testId="atmosphere-volume-seed"
        onChange={(value) => patchNumber("atmosphereSeed", value)}
      />

      </ControlSection>

      <ControlSection label="Drift" testId="atmosphere-volume-drift-container">
      <BooleanRow
        label="Drift"
        checked={driftEnabled}
        disabled={controlDisabled}
        testId="atmosphere-volume-drift-enabled"
        onChange={(value) => patchBoolean("atmosphereDriftEnabled", value)}
      />
      <NumberRow
        label="Speed"
        value={styleNumber(style, "atmosphereDriftSpeedMps", 5)}
        min={0}
        max={200}
        step={0.1}
        decimals={1}
        disabled={controlDisabled || !driftEnabled}
        testId="atmosphere-volume-drift-speed-mps"
        onChange={(value) => patchNumber("atmosphereDriftSpeedMps", value)}
      />
      <NumberRow
        label="Direction X"
        value={styleNumber(style, "atmosphereDriftDirectionX", 1)}
        min={-1}
        max={1}
        step={0.01}
        decimals={2}
        disabled={controlDisabled || !driftEnabled}
        testId="atmosphere-volume-drift-direction-x"
        onChange={(value) => patchNumber("atmosphereDriftDirectionX", value)}
      />
      <NumberRow
        label="Direction Y"
        value={styleNumber(style, "atmosphereDriftDirectionY", 0)}
        min={-1}
        max={1}
        step={0.01}
        decimals={2}
        disabled={controlDisabled || !driftEnabled}
        testId="atmosphere-volume-drift-direction-y"
        onChange={(value) => patchNumber("atmosphereDriftDirectionY", value)}
      />
      <NumberRow
        label="Direction Z"
        value={styleNumber(style, "atmosphereDriftDirectionZ", 0)}
        min={-1}
        max={1}
        step={0.01}
        decimals={2}
        disabled={controlDisabled || !driftEnabled}
        testId="atmosphere-volume-drift-direction-z"
        onChange={(value) => patchNumber("atmosphereDriftDirectionZ", value)}
      />

      </ControlSection>

      <ControlSection label="Render" testId="atmosphere-volume-render-container">
      <BooleanRow
        label="Depth test"
        checked={styleBoolean(style, "atmosphereDepthTest", true)}
        disabled={controlDisabled}
        testId="atmosphere-volume-depth-test"
        onChange={(value) => patchBoolean("atmosphereDepthTest", value)}
      />
      <NumberRow
        label="Render order"
        value={styleNumber(style, "atmosphereRenderOrder", 20)}
        min={-10000}
        max={10000}
        step={1}
        decimals={0}
        inputMode="number"
        disabled={controlDisabled}
        testId="atmosphere-volume-render-order"
        onChange={(value) => patchNumber("atmosphereRenderOrder", value)}
      />
      </ControlSection>
    </div>
  );
}
