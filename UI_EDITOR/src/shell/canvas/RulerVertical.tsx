import { theme } from "../styles/theme";

interface Props {
  height: number;
  zoom: number;
  panY: number;
  frameOriginCanvasY: number;
}

export function RulerVertical({ height, zoom, panY, frameOriginCanvasY }: Props) {
  const tickInterval = chooseTickInterval(zoom);
  const ticks: number[] = [];
  const firstTick = Math.floor((-panY - frameOriginCanvasY) / tickInterval) * tickInterval;
  const lastTick = firstTick + (height / zoom) + tickInterval;
  for (let v = firstTick; v <= lastTick; v += tickInterval) {
    ticks.push(v);
  }
  return (
    <div
      style={{
        width: 28,
        background: theme.background.panel,
        borderRight: theme.border.hairline,
        position: "relative",
        overflow: "hidden",
        font: `10px ${theme.font.mono}`,
        color: theme.foreground.tertiary,
      }}
    >
      {ticks.map((tickVal) => {
        const screenY = (tickVal + panY + frameOriginCanvasY) * zoom;
        return (
          <div
            key={tickVal}
            style={{
              position: "absolute",
              top: screenY,
              left: 0,
              width: "100%",
              borderTop: "1px solid rgba(255,255,255,0.16)",
              paddingLeft: 2,
              fontSize: 9,
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
  const desiredFramePx = 50 / Math.max(zoom, 0.001);
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  for (const c of candidates) {
    if (c >= desiredFramePx) return c;
  }
  return 1000;
}
