import { theme } from "../styles/theme";
import { useShell } from "../state/ShellContext";
import { BUNDLED_BACKGROUNDS } from "./backgroundCatalog";
import { runValidation } from "../../core/validation/runValidation";

export function BackgroundStressBar() {
  const { state, dispatch } = useShell();
  const select = (id: string | null) => {
    dispatch({ type: "ACTIVE_BACKGROUND_SET", backgroundId: id });
    if (state.pkg) {
      const findings = runValidation(state.pkg, null, state.profile, id);
      dispatch({ type: "VALIDATION_RAN", findings, lastValidatedAt: Date.now() });
    }
  };
  const cycle = () => {
    if (!state.pkg) return;
    const all: Array<string | null> = [null, ...BUNDLED_BACKGROUNDS.map((b) => b.id)];
    const idx = all.indexOf(state.activeBackgroundId);
    const next = all[(idx + 1) % all.length] ?? null;
    select(next);
  };
  return (
    <div
      style={{
        height: 32,
        background: theme.background.panel,
        borderTop: theme.border.hairline,
        color: theme.foreground.tertiary,
        font: `${theme.font.bodySize}px ${theme.font.ui}`,
        display: "flex",
        alignItems: "center",
        padding: `0 ${theme.spacing.md}px`,
        gap: 6,
      }}
    >
      <span style={{ color: theme.foreground.tertiary, fontSize: 11, textTransform: "uppercase" }}>
        Background stress
      </span>
      <button type="button" onClick={() => select(null)} style={chip(state.activeBackgroundId == null)}>
        None
      </button>
      {BUNDLED_BACKGROUNDS.map((bg) => (
        <button
          key={bg.id}
          type="button"
          onClick={() => select(bg.id)}
          style={chip(state.activeBackgroundId === bg.id)}
          title={bg.label}
        >
          {bg.label}
        </button>
      ))}
      <button type="button" onClick={cycle} style={chip(false)}>
        Cycle
      </button>
    </div>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    background: active ? theme.accent.active : theme.background.panelRaised,
    color: active ? "rgba(18,21,24,1)" : theme.foreground.primary,
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: theme.radius.control,
    padding: "2px 8px",
    font: "inherit",
    cursor: "pointer",
  };
}
