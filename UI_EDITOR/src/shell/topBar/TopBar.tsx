import { theme } from "../styles/theme";
import { useShell } from "../state/ShellContext";

export function TopBar() {
  const { state, dispatch } = useShell();
  const pkgName = state.pkg?.manifest.name ?? "No package loaded";
  const dirtyMark = state.dirty ? " •" : "";
  const saveLabel = state.saveStatus === "saving" ? "Saving..." : "Save";
  return (
    <div
      style={{
        height: 44,
        display: "flex",
        alignItems: "center",
        padding: `0 ${theme.spacing.md}px`,
        background: theme.background.panel,
        borderBottom: theme.border.hairline,
        color: theme.foreground.primary,
        font: `${theme.font.bodySize}px ${theme.font.ui}`,
        gap: theme.spacing.md,
      }}
    >
      <strong style={{ fontWeight: 600 }}>GUI Workbench</strong>
      <span style={{ color: theme.foreground.tertiary }}>—</span>
      <span style={{ color: theme.foreground.secondary }}>
        {pkgName}
        {dirtyMark}
      </span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        style={topBarButtonStyle}
        disabled={!state.pkg || state.saveStatus === "saving"}
        onClick={() => dispatch({ type: "SAVE_STARTED" })}
      >
        {saveLabel}
      </button>
      <button
        type="button"
        style={topBarButtonStyle}
        disabled={!state.pkg}
        onClick={() => {
          dispatch({
            type: "VALIDATION_RAN",
            findings: state.pkg?.findings ?? [],
            lastValidatedAt: Date.now(),
          });
        }}
      >
        Validate
      </button>
      <button
        type="button"
        style={topBarButtonStyle}
        disabled={!state.pkg}
        onClick={async () => {
          if (!state.pkg) return;
          try {
            const { exportPackage } = await import("../../core/export/exportPackage");
            const res = await exportPackage(state.pkg);
            dispatch({
              type: "TOAST_PUSHED",
              toast: {
                id: `t-${Date.now()}`,
                severity: res.ok ? "info" : "error",
                message: res.ok
                  ? `Exported ${res.written.length} files.`
                  : `Export failed: ${res.reason ?? "unknown"}`,
                createdAt: Date.now(),
              },
            });
          } catch (err) {
            dispatch({
              type: "TOAST_PUSHED",
              toast: {
                id: `t-${Date.now()}`,
                severity: "error",
                message: `Export failed: ${(err as Error).message}`,
                createdAt: Date.now(),
              },
            });
          }
        }}
      >
        Export
      </button>
    </div>
  );
}

const topBarButtonStyle: React.CSSProperties = {
  background: theme.background.panelRaised,
  color: theme.foreground.primary,
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: theme.radius.control,
  padding: `4px ${theme.spacing.md}px`,
  font: `${theme.font.bodySize}px ${theme.font.ui}`,
  cursor: "pointer",
};
