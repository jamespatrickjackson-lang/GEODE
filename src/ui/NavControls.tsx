import { useEditor } from "../editor/EditorContext";
import { frostedRoot, vibrancyLabel } from "../editor/styles";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import { usePageController } from "../pages/PageController";

// Nav button group as a single frosted chip. Its material follows
// Global Settings > GUI Styles, with optional Navigator-specific overrides.

const groupBaseStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  zIndex: 10,
  ...frostedRoot,
};

const buttonBaseStyle: React.CSSProperties = {
  background: "transparent",
  color: vibrancyLabel,
  border: "1px solid rgba(0, 0, 0, 0.08)",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "system-ui, sans-serif",
};

const arrowButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

const centerButtonStyle: React.CSSProperties = {};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  const rgbMatch = clean.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+)?\s*\)$/i,
  );
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return `rgba(246, 246, 246, ${alpha})`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface TrianglePoint {
  x: number;
  y: number;
}

function pointToward(
  from: TrianglePoint,
  to: TrianglePoint,
  distance: number,
): TrianglePoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0 || distance <= 0) return from;
  const amount = Math.min(0.46, distance / length);
  return {
    x: from.x + dx * amount,
    y: from.y + dy * amount,
  };
}

function trianglePoints(
  direction: "previous" | "next",
  bevelPx: number,
  size: number,
): string {
  const vertices =
    direction === "previous"
      ? [
          { x: 8.5, y: 2 },
          { x: 3.5, y: 6 },
          { x: 8.5, y: 10 },
        ]
      : [
          { x: 3.5, y: 2 },
          { x: 8.5, y: 6 },
          { x: 3.5, y: 10 },
        ];
  const bevel = clamp(bevelPx * (12 / Math.max(1, size)), 0, 2.4);
  if (bevel <= 0.01) {
    return vertices.map((point) => `${point.x} ${point.y}`).join(" ");
  }
  const points: TrianglePoint[] = [];
  vertices.forEach((point, index) => {
    const previous = vertices[(index + vertices.length - 1) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    points.push(pointToward(point, previous, bevel));
    points.push(pointToward(point, next, bevel));
  });
  return points
    .map((point) => `${point.x.toFixed(3)} ${point.y.toFixed(3)}`)
    .join(" ");
}

function NavTriangle({
  direction,
  size,
  fill,
  stroke,
  strokeWidth,
  bevel,
}: {
  direction: "previous" | "next";
  size: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  bevel: number;
}) {
  const points = trianglePoints(direction, bevel, size);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", overflow: "visible" }}
    >
      <polygon
        points={points}
        fill={fill}
        stroke={strokeWidth > 0 ? stroke : "none"}
        strokeWidth={strokeWidth}
        strokeLinejoin="bevel"
      />
    </svg>
  );
}

export function NavControls() {
  const { state, selectPage } = useEditor();
  const {
    currentIndex,
    pages,
    isTransitioning,
    freelookActive,
    goto,
    next,
    prev,
    resetToPose,
  } = usePageController();
  const globalSettingsSelected =
    !state.presenterMode && state.selectedPageId === ENVIRONMENT_SENTINEL;
  const firstVisibleIndex = pages.findIndex(
    (candidate) => candidate.hidden !== true,
  );
  const firstVisiblePage =
    firstVisibleIndex >= 0 ? pages[firstVisibleIndex] : null;
  let lastVisibleIndex = -1;
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    if (pages[i].hidden !== true) {
      lastVisibleIndex = i;
      break;
    }
  }
  const lastVisiblePage =
    lastVisibleIndex >= 0 ? pages[lastVisibleIndex] : null;
  const handlePrevious = () => {
    if (globalSettingsSelected && lastVisiblePage) {
      selectPage(lastVisiblePage.id);
      goto(lastVisibleIndex);
      return;
    }
    prev();
  };
  const handleNext = () => {
    if (globalSettingsSelected && firstVisiblePage) {
      selectPage(firstVisiblePage.id);
      goto(firstVisibleIndex);
      return;
    }
    next();
  };
  const navPageLabel = globalSettingsSelected
    ? "00. Global Settings"
    : (pages[currentIndex]?.title ?? "");

  const gui = state.environment.scene?.gui ?? {};
  const guiOverlay = gui.overlay ?? {};
  const guiNavigator = gui.navigator ?? {};
  const navigatorOverride = guiNavigator.useOverride === true;
  const navTextColor = navigatorOverride
    ? guiNavigator.textColor ?? guiOverlay.textColor ?? vibrancyLabel
    : guiOverlay.textColor ?? vibrancyLabel;
  const navBorderAlpha = clamp(
    navigatorOverride
      ? guiNavigator.borderAlpha ?? guiOverlay.borderAlpha ?? 0.58
      : guiOverlay.borderAlpha ?? 0.58,
    0,
    1,
  );
  const navBorderWidth = Math.max(
    0,
    navigatorOverride
      ? guiNavigator.borderWidth ?? guiOverlay.borderWidth ?? 1
      : guiOverlay.borderWidth ?? 1,
  );
  const navBorderSource = navigatorOverride
    ? guiNavigator.borderColor ?? guiOverlay.borderColor ?? "#ffffff"
    : guiOverlay.borderColor ?? "#ffffff";
  const navBorderColor = hexToRgba(
    navBorderSource,
    navBorderAlpha,
  );
  const navBackdropBlur = Math.max(
    0,
    navigatorOverride
      ? guiNavigator.backdropBlurPx ??
          guiOverlay.backdropBlurPx ??
          24
      : guiOverlay.backdropBlurPx ?? 24,
  );
  const navBackdropSaturation = Math.max(
    0,
    navigatorOverride
      ? guiNavigator.backdropSaturation ??
          guiOverlay.backdropSaturation ??
          180
      : guiOverlay.backdropSaturation ?? 180,
  );
  const navDividerAlpha = clamp(
    navigatorOverride ? guiNavigator.dividerAlpha ?? 0.22 : 0.22,
    0,
    1,
  );
  const navDividerColor = hexToRgba(
    navBorderSource,
    Math.min(navBorderAlpha, navDividerAlpha),
  );
  const navBackgroundColor = navigatorOverride
    ? guiNavigator.backgroundColor ??
      guiOverlay.backgroundColor ??
      "#f6f6f6"
    : guiOverlay.backgroundColor ?? "#f6f6f6";
  const navBackgroundAlpha = clamp(
    navigatorOverride
      ? guiNavigator.backgroundAlpha ??
          guiOverlay.backgroundAlpha ??
          0.72
      : guiOverlay.backgroundAlpha ?? 0.72,
    0,
    1,
  );
  const navRadius = navigatorOverride
    ? guiNavigator.radius ?? guiOverlay.radius ?? 999
    : guiOverlay.radius ?? 999;
  const navGroupPadding = navigatorOverride ? guiNavigator.groupPadding ?? 4 : 4;
  const navGap = navigatorOverride ? guiNavigator.gap ?? 4 : 4;
  const navBottom = navigatorOverride ? guiNavigator.bottom ?? 16 : 16;
  const navButtonPaddingX = navigatorOverride
    ? guiNavigator.buttonPaddingX ?? 14
    : 14;
  const navButtonPaddingY = navigatorOverride
    ? guiNavigator.buttonPaddingY ?? 6
    : 6;
  const navArrowSize = navigatorOverride ? guiNavigator.arrowSize ?? 10 : 10;
  const navArrowFillSource = navigatorOverride
    ? guiNavigator.arrowFillColor ?? navTextColor
    : navTextColor;
  const navArrowFill = navigatorOverride
    ? hexToRgba(
        navArrowFillSource,
        clamp(guiNavigator.arrowFillAlpha ?? 1, 0, 1),
      )
    : navArrowFillSource;
  const navArrowStroke = navigatorOverride
    ? hexToRgba(
        guiNavigator.arrowOutlineColor ?? navArrowFillSource,
        clamp(guiNavigator.arrowOutlineAlpha ?? 0, 0, 1),
      )
    : "transparent";
  const navArrowStrokeWidth = navigatorOverride
    ? Math.max(0, guiNavigator.arrowOutlineWidth ?? 0)
    : 0;
  const navArrowBevel = navigatorOverride ? guiNavigator.arrowBevel ?? 0 : 0;
  const navArrowPaddingX = navigatorOverride
    ? guiNavigator.arrowPaddingX ?? navButtonPaddingX
    : navButtonPaddingX;
  const navArrowPaddingY = navigatorOverride
    ? guiNavigator.arrowPaddingY ?? navButtonPaddingY
    : navButtonPaddingY;
  const navFontSize = navigatorOverride ? guiNavigator.fontSize ?? 13 : 13;
  const navFontWeight = navigatorOverride
    ? guiNavigator.fontWeight ?? guiOverlay.bodyFontWeight ?? 400
    : guiOverlay.bodyFontWeight ?? 400;
  const navFontStyle =
    (navigatorOverride
      ? guiNavigator.fontItalic ?? guiOverlay.bodyItalic
      : guiOverlay.bodyItalic) === true
      ? "italic"
      : "normal";
  const groupStyle: React.CSSProperties = {
    ...groupBaseStyle,
    bottom: navBottom,
    gap: navGap,
    padding: navGroupPadding,
    background: hexToRgba(navBackgroundColor, navBackgroundAlpha),
    border:
      navBorderWidth > 0
        ? `${navBorderWidth}px solid ${navBorderColor}`
        : "none",
    borderRadius: navRadius,
    overflow: "hidden",
    boxShadow: "none",
    backdropFilter: `blur(${navBackdropBlur}px) saturate(${navBackdropSaturation}%)`,
    WebkitBackdropFilter: `blur(${navBackdropBlur}px) saturate(${navBackdropSaturation}%)`,
  };
  const buttonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    color: navTextColor,
    border: `1px solid ${navDividerColor}`,
    borderRadius: navRadius,
    fontSize: navFontSize,
    fontWeight: navFontWeight,
    fontStyle: navFontStyle,
    padding: `${navButtonPaddingY}px ${navButtonPaddingX}px`,
  };
  const disabledStyle: React.CSSProperties = {
    opacity: 0.62,
    cursor: "default",
  };
  const arrowButtonPaddingStyle: React.CSSProperties = {
    padding: `${navArrowPaddingY}px ${navArrowPaddingX}px`,
  };

  return (
    <div style={groupStyle}>
      <button
        style={
          isTransitioning
            ? {
                ...buttonStyle,
                ...arrowButtonStyle,
                ...arrowButtonPaddingStyle,
                ...disabledStyle,
              }
            : { ...buttonStyle, ...arrowButtonStyle, ...arrowButtonPaddingStyle }
        }
        onClick={handlePrevious}
        disabled={isTransitioning}
        title="Previous page"
        aria-label="Previous page"
      >
        <NavTriangle
          direction="previous"
          size={navArrowSize}
          fill={navArrowFill}
          stroke={navArrowStroke}
          strokeWidth={navArrowStrokeWidth}
          bevel={navArrowBevel}
        />
      </button>
      <button
        style={
          freelookActive && !isTransitioning
            ? { ...buttonStyle, ...centerButtonStyle }
            : { ...buttonStyle, ...centerButtonStyle, ...disabledStyle }
        }
        onClick={resetToPose}
        disabled={!freelookActive || isTransitioning}
        title={freelookActive ? "Reset view to this page's pose" : undefined}
      >
          <span>{navPageLabel}</span>
        </button>
      <button
        style={
          isTransitioning
            ? {
                ...buttonStyle,
                ...arrowButtonStyle,
                ...arrowButtonPaddingStyle,
                ...disabledStyle,
              }
            : { ...buttonStyle, ...arrowButtonStyle, ...arrowButtonPaddingStyle }
        }
        onClick={handleNext}
        disabled={isTransitioning}
        title="Next page"
        aria-label="Next page"
      >
        <NavTriangle
          direction="next"
          size={navArrowSize}
          fill={navArrowFill}
          stroke={navArrowStroke}
          strokeWidth={navArrowStrokeWidth}
          bevel={navArrowBevel}
        />
      </button>
    </div>
  );
}
