import type { CSSProperties } from "react";
import {
  TECHNICAL_MONO_FONT,
  vibrancyLabel,
} from "../editor/styles";

export const LEGEND_PANEL_WIDTH_PX = 282;
export const LEGEND_STACK_GAP_PX = 36;

export const transparentLegendPanelStyle: CSSProperties = {
  position: "absolute",
  zIndex: 11,
  width: LEGEND_PANEL_WIDTH_PX,
  boxSizing: "border-box",
  padding: 14,
  pointerEvents: "auto",
  fontFamily: TECHNICAL_MONO_FONT,
  color: vibrancyLabel,
  background: "transparent",
  border: "none",
  borderRadius: 0,
  boxShadow: "none",
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
};
