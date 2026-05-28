import type { CSSProperties } from "react";
import {
  TECHNICAL_MONO_FONT,
  vibrancyLabel,
  vibrancySecondaryLabel,
} from "../editor/styles";
import type { BoxOverlayStyle } from "../pages/types";

export const LEGEND_PANEL_WIDTH_PX = 282;
export const LEGEND_PAGE_EDGE_MARGIN_PX = 16;
export const LEGEND_BOTTOM_EDGE_OFFSET_PX = 50;
export const LEGEND_STACK_GAP_PX = 14;
export const LEGEND_CHECKBOX_SIZE_PX = 13;
export const legendControlSpacing = {
  boxColumnPx: 16,
  rowInsetPx: 4,
  labelGapPx: 14,
  firstRowMarginTopPx: 11.475,
  rowMarginTopPx: 9,
} as const;

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
