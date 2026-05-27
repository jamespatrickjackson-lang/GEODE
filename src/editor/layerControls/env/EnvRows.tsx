import type React from "react";
import { panelStyles, thinLightMaterial, vibrancySecondaryLabel } from "../../styles";
import {
  nestedControlRowStyle,
  nestedFieldLabelStyle,
  overrideTagActiveStyle,
  overrideTagStyle,
} from "../../styleControls";
import { isStyleFieldOverridden, isVisibilityOverridden } from "../../../pages/effective";
import type { EditableStyle, PresentationPage } from "../../../pages/types";
import { LABEL_KIND_OPTIONS } from "../labelKindOptions";

const LABEL_POINTER_SIDE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
] as const;

const treeToggleButtonStyle: React.CSSProperties = {
  position: "relative",
  width: 62,
  height: 26,
  borderRadius: 999,
  border: "1px solid transparent",
  flex: "0 0 auto",
  padding: 0,
  cursor: "pointer",
  font: "inherit",
  overflow: "hidden",
  boxShadow: "none",
  transition: "background 160ms ease, border-color 160ms ease",
};

const treeToggleButtonActiveStyle: React.CSSProperties = {
  background: "rgba(25, 53, 37, 0.56)",
  boxShadow: "none",
  color: "rgba(255, 255, 255, 0.92)",
};

const treeToggleButtonInactiveStyle: React.CSSProperties = {
  ...thinLightMaterial,
  background: "rgba(18, 21, 24, 0.304)",
  color: vibrancySecondaryLabel,
};

const treeToggleThumbStyle: React.CSSProperties = {
  position: "absolute",
  left: 3,
  top: 3,
  width: 20,
  height: 20,
  borderRadius: 999,
  background: "rgba(244, 240, 232, 0.86)",
  boxShadow: "none",
  transition: "transform 160ms ease",
};

const treeToggleTextStyle: React.CSSProperties = {
  position: "absolute",
  left: 25,
  right: 8,
  top: 5,
  fontSize: 11,
  fontWeight: 700,
  textAlign: "center",
  lineHeight: "16px",
};

export function EnvTreeVisibilityToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>Visible (default)</label>
      <ToggleButton active={visible} onClick={onToggle} />
    </div>
  );
}

export function PageTreeVisibilityToggle({
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
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(effective);
          else onClear();
        }}
        title="Override environment default for this page"
      />
      <ToggleButton
        active={effective}
        onClick={() => onSet(!effective)}
        title={
          overridden
            ? "Toggle forest cover for this page"
            : "Toggle forest cover and create a page override"
        }
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

export function ToggleButton({
  active,
  onClick,
  title,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      title={title}
      style={{
        ...treeToggleButtonStyle,
        ...(active
          ? treeToggleButtonActiveStyle
          : treeToggleButtonInactiveStyle),
      }}
    >
      <span
        style={{
          ...treeToggleThumbStyle,
          transform: active ? "translateX(36px)" : "translateX(0)",
        }}
      />
      <span
        style={{
          ...treeToggleTextStyle,
          left: active ? 8 : 29,
          right: active ? 29 : 8,
        }}
      >
        {active ? "On" : "Off"}
      </span>
    </button>
  );
}

export function EnvShowLabelsRow({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Show labels</label>
      <input type="checkbox" checked={value} onChange={onToggle} />
    </div>
  );
}

export function EnvAffectedByFogRow({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Use fog</label>
      <ToggleButton
        active={value}
        onClick={onToggle}
        title="Include this layer in scene fog"
      />
    </div>
  );
}

export function EnvLabelKindRow({
  value,
  onChange,
}: {
  value: NonNullable<EditableStyle["labelKind"]>;
  onChange: (v: NonNullable<EditableStyle["labelKind"]>) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Label type</label>
      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value as NonNullable<EditableStyle["labelKind"]>)
        }
        style={panelStyles.textInput}
      >
        {LABEL_KIND_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PageLabelKindRow({
  page,
  layerId,
  envValue,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envValue: NonNullable<EditableStyle["labelKind"]>;
  onSet: (v: NonNullable<EditableStyle["labelKind"]>) => void;
  onClear: () => void;
}) {
  const overridden = isStyleFieldOverridden(page, layerId, "labelKind");
  const overrideVal = page.layerOverrides?.[layerId]?.labelKind;
  const effective =
    overridden && (overrideVal === "landTitle" || overrideVal === "siteElement")
      ? overrideVal
      : envValue;
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Label type</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(envValue);
          else onClear();
        }}
        title="Override environment label type for this page"
      />
      <select
        value={effective}
        disabled={!overridden}
        onChange={(e) =>
          onSet(e.target.value as NonNullable<EditableStyle["labelKind"]>)
        }
        style={{
          ...panelStyles.textInput,
          flex: 1,
          opacity: overridden ? 1 : 0.4,
        }}
      >
        {LABEL_KIND_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

export function EnvLabelPointerVisibleRow({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Show pointer</label>
      <ToggleButton
        active={value}
        onClick={onToggle}
        title="Show or hide the connector from the label to its element"
      />
    </div>
  );
}

export function PageLabelPointerVisibleRow({
  page,
  layerId,
  envValue,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envValue: boolean;
  onSet: (v: boolean) => void;
  onClear: () => void;
}) {
  const overridden = isStyleFieldOverridden(
    page,
    layerId,
    "labelPointerVisible",
  );
  const overrideVal =
    page.layerOverrides?.[layerId]?.labelPointerVisible !== false;
  const effective = overridden ? overrideVal : envValue;
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Show pointer</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(envValue);
          else onClear();
        }}
        title="Override environment label pointer for this page"
      />
      <ToggleButton
        active={effective}
        onClick={() => onSet(!effective)}
        title={
          overridden
            ? "Toggle the label pointer for this page"
            : "Toggle the label pointer and create a page override"
        }
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

export function EnvLabelPointerSideRow({
  value,
  onChange,
}: {
  value: NonNullable<EditableStyle["labelPointerSide"]>;
  onChange: (v: NonNullable<EditableStyle["labelPointerSide"]>) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Pointer side</label>
      <select
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value as NonNullable<EditableStyle["labelPointerSide"]>,
          )
        }
        style={panelStyles.textInput}
      >
        {LABEL_POINTER_SIDE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PageLabelPointerSideRow({
  page,
  layerId,
  envValue,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envValue: NonNullable<EditableStyle["labelPointerSide"]>;
  onSet: (v: NonNullable<EditableStyle["labelPointerSide"]>) => void;
  onClear: () => void;
}) {
  const overridden = isStyleFieldOverridden(page, layerId, "labelPointerSide");
  const overrideVal = page.layerOverrides?.[layerId]?.labelPointerSide;
  const effective =
    overridden &&
    (overrideVal === "left" ||
      overrideVal === "right" ||
      overrideVal === "auto")
      ? overrideVal
      : envValue;
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Pointer side</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(envValue);
          else onClear();
        }}
        title="Override environment pointer side for this page"
      />
      <select
        value={effective}
        disabled={!overridden}
        onChange={(e) =>
          onSet(
            e.target.value as NonNullable<EditableStyle["labelPointerSide"]>,
          )
        }
        style={{
          ...panelStyles.textInput,
          flex: 1,
          opacity: overridden ? 1 : 0.4,
        }}
      >
        {LABEL_POINTER_SIDE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

export function PageShowLabelsRow({
  page,
  layerId,
  envValue,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envValue: boolean;
  onSet: (v: boolean) => void;
  onClear: () => void;
}) {
  const overridden = isStyleFieldOverridden(page, layerId, "showLabels");
  const overrideVal = page.layerOverrides?.[layerId]?.showLabels === true;
  const effective = overridden ? overrideVal : envValue;
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Show labels</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(envValue);
          else onClear();
        }}
        title="Override environment default for this page"
      />
      <input
        type="checkbox"
        checked={effective}
        disabled={!overridden}
        onChange={(e) => onSet(e.target.checked)}
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

export function PageAffectedByFogRow({
  page,
  layerId,
  envValue,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envValue: boolean;
  onSet: (v: boolean) => void;
  onClear: () => void;
}) {
  const overridden = isStyleFieldOverridden(page, layerId, "affectedByFog");
  const overrideVal = page.layerOverrides?.[layerId]?.affectedByFog !== false;
  const effective = overridden ? overrideVal : envValue;
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Use fog</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(envValue);
          else onClear();
        }}
        title="Override environment fog behavior for this page"
      />
      <ToggleButton
        active={effective}
        onClick={() => onSet(!effective)}
        title={
          overridden
            ? "Toggle fog for this page"
            : "Toggle fog and create a page override"
        }
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}
