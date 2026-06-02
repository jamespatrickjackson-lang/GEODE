import type { Frame, SafeArea } from "../schema/frame";
import type { Container } from "../schema/container";
import type { Component } from "../schema/component";
import type { Guide } from "../schema/guide";
import type { AnchorLine } from "../schema/anchor";

export function anchorsForFrame(
  frame: Frame,
  containers: readonly Container[],
  components: readonly Component[],
  safeArea: SafeArea | null,
  guides: readonly Guide[],
  excludeIds: ReadonlySet<string>,
): readonly AnchorLine[] {
  const out: AnchorLine[] = [];
  // Frame edges and centres
  out.push({ axis: "x", position: 0, sourceKind: "frame-edge" });
  out.push({ axis: "x", position: frame.size.w, sourceKind: "frame-edge" });
  out.push({ axis: "y", position: 0, sourceKind: "frame-edge" });
  out.push({ axis: "y", position: frame.size.h, sourceKind: "frame-edge" });
  out.push({ axis: "x", position: frame.size.w / 2, sourceKind: "frame-centre" });
  out.push({ axis: "y", position: frame.size.h / 2, sourceKind: "frame-centre" });
  // Safe area
  if (safeArea) {
    out.push({ axis: "x", position: safeArea.left, sourceKind: "safe-area" });
    out.push({ axis: "x", position: frame.size.w - safeArea.right, sourceKind: "safe-area" });
    out.push({ axis: "y", position: safeArea.top, sourceKind: "safe-area" });
    out.push({ axis: "y", position: frame.size.h - safeArea.bottom, sourceKind: "safe-area" });
  }
  // Containers
  for (const c of containers) {
    if (excludeIds.has(c.id) || c.hidden) continue;
    pushRect(out, c.id, c.rect, "container-edge", "container-centre");
  }
  // Components
  for (const c of components) {
    if (excludeIds.has(c.id) || c.hidden) continue;
    pushRect(out, c.id, c.rect, "component-edge", "component-centre");
  }
  // Guides
  for (const g of guides) {
    if (g.frameId !== frame.id) continue;
    out.push({ axis: g.axis, position: g.position, sourceKind: "guide", sourceId: g.id });
  }
  return out;
}

function pushRect(
  out: AnchorLine[],
  sourceId: string,
  rect: { x: number; y: number; w: number; h: number },
  edgeKind: AnchorLine["sourceKind"],
  centreKind: AnchorLine["sourceKind"],
): void {
  out.push({ axis: "x", position: rect.x, sourceKind: edgeKind, sourceId });
  out.push({ axis: "x", position: rect.x + rect.w, sourceKind: edgeKind, sourceId });
  out.push({ axis: "y", position: rect.y, sourceKind: edgeKind, sourceId });
  out.push({ axis: "y", position: rect.y + rect.h, sourceKind: edgeKind, sourceId });
  out.push({ axis: "x", position: rect.x + rect.w / 2, sourceKind: centreKind, sourceId });
  out.push({ axis: "y", position: rect.y + rect.h / 2, sourceKind: centreKind, sourceId });
}
