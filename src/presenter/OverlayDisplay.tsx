import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import { usePageController } from "../pages/PageController";
import { overlayMarkdownPath, readFile } from "../editor/save";
import {
  frostedRoot,
  vibrancyLabel,
  vibrancySecondaryLabel,
} from "../editor/styles";
import { useEditor } from "../editor/EditorContext";
import { appAssetUrl } from "../projects/projectPathsRuntime";
import type { EasingName, PresentationPage } from "../pages/types";

// Audience-facing overlay panel. Free-floating frosted container that
// sizes/positions per-page (overlayLayout on PresentationPage). In
// editor mode the panel is draggable from any non-interactive surface
// and resizable from a bottom-right corner handle; final position +
// size commit on mouseup. In presenter mode interactions are inert --
// the overlay just renders at its saved layout.

type OverlayLayout = NonNullable<PresentationPage["overlayLayout"]>;

const DEFAULT_LAYOUT: OverlayLayout = {
  x: 0.7,
  y: 0.04,
  width: 0.27,
};

// Clamps applied at the boundary of every drag/resize tick.
const CLAMP = {
  yMax: 0.95,
  widthMin: 0.15,
  widthMax: 0.6,
  heightMin: 0.1,
  heightMax: 0.95,
};

const RESIZE_HANDLE_PX = 14;
const DEFAULT_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  color: vibrancyLabel,
  margin: 0,
  marginBottom: 4,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: vibrancySecondaryLabel,
  marginBottom: 18,
};

const overlayContentStyle: React.CSSProperties = {
  padding: 0,
  color: vibrancyLabel,
};

const markdownStyle: React.CSSProperties = {
  color: vibrancyLabel,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
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

function cssStringLiteral(value: string): string {
  return JSON.stringify(value);
}

function normalizeLayout(l: OverlayLayout): OverlayLayout {
  const width = clamp(l.width, CLAMP.widthMin, CLAMP.widthMax);
  const x = clamp(l.x, 0, 1 - width);
  const height =
    typeof l.height === "number"
      ? clamp(
          l.height,
          CLAMP.heightMin,
          Math.min(CLAMP.heightMax, Math.max(CLAMP.heightMin, 1 - l.y)),
        )
      : undefined;
  const yMax =
    typeof height === "number"
      ? Math.min(CLAMP.yMax, Math.max(0, 1 - height))
      : CLAMP.yMax;
  const y = clamp(l.y, 0, yMax);
  return { x, y, width, height };
}

function isInteractiveTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest("a, button, input, textarea, select, [data-resize]");
}

// Defaults only. Per-page overrides live in page.overlay.timing so text
// choreography can differ from camera choreography.
const DEFAULT_FADE_MS = 2000;
const DEFAULT_EASING: EasingName = "linear";

function overlayFadeMs(page: PresentationPage | null): number {
  return Math.max(0, page?.overlay?.timing?.fadeMs ?? DEFAULT_FADE_MS);
}

function overlaySlidePx(page: PresentationPage | null): number {
  const timing = page?.overlay?.timing as
    | { slidePx?: unknown; slideEnabled?: unknown }
    | undefined;
  if (timing?.slideEnabled === false) return 0;
  return Math.max(0, Number(timing?.slidePx ?? 36) || 36);
}

function overlayCssEasing(page: PresentationPage | null): string {
  const easing = page?.overlay?.timing?.easing ?? DEFAULT_EASING;
  switch (easing) {
    case "linear":
      return "linear";
    case "easeInOutCubic":
      return "cubic-bezier(0.65, 0, 0.35, 1)";
    case "easeOutQuart":
      return "cubic-bezier(0.25, 1, 0.5, 1)";
    case "easeInOutSine":
      return "cubic-bezier(0.37, 0, 0.63, 1)";
    case "easeOutCubic":
    default:
      return "cubic-bezier(0.33, 1, 0.68, 1)";
  }
}

function renderOverlayHtml(
  page: PresentationPage,
  text: string,
  projectRoot: string,
): string {
  if (!text || text.trim() === "") return "";
  const rendered = marked.parse(text, { async: false }) as string;
  // Image pass:
  //  1. Resolve relative src to /projects/<id>/overlays/<page>/<file>.
  //  2. Wrap each image in a figure so CSS can add an automatic bottom-right
  //     figure label without authors hand-writing captions in markdown.
  return rendered.replace(
    /<img\b([^>]*)>/g,
    (match: string, attrs: string) => {
      const srcMatch = /\bsrc="([^"]+)"/.exec(attrs);
      if (!srcMatch) return match;
      const src = srcMatch[1];
      const isAbsolute =
        src.startsWith("http://") ||
        src.startsWith("https://") ||
        src.startsWith("/") ||
        src.startsWith("data:");
      const resolvedSrc = isAbsolute
        ? src
        : appAssetUrl(`${projectRoot}/overlays/${page.id}/${src}`);
      const resolvedAttrs = attrs.replace(
        /\bsrc="[^"]+"/,
        `src="${resolvedSrc}"`,
      );
      return (
        `<figure class="presentation-overlay-figure">` +
        `<img${resolvedAttrs}>` +
        `<figcaption></figcaption>` +
        `</figure>`
      );
    },
  );
}

async function loadOverlayHtml(
  page: PresentationPage,
  projectRoot: string,
): Promise<string> {
  const text = await readFile(overlayMarkdownPath(page.id, projectRoot));
  return renderOverlayHtml(page, text ?? "", projectRoot);
}

export function OverlayDisplay() {
  const {
    pages,
    transitionFrame,
  } =
    usePageController();
  const page = pages[transitionFrame.sourceIndex];
  const targetPage =
    typeof transitionFrame.targetIndex === "number"
      ? pages[transitionFrame.targetIndex]
      : null;
  const { state, setPageOverlayLayout } = useEditor();
  const projectRoot = state.projectRoot;
  const isEditor = !state.presenterMode;

  const [htmlByPage, setHtmlByPage] = useState<Record<string, string>>({});
  // Live layout during a drag/resize. Null when not interacting.
  // Mirrored to a ref so the document-level mouseup handler can read
  // the final value without depending on React state lag.
  const [liveLayout, setLiveLayout] = useState<OverlayLayout | null>(null);
  const liveLayoutRef = useRef<OverlayLayout | null>(null);
  // panelRef must be declared up here, before any conditional return.
  // React's rules of hooks require the same hook count + order across
  // every render -- a ref defined after the early-out for "no overlay
  // content" mismatched on the first content-bearing render and
  // crashed with "Rendered more hooks than during the previous render."
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Reset live state on page change so a stray mid-drag doesn't bleed.
  useEffect(() => {
    setLiveLayout(null);
    liveLayoutRef.current = null;
  }, [page?.id]);

  useEffect(() => {
    const pagesToLoad = [page, targetPage].filter(
      (p): p is PresentationPage =>
        !!p && htmlByPage[p.id] === undefined,
    );
    if (pagesToLoad.length === 0) return;
    let cancelled = false;
    for (const p of pagesToLoad) {
      loadOverlayHtml(p, projectRoot)
        .then((nextHtml) => {
          if (cancelled) return;
          setHtmlByPage((prev) => ({ ...prev, [p.id]: nextHtml }));
        })
        .catch(() => {
          if (cancelled) return;
          setHtmlByPage((prev) => ({ ...prev, [p.id]: "" }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [page, targetPage, htmlByPage, projectRoot]);

  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    loadOverlayHtml(page, projectRoot)
      .then((nextHtml) => {
        if (cancelled) return;
        setHtmlByPage((prev) => ({ ...prev, [page.id]: nextHtml }));
      })
      .catch(() => {
        if (!cancelled) {
          setHtmlByPage((prev) => ({ ...prev, [page.id]: "" }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, state.overlays, projectRoot]);

  const guiOverlay = state.environment.scene?.gui?.overlay ?? {};
  const overlayTextColor = guiOverlay.textColor ?? vibrancyLabel;
  const overlaySecondaryTextColor =
    guiOverlay.secondaryTextColor ?? vibrancySecondaryLabel;
  const overlayBodyTextColor = guiOverlay.bodyTextColor ?? overlayTextColor;
  const overlayTextPadding =
    guiOverlay.textPadding ?? guiOverlay.contentPadding ?? 32;
  const overlayImagePadding = guiOverlay.imagePadding ?? 32;
  const overlayImageRadius = guiOverlay.imageRadius ?? 16;
  const overlayRadius =
    guiOverlay.bevelRatio === true
      ? overlayImageRadius + overlayImagePadding
      : guiOverlay.radius ?? 24;
  const headingFontFamily =
    guiOverlay.headingFontFamily ?? DEFAULT_FONT_FAMILY;
  const subheadingFontFamily =
    guiOverlay.subheadingFontFamily ?? DEFAULT_FONT_FAMILY;
  const bodyFontFamily = guiOverlay.bodyFontFamily ?? DEFAULT_FONT_FAMILY;
  const headingFontSize = guiOverlay.headingFontSize ?? 22;
  const subheadingFontSize = guiOverlay.subheadingFontSize ?? 13;
  const bodyFontSize = guiOverlay.bodyFontSize ?? 14;
  const headingFontWeight = guiOverlay.headingFontWeight ?? 600;
  const subheadingFontWeight = guiOverlay.subheadingFontWeight ?? 400;
  const bodyFontWeight = guiOverlay.bodyFontWeight ?? 400;
  const headingFontStyle = guiOverlay.headingItalic === true ? "italic" : "normal";
  const subheadingFontStyle =
    guiOverlay.subheadingItalic === true ? "italic" : "normal";
  const bodyFontStyle = guiOverlay.bodyItalic === true ? "italic" : "normal";
  const overlayBorderWidth = guiOverlay.borderWidth ?? 1;
  const overlayBorderAlpha = guiOverlay.borderAlpha ?? 0.58;
  const overlayBorderColor = hexToRgba(
    guiOverlay.borderColor ?? "#ffffff",
    clamp(overlayBorderAlpha, 0, 1),
  );
  const overlayBackground = hexToRgba(
    guiOverlay.backgroundColor ?? "#f6f6f6",
    clamp(guiOverlay.backgroundAlpha ?? 0.72, 0.05, 1),
  );
  const overlayTopHighlightAlpha = clamp(
    guiOverlay.topHighlightAlpha ?? 0.7,
    0,
    1,
  );
  const overlayBottomShadowAlpha = clamp(
    guiOverlay.bottomShadowAlpha ?? 0.12,
    0,
    1,
  );
  const overlayBackdropBlur = Math.max(0, guiOverlay.backdropBlurPx ?? 24);
  const overlayBackdropSaturation = Math.max(
    0,
    guiOverlay.backdropSaturation ?? 180,
  );
  const overlayShadowAlpha = clamp(guiOverlay.shadowAlpha ?? 0.24, 0, 1);
  const overlayShadowBlur = Math.max(0, guiOverlay.shadowBlur ?? 80);
  const overlayShadowOffsetY = Math.max(0, guiOverlay.shadowOffsetY ?? 24);
  const imageOutlineWidth = guiOverlay.imageOutlineWidth ?? 0;
  const imageOutlineColor = hexToRgba(
    guiOverlay.imageOutlineColor ?? "#ffffff",
    clamp(guiOverlay.imageOutlineAlpha ?? 0, 0, 1),
  );
  const imageShadowAlpha = clamp(guiOverlay.imageShadowAlpha ?? 0.18, 0, 1);
  const imageShadowBlur = Math.max(0, guiOverlay.imageShadowBlur ?? 24);
  const imageShadow =
    imageShadowAlpha > 0 && imageShadowBlur > 0
      ? `0 ${Math.max(1, Math.round(imageShadowBlur * 0.42))}px ${imageShadowBlur}px rgba(0, 0, 0, ${imageShadowAlpha})`
      : "none";
  const figureLabelVisible = guiOverlay.figureLabelVisible !== false;
  const figureLabelBackground = hexToRgba(
    guiOverlay.figureLabelBackgroundColor ?? "#000000",
    clamp(guiOverlay.figureLabelBackgroundAlpha ?? 0, 0, 1),
  );

  const latestPageById = (candidate: PresentationPage | null) => {
    if (!candidate) return null;
    return (
      state.pages.find((p) => p.id === candidate.id) ??
      pages.find((p) => p.id === candidate.id) ??
      candidate
    );
  };

  const pageHtml = (candidate: PresentationPage): string => {
    const liveText = state.overlays[candidate.id];
    if (liveText !== undefined) {
      return renderOverlayHtml(candidate, liveText, projectRoot);
    }
    return htmlByPage[candidate.id] ?? "";
  };

  const makePanelMouseDown =
    (layoutPage: PresentationPage, layout: OverlayLayout, canEdit: boolean) =>
    (e: React.MouseEvent) => {
      if (!isEditor || !canEdit) return;
      if (isInteractiveTarget(e.target)) return;
      e.preventDefault();
      const startMX = e.clientX;
      const startMY = e.clientY;
      const startLayout = normalizeLayout(layout);
      const onMove = (mv: MouseEvent) => {
        const dx = (mv.clientX - startMX) / window.innerWidth;
        const dy = (mv.clientY - startMY) / window.innerHeight;
        const next = normalizeLayout({
          x: startLayout.x + dx,
          y: startLayout.y + dy,
          width: startLayout.width,
          height: startLayout.height,
        });
        liveLayoutRef.current = next;
        setLiveLayout(next);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        const final = liveLayoutRef.current;
        liveLayoutRef.current = null;
        setLiveLayout(null);
        if (final) setPageOverlayLayout(layoutPage.id, final);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

  const makeResizeMouseDown =
    (layoutPage: PresentationPage, layout: OverlayLayout, canEdit: boolean) =>
    (e: React.MouseEvent) => {
      if (!isEditor || !canEdit) return;
      e.stopPropagation();
      e.preventDefault();
      const startMX = e.clientX;
      const startMY = e.clientY;
      const startW = layout.width;
      const measuredHeight =
        panelRef.current?.getBoundingClientRect().height ?? 0;
      const startH =
        typeof layout.height === "number"
          ? layout.height
          : measuredHeight / window.innerHeight;
      const onMove = (mv: MouseEvent) => {
        const dx = (mv.clientX - startMX) / window.innerWidth;
        const dy = (mv.clientY - startMY) / window.innerHeight;
        const next = normalizeLayout({
          x: layout.x,
          y: layout.y,
          width: startW + dx,
          height: startH + dy,
        });
        liveLayoutRef.current = next;
        setLiveLayout(next);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        const final = liveLayoutRef.current;
        liveLayoutRef.current = null;
        setLiveLayout(null);
        if (final) setPageOverlayLayout(layoutPage.id, final);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

  const transitionActive =
    transitionFrame.active &&
    !!page &&
    !!targetPage &&
    page.id !== targetPage.id;
  const direction =
    transitionFrame.targetIndex !== null &&
    transitionFrame.targetIndex < transitionFrame.sourceIndex
      ? -1
      : 1;
  const slidePx =
    transitionActive
      ? Math.max(0, overlaySlidePx(targetPage ?? page ?? null))
      : 0;
  const transitionT = clamp(transitionFrame.progress, 0, 1);

  const panelInstances =
    transitionActive && page && targetPage
      ? [
          {
            page,
            opacity: 1 - transitionT,
            offsetPx: -direction * slidePx * transitionT,
            key: `source:${page.id}`,
            canEdit: false,
            zIndex: 19,
          },
          {
            page: targetPage,
            opacity: transitionT,
            offsetPx: direction * slidePx * (1 - transitionT),
            key: `target:${targetPage.id}`,
            canEdit: false,
            zIndex: 20,
          },
        ]
      : page
        ? [
            {
              page,
              opacity: 1,
              offsetPx: 0,
              key: `page:${page.id}`,
              canEdit: true,
              zIndex: 19,
            },
          ]
        : [];

  const renderedPanels = panelInstances
    .map((instance) => {
      const renderPage = latestPageById(instance.page);
      if (!renderPage) return null;
      if (renderPage.overlay?.hidden === true) return null;
      const renderHtml = pageHtml(renderPage);
      const renderTitleTrimmed = (renderPage.title ?? "").trim();
      const renderSubtitleTrimmed = (renderPage.subtitle ?? "").trim();
      const explicitShow = renderPage.overlay?.hidden === false;
      const hasAnyContent =
        renderHtml !== "" ||
        renderTitleTrimmed !== "" ||
        renderSubtitleTrimmed !== "";
      if (!explicitShow && !hasAnyContent) return null;
      const savedLayout = renderPage.overlayLayout ?? DEFAULT_LAYOUT;
      const layout = instance.canEdit && liveLayout ? liveLayout : savedLayout;
      const heightStyle: React.CSSProperties =
        typeof layout.height === "number"
          ? { height: `${layout.height * 100}%` }
          : { height: "max-content" };

      // Use position:absolute to match the sidebar's working pattern.
      // global.css clamps body / #root with overflow:hidden, which on
      // Chrome makes backdrop-filter degrade to "just the background
      // color" for position:fixed children of an overflow:hidden body.
      // The App root is position:absolute inset:0 so absolute children
      // anchor to the viewport equivalently AND keep the backdrop-filter
      // compositing path that the sidebar already uses successfully.
      const panelStyle: React.CSSProperties = {
        position: "absolute",
        left: `${layout.x * 100}%`,
        top: `${layout.y * 100}%`,
        width: `${layout.width * 100}%`,
        ...heightStyle,
        color: vibrancyLabel,
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
        lineHeight: 1.55,
        padding: 0,
        boxSizing: "border-box",
        border: `${overlayBorderWidth}px solid ${overlayBorderColor}`,
        borderRadius: overlayRadius,
        overflow: "hidden",
        boxShadow: `0 ${overlayShadowOffsetY}px ${overlayShadowBlur}px rgba(0, 0, 0, ${overlayShadowAlpha}), inset 0 1px 0 rgba(255, 255, 255, ${overlayTopHighlightAlpha}), inset 0 -1px 0 rgba(0, 0, 0, ${overlayBottomShadowAlpha})`,
        outline: "1px solid rgba(0, 0, 0, 0.08)",
        // Above scene labels (18), below the editor sidebar/light toggle chrome.
        zIndex: instance.zIndex,
        cursor:
          isEditor && instance.canEdit
            ? liveLayout
              ? "grabbing"
              : "grab"
            : "default",
        userSelect: liveLayout ? "none" : "auto",
        ...frostedRoot,
        background: overlayBackground,
        // Re-spell backdrop-filter explicitly after the spread so it's
        // unambiguously present in the inline style React generates.
        backdropFilter: `blur(${overlayBackdropBlur}px) saturate(${overlayBackdropSaturation}%)`,
        WebkitBackdropFilter: `blur(${overlayBackdropBlur}px) saturate(${overlayBackdropSaturation}%)`,
        opacity: instance.opacity,
        transform: `translate3d(${instance.offsetPx.toFixed(1)}px, 0, 0)`,
        transition: transitionActive
          ? "none"
          : `opacity ${overlayFadeMs(renderPage)}ms ${overlayCssEasing(renderPage)}, transform ${overlayFadeMs(renderPage)}ms ${overlayCssEasing(renderPage)}`,
        // Make the panel inert during fade-out so a stray click on
        // mid-transition content can't fire a navigate or drag.
        pointerEvents:
          instance.canEdit && instance.opacity >= 0.5 ? "auto" : "none",
      };

      // Resize handle anchored bottom-right via explicit `inset` so the
      // value can't be silently overridden by a parent style cascade.
      // z-index above any rendered markdown content (images especially)
      // so a wide image overlapping the corner can't intercept mousedown.
      const resizeHandleStyle: React.CSSProperties = {
        position: "absolute",
        inset: "auto 8px 8px auto",
        width: RESIZE_HANDLE_PX,
        height: RESIZE_HANDLE_PX,
        background: "rgba(255, 255, 255, 0.18)",
        border: "1px solid rgba(255, 255, 255, 0.25)",
        borderRadius: 3,
        cursor: "nwse-resize",
        boxShadow: "inset -2px -2px 0 rgba(255, 255, 255, 0.12)",
        zIndex: 2,
      };

      const renderTitle = renderPage.title ?? "";
      const renderSubtitle = renderPage.subtitle ?? "";

      return (
        <div
          key={instance.key}
          ref={instance.canEdit ? panelRef : undefined}
          style={panelStyle}
          onMouseDown={makePanelMouseDown(renderPage, layout, instance.canEdit)}
        >
          <div
            className="presentation-overlay-content"
            style={
              {
                ...overlayContentStyle,
                color: overlayBodyTextColor,
                boxSizing: "border-box",
                height: typeof layout.height === "number" ? "100%" : "auto",
                overflowY:
                  typeof layout.height === "number" ? "auto" : "visible",
                "--presentation-overlay-text": overlayBodyTextColor,
                "--presentation-overlay-secondary": overlaySecondaryTextColor,
                "--presentation-overlay-text-padding": `${overlayTextPadding}px`,
                "--presentation-overlay-image-padding": `${overlayImagePadding}px`,
                "--presentation-overlay-body-font": bodyFontFamily,
                "--presentation-overlay-body-size": `${bodyFontSize}px`,
                "--presentation-overlay-body-weight": bodyFontWeight,
                "--presentation-overlay-body-style": bodyFontStyle,
                "--presentation-overlay-image-radius": `${overlayImageRadius}px`,
                "--presentation-overlay-image-margin": `${guiOverlay.imageSpacing ?? 14}px`,
                "--presentation-overlay-image-outline": `${imageOutlineWidth}px solid ${imageOutlineColor}`,
                "--presentation-overlay-image-shadow": imageShadow,
                "--presentation-overlay-figure-display": figureLabelVisible
                  ? "flex"
                  : "none",
                "--presentation-overlay-figure-prefix": cssStringLiteral(
                  guiOverlay.figureLabelPrefix ?? "Fig.",
                ),
                "--presentation-overlay-figure-color":
                  guiOverlay.figureLabelColor ?? overlayBodyTextColor,
                "--presentation-overlay-figure-font":
                  guiOverlay.figureLabelFontFamily ?? bodyFontFamily,
                "--presentation-overlay-figure-font-size": `${guiOverlay.figureLabelFontSize ?? 11}px`,
                "--presentation-overlay-figure-padding-x": `${guiOverlay.figureLabelPaddingX ?? 8}px`,
                "--presentation-overlay-figure-padding-y": `${guiOverlay.figureLabelPaddingY ?? 4}px`,
                "--presentation-overlay-figure-inset": `${guiOverlay.figureLabelInset ?? 10}px`,
                "--presentation-overlay-figure-background": figureLabelBackground,
                "--presentation-overlay-figure-radius": `${guiOverlay.figureLabelRadius ?? 999}px`,
              } as React.CSSProperties
            }
          >
            <h1
              style={{
                ...titleStyle,
                color: overlayTextColor,
                fontFamily: headingFontFamily,
                fontSize: headingFontSize,
                fontWeight: headingFontWeight,
                fontStyle: headingFontStyle,
                padding: `${overlayTextPadding}px ${overlayTextPadding}px 0`,
              }}
            >
              {renderTitle}
            </h1>
            {renderSubtitle && (
              <div
                style={{
                  ...subtitleStyle,
                  color: overlaySecondaryTextColor,
                  fontFamily: subheadingFontFamily,
                  fontSize: subheadingFontSize,
                  fontWeight: subheadingFontWeight,
                  fontStyle: subheadingFontStyle,
                  padding: `0 ${overlayTextPadding}px`,
                }}
              >
                {renderSubtitle}
              </div>
            )}
            <div
              className="presentation-overlay-markdown"
              style={{
                ...markdownStyle,
                color: overlayBodyTextColor,
                fontFamily: bodyFontFamily,
                fontSize: bodyFontSize,
                fontWeight: bodyFontWeight,
                fontStyle: bodyFontStyle,
                paddingBottom: overlayTextPadding,
              }}
              // Markdown is authored by internal staff (#022 dev-only writes).
              // Not adversarial input -- direct innerHTML is acceptable for alpha.
              dangerouslySetInnerHTML={{ __html: renderHtml }}
            />
          </div>
          {isEditor && instance.canEdit && (
            <div
              data-resize
              style={resizeHandleStyle}
              onMouseDown={makeResizeMouseDown(
                renderPage,
                layout,
                instance.canEdit,
              )}
              title="Drag to resize"
            />
          )}
        </div>
      );
    })
    .filter((panel): panel is JSX.Element => panel !== null);

  if (renderedPanels.length === 0) return null;

  return <>{renderedPanels}</>;
}
