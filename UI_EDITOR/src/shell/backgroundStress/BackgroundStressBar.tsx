import { theme } from "../styles/theme";

export function BackgroundStressBar() {
  return (
    <div
      style={{
        height: 28,
        background: theme.background.panel,
        borderTop: theme.border.hairline,
        color: theme.foreground.tertiary,
        font: `${theme.font.bodySize}px ${theme.font.ui}`,
        display: "flex",
        alignItems: "center",
        padding: `0 ${theme.spacing.md}px`,
      }}
    >
      Background stress (Phase 10)
    </div>
  );
}
