import { PADDING_SOURCE_ATTR, SOURCE_ATTR } from "./constants";
import type { BoxModelInfo, PaddingHit, RectLike } from "./types";
import { cssNumber } from "./util";

export function readBoxModel(element: Element): BoxModelInfo {
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

export function readPaddingHit(
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

export function containsPoint(rect: RectLike, x: number, y: number): boolean {
  return (
    x >= rect.left &&
    x <= rect.left + rect.width &&
    y >= rect.top &&
    y <= rect.top + rect.height
  );
}
