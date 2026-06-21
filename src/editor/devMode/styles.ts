import type { CSSProperties } from "react";
import {
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
  regularLightMaterial,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "../styles";
import type { RectLike } from "./types";

export const CONTROL_PANEL_WIDTH_PX = 392;

export const devModeBadgeStyle: CSSProperties = {
  position: "fixed",
  left: 12,
  bottom: 12,
  zIndex: 2147483647,
  padding: "6px 10px",
  border: FROSTED_HAIRLINE,
  borderRadius: 999,
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  pointerEvents: "none",
  ...regularLightMaterial,
};

export const containerOutlineStyle: CSSProperties = {
  position: "fixed",
  zIndex: 2147483641,
  border: "1px solid rgba(244, 240, 232, 0.62)",
  boxShadow: "0 0 0 1px rgba(0, 122, 255, 0.18)",
  borderRadius: 8,
  pointerEvents: "none",
  boxSizing: "border-box",
};

export const selectedContainerOutlineStyle: CSSProperties = {
  border: "2px solid rgba(255, 214, 102, 0.94)",
  boxShadow: "0 0 0 3px rgba(255, 214, 102, 0.18)",
};

export const containerPointerSvgStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  zIndex: 2147483642,
  pointerEvents: "none",
};

export const containerPointerLineStyle: CSSProperties = {
  stroke: "rgba(244, 240, 232, 0.58)",
  strokeWidth: 1,
  strokeDasharray: "3 3",
};

export const selectedContainerPointerLineStyle: CSSProperties = {
  ...containerPointerLineStyle,
  stroke: "rgba(255, 214, 102, 0.94)",
  strokeWidth: 1.5,
};

export const containerPointerDotStyle: CSSProperties = {
  fill: "rgba(244, 240, 232, 0.68)",
};

export const selectedContainerPointerDotStyle: CSSProperties = {
  fill: "rgba(255, 214, 102, 0.94)",
};

export const containerLabelStyle: CSSProperties = {
  position: "fixed",
  zIndex: 2147483642,
  padding: "2px 6px",
  borderRadius: 6,
  color: vibrancyLabel,
  background: "rgba(18, 21, 24, 0.82)",
  border: FROSTED_HAIRLINE,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 10,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  pointerEvents: "none",
  boxSizing: "border-box",
};

export const highlightStyle: CSSProperties = {
  position: "fixed",
  zIndex: 2147483645,
  border: "1px solid rgba(0, 122, 255, 0.85)",
  boxShadow: "0 0 0 2px rgba(0, 122, 255, 0.18)",
  borderRadius: 8,
  pointerEvents: "none",
};

export const controlPanelStyle: CSSProperties = {
  position: "fixed",
  zIndex: 2147483647,
  width: CONTROL_PANEL_WIDTH_PX,
  boxSizing: "border-box",
  overflowY: "auto",
  padding: 12,
  border: FROSTED_HAIRLINE,
  borderRadius: 14,
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  lineHeight: 1.35,
  pointerEvents: "auto",
  ...regularLightMaterial,
};

export const controlPanelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 8,
};

export const controlPanelKickerStyle: CSSProperties = {
  color: vibrancyTertiaryLabel,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0,
};

export const controlPanelTitleStyle: CSSProperties = {
  color: vibrancyLabel,
  fontSize: 14,
  fontWeight: 700,
};

export const controlPanelCloseStyle: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  border: FROSTED_HAIRLINE,
  color: vibrancyLabel,
  background: "rgba(18, 21, 24, 0.54)",
  cursor: "pointer",
  font: "inherit",
};

export const controlPanelScrollHintStyle: CSSProperties = {
  position: "fixed",
  zIndex: 2147483648,
  width: CONTROL_PANEL_WIDTH_PX,
  boxSizing: "border-box",
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  borderBottomLeftRadius: 14,
  borderBottomRightRadius: 14,
  background:
    "linear-gradient(180deg, rgba(18, 21, 24, 0), rgba(18, 21, 24, 0.9))",
};

export const controlPanelScrollHintChevronStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRight: `2px solid ${vibrancyLabel}`,
  borderBottom: `2px solid ${vibrancyLabel}`,
  transform: "rotate(45deg)",
};

export const controlPanelMetaStyle: CSSProperties = {
  color: vibrancySecondaryLabel,
  fontSize: 11,
  display: "grid",
  gap: 3,
  marginBottom: 10,
  wordBreak: "break-word",
};

export const computedGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 6,
  marginBottom: 12,
  paddingBottom: 10,
  borderBottom: FROSTED_HAIRLINE,
};

export const computedLabelStyle: CSSProperties = {
  display: "block",
  color: vibrancyTertiaryLabel,
  fontSize: 10,
};

export const computedValueStyle: CSSProperties = {
  display: "block",
  color: vibrancySecondaryLabel,
  fontSize: 11,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const controlGroupStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "10px 0",
  borderBottom: FROSTED_HAIRLINE,
};

export const controlGroupTitleStyle: CSSProperties = {
  color: vibrancyLabel,
  fontWeight: 700,
  marginTop: 2,
};

export const controlPanelLowLevelLabelStyle: CSSProperties = {
  color: vibrancyTertiaryLabel,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0,
  margin: "10px 0 2px",
  textTransform: "uppercase",
};

export const devControlRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "104px minmax(0, 1fr) 70px",
  alignItems: "center",
  gap: 8,
  color: vibrancySecondaryLabel,
};

export const devTextFieldRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "104px minmax(0, 1fr)",
  alignItems: "center",
  gap: 8,
  color: vibrancySecondaryLabel,
};

export const devTextInputStyle: CSSProperties = {
  minWidth: 0,
  border: FROSTED_HAIRLINE,
  borderRadius: 8,
  padding: "5px 8px",
  color: vibrancyLabel,
  background: "rgba(18, 21, 24, 0.72)",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 11,
};

export const devColorInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 24,
  border: FROSTED_HAIRLINE,
  borderRadius: 8,
  padding: 2,
  background: "rgba(18, 21, 24, 0.72)",
};

export const devControlValueStyle: CSSProperties = {
  color: vibrancyLabel,
  fontSize: 11,
  textAlign: "right",
  whiteSpace: "nowrap",
};

export const devSelectStyle: CSSProperties = {
  gridColumn: "2 / 4",
  minWidth: 0,
  border: FROSTED_HAIRLINE,
  borderRadius: 8,
  padding: "4px 8px",
  color: vibrancyLabel,
  background: "rgba(18, 21, 24, 0.72)",
  fontFamily: TECHNICAL_MONO_FONT,
};

export function paddingRectStyle(rect: RectLike): CSSProperties {
  return {
    position: "fixed",
    zIndex: 2147483644,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    background: "rgba(255, 149, 0, 0.32)",
    border: "1px solid rgba(255, 149, 0, 0.62)",
    boxSizing: "border-box",
    pointerEvents: "none",
  };
}

export function contentRectStyle(rect: RectLike): CSSProperties {
  return {
    position: "fixed",
    zIndex: 2147483644,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    border: "1px dashed rgba(0, 122, 255, 0.8)",
    boxSizing: "border-box",
    pointerEvents: "none",
  };
}

export const tooltipStyle: CSSProperties = {
  position: "fixed",
  zIndex: 2147483646,
  width: 316,
  padding: "8px 10px",
  border: FROSTED_HAIRLINE,
  borderRadius: 10,
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  lineHeight: 1.35,
  pointerEvents: "none",
  ...regularLightMaterial,
};

export const tooltipKickerStyle: CSSProperties = {
  color: vibrancyTertiaryLabel,
  fontSize: 10,
  marginBottom: 2,
};

export const tooltipSourceStyle: CSSProperties = {
  fontWeight: 700,
  color: vibrancyLabel,
};

export const tooltipPaddingStyle: CSSProperties = {
  marginTop: 4,
  fontWeight: 700,
  color: "rgba(168, 92, 0, 0.95)",
};

export const tooltipNoteStyle: CSSProperties = {
  color: vibrancySecondaryLabel,
  marginTop: 4,
};

// Label interactivity (Phase 1): clickable container labels are pointer-active
// and marked as dev-mode control surfaces so the global capture click handler
// does not re-resolve to a child element.
export const clickableContainerLabelStyle: CSSProperties = {
  ...containerLabelStyle,
  pointerEvents: "auto",
  cursor: "pointer",
  border: 0,
  textAlign: "left",
  font: "inherit",
};

export const selectedContainerLabelStyle: CSSProperties = {
  background: "rgba(255, 214, 102, 0.22)",
  color: vibrancyLabel,
  boxShadow: "0 0 0 1px rgba(255, 214, 102, 0.7)",
};

// Phase 2: scope toggle inside the control panel.
export const scopeToggleStyle: CSSProperties = {
  alignSelf: "flex-start",
  margin: "2px 0 8px",
  padding: "3px 8px",
  borderRadius: 999,
  border: FROSTED_HAIRLINE,
  background: "rgba(18, 21, 24, 0.54)",
  color: vibrancySecondaryLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 10,
  cursor: "pointer",
};

// Phase 4: note shown when a text edit cannot persist (untagged target).
export const untaggedTextNoteStyle: CSSProperties = {
  color: "rgba(255, 149, 0, 0.95)",
  fontSize: 10,
  marginTop: 2,
};

// Phase 3: dev save / discard bar.
export const devSaveBarStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: 14,
  transform: "translateX(-50%)",
  zIndex: 2147483647,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  borderRadius: 12,
  border: FROSTED_HAIRLINE,
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  pointerEvents: "auto",
  ...regularLightMaterial,
};

export const devSaveBarLabelStyle: CSSProperties = {
  color: vibrancySecondaryLabel,
  fontSize: 11,
};

export const devSaveButtonStyle: CSSProperties = {
  padding: "5px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255, 214, 102, 0.7)",
  background: "rgba(255, 214, 102, 0.22)",
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  cursor: "pointer",
};

export const devDiscardButtonStyle: CSSProperties = {
  padding: "5px 12px",
  borderRadius: 999,
  border: FROSTED_HAIRLINE,
  background: "rgba(18, 21, 24, 0.54)",
  color: vibrancySecondaryLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  cursor: "pointer",
};

// Phase 5: reorder drag ghost + drop indicator.
export const reorderGhostStyle: CSSProperties = {
  position: "fixed",
  zIndex: 2147483646,
  pointerEvents: "none",
  borderRadius: 8,
  border: "1px solid rgba(255, 214, 102, 0.9)",
  background: "rgba(255, 214, 102, 0.16)",
  boxSizing: "border-box",
};

export const reorderDropIndicatorStyle: CSSProperties = {
  position: "fixed",
  zIndex: 2147483646,
  height: 2,
  background: "rgba(255, 214, 102, 0.95)",
  pointerEvents: "none",
};

// Phase 6: sidebar-structure reorder proposal toast (no runtime mutation).
export const proposalToastStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  top: 14,
  transform: "translateX(-50%)",
  zIndex: 2147483647,
  maxWidth: 540,
  padding: "10px 14px",
  borderRadius: 12,
  border: FROSTED_HAIRLINE,
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 11,
  lineHeight: 1.4,
  pointerEvents: "auto",
  display: "grid",
  gap: 6,
  ...regularLightMaterial,
};

export const proposalOrderStyle: CSSProperties = {
  color: vibrancySecondaryLabel,
  wordBreak: "break-word",
};
