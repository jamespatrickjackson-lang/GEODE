export const theme = {
  background: {
    body: "rgba(18, 21, 24, 1.0)",
    panel: "rgba(28, 32, 36, 1.0)",
    panelRaised: "rgba(38, 42, 46, 1.0)",
    field: "rgba(18, 21, 24, 0.4)",
  },
  foreground: {
    primary: "rgba(244, 240, 232, 1.0)",
    secondary: "rgba(244, 240, 232, 0.72)",
    tertiary: "rgba(244, 240, 232, 0.46)",
  },
  accent: {
    active: "rgba(120, 180, 220, 0.8)",
  },
  severity: {
    info: "rgba(120, 180, 220, 0.9)",
    suggestion: "rgba(160, 200, 240, 0.9)",
    warning: "rgba(240, 200, 100, 0.9)",
    error: "rgba(240, 120, 100, 0.9)",
    blocker: "rgba(220, 60, 60, 1.0)",
  },
  border: {
    hairline: "1px solid rgba(255, 255, 255, 0.08)",
    panelOutline: "1px solid rgba(255, 255, 255, 0.16)",
  },
  radius: {
    panel: 8,
    control: 6,
    pill: 999,
  },
  font: {
    ui: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    bodySize: 13,
    bodyLineHeight: 1.4,
    monoSize: 12,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
  },
  frostedBackdrop:
    "saturate(145%) blur(20px)",
} as const;

export type Theme = typeof theme;
