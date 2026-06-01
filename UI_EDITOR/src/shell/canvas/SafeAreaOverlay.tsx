import type { Frame } from "../../core/schema/frame";

interface Props {
  frame: Frame;
}

export function SafeAreaOverlay({ frame }: Props) {
  if (!frame.safeArea) return null;
  const sa = frame.safeArea;
  return (
    <div
      style={{
        position: "absolute",
        left: sa.left,
        top: sa.top,
        right: sa.right,
        bottom: sa.bottom,
        border: "1px dashed rgba(120,180,220,0.32)",
        pointerEvents: "none",
      }}
    />
  );
}
