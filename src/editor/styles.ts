import type { CSSProperties } from "react";

// Shared editor panel styles. Plain inline objects -- no design system, no
// CSS-in-JS lib, no theming. Keep this aligned with the landing image editor
// and overlay-box material: dark frosted glass, restrained borders, technical
// mono text, and no loud interior hover fills.

export const TECHNICAL_MONO_FONT =
  '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
export const vibrancyLabel = "#f4f0e8";
export const vibrancySecondaryLabel = "rgba(244, 240, 232, 0.72)";
export const vibrancyTertiaryLabel = "rgba(244, 240, 232, 0.46)";
export const editorFieldBackground = "rgba(18, 21, 24, 0.4)";
export const editorFieldText = vibrancyLabel;
export const editorFieldBorder = "1px solid transparent";
export const EDITOR_FULL_RADIUS = 999;
export const EDITOR_SECTION_MARGIN_X = 12;
export const EDITOR_SECTION_GAP_Y = 10;
export const EDITOR_SCROLL_END_PADDING_Y = 4;
export const EDITOR_PAGE_LIST_INDENT_X = 18;
export const EDITOR_HEADING_BAR_BACKGROUND = "rgba(18, 21, 24, 0.528)";
export const EDITOR_NESTED_BAR_BACKGROUND = "rgba(18, 21, 24, 0.442)";
export const EDITOR_ACTIVE_BAR_BACKGROUND = "rgba(18, 21, 24, 0.672)";
export const EDITOR_ACTIVE_BAR_HOVER_BACKGROUND = "rgba(18, 21, 24, 0.768)";
export const globalSettingsAccent = EDITOR_ACTIVE_BAR_BACKGROUND;
export const globalSettingsHoverAccent = EDITOR_ACTIVE_BAR_HOVER_BACKGROUND;

export const regularLightMaterial: CSSProperties = {
  background: EDITOR_HEADING_BAR_BACKGROUND,
  backdropFilter: "blur(20px) saturate(145%)",
  WebkitBackdropFilter: "blur(20px) saturate(145%)",
};

export const thinLightMaterial: CSSProperties = {
  background: "rgba(18, 21, 24, 0.304)",
  backdropFilter: "blur(16px) saturate(135%)",
  WebkitBackdropFilter: "blur(16px) saturate(135%)",
};

export const FROSTED_HAIRLINE = "1px solid transparent";
export const FROSTED_PANEL_OUTLINE = "1px solid rgba(255, 255, 255, 0.2)";
export const FROSTED_PANEL_SHADOW =
  "0 24px 80px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.7), inset 0 -1px 0 rgba(0, 0, 0, 0.12)";
export const FROSTED_CONTROL_SHADOW =
  "inset 0 1px 0 rgba(255, 255, 255, 0.096), inset 0 -1px 0 rgba(0, 0, 0, 0.144)";
export const EDITOR_PILL_TEXT_INSET_PX = 24;

const pageAccentRgbPalette = [
  [250, 196, 205],
  [188, 219, 250],
  [197, 228, 205],
  [248, 226, 174],
  [218, 204, 247],
  [246, 202, 181],
];

export const pageAccentPalette = pageAccentRgbPalette.map(
  ([r, g, b]) => `rgba(${r}, ${g}, ${b}, 0.496)`,
);

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function colorWithAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const hexMatch = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];
    const full =
      raw.length === 3
        ? raw
            .split("")
            .map((char) => char + char)
            .join("")
        : raw;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const rgbMatch = hex.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+)?\s*\)$/i,
  );
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}

export function pageAccentHexForIndex(index: number): string {
  const safeIndex =
    ((index % pageAccentRgbPalette.length) + pageAccentRgbPalette.length) %
    pageAccentRgbPalette.length;
  const [r, g, b] = pageAccentRgbPalette[safeIndex];
  return rgbToHex(r, g, b);
}

export function pageAccentForIndex(index: number, alpha = 0.496): string {
  const safeIndex =
    ((index % pageAccentRgbPalette.length) + pageAccentRgbPalette.length) %
    pageAccentRgbPalette.length;
  const [r, g, b] = pageAccentRgbPalette[safeIndex];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function pageAccentForPage(
  page: { accentColor?: string | null },
  index: number,
  alpha = 0.496,
): string {
  return page.accentColor
    ? colorWithAlpha(page.accentColor, alpha)
    : pageAccentForIndex(index, alpha);
}

// Sub Master accent palette (DEC-079). Distinct from the Global page palette
// so authors can tell a Sub Master group apart at a glance. Each Sub Master
// is assigned an ordinal at creation; the master row and its children all
// share the hue derived from that ordinal.
const subMasterRgbPalette = [
  [120, 180, 200], // deep teal
  [196, 130, 180], // magenta
  [212, 168, 96], // amber
  [168, 198, 110], // lime
  [142, 144, 200], // indigo
  [220, 142, 116], // coral
];

export function subMasterAccentForOrdinal(
  ordinal: number,
  alpha = 0.496,
): string {
  const safeOrdinal = Math.max(1, Math.floor(ordinal));
  const idx = (safeOrdinal - 1) % subMasterRgbPalette.length;
  const [r, g, b] = subMasterRgbPalette[idx];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function subMasterAccentHexForOrdinal(ordinal: number): string {
  const safeOrdinal = Math.max(1, Math.floor(ordinal));
  const idx = (safeOrdinal - 1) % subMasterRgbPalette.length;
  const [r, g, b] = subMasterRgbPalette[idx];
  return rgbToHex(r, g, b);
}

export type PageRowRole = "global" | "subMaster" | "subMasterChild";

// Returns the row accent for any page kind, honouring a per-page
// accentColor override when present. globalIndex is the page's position
// among global children only (used only when role === "global"). ordinal
// is the Sub Master's subMasterOrdinal (used when role !== "global"); for
// a child, pass the parent's ordinal so the group shares one hue.
export function pageAccentForPageWithGroup(
  page: { accentColor?: string | null },
  role: PageRowRole,
  globalIndex: number,
  ordinal: number | undefined,
  alpha = 0.496,
): string {
  if (page.accentColor) return colorWithAlpha(page.accentColor, alpha);
  if (role === "global") return pageAccentForIndex(globalIndex, alpha);
  return subMasterAccentForOrdinal(ordinal ?? 1, alpha);
}

// Chrome variants for Sub Master rows. The master gets a saturated 4 px left
// border in its hue; children share the hue at the standard alpha but are
// indented 12 px to read as nested.
export function subMasterRowBorderStyle(hex: string): CSSProperties {
  return { borderLeft: `4px solid ${hex}` };
}

export const subMasterChildIndentStyle: CSSProperties = {
  paddingLeft: 12,
};

// DEV NOTES: sidebar material system
// ----------------------------------
// This file is the first place to look when changing the editor sidebar.
//
// The current intent is dark overlay-box material:
// - regularLightMaterial: heavier separation. Used for the sidebar itself and
//   the main section bars: Pages, Cinematics, Topo, Forge/Data, Cards.
// - thinLightMaterial: lighter interactive material. Used for secondary bars,
//   selected rows, small buttons, and text inputs.
// - FROSTED_HAIRLINE: transparent internal layout border; the outer editor
//   panel keeps its visible border through FROSTED_PANEL_OUTLINE.
// - vibrancyLabel / Secondary / Tertiary: the only text color levels sidebar UI
//   should normally use. Avoid adding one-off colors for labels/headings.
//
// The main knobs for the rounded "bar" look are below:
// - frostedHeading: material + shape for top-level bars.
// - frostedSubheading: material + shape for second-level bars.
// - panelStyles.collapsibleHeader: spacing/layout of the top-level bars.
//
// If you want the bars less pill-like, reduce borderRadius from 999 to 8-14.
// If you want them more/less glassy, change alpha and blur in the material
// objects above, not in each individual panel.
export const frostedRoot = regularLightMaterial;
export const frostedNested = regularLightMaterial;
export const frostedMenuBar = regularLightMaterial;
export const frostedHeading: CSSProperties = {
  ...regularLightMaterial,
  border: "1px solid transparent",
  borderRadius: `var(--editor-bar-radius, ${EDITOR_FULL_RADIUS}px)`,
  boxSizing: "border-box",
  boxShadow: "none",
};
export const frostedSubheading: CSSProperties = {
  ...regularLightMaterial,
  background: EDITOR_HEADING_BAR_BACKGROUND,
  border: "1px solid transparent",
  borderRadius: `var(--editor-bar-radius, ${EDITOR_FULL_RADIUS}px)`,
  boxSizing: "border-box",
  boxShadow: "none",
};

export const panelStyles: Record<string, CSSProperties> = {
  body: {
    padding: "10px 14px 14px",
    overflowY: "auto",
    fontSize: 13,
    color: vibrancyLabel,
    fontFamily: TECHNICAL_MONO_FONT,
    flex: 1,
    background: "transparent",
  },
  globalSettingsBar: {
    ...frostedSubheading,
    display: "flex",
    alignItems: "var(--editor-container-align, center)",
    justifyContent: "var(--editor-container-justify, space-between)",
    gap: "var(--editor-container-gap, 14px)",
    width: "100%",
    minHeight: "var(--editor-nested-bar-height, 42px)",
    padding: `0 var(--editor-pill-text-inset, ${EDITOR_PILL_TEXT_INSET_PX}px)`,
    cursor: "pointer",
    userSelect: "none",
  },
  globalSettingsBody: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "8px 0 8px var(--editor-container-body-indent, 28px)",
  },
  section: {
    paddingBottom: 12,
    marginBottom: 12,
    borderBottom: FROSTED_HAIRLINE,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
  },
  layerLabel: {
    fontWeight: 600,
  },
  layerType: {
    fontSize: 11,
    color: vibrancySecondaryLabel,
    fontFamily: TECHNICAL_MONO_FONT,
    fontStyle: "italic",
    whiteSpace: "nowrap",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  fieldLabel: {
    width: 100,
    fontSize: 12,
    color: vibrancySecondaryLabel,
  },
  textInput: {
    ...thinLightMaterial,
    flex: 1,
    background: editorFieldBackground,
    color: editorFieldText,
    border: editorFieldBorder,
    borderRadius: 8,
    padding: "4px 8px",
    fontSize: 12,
    fontFamily: "inherit",
    caretColor: editorFieldText,
    colorScheme: "dark",
    boxShadow: "none",
  },
  numberReadout: {
    width: 40,
    fontSize: 11,
    color: vibrancySecondaryLabel,
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  },
  summary: {
    cursor: "pointer",
    fontSize: 12,
    color: vibrancySecondaryLabel,
    marginBottom: 6,
  },
  muted: {
    color: vibrancyTertiaryLabel,
    fontStyle: "italic",
    marginBottom: 8,
  },
  pageRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    width: "100%",
    minWidth: 0,
    minHeight: 28,
    padding: "4px 8px",
    border: "1px solid transparent",
    borderRadius: EDITOR_FULL_RADIUS,
    boxSizing: "border-box",
    overflow: "hidden",
    cursor: "pointer",
    transition: "border-color 140ms ease, box-shadow 140ms ease, opacity 140ms ease",
  },
  pageRowSelected: {
    ...thinLightMaterial,
    border: "1px solid transparent",
    borderRadius: EDITOR_FULL_RADIUS,
    boxShadow: "none",
  },
  iconButton: {
    ...thinLightMaterial,
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vibrancyLabel,
    border: "1px solid transparent",
    borderRadius: EDITOR_FULL_RADIUS,
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
    boxShadow: "none",
    appearance: "none",
    fontFamily: TECHNICAL_MONO_FONT,
  },
  primaryButton: {
    ...thinLightMaterial,
    padding: "6px 12px",
    color: vibrancyLabel,
    border: "1px solid transparent",
    borderRadius: EDITOR_FULL_RADIUS,
    fontSize: 13,
    cursor: "pointer",
    boxShadow: "none",
    appearance: "none",
    fontFamily: TECHNICAL_MONO_FONT,
  },
  button: {
    ...thinLightMaterial,
    width: 108,
    minHeight: 28,
    padding: "6px 10px",
    color: vibrancySecondaryLabel,
    border: "1px solid transparent",
    borderRadius: EDITOR_FULL_RADIUS,
    fontSize: 11,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "none",
    appearance: "none",
  },
  collapsibleSection: {
    borderTop: FROSTED_HAIRLINE,
  },
  // DEV NOTES: main heading bars
  // ----------------------------
  // This is the layout for the top-level sidebar bars:
  // Pages, Cinematics, Sections, Topo, Forge/Data, and Cards. The material/rounding comes from
  // frostedHeading above. Change margin/padding/minHeight here when the bars
  // need to align differently with the sidebar edges.
  collapsibleHeader: {
    ...frostedHeading,
    display: "flex",
    alignItems: "var(--editor-container-align, center)",
    justifyContent: "var(--editor-container-justify, space-between)",
    gap: "var(--editor-container-gap, 14px)",
    minHeight: "var(--editor-top-bar-height, 44px)",
    padding: `0 var(--editor-pill-text-inset, ${EDITOR_PILL_TEXT_INSET_PX}px)`,
    margin: `var(--editor-section-gap-y, ${EDITOR_SECTION_GAP_Y}px) var(--editor-section-margin-x, ${EDITOR_SECTION_MARGIN_X}px) var(--editor-top-bar-bottom-gap, 6px)`,
    cursor: "pointer",
    userSelect: "none",
  },
  // The click target at the right side of the main heading bars. The chevron
  // shape itself is disclosureChevron below; this wrapper controls hit size.
  disclosureTriangle: {
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    color: vibrancyLabel,
    flex: "none",
  },
  // CSS chevron used in CollapsibleSection. It rotates between closed/open.
  disclosureChevron: {
    width: 9,
    height: 9,
    borderRight: "2px solid rgba(244, 240, 232, 0.82)",
    borderBottom: "2px solid rgba(244, 240, 232, 0.82)",
    transformOrigin: "center",
    transition: "transform 160ms ease",
  },
  collapsibleTitle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontSize: 15,
    fontWeight: 600,
    color: vibrancyLabel,
    textTransform: "none",
    letterSpacing: 0,
    lineHeight: 1.15,
    fontFamily: TECHNICAL_MONO_FONT,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  collapsibleDetail: {
    fontSize: 12,
    color: vibrancySecondaryLabel,
    fontWeight: 400,
    textTransform: "none",
    letterSpacing: 0,
    marginLeft: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
  },
  collapsibleBody: {
    padding: 0,
  },
  collapsibleBodyFrame: {
    boxSizing: "border-box",
    padding:
      "0 var(--editor-section-margin-x, 12px) 0 var(--editor-container-body-indent, 28px)",
  },
  textarea: {
    ...thinLightMaterial,
    width: "100%",
    minHeight: 200,
    background: editorFieldBackground,
    color: editorFieldText,
    border: editorFieldBorder,
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
    caretColor: editorFieldText,
    colorScheme: "dark",
    boxShadow: "none",
  },
};
/*  */
