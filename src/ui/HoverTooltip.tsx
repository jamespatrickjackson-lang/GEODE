import { useEffect, useState } from "react";
import { frostedRoot } from "../editor/styles";

// Cursor-following hover tooltip. Mounted once at the App root; receives
// state from a tiny module-level pub/sub so the scene's mousemove +
// raycast loop can publish without round-tripping through React. The
// raycaster (in scene.ts) handles the 200ms hover-delay state machine
// and only calls setHoverTooltip(...) once a label has settled. This
// component just renders.
//
// Visual: frosted-glass chip, ~280px max width, 6/10 padding. Fades in
// 200ms; on hide we set null and CSS unmounts (no fade-out tail; the
// scene picks new targets so fast that a fade-out would lag the cursor).

export interface HoverTooltipState {
  x: number;
  y: number;
  label: string;
}

let current: HoverTooltipState | null = null;
const listeners = new Set<(s: HoverTooltipState | null) => void>();

export function setHoverTooltip(next: HoverTooltipState | null): void {
  current = next;
  for (const l of listeners) l(next);
}

export function getHoverTooltip(): HoverTooltipState | null {
  return current;
}

function subscribe(fn: (s: HoverTooltipState | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const wrapStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 100,
  pointerEvents: "none",
  maxWidth: 280,
  padding: "6px 10px",
  borderRadius: 6,
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
  color: "#eee",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  ...frostedRoot,
  // Re-spell after spread for the same reason as OverlayDisplay --
  // ensures backdrop-filter ends up in React's inline style output.
  backdropFilter: "blur(16px) saturate(160%)",
  WebkitBackdropFilter: "blur(16px) saturate(160%)",
  transition: "opacity 200ms ease",
};

export function HoverTooltip() {
  const [state, setState] = useState<HoverTooltipState | null>(current);
  useEffect(() => subscribe(setState), []);
  if (!state) return null;
  return (
    <div
      style={{
        ...wrapStyle,
        left: state.x,
        top: state.y,
        opacity: 1,
      }}
    >
      {state.label}
    </div>
  );
}
