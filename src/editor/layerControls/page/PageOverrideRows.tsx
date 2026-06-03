import { useEditor } from "../../EditorContext";
import { panelStyles } from "../../styles";
import { overrideTagActiveStyle, overrideTagStyle } from "../../styleControls";
import { TransientSlider } from "../../TransientSlider";
import { renderPresetOptionsForEnvironment } from "../../../pages/renderPresets";
import type { RenderPresetId } from "../../../pages/types";

export function PageRenderPresetOverrideRow({
  value,
  onChange,
}: {
  value: RenderPresetId | "";
  onChange: (value: RenderPresetId | "") => void;
}) {
  const { state } = useEditor();
  const renderPresetOptions = renderPresetOptionsForEnvironment(
    state.environment,
  );
  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>Render preset</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RenderPresetId | "")}
        style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
        title="Override the project render preset for this page"
      >
        <option value="">Inherit project preset</option>
        {renderPresetOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span style={value ? overrideTagActiveStyle : overrideTagStyle}>
        {value ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

export function PageBooleanOverrideRow({
  label,
  value,
  overridden,
  onEnable,
  onClear,
  onChange,
}: {
  label: string;
  value: boolean;
  overridden: boolean;
  onEnable: () => void;
  onClear: () => void;
  onChange: (value: boolean) => void;
}) {
  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>{label}</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onEnable();
          else onClear();
        }}
        title="Override environment setup for this page"
      />
      <input
        type="checkbox"
        checked={value}
        disabled={!overridden}
        onChange={(e) => onChange(e.target.checked)}
        title="Force this page on or off"
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

export function PageMoodOverrideRow({
  label,
  value,
  min,
  max,
  step,
  overridden,
  onEnable,
  onClear,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  overridden: boolean;
  onEnable: () => void;
  onClear: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>{label}</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onEnable();
          else onClear();
        }}
        title="Override environment setup for this page"
      />
      <TransientSlider
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={!overridden}
        onChange={onChange}
        format={(nextValue) => nextValue.toFixed(2)}
        style={{ flex: 1, opacity: overridden ? 1 : 0.4 }}
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}
