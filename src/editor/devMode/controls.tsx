import type { ReactNode } from "react";
import { TransientSlider } from "../TransientSlider";
import {
  computedLabelStyle,
  computedValueStyle,
  controlGroupStyle,
  controlGroupTitleStyle,
  devColorInputStyle,
  devControlRowStyle,
  devControlValueStyle,
  devSelectStyle,
  devTextFieldRowStyle,
  devTextInputStyle,
} from "./styles";

export function DevControlGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={controlGroupStyle}>
      <div style={controlGroupTitleStyle}>{title}</div>
      {children}
    </div>
  );
}

export function ComputedValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <span style={computedLabelStyle}>{label}</span>
      <span style={computedValueStyle}>{value || "n/a"}</span>
    </div>
  );
}

export function DevTextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={devTextFieldRowStyle}>
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={devTextInputStyle}
      />
    </label>
  );
}

export function DevColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={devControlRowStyle}>
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={devColorInputStyle}
      />
      <span style={devControlValueStyle}>{value}</span>
    </label>
  );
}

export function DevRange({
  label,
  value,
  min,
  max,
  step,
  format = (next) => `${next.toFixed(0)} px`,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label style={devControlRowStyle}>
      <span>{label}</span>
      <TransientSlider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        format={format}
        style={{ minWidth: 0, flex: 1 }}
      />
    </label>
  );
}

export function DevSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label style={devControlRowStyle}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        style={devSelectStyle}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DevCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={devControlRowStyle}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ justifySelf: "start" }}
      />
      <span style={devControlValueStyle}>{checked ? "on" : "off"}</span>
    </label>
  );
}
