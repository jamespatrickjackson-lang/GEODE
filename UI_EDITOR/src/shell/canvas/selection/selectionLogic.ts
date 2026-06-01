import type { Component } from "../../../core/schema/component";
import type { Container } from "../../../core/schema/container";
import type { Frame } from "../../../core/schema/frame";
import type { SelectionId } from "../../../core/schema/package";

export interface SelectableHit {
  kind: "container" | "component";
  id: string;
}

export function topmostElementAtFramePoint(
  point: { x: number; y: number },
  frame: Frame,
  containers: Record<string, Container>,
  components: Record<string, Component>,
): SelectableHit | null {
  for (let i = frame.componentIds.length - 1; i >= 0; i--) {
    const id = frame.componentIds[i]!;
    const c = components[id];
    if (c && !c.hidden && pointInside(point, c.rect)) {
      return { kind: "component", id };
    }
  }
  for (let i = frame.containerIds.length - 1; i >= 0; i--) {
    const id = frame.containerIds[i]!;
    const c = containers[id];
    if (c && !c.hidden) {
      const childHit = hitInsideContainer(point, c, containers, components);
      if (childHit) return childHit;
      if (pointInside(point, c.rect)) return { kind: "container", id };
    }
  }
  return null;
}

function hitInsideContainer(
  point: { x: number; y: number },
  container: Container,
  containers: Record<string, Container>,
  components: Record<string, Component>,
): SelectableHit | null {
  for (let i = container.componentIds.length - 1; i >= 0; i--) {
    const id = container.componentIds[i]!;
    const c = components[id];
    if (c && !c.hidden && pointInside(point, c.rect)) {
      return { kind: "component", id };
    }
  }
  for (let i = container.containerIds.length - 1; i >= 0; i--) {
    const id = container.containerIds[i]!;
    const c = containers[id];
    if (c && !c.hidden) {
      const childHit = hitInsideContainer(point, c, containers, components);
      if (childHit) return childHit;
      if (pointInside(point, c.rect)) return { kind: "container", id };
    }
  }
  return null;
}

function pointInside(p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function selectionEquals(a: ReadonlyArray<SelectionId>, b: ReadonlyArray<SelectionId>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.id !== b[i]!.id || a[i]!.kind !== b[i]!.kind) return false;
  }
  return true;
}

export function elementsWhollyEnclosedByRect(
  rect: { x: number; y: number; w: number; h: number },
  frame: Frame,
  containers: Record<string, Container>,
  components: Record<string, Component>,
): SelectionId[] {
  const out: SelectionId[] = [];
  for (const id of frame.componentIds) {
    const c = components[id];
    if (c && !c.hidden && rectContains(rect, c.rect)) {
      out.push({ kind: "component", id });
    }
  }
  for (const id of frame.containerIds) {
    const c = containers[id];
    if (c && !c.hidden && rectContains(rect, c.rect)) {
      out.push({ kind: "container", id });
    }
  }
  return out;
}

function rectContains(outer: { x: number; y: number; w: number; h: number }, inner: { x: number; y: number; w: number; h: number }): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}
