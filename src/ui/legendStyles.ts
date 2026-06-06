import type { CSSProperties } from "react";
import {
  TECHNICAL_MONO_FONT,
  vibrancyLabel,
  vibrancySecondaryLabel,
} from "../editor/styles";
import type { BoxOverlayStyle } from "../pages/types";

export const LEGEND_PANEL_WIDTH_PX = 282;
export const LEGEND_PAGE_EDGE_MARGIN_PX = 16;
export const LEGEND_BOTTOM_EDGE_OFFSET_PX = 100;
export const LEGEND_STACK_GAP_PX = 14;
export const LEGEND_CHECKBOX_SIZE_PX = 13;
export const legendControlSpacing = {
  boxColumnPx: 16,
  rowInsetPx: 4,
  labelGapPx: 14,
  firstRowMarginTopPx: 11.475,
  rowMarginTopPx: 9,
} as const;
export const QUICK_LEGEND_INACTIVE_BACKGROUND =
  "rgba(128, 134, 145, 0.38)";
export const QUICK_LEGEND_PRIMARY_WIDTH_PX = 108;
export const QUICK_LEGEND_PRIMARY_HEIGHT_PX = 28;
export const QUICK_LEGEND_ICON_SIZE_PX = 24;
export const QUICK_LEGEND_BUTTON_GAP_PX = 6;
export const QUICK_LEGEND_STACK_GAP_PX = 7;

const LEGEND_CHECKBOX_OFF_COLOR = "rgba(132, 136, 145, 0.46)";
const LEGEND_CHECKBOX_ON_COLOR = vibrancyLabel;

export interface LegendTextColors {
  heading: string;
  subtext: string;
  body: string;
}

export function resolveLegendTextColors(
  overlay: Pick<
    BoxOverlayStyle,
    "textColor" | "secondaryTextColor" | "bodyTextColor"
  > | null | undefined,
): LegendTextColors {
  const heading = overlay?.textColor ?? vibrancyLabel;
  return {
    heading,
    subtext: overlay?.secondaryTextColor ?? vibrancySecondaryLabel,
    body: overlay?.bodyTextColor ?? heading,
  };
}

export function colorWithAlpha(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6) return hexColor;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

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

export const compactQuickLegendRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  boxSizing: "border-box",
  fontSize: 10,
  flexWrap: "nowrap",
};

export const compactQuickLegendStackStyle: CSSProperties = {
  display: "grid",
  gap: 7,
};

export const compactQuickLegendPrimaryButtonBaseStyle: CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  borderRadius: 999,
  border: 0,
  flex: "0 0 108px",
  width: 108,
  height: 28,
  justifyContent: "center",
  padding: "0 12px",
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: 0,
  color: "#101216",
  cursor: "pointer",
  whiteSpace: "nowrap",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  outline: "none",
};

export const compactQuickLegendIconButtonBaseStyle: CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  borderRadius: 999,
  border: 0,
  flex: "0 0 24px",
  width: 24,
  height: 24,
  justifyContent: "center",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  boxSizing: "border-box",
  color: "#101216",
  cursor: "pointer",
  outline: "none",
};

export function legendCheckboxStyle(
  checked: boolean,
  options: {
    checkedColor?: string;
    uncheckedColor?: string;
  } = {},
): CSSProperties {
  return {
    appearance: "none",
    WebkitAppearance: "none",
    display: "block",
    flex: `0 0 ${LEGEND_CHECKBOX_SIZE_PX}px`,
    width: LEGEND_CHECKBOX_SIZE_PX,
    height: LEGEND_CHECKBOX_SIZE_PX,
    margin: 0,
    padding: 0,
    border: 0,
    borderRadius: 999,
    cursor: "pointer",
    outline: "none",
    verticalAlign: "middle",
    backgroundColor: checked
      ? options.checkedColor ?? LEGEND_CHECKBOX_ON_COLOR
      : options.uncheckedColor ?? LEGEND_CHECKBOX_OFF_COLOR,
    backgroundImage: "none",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
    boxShadow: "none",
  };
}

export function legendControlRowStyle(
  options: {
    first?: boolean;
    cursor?: CSSProperties["cursor"];
  } = {},
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `${legendControlSpacing.boxColumnPx}px 1fr`,
    alignItems: "center",
    columnGap: legendControlSpacing.labelGapPx,
    paddingLeft: legendControlSpacing.rowInsetPx,
    boxSizing: "border-box",
    marginTop: options.first
      ? legendControlSpacing.firstRowMarginTopPx
      : legendControlSpacing.rowMarginTopPx,
    ...(options.cursor ? { cursor: options.cursor } : {}),
  };
}
