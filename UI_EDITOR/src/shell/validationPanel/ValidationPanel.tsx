import { theme } from "../styles/theme";
import { useShell } from "../state/ShellContext";

export function ValidationPanel() {
  const { state } = useShell();
  return (
    <div
      style={{
        height: 120,
        background: theme.background.panel,
        borderTop: theme.border.hairline,
        color: theme.foreground.secondary,
        font: `${theme.font.bodySize}px ${theme.font.ui}`,
        padding: theme.spacing.sm,
        overflowY: "auto",
      }}
    >
      <div style={{ color: theme.foreground.tertiary, textTransform: "uppercase", fontSize: theme.font.bodySize - 1 }}>
        Validation findings
      </div>
      {state.findings.length === 0 ? (
        <div style={{ marginTop: theme.spacing.sm, color: theme.foreground.tertiary }}>
          No findings.
        </div>
      ) : (
        state.findings.map((f, idx) => (
          <div key={`${f.ruleId}-${idx}`} style={{ marginTop: theme.spacing.xs }}>
            <span style={{ color: severityColour(f.severity) }}>[{f.severity}]</span> {f.ruleId}: {f.message}
          </div>
        ))
      )}
    </div>
  );
}

function severityColour(s: string): string {
  switch (s) {
    case "info":
      return theme.severity.info;
    case "suggestion":
      return theme.severity.suggestion;
    case "warning":
      return theme.severity.warning;
    case "error":
      return theme.severity.error;
    case "blocker":
      return theme.severity.blocker;
    default:
      return theme.foreground.secondary;
  }
}
