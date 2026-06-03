import type React from "react";
import {
  isStyleFieldOverridden,
  isVisibilityOverridden,
} from "../pages/effective";
import type { EditableStyle, PresentationPage } from "../pages/types";
import {
  FROSTED_HAIRLINE,
  editorFieldBackground,
  editorFieldBorder,
  editorFieldText,
  panelStyles,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "./styles";
import { TransientSlider } from "./TransientSlider";

export const nestedDetailsStyle: React.CSSProperties = {
  marginTop: 7,
  paddingLeft: 10,
  boxSizing: "border-box",
};

export const detailsContentStyle: React.CSSProperties = {
  padding: "4px 0 0 14px",
};

export const drillingAssayDetailsStyle: React.CSSProperties = {
  marginBottom: 10,
  padding: "6px 12px 8px 0",
  borderBottom: FROSTED_HAIRLINE,
};

export const drillingAssaySummaryStyle: React.CSSProperties = {
  ...panelStyles.summary,
  fontWeight: 700,
  color: vibrancySecondaryLabel,
  marginBottom: 8,
};

export const drillingAssayHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: vibrancyTertiaryLabel,
  marginTop: 4,
  paddingLeft: 66,
  lineHeight: 1.3,
};

export const drillingAssayPaletteStyle: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 8,
  paddingLeft: 66,
};

export const drillingAssayPaletteTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: vibrancySecondaryLabel,
  marginBottom: 6,
};

export const nestedControlRowStyle: React.CSSProperties = {
  ...panelStyles.row,
};

export const nestedFieldLabelStyle: React.CSSProperties = {
  ...panelStyles.fieldLabel,
  width: 92,
  flex: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const overrideTagStyle: React.CSSProperties = {
  fontSize: 10,
  color: vibrancyTertiaryLabel,
  marginLeft: 4,
};

export const overrideTagActiveStyle: React.CSSProperties = {
  ...overrideTagStyle,
  color: vibrancySecondaryLabel,
};

export const editorDarkSelectStyle: React.CSSProperties = {
  ...panelStyles.textInput,
  flex: 1,
  minWidth: 0,
  height: 26,
  padding: "3px 8px",
  background: editorFieldBackground,
  color: editorFieldText,
  border: editorFieldBorder,
  borderRadius: 8,
  colorScheme: "dark",
};

export const editorCompactSegmentedRowStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: 4,
  flex: 1,
  minWidth: 0,
};

export const editorCompactSegmentButtonStyle: React.CSSProperties = {
  ...panelStyles.button,
  flex: 1,
  width: "auto",
  minWidth: 0,
  minHeight: 22,
  padding: "2px 8px",
  fontSize: 11,
  lineHeight: 1.15,
  whiteSpace: "nowrap",
};

const editorEyeSvgStyle: React.CSSProperties = {
  width: 13,
  height: 13,
  display: "block",
  flex: "none",
};

export function EditorEyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={editorEyeSvgStyle}
    >
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function EditorEyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={editorEyeSvgStyle}
    >
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M2.5 12s3.5-6 9.5-6c1.3 0 2.5.28 3.55.73M21.5 12s-3.5 6-9.5 6c-1.31 0-2.51-.28-3.58-.74"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function editorEyeButtonStyle(
  visible: boolean,
  overridden = false,
): React.CSSProperties {
  return {
    ...panelStyles.iconButton,
    width: 24,
    height: 24,
    flex: "0 0 24px",
    padding: 0,
    border: "1px solid transparent",
    background: "transparent",
    boxShadow: "none",
    color: overridden
      ? "rgba(143, 215, 255, 0.92)"
      : visible
        ? vibrancyLabel
        : vibrancyTertiaryLabel,
    opacity: visible ? 1 : 0.72,
  };
}

export function EditorEyeButton({
  visible,
  onClick,
  title,
  ariaLabel,
  overridden = false,
  disabled = false,
  testId,
  style,
}: {
  visible: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  ariaLabel?: string;
  overridden?: boolean;
  disabled?: boolean;
  testId?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className="editor-action-button editor-icon-only-button"
      data-testid={testId}
      style={{
        ...editorEyeButtonStyle(visible, overridden),
        ...(disabled ? { cursor: "not-allowed", opacity: 0.45 } : {}),
        ...style,
      }}
      disabled={disabled}
      onClick={onClick}
      title={title ?? (visible ? "Hide" : "Show")}
      aria-label={ariaLabel ?? (visible ? "Hide" : "Show")}
      aria-pressed={visible}
    >
      {visible ? <EditorEyeIcon /> : <EditorEyeOffIcon />}
    </button>
  );
}

export function EditorCompactSegmentedRow<T extends string>({
  label,
  value,
  options,
  testId,
  disabled = false,
  controlOpacity = 1,
  ariaLabel,
  onChange,
}: {
  label?: string;
  value: T;
  options: readonly {
    value: T;
    label: string;
    disabled?: boolean;
    testId?: string;
  }[];
  testId: string;
  disabled?: boolean;
  controlOpacity?: number;
  ariaLabel?: string;
  onChange: (value: T) => void;
}) {
  const groupLabel = ariaLabel ?? label ?? testId;
  return (
    <div style={nestedControlRowStyle}>
      {label ? <label style={nestedFieldLabelStyle}>{label}</label> : null}
      <div
        role="group"
        aria-label={groupLabel}
        data-testid={testId}
        style={editorCompactSegmentedRowStyle}
      >
        {options.map((option) => {
          const selected = option.value === value;
          const optionDisabled = disabled || option.disabled === true;
          return (
            <button
              key={option.value}
              type="button"
              data-testid={option.testId ?? `${testId}-${option.value}`}
              disabled={optionDisabled}
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              style={{
                ...editorCompactSegmentButtonStyle,
                color: selected ? vibrancyLabel : vibrancySecondaryLabel,
                borderColor: selected
                  ? "rgba(244, 240, 232, 0.56)"
                  : "rgba(244, 240, 232, 0.18)",
                opacity: optionDisabled ? 0.4 : controlOpacity,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type LayerStyleSetter = (
  layerId: string,
  patch: Partial<EditableStyle>,
) => void;
export type PageStyleSetter = (
  pageId: string,
  layerId: string,
  patch: Partial<EditableStyle>,
) => void;
export type PageStyleClearer = (
  pageId: string,
  layerId: string,
  field: keyof EditableStyle,
) => void;

export function EnvVisibilityRow({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>Visible (default)</label>
      <EditorEyeButton
        visible={visible}
        onClick={onToggle}
        title={visible ? "Hide by default" : "Show by default"}
        ariaLabel={visible ? "Hide by default" : "Show by default"}
        style={{ marginLeft: "auto" }}
      />
    </div>
  );
}

export function PageVisibilityRow({
  page,
  layerId,
  envVisible,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envVisible: boolean;
  onSet: (v: boolean) => void;
  onClear: () => void;
}) {
  const overridden = isVisibilityOverridden(page, layerId);
  const overrideVal = page.visibilityOverrides?.[layerId];
  const effective = overridden ? !!overrideVal : envVisible;

  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>Visible</label>
      <EditorEyeButton
        visible={effective}
        overridden={overridden}
        onClick={() => onSet(!effective)}
        title={
          overridden
            ? effective
              ? "Hide on this page"
              : "Show on this page"
            : effective
              ? "Hide on this page and create override"
              : "Show on this page and create override"
        }
        ariaLabel={effective ? "Hide on this page" : "Show on this page"}
        style={{ marginLeft: "auto" }}
      />
      <button
        type="button"
        onClick={overridden ? onClear : () => onSet(effective)}
        title={
          overridden
            ? "Clear page visibility override"
            : "Create page visibility override"
        }
        style={{
          border: "none",
          background: "transparent",
          padding: "0 0 0 4px",
          cursor: "pointer",
          font: "inherit",
        }}
      >
        <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
          {overridden ? "overridden" : "inherited"}
        </span>
      </button>
    </div>
  );
}

export function EnvStyleRow({
  label,
  inputType,
  value,
  min = 0,
  max = 1,
  step = 0.05,
  decimals = 2,
  testId,
  onChange,
}: {
  label: string;
  inputType: "color" | "range" | "number";
  value: string;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  testId?: string;
  onChange: (v: string) => void;
}) {
  const rangeValue = parseFloat(value);
  const safeValue = Number.isFinite(rangeValue) ? rangeValue : min;
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      {inputType === "range" ? (
        <TransientSlider
          value={safeValue}
          min={min}
          max={max}
          step={step}
          testId={testId}
          onChange={(next) => onChange(String(next))}
          format={(next) => next.toFixed(decimals)}
          style={{ flex: 1 }}
        />
      ) : (
        <input
          type={inputType}
          value={value}
          step={inputType === "number" ? step : undefined}
          data-testid={testId}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: inputType === "number" ? 1 : undefined }}
        />
      )}
    </div>
  );
}

export function PageStyleRow({
  label,
  inputType,
  inheritedValue,
  isOverridden,
  overrideValue,
  fallbackValue,
  min = 0,
  max = 1,
  step = 0.05,
  decimals = 2,
  onOverride,
  onClear,
}: {
  label: string;
  inputType: "color" | "range";
  inheritedValue: string | undefined;
  isOverridden: boolean;
  overrideValue: string | undefined;
  fallbackValue?: string;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  onOverride: (v: string) => void;
  onClear: () => void;
}) {
  const fallback = fallbackValue ?? (inputType === "range" ? "1" : "#cccccc");
  const value = isOverridden
    ? (overrideValue ?? inheritedValue ?? fallback)
    : (inheritedValue ?? fallback);
  const rangeValue = parseFloat(value);
  const safeValue = Number.isFinite(rangeValue) ? rangeValue : min;

  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <input
        type="checkbox"
        checked={isOverridden}
        onChange={(e) => {
          if (e.target.checked) {
            onOverride(value);
          } else {
            onClear();
          }
        }}
        title="Override environment value for this page"
      />
      {inputType === "range" ? (
        <TransientSlider
          value={safeValue}
          min={min}
          max={max}
          step={step}
          disabled={!isOverridden}
          onChange={(next) => onOverride(String(next))}
          format={(next) => next.toFixed(decimals)}
          style={{ flex: 1, opacity: isOverridden ? 1 : 0.4 }}
        />
      ) : (
        <input
          type="color"
          value={value}
          disabled={!isOverridden}
          onChange={(e) => onOverride(e.target.value)}
          style={{ opacity: isOverridden ? 1 : 0.4 }}
        />
      )}
      <span style={isOverridden ? overrideTagActiveStyle : overrideTagStyle}>
        {isOverridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

export function EnvSelectRow<T extends string>({
  label,
  value,
  options,
  testId,
  disabled = false,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  testId?: string;
  disabled?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <select
        value={value}
        data-testid={testId}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          ...editorDarkSelectStyle,
          opacity: disabled ? 0.4 : 1,
        }}
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

export function EzGammaCheckboxRow({
  label,
  checked,
  testId,
  onChange,
}: {
  label: string;
  checked: boolean;
  testId?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
      <span style={nestedFieldLabelStyle}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        data-testid={testId}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function LayerNumberStyleControl({
  label,
  field,
  fallback,
  min,
  max,
  step,
  decimals,
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
  testId,
}: {
  label: string;
  field: keyof EditableStyle;
  fallback: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
  testId?: string;
}) {
  if (isEnv) {
    return (
      <EnvStyleRow
        label={label}
        inputType="range"
        value={String(styleNumber(style, field, fallback))}
        min={min}
        max={max}
        step={step}
        decimals={decimals}
        testId={testId}
        onChange={(value) =>
          setEnvLayerStyle(layerId, { [field]: parseFloat(value) })
        }
      />
    );
  }
  if (!currentPage) return null;
  return (
    <PageStyleRow
      label={label}
      inputType="range"
      inheritedValue={String(styleNumber(style, field, fallback))}
      isOverridden={isStyleFieldOverridden(currentPage, layerId, field)}
      overrideValue={
        currentPage.layerOverrides?.[layerId]?.[field] !== undefined
          ? String(currentPage.layerOverrides[layerId][field])
          : undefined
      }
      fallbackValue={String(fallback)}
      min={min}
      max={max}
      step={step}
      decimals={decimals}
      onOverride={(value) =>
        setPageLayerOverride(currentPage.id, layerId, {
          [field]: parseFloat(value),
        })
      }
      onClear={() => clearPageLayerOverride(currentPage.id, layerId, field)}
    />
  );
}

export function LayerBooleanStyleControl({
  label,
  field,
  fallback,
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
}: {
  label: string;
  field: keyof EditableStyle;
  fallback: boolean;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const checked = styleBoolean(style, field, fallback);
  if (isEnv) {
    return (
      <EzGammaCheckboxRow
        label={label}
        checked={checked}
        onChange={(value) => setEnvLayerStyle(layerId, { [field]: value })}
      />
    );
  }
  if (!currentPage) return null;
  const overridden = isStyleFieldOverridden(currentPage, layerId, field);
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) {
            setPageLayerOverride(currentPage.id, layerId, { [field]: checked });
          } else {
            clearPageLayerOverride(currentPage.id, layerId, field);
          }
        }}
        title="Override environment value for this page"
      />
      <input
        type="checkbox"
        checked={checked}
        disabled={!overridden}
        onChange={(e) =>
          setPageLayerOverride(currentPage.id, layerId, {
            [field]: e.target.checked,
          })
        }
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

export function LayerColorStyleControl({
  label,
  field,
  fallback,
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
  testId,
}: {
  label: string;
  field: keyof EditableStyle;
  fallback: string;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
  testId?: string;
}) {
  const value = styleString(style, field, fallback);
  if (isEnv) {
    return (
      <EnvStyleRow
        label={label}
        inputType="color"
        value={value}
        testId={testId}
        onChange={(next) => setEnvLayerStyle(layerId, { [field]: next })}
      />
    );
  }
  if (!currentPage) return null;
  return (
    <PageStyleRow
      label={label}
      inputType="color"
      inheritedValue={value}
      isOverridden={isStyleFieldOverridden(currentPage, layerId, field)}
      overrideValue={
        currentPage.layerOverrides?.[layerId]?.[field] !== undefined
          ? String(currentPage.layerOverrides[layerId][field])
          : undefined
      }
      fallbackValue={fallback}
      onOverride={(next) =>
        setPageLayerOverride(currentPage.id, layerId, { [field]: next })
      }
      onClear={() => clearPageLayerOverride(currentPage.id, layerId, field)}
    />
  );
}

export function styleNumber(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: number,
): number {
  const value = style[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function styleString(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: string,
): string {
  const value = style[key];
  return typeof value === "string" ? value : fallback;
}

export function styleBoolean(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
}
