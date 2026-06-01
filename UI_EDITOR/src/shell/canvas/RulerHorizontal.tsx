import { theme } from "../styles/theme";

interface Props {
  width: number;
  zoom: number;
  panX: number;
  frameOriginCanvasX: number;
}

export function RulerHorizontal({ width, zoom, panX, frameOriginCanvasX }: Props) {
  const tickInterval = chooseTickInterval(zoom);
  const ticks: number[] = [];
  const firstTick = Math.floor((-panX - frameOriginCanvasX) / tickInterval) * tickInterval;
  const lastTick = firstTick + (width / zoom) + tickInterval;
  for (let v = firstTick; v <= lastTick; v += tickInterval) {
    ticks.push(v);
  }
  return (
    <div
      style={{
        height: 18,
        background: theme.background.panel,
        borderBottom: theme.border.hairline,
        position: "relative",
        overflow: "hidden",
        font: `10px ${theme.font.mono}`,
        color: theme.foreground.tertiary,
      }}
    >
      {ticks.map((tickVal) => {
        const screenX = (tickVal + panX + frameOriginCanvasX) * zoom;
        return (
          <div
            key={tickVal}
            style={{
              position: "absolute",
              left: screenX,
              top: 0,
              height: "100%",
              borderLeft: "1px solid rgba(255,255,255,0.16)",
              paddingLeft: 2,
            }}
          >
            {tickVal}
          </div>
        );
      })}
    </div>
  );
}

function chooseTickInterval(zoom: number): number {
  // major tick label spaced ~50 screen px apart
  const desiredFramePx = 50 / Math.max(zoom, 0.001);
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  for (const c of candidates) {
    if (c >= desiredFramePx) return c;
  }
  return 1000;
}
