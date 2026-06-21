// Phase 5 (D3): pure helpers for the dev-mode "ordered collection" reorder
// primitive. No DOM / no React, so the index math is unit-testable with
// synthetic fixtures (per the page-agnostic ban: never live pageOrder/ids).

export interface ReorderItemBox {
  id: string;
  top: number;
  height: number;
}

// Drop index for a pointer Y over a vertical list of item boxes. Uses each
// item's midpoint so the drop lands above/below the hovered item naturally.
export function computeDropIndex(
  items: ReorderItemBox[],
  pointerY: number,
): number {
  if (items.length === 0) return 0;
  const sorted = [...items].sort((a, b) => a.top - b.top);
  for (let index = 0; index < sorted.length; index += 1) {
    const mid = sorted[index].top + sorted[index].height / 2;
    if (pointerY < mid) return index;
  }
  return sorted.length;
}

// Moves the item at fromIndex so it sits at toIndex in the resulting array.
export function reorderArray<T>(
  list: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= list.length ||
    toIndex < 0 ||
    toIndex > list.length
  ) {
    return list.slice();
  }
  const next = list.slice();
  const [moved] = next.splice(fromIndex, 1);
  // Account for the removal shifting indices when moving downward.
  const target = toIndex > fromIndex ? toIndex - 1 : toIndex;
  next.splice(target, 0, moved);
  return next;
}

// Translates a from/to move into the minimal sequence of single-step swaps.
// Lets the primitive drive collections whose only model dispatch is step-wise
// up/down (e.g. pages: reorderPage(id, "up"|"down")) without a new dispatch.
export function stepsForMove(
  fromIndex: number,
  toIndex: number,
): ("up" | "down")[] {
  const clampedTarget = toIndex > fromIndex ? toIndex - 1 : toIndex;
  const delta = clampedTarget - fromIndex;
  if (delta === 0) return [];
  const direction = delta > 0 ? "down" : "up";
  return new Array(Math.abs(delta)).fill(direction);
}
