import type { Component } from "../../../core/schema/component";
import type { Container } from "../../../core/schema/container";
import type { Package } from "../../../core/schema/package";

// Resolve a colour value (literal hex, token/swatch ref, or style ref) to a
// CSS colour string against the package's libraries. Built once per package in
// CanvasRoot and threaded down so elements paint with their real colours
// instead of a generic placeholder.
export type ColourResolver = (value: unknown, fallback?: string) => string;

export function buildColourResolver(pkg: Package | null): ColourResolver {
  const swatchById = new Map<string, { hex: string; alpha: number }>();
  const styleFillById = new Map<string, unknown>();
  if (pkg) {
    for (const s of pkg.libraries.colours) {
      swatchById.set(s.id, { hex: s.hex, alpha: s.alpha });
    }
    for (const st of pkg.libraries.styles) {
      if (st.fill) styleFillById.set(st.id, st.fill);
    }
  }
  const toCss = (hex: string, alpha: number): string => {
    if (hex === "transparent") return "transparent";
    const clean = hex.replace("#", "");
    if (clean.length === 6) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return hex;
  };
  const resolve: ColourResolver = (value, fallback = "transparent") => {
    if (!value || typeof value !== "object") return fallback;
    const v = value as {
      hex?: string;
      alpha?: number;
      tokenRef?: string;
      styleRef?: string;
    };
    if (typeof v.hex === "string") {
      return toCss(v.hex, typeof v.alpha === "number" ? v.alpha : 1);
    }
    if (v.tokenRef) {
      const sw = swatchById.get(v.tokenRef);
      if (sw) return toCss(sw.hex, sw.alpha);
      return fallback;
    }
    if (v.styleRef) {
      const f = styleFillById.get(v.styleRef);
      if (f) return resolve(f, fallback);
      return fallback;
    }
    return fallback;
  };
  return resolve;
}

const UI_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SECONDARY = "rgba(244,240,232,0.72)";
const PRIMARY = "rgba(244,240,232,1)";

function fontSizeOf(v: unknown, fallback: number): number {
  return typeof v === "number" ? v : fallback;
}

export function RenderComponent({
  component,
  resolve,
}: {
  component: Component;
  resolve: ColourResolver;
}) {
  const p = component.props as unknown as Record<string, unknown>;
  const archetype = p.archetype as string;
  const name = component.intent?.name ?? component.name ?? archetype;

  switch (archetype) {
    case "text":
    case "inline-editable-text": {
      const value = (p.value as string) ?? name;
      const colour = resolve(p.colour, archetype === "inline-editable-text" ? PRIMARY : SECONDARY);
      return (
        <div
          title={name}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            color: colour === "transparent" ? PRIMARY : colour,
            font: `${fontSizeOf(p.fontSize, 13)}px ${UI_FONT}`,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value}
        </div>
      );
    }
    case "numeric-label": {
      const value = (p.value as string) ?? "00";
      const sep = (p.trailingSeparator as string) ?? "";
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            color: resolve(p.colour, SECONDARY) === "transparent" ? SECONDARY : resolve(p.colour, SECONDARY),
            font: `${fontSizeOf(p.fontSize, 12)}px ${UI_FONT}`,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
          {sep}
        </div>
      );
    }
    case "letter-glyph": {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: resolve(p.colour, SECONDARY),
            font: `${fontSizeOf(p.fontSize, 11)}px ${UI_FONT}`,
          }}
        >
          {(p.letter as string) ?? "F"}
        </div>
      );
    }
    case "dirty-dot": {
      return (
        <div
          title={name}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: resolve(p.fill, "rgba(255,111,127,0.9)"),
          }}
        />
      );
    }
    case "colour-swatch": {
      return (
        <div
          title={name}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: resolve(p.currentColour, "rgba(200,160,120,0.8)"),
            border: "1px solid rgba(255,255,255,0.25)",
          }}
        />
      );
    }
    case "pill-button":
    case "toggle-button": {
      const surfaceTinted = p.surface === "tinted" || p.pressed === true;
      return (
        <div
          title={name}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: surfaceTinted ? "rgba(120,180,220,0.28)" : "rgba(244,240,232,0.08)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: PRIMARY,
            font: `12px ${UI_FONT}`,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {(p.label as string) ?? ""}
        </div>
      );
    }
    case "icon-button":
    case "footer-action-button": {
      return (
        <div
          title={(p.ariaLabel as string) ?? name}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            background: "rgba(244,240,232,0.07)",
            border: "1px solid rgba(255,255,255,0.16)",
            color: SECONDARY,
            font: `13px ${UI_FONT}`,
          }}
        >
          {glyphForIcon(p.iconLibraryEntryId as string | undefined)}
        </div>
      );
    }
    case "checkbox": {
      return (
        <div
          title={name}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 3,
            background: p.checked ? "rgba(120,180,220,0.8)" : "rgba(18,21,24,0.5)",
            border: "1px solid rgba(255,255,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: PRIMARY,
            fontSize: 11,
          }}
        >
          {p.checked ? "✓" : ""}
        </div>
      );
    }
    case "slider": {
      return (
        <div
          title={name}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.16)", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: -3,
                left: "45%",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "rgba(120,180,220,0.95)",
              }}
            />
          </div>
        </div>
      );
    }
    case "numeric-input":
    case "select-dropdown": {
      return (
        <div
          title={name}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            padding: "0 6px",
            borderRadius: 4,
            background: "rgba(18,21,24,0.5)",
            border: "1px solid rgba(255,255,255,0.16)",
            color: SECONDARY,
            font: `12px ${UI_FONT}`,
            justifyContent: "space-between",
          }}
        >
          <span>{archetype === "numeric-input" ? String(p.value ?? 0) : "Option"}</span>
          {archetype === "select-dropdown" ? <span style={{ opacity: 0.6 }}>▾</span> : null}
        </div>
      );
    }
    case "divider": {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: resolve(p.colour, "rgba(255,255,255,0.16)"),
          }}
        />
      );
    }
    case "ellipse": {
      return (
        <div
          title={name}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: resolve(p.fill, "rgba(255,255,255,0.06)"),
            border: "1px solid rgba(255,255,255,0.16)",
          }}
        />
      );
    }
    case "rectangle": {
      return (
        <div
          title={name}
          style={{
            width: "100%",
            height: "100%",
            background: resolve(p.fill, "rgba(255,255,255,0.06)"),
            border: "1px solid rgba(255,255,255,0.16)",
          }}
        />
      );
    }
    case "line": {
      const lp = p as unknown as {
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
            stroke={resolve(lp.colour, SECONDARY)}
            strokeWidth={lp.thickness}
            strokeLinecap="round"
          />
        </svg>
      );
    }
    default: {
      return (
        <div
          title={name}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            padding: "0 4px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4,
            color: SECONDARY,
            font: `11px ${UI_FONT}`,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            boxSizing: "border-box",
          }}
        >
          {name}
        </div>
      );
    }
  }
}

function glyphForIcon(id: string | undefined): string {
  switch (id) {
    case "icon-add":
      return "+";
    case "icon-trash":
      return "🗑";
    case "icon-duplicate":
      return "⧉";
    case "icon-reset":
      return "↺";
    case "icon-eye":
      return "👁";
    case "icon-eye-off":
      return "⦸";
    case "icon-triangle-up":
      return "▲";
    case "icon-triangle-down":
      return "▼";
    case "icon-refresh":
      return "↻";
    case "icon-camera":
      return "◉";
    case "icon-focus":
      return "F";
    case "icon-dot":
      return "•";
    default:
      return "•";
  }
}

export function RenderContainer({
  container,
  resolve,
}: {
  container: Container;
  resolve: ColourResolver;
}) {
  const fill = resolve(container.fill, "transparent");
  const borderColour = resolve(container.border?.colour, "rgba(255,255,255,0.12)");
  const borderWidth = typeof container.border?.width === "number" ? container.border.width : 1;
  return (
    <div
      title={container.intent?.name ?? container.name ?? container.archetype}
      style={{
        width: "100%",
        height: "100%",
        background: fill,
        border: container.border
          ? `${borderWidth}px solid ${borderColour}`
          : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 6,
        boxSizing: "border-box",
      }}
    />
  );
}
