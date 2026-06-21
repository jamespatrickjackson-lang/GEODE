import {
  CONTAINER_ATTR,
  CONTAINER_NAME_ATTR,
  CONTAINER_SCOPE_ATTR,
  CONTAINER_TYPE_ATTR,
  NOTE_ATTR,
  SOURCE_ATTR,
  TEXT_SOURCE_ATTR,
} from "./constants";
import type { HoverInfo } from "./types";
import { cleanText, shortenPath } from "./util";
import { readEditableText } from "./text";
import { readBoxModel, readPaddingHit } from "./boxModel";

interface TextHit {
  element: Element;
  source?: string;
  note?: string;
  label: string;
}

interface ResolveParams {
  baseElement: Element;
  textHit: TextHit | null;
  x: number;
  y: number;
  lock: boolean;
  computePadding: boolean;
}

function resolveHoverInfo({
  baseElement,
  textHit,
  x,
  y,
  lock,
  computePadding,
}: ResolveParams): HoverInfo {
  const container = baseElement.closest(`[${CONTAINER_ATTR}="true"]`);
  const annotated = container ?? baseElement.closest(`[${SOURCE_ATTR}]`);
  const fallback = annotated ? null : readReactDebugSource(baseElement);
  const element = annotated ?? fallback?.element ?? baseElement;
  const source =
    textHit?.source ?? annotated?.getAttribute(SOURCE_ATTR) ?? fallback?.source;
  const note =
    textHit?.note ?? annotated?.getAttribute(NOTE_ATTR) ?? fallback?.note;
  const containerName =
    container?.getAttribute(CONTAINER_NAME_ATTR) ??
    cleanText(element.textContent) ??
    undefined;
  const containerType =
    container?.getAttribute(CONTAINER_TYPE_ATTR) ?? genericContainerType(element);
  const containerScope =
    container?.getAttribute(CONTAINER_SCOPE_ATTR) ?? undefined;
  const textElement = findPrimaryTextElement(textHit?.element, element);
  const textValue = textElement ? readEditableText(textElement) : undefined;
  const textSource =
    textElement?.getAttribute(TEXT_SOURCE_ATTR) ?? textHit?.source ?? undefined;

  const rect = element.getBoundingClientRect();
  const box = lock ? readBoxModel(element) : undefined;
  const padding = computePadding
    ? readPaddingHit(element, x, y, source)
    : undefined;

  if (!source) {
    return {
      x,
      y,
      source: "No source tag found",
      note: "Add data-dev-source or data-dev-text-source to the nearest JSX element.",
      label: textHit?.label ?? describeElement(baseElement),
      rect: baseElement.getBoundingClientRect(),
      box: lock ? readBoxModel(baseElement) : undefined,
      locked: lock,
      element: baseElement,
      containerName,
      containerType,
      containerScope,
      textElement,
      textValue,
      textSource,
    };
  }

  return {
    x,
    y,
    source: padding?.source ?? source,
    note:
      padding && padding.sides.length > 0
        ? "Clicked inside this element's padding area."
        : note,
    label: containerName
      ? `${containerName} (${containerType})`
      : textHit?.label ?? describeElement(element),
    rect,
    box,
    padding,
    locked: lock,
    element,
    containerName,
    containerType,
    containerScope,
    textElement,
    textValue,
    textSource,
  };
}

export function inspectAtPoint(
  event: Pick<MouseEvent | PointerEvent, "clientX" | "clientY" | "target">,
  opts: { lock?: boolean } = {},
): HoverInfo | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;

  const textHit = findTextHit(event.clientX, event.clientY);
  const baseElement = textHit?.element ?? target;
  return resolveHoverInfo({
    baseElement,
    textHit,
    x: event.clientX,
    y: event.clientY,
    lock: Boolean(opts.lock),
    computePadding: Boolean(opts.lock),
  });
}

/**
 * Builds a locked HoverInfo from a known element (e.g. a clicked container
 * label) without re-resolving through a pointer hit-test. Used by Phase 1
 * clickable container labels so a back-panel container can be selected even
 * when its children intercept the pointer.
 */
export function inspectElement(
  element: Element,
  opts: { lock?: boolean } = {},
): HoverInfo | null {
  if (!(element instanceof Element)) return null;
  const rect = element.getBoundingClientRect();
  return resolveHoverInfo({
    baseElement: element,
    textHit: null,
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    lock: opts.lock ?? true,
    computePadding: false,
  });
}

export function genericContainerType(element: Element | undefined): string {
  if (!element) return "unknown";
  const attrType = element.getAttribute(CONTAINER_TYPE_ATTR);
  if (attrType) return attrType;
  const role = element.getAttribute("role");
  if (role) return `${element.tagName.toLowerCase()}[${role}]`;
  return element.tagName.toLowerCase();
}

function findPrimaryTextElement(
  preferred: Element | undefined,
  fallback: Element,
): HTMLElement | undefined {
  const candidates = [preferred, fallback];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (
      candidate instanceof HTMLElement &&
      candidate.hasAttribute(TEXT_SOURCE_ATTR)
    ) {
      return candidate;
    }
    const closest = candidate.closest?.(`[${TEXT_SOURCE_ATTR}]`);
    if (closest instanceof HTMLElement) return closest;
    const child = candidate.querySelector?.(`[${TEXT_SOURCE_ATTR}]`);
    if (child instanceof HTMLElement) return child;
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate instanceof HTMLElement && readEditableText(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function findTextHit(x: number, y: number): TextHit | null {
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
