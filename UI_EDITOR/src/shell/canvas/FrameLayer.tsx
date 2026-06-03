import type { Frame } from "../../core/schema/frame";
import type { Container } from "../../core/schema/container";
import type { Component } from "../../core/schema/component";
import type { Guide } from "../../core/schema/guide";
import type { SmartGuide } from "../../core/geometry/smartGuides";
import type { Rect } from "../../core/schema/primitives";
import type { HandleId } from "../../core/geometry/transform";
import { SafeAreaOverlay } from "./SafeAreaOverlay";
import { GuidesLayer } from "./GuidesLayer";
import { SelectionLayer } from "./SelectionLayer";
import { RenderComponent, RenderContainer, type ColourResolver } from "./elements/RenderDispatcher";

interface Props {
  frame: Frame;
  zoom: number;
  containers: Record<string, Container>;
  components: Record<string, Component>;
  resolveColour: ColourResolver;
  guides: ReadonlyArray<Guide>;
  smartGuides: ReadonlyArray<SmartGuide>;
  selectedRects: ReadonlyArray<Rect>;
  showHandles: boolean;
  isActive: boolean;
  onFramePointerDown?: (evt: React.PointerEvent) => void;
  onElementPointerDown?: (kind: "container" | "component", id: string, evt: React.PointerEvent) => void;
  onHandlePointerDown?: (handle: HandleId, evt: React.PointerEvent) => void;
  activeBackgroundUrl?: string;
}

// Elements carry Frame-space rects regardless of nesting depth (see
// 07_package_format.md §5). The renderer must therefore walk the whole tree —
// not just the frame's direct children — emitting parents before their
// children so child chrome paints on top of the container behind it.
type FrameNode =
  | { kind: "container"; el: Container }
  | { kind: "component"; el: Component };

function flattenFrameTree(
  frame: Frame,
  containers: Record<string, Container>,
  components: Record<string, Component>,
): FrameNode[] {
  const out: FrameNode[] = [];
  const visited = new Set<string>();
  const walkContainer = (containerId: string) => {
    const c = containers[containerId];
    if (!c || c.hidden || visited.has(c.id)) return;
    visited.add(c.id);
    out.push({ kind: "container", el: c });
    for (const childId of c.containerIds) walkContainer(childId);
    for (const childId of c.componentIds) {
      const comp = components[childId];
      if (comp && !comp.hidden && !visited.has(comp.id)) {
        visited.add(comp.id);
        out.push({ kind: "component", el: comp });
      }
    }
  };
  for (const id of frame.containerIds) walkContainer(id);
  for (const id of frame.componentIds) {
    const comp = components[id];
    if (comp && !comp.hidden && !visited.has(comp.id)) {
      visited.add(comp.id);
      out.push({ kind: "component", el: comp });
    }
  }
  // Safety net: any element tagged with this frameId that the parent-chain
  // walk missed (orphaned parentId) still renders, so nothing silently
  // disappears.
  for (const c of Object.values(containers)) {
    if (c.frameId === frame.id && !c.hidden && !visited.has(c.id)) {
      visited.add(c.id);
      out.push({ kind: "container", el: c });
    }
  }
  for (const c of Object.values(components)) {
    if (c.frameId === frame.id && !c.hidden && !visited.has(c.id)) {
      visited.add(c.id);
      out.push({ kind: "component", el: c });
    }
  }
  return out;
}

export function FrameLayer({
  frame,
  zoom,
  containers,
  components,
  resolveColour,
  guides,
  smartGuides,
  selectedRects,
  showHandles,
  isActive,
  onFramePointerDown,
  onElementPointerDown,
  onHandlePointerDown,
  activeBackgroundUrl,
}: Props) {
  return (
    <div
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onFramePointerDown?.(e);
      }}
      style={{
        position: "absolute",
        left: frame.positionOnCanvas.x * zoom,
        top: frame.positionOnCanvas.y * zoom,
        width: frame.size.w * zoom,
        height: frame.size.h * zoom,
        transformOrigin: "top left",
      }}
    >
      {/* Frame name tab, sized in screen px (not scaled) so it stays legible. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -18,
          font: '11px system-ui, -apple-system, "Segoe UI", sans-serif',
          color: isActive ? "rgba(120,180,220,1)" : "rgba(244,240,232,0.6)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {frame.name ?? frame.id}
      </div>
      <div
        style={{
          width: frame.size.w,
          height: frame.size.h,
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
          background: activeBackgroundUrl
            ? `center/cover no-repeat url(${activeBackgroundUrl}), rgba(34,38,44,1)`
            : "rgba(34,38,44,1)",
          outline: isActive ? "2px solid rgba(120,180,220,0.85)" : "1px solid rgba(255,255,255,0.22)",
          position: "relative",
          color: "rgba(244,240,232,1)",
        }}
      >
        {flattenFrameTree(frame, containers, components).map((node) =>
          node.kind === "container" ? (
            <div
              key={node.el.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                onElementPointerDown?.("container", node.el.id, e);
              }}
              style={{
                position: "absolute",
                left: node.el.rect.x,
                top: node.el.rect.y,
                width: node.el.rect.w,
                height: node.el.rect.h,
                cursor: node.el.locked ? "not-allowed" : "move",
              }}
            >
              <RenderContainer container={node.el} resolve={resolveColour} />
            </div>
          ) : (
            <div
              key={node.el.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                onElementPointerDown?.("component", node.el.id, e);
              }}
              style={{
                position: "absolute",
                left: node.el.rect.x,
                top: node.el.rect.y,
                width: node.el.rect.w,
                height: node.el.rect.h,
                cursor: node.el.locked ? "not-allowed" : "move",
              }}
            >
              <RenderComponent component={node.el} resolve={resolveColour} />
            </div>
          ),
        )}
        <SafeAreaOverlay frame={frame} />
        <GuidesLayer
          frameSize={frame.size}
          guides={guides.filter((g) => g.frameId === frame.id)}
          smartGuides={smartGuides}
        />
        <SelectionLayer
          rects={selectedRects}
          showHandles={showHandles}
          onHandlePointerDown={onHandlePointerDown}
        />
      </div>
    </div>
  );
}
