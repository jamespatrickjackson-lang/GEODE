import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
  regularLightMaterial,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "./styles";

interface HoverInfo {
  x: number;
  y: number;
  source: string;
  note?: string;
  label: string;
  rect?: DOMRect;
  padding?: PaddingHit;
  box?: BoxModelInfo;
  locked?: boolean;
}

const SOURCE_ATTR = "data-dev-source";
const NOTE_ATTR = "data-dev-note";
const TEXT_SOURCE_ATTR = "data-dev-text-source";
const PADDING_SOURCE_ATTR = "data-dev-padding-source";

interface BoxModelInfo {
  rect: DOMRect;
  content: RectLike;
  paddingTop: RectLike | null;
  paddingRight: RectLike | null;
  paddingBottom: RectLike | null;
  paddingLeft: RectLike | null;
}

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PaddingHit {
  sides: string[];
  source: string;
}

export function DevModeInspector() {
  const [enabled, setEnabled] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [locked, setLocked] = useState<HoverInfo | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "d" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isTypingTarget(document.activeElement)
      ) {
        return;
      }
      event.preventDefault();
      setEnabled((value) => {
        const next = !value;
        if (!next) {
          setHover(null);
          setLocked(null);
        }
        return next;
      });
      setHover(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onPointerMove = (event: PointerEvent) => {
      if (locked) return;
      const next = inspectAtPoint(event);
      if (next) setHover(next);
    };

    const onPointerLeave = () => setHover(null);
    const onClick = (event: MouseEvent) => {
      const next = inspectAtPoint(event, { lock: true });
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      setLocked(next);
      setHover(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLocked(null);
    };

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerleave", onPointerLeave);
    return () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [enabled, locked]);

  if (!enabled) return null;

  const info = locked ?? hover;
  const tooltipLeft = info
    ? Math.min(info.x + 14, window.innerWidth - 330)
    : 16;
  const tooltipTop = info
    ? Math.min(info.y + 16, window.innerHeight - 132)
    : 16;

  return createPortal(
    <>
      <div style={devModeBadgeStyle}>Dev mode: hover to find code</div>
      {info?.box && <BoxModelOverlay box={info.box} />}
      {info?.rect && (
        <div
          style={{
            ...highlightStyle,
            left: info.rect.left,
            top: info.rect.top,
            width: info.rect.width,
            height: info.rect.height,
          }}
        />
      )}
      {info && (
        <div
          style={{
            ...tooltipStyle,
            left: tooltipLeft,
            top: tooltipTop,
          }}
        >
          <div style={tooltipKickerStyle}>
            {info.locked ? "clicked" : "hover"} · {info.label}
          </div>
          <div style={tooltipSourceStyle}>{info.source}</div>
          {info.padding && (
            <div style={tooltipPaddingStyle}>
              padding: {info.padding.sides.join(" + ")}
            </div>
          )}
          {info.note && <div style={tooltipNoteStyle}>{info.note}</div>}
          {info.locked && (
            <div style={tooltipNoteStyle}>Press Esc to clear the lock.</div>
          )}
        </div>
      )}
    </>,
    document.body,
  );
}

function inspectAtPoint(
  event: Pick<MouseEvent | PointerEvent, "clientX" | "clientY" | "target">,
  opts: { lock?: boolean } = {},
): HoverInfo | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;

  const textHit = findTextHit(event.clientX, event.clientY);
  const baseElement = textHit?.element ?? target;
  const annotated = baseElement.closest(`[${SOURCE_ATTR}]`);
  const fallback = annotated ? null : readReactDebugSource(baseElement);
  const element = annotated ?? fallback?.element ?? baseElement;
  const source =
    textHit?.source ?? annotated?.getAttribute(SOURCE_ATTR) ?? fallback?.source;
  const note =
    textHit?.note ?? annotated?.getAttribute(NOTE_ATTR) ?? fallback?.note;

  const rect = element.getBoundingClientRect();
  const box = opts.lock ? readBoxModel(element) : undefined;
  const padding = opts.lock
    ? readPaddingHit(element, event.clientX, event.clientY, source)
    : undefined;

  if (!source) {
    return {
      x: event.clientX,
      y: event.clientY,
      source: "No source tag found",
      note: "Add data-dev-source or data-dev-text-source to the nearest JSX element.",
      label: textHit?.label ?? describeElement(baseElement),
      rect: baseElement.getBoundingClientRect(),
      box: opts.lock ? readBoxModel(baseElement) : undefined,
      locked: opts.lock,
    };
  }

  return {
    x: event.clientX,
    y: event.clientY,
    source: padding?.source ?? source,
    note:
      padding && padding.sides.length > 0
        ? "Clicked inside this element's padding area."
        : note,
    label: textHit?.label ?? describeElement(element),
    rect,
    box,
    padding,
    locked: opts.lock,
  };
}

function BoxModelOverlay({ box }: { box: BoxModelInfo }) {
  return (
    <>
      {box.paddingTop && <div style={paddingRectStyle(box.paddingTop)} />}
      {box.paddingRight && <div style={paddingRectStyle(box.paddingRight)} />}
      {box.paddingBottom && <div style={paddingRectStyle(box.paddingBottom)} />}
      {box.paddingLeft && <div style={paddingRectStyle(box.paddingLeft)} />}
      <div style={contentRectStyle(box.content)} />
    </>
  );
}

function isTypingTarget(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLInputElement) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLSelectElement) return true;
  return element instanceof HTMLElement && element.isContentEditable;
}

function findTextHit(x: number, y: number):
  | { element: Element; source?: string; note?: string; label: string }
  | null {
  const node = getTextNodeAtPoint(x, y);
  if (!node || !cleanText(node.textContent)) return null;
  const element = node.parentElement;
  if (!element) return null;

  const textSourceElement = element.closest(`[${TEXT_SOURCE_ATTR}]`);
  const annotated = element.closest(`[${SOURCE_ATTR}]`);
  const source =
    textSourceElement?.getAttribute(TEXT_SOURCE_ATTR) ??
    annotated?.getAttribute(SOURCE_ATTR) ??
    readReactDebugSource(element)?.source;

  return {
    element: textSourceElement ?? annotated ?? element,
    source,
    note: textSourceElement
      ? textSourceElement.getAttribute(NOTE_ATTR) ?? undefined
      : "Text node hit. Add data-dev-text-source for a more exact text-location tag.",
    label: `text "${cleanText(node.textContent)}"`,
  };
}

function getTextNodeAtPoint(x: number, y: number): Text | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  const position = doc.caretPositionFromPoint?.(x, y);
  if (position?.offsetNode.nodeType === Node.TEXT_NODE) {
    return position.offsetNode as Text;
  }

  const range = doc.caretRangeFromPoint?.(x, y);
  if (range?.startContainer.nodeType === Node.TEXT_NODE) {
    return range.startContainer as Text;
  }

  return null;
}

function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role");
  const sourceLabel =
    element.getAttribute("aria-label") ??
    element.getAttribute("title") ??
    cleanText(element.textContent);
  return [tag, role ? `[role=${role}]` : "", sourceLabel]
    .filter(Boolean)
    .join(" ");
}

function readBoxModel(element: Element): BoxModelInfo {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const borderTop = cssNumber(style.borderTopWidth);
  const borderRight = cssNumber(style.borderRightWidth);
  const borderBottom = cssNumber(style.borderBottomWidth);
  const borderLeft = cssNumber(style.borderLeftWidth);
  const paddingTop = cssNumber(style.paddingTop);
  const paddingRight = cssNumber(style.paddingRight);
  const paddingBottom = cssNumber(style.paddingBottom);
  const paddingLeft = cssNumber(style.paddingLeft);

  const paddingBox = {
    left: rect.left + borderLeft,
    top: rect.top + borderTop,
    right: rect.right - borderRight,
    bottom: rect.bottom - borderBottom,
  };
  const content = {
    left: paddingBox.left + paddingLeft,
    top: paddingBox.top + paddingTop,
    width: Math.max(0, paddingBox.right - paddingBox.left - paddingLeft - paddingRight),
    height: Math.max(0, paddingBox.bottom - paddingBox.top - paddingTop - paddingBottom),
  };

  return {
    rect,
    content,
    paddingTop:
      paddingTop > 0
        ? {
            left: paddingBox.left,
            top: paddingBox.top,
            width: Math.max(0, paddingBox.right - paddingBox.left),
            height: paddingTop,
          }
        : null,
    paddingRight:
      paddingRight > 0
        ? {
            left: paddingBox.right - paddingRight,
            top: content.top,
            width: paddingRight,
            height: content.height,
          }
        : null,
    paddingBottom:
      paddingBottom > 0
        ? {
            left: paddingBox.left,
            top: paddingBox.bottom - paddingBottom,
            width: Math.max(0, paddingBox.right - paddingBox.left),
            height: paddingBottom,
          }
        : null,
    paddingLeft:
      paddingLeft > 0
        ? {
            left: paddingBox.left,
            top: content.top,
            width: paddingLeft,
            height: content.height,
          }
        : null,
  };
}

function readPaddingHit(
  element: Element,
  x: number,
  y: number,
  fallbackSource?: string,
): PaddingHit | undefined {
  const box = readBoxModel(element);
  const sides = [
    box.paddingTop && containsPoint(box.paddingTop, x, y) ? "top" : null,
    box.paddingRight && containsPoint(box.paddingRight, x, y) ? "right" : null,
    box.paddingBottom && containsPoint(box.paddingBottom, x, y) ? "bottom" : null,
    box.paddingLeft && containsPoint(box.paddingLeft, x, y) ? "left" : null,
  ].filter((side): side is string => !!side);
  if (sides.length === 0) return undefined;

  const paddingSource =
    element.closest(`[${PADDING_SOURCE_ATTR}]`)?.getAttribute(PADDING_SOURCE_ATTR) ??
    element.closest(`[${SOURCE_ATTR}]`)?.getAttribute(SOURCE_ATTR) ??
    fallbackSource ??
    "No padding source tag found";
  return { sides, source: paddingSource };
}

function containsPoint(rect: RectLike, x: number, y: number): boolean {
  return (
    x >= rect.left &&
    x <= rect.left + rect.width &&
    y >= rect.top &&
    y <= rect.top + rect.height
  );
}

function cssNumber(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(text: string | null): string | null {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > 44 ? `${cleaned.slice(0, 41)}...` : cleaned;
}

function readReactDebugSource(element: Element):
  | { source: string; note: string; element: Element }
  | null {
  const reactKey = Object.keys(element).find((key) =>
    key.startsWith("__reactFiber$"),
  );
  if (!reactKey) return null;

  let fiber = (element as unknown as Record<string, unknown>)[reactKey] as
    | Record<string, unknown>
    | undefined;
  if (!fiber) return null;

  while (fiber) {
    const debugSource = fiber._debugSource as
      | { fileName?: string; lineNumber?: number; columnNumber?: number }
      | undefined;
    if (debugSource?.fileName && debugSource.lineNumber) {
      const source = `${shortenPath(debugSource.fileName)}:${debugSource.lineNumber}`;
      return {
        source,
        note: "React dev source fallback. Add data-dev-source for a more specific style location.",
        element,
      };
    }
    fiber = fiber.return as Record<string, unknown> | undefined;
  }
  return null;
}

function shortenPath(fileName: string): string {
  const normalized = fileName.replace(/\\/g, "/");
  const srcIndex = normalized.lastIndexOf("/src/");
  if (srcIndex >= 0) return normalized.slice(srcIndex + 1);
  return normalized;
}

const devModeBadgeStyle: React.CSSProperties = {
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

const highlightStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 2147483645,
  border: "1px solid rgba(0, 122, 255, 0.85)",
  boxShadow: "0 0 0 2px rgba(0, 122, 255, 0.18)",
  borderRadius: 8,
  pointerEvents: "none",
};

function paddingRectStyle(rect: RectLike): React.CSSProperties {
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

function contentRectStyle(rect: RectLike): React.CSSProperties {
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

const tooltipStyle: React.CSSProperties = {
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

const tooltipKickerStyle: React.CSSProperties = {
  color: vibrancyTertiaryLabel,
  fontSize: 10,
  marginBottom: 2,
};

const tooltipSourceStyle: React.CSSProperties = {
  fontWeight: 700,
  color: vibrancyLabel,
};

const tooltipPaddingStyle: React.CSSProperties = {
  marginTop: 4,
  fontWeight: 700,
  color: "rgba(168, 92, 0, 0.95)",
};

const tooltipNoteStyle: React.CSSProperties = {
  color: vibrancySecondaryLabel,
  marginTop: 4,
};
