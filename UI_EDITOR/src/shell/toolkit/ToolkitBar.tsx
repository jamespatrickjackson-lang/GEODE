import { theme } from "../styles/theme";

export function ToolkitBar() {
  return (
    <div
      style={{
        height: 40,
        background: theme.background.panel,
        borderTop: theme.border.hairline,
        color: theme.foreground.tertiary,
        font: `${theme.font.bodySize}px ${theme.font.ui}`,
        display: "flex",
        alignItems: "center",
        padding: `0 ${theme.spacing.md}px`,
      }}
    >
      Toolkit (Phase 5)
    </div>
  );
}
