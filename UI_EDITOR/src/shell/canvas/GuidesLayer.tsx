import type { Guide } from "../../core/schema/guide";
import type { SmartGuide } from "../../core/geometry/smartGuides";

interface Props {
  frameSize: { w: number; h: number };
  guides: ReadonlyArray<Guide>;
  smartGuides: ReadonlyArray<SmartGuide>;
}

export function GuidesLayer({ frameSize, guides, smartGuides }: Props) {
  return (
    <>
      {guides.map((g) =>
        g.axis === "x" ? (
          <div
            key={g.id}
            style={{
              position: "absolute",
              top: 0,
              left: g.position,
              width: 1,
              height: frameSize.h,
              background: "rgba(160,200,240,0.5)",
              pointerEvents: "none",
            }}
          />
        ) : (
          <div
            key={g.id}
            style={{
              position: "absolute",
              left: 0,
              top: g.position,
              height: 1,
              width: frameSize.w,
              background: "rgba(160,200,240,0.5)",
              pointerEvents: "none",
            }}
          />
        ),
      )}
      {smartGuides.map((g, idx) =>
        g.axis === "x" ? (
          <div
            key={`sg-${idx}`}
            style={{
              position: "absolute",
              top: g.start,
              left: g.position,
              width: 1,
              height: g.end - g.start,
              background: "rgba(240,200,100,0.85)",
              pointerEvents: "none",
            }}
          />
        ) : (
          <div
            key={`sg-${idx}`}
            style={{
              position: "absolute",
              left: g.start,
              top: g.position,
              height: 1,
              width: g.end - g.start,
              background: "rgba(240,200,100,0.85)",
              pointerEvents: "none",
            }}
          />
        ),
      )}
    </>
  );
}
