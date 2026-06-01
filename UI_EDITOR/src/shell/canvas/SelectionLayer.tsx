import type { Rect } from "../../core/schema/primitives";
import type { HandleId } from "../../core/geometry/transform";

interface Props {
  rects: ReadonlyArray<Rect>;
  showHandles: boolean;
  onHandlePointerDown?: (handle: HandleId, evt: React.PointerEvent) => void;
}

const HANDLE_POSITIONS: ReadonlyArray<{
  id: HandleId;
  fx: number;
  fy: number;
  cursor: string;
}> = [
  { id: "nw", fx: 0, fy: 0, cursor: "nwse-resize" },
  { id: "n", fx: 0.5, fy: 0, cursor: "ns-resize" },
  { id: "ne", fx: 1, fy: 0, cursor: "nesw-resize" },
  { id: "e", fx: 1, fy: 0.5, cursor: "ew-resize" },
  { id: "se", fx: 1, fy: 1, cursor: "nwse-resize" },
  { id: "s", fx: 0.5, fy: 1, cursor: "ns-resize" },
  { id: "sw", fx: 0, fy: 1, cursor: "nesw-resize" },
  { id: "w", fx: 0, fy: 0.5, cursor: "ew-resize" },
];

export function SelectionLayer({ rects, showHandles, onHandlePointerDown }: Props) {
  return (
    <>
      {rects.map((r, idx) => (
        <div
          key={`sel-${idx}`}
          style={{
            position: "absolute",
            left: r.x - 1,
            top: r.y - 1,
            width: r.w + 2,
            height: r.h + 2,
            border: "1px solid rgba(120,180,220,0.85)",
            pointerEvents: "none",
            boxSizing: "border-box",
          }}
        >
          {showHandles && rects.length === 1 &&
            HANDLE_POSITIONS.map((h) => (
              <div
                key={h.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onHandlePointerDown?.(h.id, e);
                }}
                style={{
                  position: "absolute",
                  left: h.fx * (r.w + 2) - 4,
                  top: h.fy * (r.h + 2) - 4,
                  width: 8,
                  height: 8,
                  background: "rgba(18,21,24,1.0)",
                  border: "1px solid rgba(120,180,220,1.0)",
                  cursor: h.cursor,
                  pointerEvents: "auto",
                }}
              />
            ))}
        </div>
      ))}
    </>
  );
}
