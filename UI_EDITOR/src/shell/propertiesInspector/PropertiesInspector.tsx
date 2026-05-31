import { theme } from "../styles/theme";

export function PropertiesInspector() {
  return (
    <div
      style={{
        flex: 1,
        background: theme.background.panel,
        color: theme.foreground.tertiary,
        font: `${theme.font.bodySize}px ${theme.font.ui}`,
        padding: theme.spacing.sm,
      }}
    >
      Properties (Phase 11)
    </div>
  );
}
