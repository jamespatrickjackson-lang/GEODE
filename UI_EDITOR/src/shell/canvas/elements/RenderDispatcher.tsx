import type { Component } from "../../../core/schema/component";
import type { Container } from "../../../core/schema/container";

function resolveColour(c: unknown, fallback = "transparent"): string {
  if (!c || typeof c !== "object") return fallback;
  const v = c as { hex?: string; alpha?: number; tokenRef?: string; styleRef?: string };
  if (v.tokenRef || v.styleRef) return "rgba(120,180,220,0.18)";
  if (typeof v.hex === "string") {
    const a = typeof v.alpha === "number" ? v.alpha : 1;
    const hex = v.hex.replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    return v.hex;
  }
  return fallback;
}

export function RenderComponent({ component }: { component: Component }) {
  const p = component.props;
  const label = component.intent?.name ?? component.name ?? p.archetype;
  const fill = "fill" in p ? resolveColour((p as { fill?: unknown }).fill) : "transparent";
  const archetype = p.archetype;
  if (archetype === "divider") {
    const dp = p as { orientation: "horizontal" | "vertical"; thickness: number; colour?: unknown };
    return (
      <div
        title={label}
        style={{
          width: "100%",
          height: "100%",
          background: resolveColour(dp.colour, "rgba(255,255,255,0.16)"),
        }}
      />
    );
  }
  if (archetype === "dirty-dot") {
    return (
      <div
        title={label}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: resolveColour((p as { fill?: unknown }).fill, "rgba(244,240,232,0.72)"),
        }}
      />
    );
  }
  if (archetype === "ellipse") {
    return (
      <div
        title={label}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: fill === "transparent" ? "rgba(255,255,255,0.04)" : fill,
          border: "1px solid rgba(255,255,255,0.16)",
        }}
      />
    );
  }
  if (archetype === "line") {
    const lp = p as {
      start: { x: number; y: number };
      end: { x: number; y: number };
      thickness: number;
      colour?: unknown;
    };
    return (
      <svg viewBox={`0 0 ${component.rect.w} ${component.rect.h}`} style={{ width: "100%", height: "100%" }}>
        <line
          x1={lp.start.x - component.rect.x}
          y1={lp.start.y - component.rect.y}
          x2={lp.end.x - component.rect.x}
          y2={lp.end.y - component.rect.y}
          stroke={resolveColour(lp.colour, "rgba(244,240,232,0.72)")}
          strokeWidth={lp.thickness}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (archetype === "rectangle") {
    return (
      <div
        title={label}
        style={{
          width: "100%",
          height: "100%",
          background: fill === "transparent" ? "rgba(255,255,255,0.04)" : fill,
          border: "1px solid rgba(255,255,255,0.16)",
        }}
      />
    );
  }
  // generic fallback — labelled box
  return (
    <div
      title={label}
      style={{
        width: "100%",
        height: "100%",
        background: fill === "transparent" ? "rgba(255,255,255,0.04)" : fill,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 4,
        color: "rgba(244,240,232,0.72)",
        font: '11px system-ui, -apple-system, "Segoe UI", sans-serif',
        padding: 4,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        boxSizing: "border-box",
      }}
    >
      {label}
    </div>
  );
}

export function RenderContainer({ container }: { container: Container }) {
  const fill = resolveColour(container.fill, "rgba(255,255,255,0.02)");
  const borderColour = resolveColour(container.border?.colour, "rgba(255,255,255,0.12)");
  const borderWidth =
    typeof container.border?.width === "number" ? container.border.width : 1;
  return (
    <div
      title={container.intent?.name ?? container.name ?? container.archetype}
      style={{
        width: "100%",
        height: "100%",
        background: fill,
        border: container.border ? `${borderWidth}px solid ${borderColour}` : "1px dashed rgba(255,255,255,0.08)",
        borderRadius: 6,
        boxSizing: "border-box",
      }}
    />
  );
}
