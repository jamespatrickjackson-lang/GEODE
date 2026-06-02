import { theme } from "../styles/theme";

export function LayersPanel() {
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
      Layers (Phase 4 / 6)
    </div>
  );
}
