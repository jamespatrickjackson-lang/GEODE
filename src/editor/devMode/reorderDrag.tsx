import { useEffect, useRef, useState } from "react";
import { ORDER_GROUP_ATTR, ORDER_ID_ATTR } from "./constants";
import { computeDropIndex, type ReorderItemBox } from "./reorder";
import { commitReorder } from "./reorderRegistry";
import { reorderDropIndicatorStyle, reorderGhostStyle } from "./styles";

const DRAG_THRESHOLD_PX = 5;

interface ItemBox extends ReorderItemBox {
  left: number;
  width: number;
}

interface DragRender {
  ghostLeft: number;
  ghostTop: number;
  ghostWidth: number;
  ghostHeight: number;
  indicatorLeft: number;
  indicatorTop: number;
  indicatorWidth: number;
}

interface Candidate {
  groupKey: string;
  itemId: string;
  element: Element;
  startX: number;
  startY: number;
  fromIndex: number;
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value;
}

function groupBoxes(groupKey: string): ItemBox[] {
  const selector = `[${ORDER_GROUP_ATTR}="${cssEscape(groupKey)}"][${ORDER_ID_ATTR}]`;
  return Array.from(document.querySelectorAll(selector)).flatMap((node) => {
    const id = node.getAttribute(ORDER_ID_ATTR);
    if (!id) return [];
    const rect = node.getBoundingClientRect();
    return [{ id, top: rect.top, height: rect.height, left: rect.left, width: rect.width }];
  });
}

// F4: while a reorder drag is active, the dev-mode hover/lock handlers must
// stand down so a drag never selects or locks the row. A short post-drag window
// also swallows the synthetic click that fires after pointerup.
let activeReorderDrag = false;
let suppressClickUntil = 0;

export function isReorderDragging(): boolean {
  return activeReorderDrag;
}

export function isReorderClickSuppressed(): boolean {
  return Date.now() < suppressClickUntil;
}

// Phase 5 (D3): press-and-hold drag reorder over any element tagged with
// data-dev-order-group + data-dev-order-id. Inert until a collection is tagged;
// the index math lives in the pure, tested reorder helpers.
export function ReorderDragLayer({ enabled }: { enabled: boolean }) {
  const [render, setRender] = useState<DragRender | null>(null);
  const candidateRef = useRef<Candidate | null>(null);
  const draggingRef = useRef<{ candidate: Candidate; toIndex: number } | null>(
    null,
  );

  useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (event: PointerEvent) => {
      const element =
        event.target instanceof Element
          ? event.target.closest(`[${ORDER_ID_ATTR}]`)
          : null;
      if (!element) return;
      const groupKey = element.getAttribute(ORDER_GROUP_ATTR);
      const itemId = element.getAttribute(ORDER_ID_ATTR);
      if (!groupKey || !itemId) return;
      const boxes = groupBoxes(groupKey);
      const fromIndex = [...boxes]
        .sort((a, b) => a.top - b.top)
        .findIndex((box) => box.id === itemId);
      candidateRef.current = {
        groupKey,
        itemId,
        element,
        startX: event.clientX,
        startY: event.clientY,
        fromIndex,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const candidate = candidateRef.current;
      if (!candidate) return;
      const moved = Math.hypot(
        event.clientX - candidate.startX,
        event.clientY - candidate.startY,
      );
      if (!draggingRef.current && moved < DRAG_THRESHOLD_PX) return;

      const boxes = groupBoxes(candidate.groupKey);
      const sorted = [...boxes].sort((a, b) => a.top - b.top);
      const toIndex = computeDropIndex(sorted, event.clientY);
      draggingRef.current = { candidate, toIndex };
      activeReorderDrag = true;

      const startRect = candidate.element.getBoundingClientRect();
      const anchor =
        toIndex < sorted.length ? sorted[toIndex] : sorted[sorted.length - 1];
      const indicatorTop =
        toIndex < sorted.length
          ? anchor.top
          : anchor.top + anchor.height;
      setRender({
        ghostLeft: startRect.left,
        ghostTop: event.clientY - startRect.height / 2,
        ghostWidth: startRect.width,
        ghostHeight: startRect.height,
        indicatorLeft: anchor?.left ?? startRect.left,
        indicatorTop,
        indicatorWidth: anchor?.width ?? startRect.width,
      });
      event.preventDefault();
    };

    const onPointerUp = () => {
      const dragging = draggingRef.current;
      if (dragging) {
        const boxes = groupBoxes(dragging.candidate.groupKey).sort(
          (a, b) => a.top - b.top,
        );
        commitReorder({
          groupKey: dragging.candidate.groupKey,
          fromIndex: dragging.candidate.fromIndex,
          toIndex: dragging.toIndex,
          itemId: dragging.candidate.itemId,
          orderedIds: boxes.map((box) => box.id),
        });
        suppressClickUntil = Date.now() + 280;
      }
      activeReorderDrag = false;
      candidateRef.current = null;
      draggingRef.current = null;
      setRender(null);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      candidateRef.current = null;
      draggingRef.current = null;
    };
  }, [enabled]);

  if (!enabled || !render) return null;
  return (
    <>
      <div
        style={{
          ...reorderGhostStyle,
          left: render.ghostLeft,
          top: render.ghostTop,
          width: render.ghostWidth,
          height: render.ghostHeight,
        }}
      />
      <div
        style={{
          ...reorderDropIndicatorStyle,
          left: render.indicatorLeft,
          top: render.indicatorTop,
          width: render.indicatorWidth,
        }}
      />
    </>
  );
}
