import { useState } from "react";
import { theme } from "../styles/theme";
import { useShell } from "../state/ShellContext";
import { runValidation } from "../../core/validation/runValidation";
import { SEVERITY_ORDER, type Severity } from "../../core/schema/validation";

export function ValidationPanel() {
  const { state, dispatch } = useShell();
  const [filter, setFilter] = useState<Severity | "all">("all");

  const onRun = () => {
    if (!state.pkg) return;
    const findings = runValidation(state.pkg, null, state.profile, state.activeBackgroundId);
    dispatch({ type: "VALIDATION_RAN", findings, lastValidatedAt: Date.now() });
  };

  const findings =
    filter === "all"
      ? state.findings
      : state.findings.filter((f) => f.severity === filter);

  return (
    <div
      style={{
        height: 160,
        background: theme.background.panel,
        borderTop: theme.border.hairline,
        color: theme.foreground.secondary,
        font: `${theme.font.bodySize}px ${theme.font.ui}`,
        padding: theme.spacing.sm,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: theme.foreground.tertiary, textTransform: "uppercase", fontSize: theme.font.bodySize - 1 }}>
          Validation
        </span>
        <button
          type="button"
          onClick={onRun}
          disabled={!state.pkg}
          style={{
            background: theme.background.panelRaised,
            color: theme.foreground.primary,
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: theme.radius.control,
            padding: `2px 8px`,
            font: "inherit",
            cursor: "pointer",
          }}
        >
          Run
        </button>
        <div style={{ flex: 1 }} />
        {(["all", ...SEVERITY_ORDER] as const).map((sev) => {
          const isActive = filter === sev;
          return (
            <button
              key={sev}
              type="button"
              onClick={() => setFilter(sev)}
              style={{
                background: isActive ? severityColour(sev as Severity) : "transparent",
                color: isActive ? "rgba(18,21,24,1)" : severityColour(sev as Severity),
                border: `1px solid ${severityColour(sev as Severity)}`,
                borderRadius: theme.radius.control,
                padding: `1px 6px`,
                font: `11px ${theme.font.ui}`,
                cursor: "pointer",
              }}
            >
              {sev}
            </button>
          );
        })}
      </div>
      {findings.length === 0 ? (
        <div style={{ color: theme.foreground.tertiary, marginTop: 4 }}>
          {state.lastValidatedAt ? "No findings." : 'Press "Run" to validate the active package.'}
        </div>
      ) : (
        findings.map((f, idx) => (
          <div key={`${f.ruleId}-${idx}`} style={{ display: "flex", gap: 6 }}>
            <span style={{ color: severityColour(f.severity), width: 80 }}>[{f.severity}]</span>
            <span style={{ color: theme.foreground.secondary, width: 220 }}>{f.ruleId}</span>
            <span style={{ color: theme.foreground.primary, flex: 1 }}>{f.message}</span>
          </div>
        ))
      )}
    </div>
  );
}

function severityColour(s: Severity | "all"): string {
  switch (s) {
    case "all":
      return theme.foreground.tertiary;
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
  }
}
