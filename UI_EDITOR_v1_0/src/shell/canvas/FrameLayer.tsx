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
import { RenderComponent, RenderContainer } from "./elements/RenderDispatcher";

interface Props {
  frame: Frame;
  zoom: number;
  containers: Record<string, Container>;
  components: Record<string, Component>;
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

export function FrameLayer({
  frame,
  zoom,
  containers,
  components,
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
      <div
        style={{
          width: frame.size.w,
          height: frame.size.h,
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
          background: activeBackgroundUrl
            ? `center/cover no-repeat url(${activeBackgroundUrl}), rgba(18,21,24,1)`
            : "rgba(18,21,24,1)",
          outline: isActive ? "2px solid rgba(120,180,220,0.6)" : "1px solid rgba(255,255,255,0.16)",
          position: "relative",
          color: "rgba(244,240,232,1)",
        }}
      >
        {frame.containerIds.map((id) => {
          const c = containers[id];
          if (!c || c.hidden) return null;
          return (
            <div
              key={c.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                onElementPointerDown?.("container", c.id, e);
              }}
              style={{
                position: "absolute",
                left: c.rect.x,
                top: c.rect.y,
                width: c.rect.w,
                height: c.rect.h,
                cursor: c.locked ? "not-allowed" : "move",
              }}
            >
              <RenderContainer container={c} />
            </div>
          );
        })}
        {frame.componentIds.map((id) => {
          const c = components[id];
          if (!c || c.hidden) return null;
          return (
            <div
              key={c.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                onElementPointerDown?.("component", c.id, e);
              }}
              style={{
                position: "absolute",
                left: c.rect.x,
                top: c.rect.y,
                width: c.rect.w,
                height: c.rect.h,
                cursor: c.locked ? "not-allowed" : "move",
              }}
            >
              <RenderComponent component={c} />
            </div>
          );
        })}
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
