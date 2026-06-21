import {
  CONTAINER_ATTR,
  CONTAINER_NAME_ATTR,
  CONTAINER_SCOPE_ATTR,
  CONTAINER_TYPE_ATTR,
  SOURCE_ATTR,
} from "./constants";
import { genericContainerType } from "./inspect";
import { packLabelRects, type LabelRect } from "./labelLayout";
import {
  clickableContainerLabelStyle,
  containerOutlineStyle,
  containerPointerDotStyle,
  containerPointerLineStyle,
  containerPointerSvgStyle,
  contentRectStyle,
  paddingRectStyle,
  selectedContainerLabelStyle,
  selectedContainerOutlineStyle,
  selectedContainerPointerDotStyle,
  selectedContainerPointerLineStyle,
} from "./styles";
import type { BoxModelInfo, ContainerOutlineInfo } from "./types";
import { cleanText } from "./util";

export interface ContainerLabelGeometry {
  left: number;
  top: number;
  width: number;
  lineY: number;
  lineStartX: number;
  lineEndX: number;
  lineEndY: number;
}

// Estimated rendered label height, used only for collision packing (D4).
const LABEL_HEIGHT = 18;
const LABEL_GAP = 4;

export function collectContainerOutlines(): ContainerOutlineInfo[] {
  return Array.from(
    document.querySelectorAll(`[${CONTAINER_ATTR}="true"]`),
  ).flatMap((element, index) => {
    if (!(element instanceof HTMLElement)) return [];
    if (element.closest("[data-dev-mode-control]")) return [];
    const rect = element.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return [];
    if (
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.top > window.innerHeight
    ) {
      return [];
    }
    const type =
      element.getAttribute(CONTAINER_TYPE_ATTR) ?? genericContainerType(element);
    const name =
      element.getAttribute(CONTAINER_NAME_ATTR) ??
      element.getAttribute("aria-label") ??
      cleanText(element.textContent) ??
      element.tagName.toLowerCase();
    const source = element.getAttribute(SOURCE_ATTR) ?? "unknown";
    return [
      {
        key: `${type}:${name}:${source}:${index}`,
        rect,
        name,
        type,
        scope: element.getAttribute(CONTAINER_SCOPE_ATTR) ?? undefined,
        element,
      },
    ];
  });
}

export function containerLabelGeometry(
  rect: DOMRect,
  name: string,
  type: string,
): ContainerLabelGeometry {
  const width = Math.min(
    300,
    Math.max(148, (name.length + type.length + 3) * 6.2),
  );
  const left = Math.max(4, rect.left - width - 24);
  const top = Math.max(
    4,
    Math.min(
      window.innerHeight - 22,
      rect.top + Math.max(0, Math.min(12, rect.height / 2 - 10)),
    ),
  );
  return finalizeLabelGeometry({ left, top, width, height: LABEL_HEIGHT }, rect);
}

function finalizeLabelGeometry(
  placed: LabelRect,
  rect: DOMRect,
): ContainerLabelGeometry {
  const { left, top, width } = placed;
  const lineY = top + LABEL_HEIGHT / 2;
  const lineStartX = left + width;
  const lineEndX = Math.max(lineStartX + 8, rect.left);
  const lineEndY = Math.min(Math.max(rect.top + 8, lineY), rect.bottom - 8);
  return { left, top, width, lineY, lineStartX, lineEndX, lineEndY };
}

// Places every container label then de-overlaps them (D4). Returns geometries
// aligned with the input outlines.
function packContainerLabels(
  outlines: ContainerOutlineInfo[],
): ContainerLabelGeometry[] {
  const base = outlines.map((outline) =>
    containerLabelGeometry(outline.rect, outline.name, outline.type),
  );
  const rects: LabelRect[] = base.map((geometry) => ({
    left: geometry.left,
    top: geometry.top,
    width: geometry.width,
    height: LABEL_HEIGHT,
  }));
  const packed = packLabelRects(
    rects,
    { width: window.innerWidth, height: window.innerHeight },
    { gap: LABEL_GAP, margin: 4 },
  );
  return packed.map((rect, index) =>
    finalizeLabelGeometry(rect, outlines[index].rect),
  );
}

export function ContainerOutlinesLayer({
  outlines,
  selectedElement,
  onSelect,
}: {
  outlines: ContainerOutlineInfo[];
  selectedElement: Element | undefined;
  onSelect: (element: Element) => void;
}) {
  const labels = packContainerLabels(outlines);
  return (
    <>
      {outlines.map((outline, index) => (
        <ContainerOutline
          key={outline.key}
          outline={outline}
          label={labels[index]}
          selected={outline.element === selectedElement}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function ContainerOutline({
  outline,
  label,
  selected,
  onSelect,
}: {
  outline: ContainerOutlineInfo;
  label: ContainerLabelGeometry;
  selected: boolean;
  onSelect: (element: Element) => void;
}) {
  return (
    <>
      <div
        style={{
          ...containerOutlineStyle,
          ...(selected ? selectedContainerOutlineStyle : {}),
          left: outline.rect.left,
          top: outline.rect.top,
          width: outline.rect.width,
          height: outline.rect.height,
        }}
      />
      <svg style={containerPointerSvgStyle} aria-hidden="true">
        <line
          x1={label.lineStartX}
          y1={label.lineY}
          x2={label.lineEndX}
          y2={label.lineEndY}
          style={
            selected
              ? selectedContainerPointerLineStyle
              : containerPointerLineStyle
          }
        />
        <circle
          cx={label.lineEndX}
          cy={label.lineEndY}
          r={2.5}
          style={
            selected ? selectedContainerPointerDotStyle : containerPointerDotStyle
          }
        />
      </svg>
      <button
        type="button"
        data-dev-mode-control="true"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect(outline.element);
        }}
        title={`${outline.name} - ${outline.type}`}
        aria-label={`Inspect container ${outline.name}`}
        style={{
          ...clickableContainerLabelStyle,
          ...(selected ? selectedContainerLabelStyle : {}),
          left: label.left,
          top: label.top,
          width: label.width,
        }}
      >
        {outline.name} - {outline.type}
      </button>
    </>
  );
}

export function BoxModelOverlay({ box }: { box: BoxModelInfo }) {
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
