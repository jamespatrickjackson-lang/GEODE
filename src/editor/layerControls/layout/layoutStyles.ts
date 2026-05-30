import type React from "react";
import {
  EDITOR_PILL_TEXT_INSET_PX,
  FROSTED_HAIRLINE,
  frostedSubheading,
  panelStyles,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "../../styles";

export const layerGroupStyle: React.CSSProperties = {
  marginBottom: 16,
  paddingLeft: 12,
};

// DEV NOTES: layer subheading bars
// --------------------------------
// These are the second-level bars inside the Layers panel:
// Environment, Topo map tile, Drilling, Targets & Tenure, Water, Topo overlays,
// Other.
//
// Material and full pill rounding come from `frostedSubheading` in styles.ts.
// Change this object when you want to adjust:
// - subheading height: padding / minHeight
// - text-to-chevron alignment: justifyContent / gap
// - distance from lower rows: padding and layerGroupStyle.marginBottom
//
// The layer rows below are intentionally plain. If Topography/Bedrock gets a
// heavier rounded white box again, look at layerGroupBodyStyle first.
export const layerGroupSummaryStyle: React.CSSProperties = {
  ...frostedSubheading,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  width: "100%",
  minHeight: 42,
  padding: `0 ${EDITOR_PILL_TEXT_INSET_PX}px`,
  cursor: "pointer",
  userSelect: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  appearance: "none",
};

// Single-line title text in the subheading pill. Descriptive second-line text
// was intentionally removed, so group titles should stay short: Topo map tile,
// Drilling, Targets & Tenure, Water.
export const layerGroupTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.2,
  color: vibrancySecondaryLabel,
  minWidth: 0,
};

export const layerGroupDisclosureStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
};

export const layerGroupChevronStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRight: "2px solid rgba(244, 240, 232, 0.82)",
  borderBottom: "2px solid rgba(244, 240, 232, 0.82)",
  transformOrigin: "center",
  transition: "transform 160ms ease",
};

// DEV NOTES: layer group contents
// -------------------------------
// This is the plain list area below a subheading bar. It controls indentation,
// not material. Keep it lighter than the subheading bar unless you explicitly
// want the content rows boxed.
export const layerGroupBodyStyle: React.CSSProperties = {
  padding: "8px 0 8px 28px",
};

export const layerGroupFogControlStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "0 12px 9px 0",
  marginBottom: 4,
  borderBottom: FROSTED_HAIRLINE,
};

export const layerGroupFogControlRowStyle: React.CSSProperties = {
  ...panelStyles.row,
};

// Individual layer rows, for example Topography, Bedrock geology, or drillhole
// layers. The borderTop is the row separator inside a group.
export const layerItemStyle: React.CSSProperties = {
  padding: "10px 12px 11px 0",
  borderTop: FROSTED_HAIRLINE,
};

export const firstLayerItemStyle: React.CSSProperties = {
  borderTop: "none",
};

export const layerControlsStyle: React.CSSProperties = {
  paddingLeft: 2,
};

export const pageRenderPresetHelpStyle: React.CSSProperties = {
  ...panelStyles.muted,
  margin: "0 0 8px 0",
  lineHeight: 1.35,
};

export const compactCheckboxRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr)",
  alignItems: "center",
  gap: 7,
  color: vibrancySecondaryLabel,
  fontSize: 11,
  lineHeight: 1.25,
  margin: "4px 0",
};

export const miniGroupTitleStyle: React.CSSProperties = {
  marginTop: 7,
  marginBottom: 4,
  color: vibrancyTertiaryLabel,
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0,
};

export const smallActionButtonStyle: React.CSSProperties = {
  ...panelStyles.button,
  width: "100%",
  minHeight: 24,
  padding: "4px 8px",
  fontSize: 11,
};

export const drillingAssayColorRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
};

export const drillingAssayColorNameStyle: React.CSSProperties = {
  ...panelStyles.textInput,
  minWidth: 0,
  height: 24,
  padding: "3px 10px",
  borderRadius: 999,
};

export const assayOutlineColorInputStyle: React.CSSProperties = {
  width: 74,
  height: 24,
  border: "0",
  borderRadius: 999,
  padding: 0,
  overflow: "hidden",
  background: "transparent",
  cursor: "pointer",
};
