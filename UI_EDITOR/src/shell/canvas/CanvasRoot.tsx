import { theme } from "../styles/theme";
import { useShell } from "../state/ShellContext";

export function CanvasRoot() {
  const { state } = useShell();
  return (
    <div
      style={{
        flex: 1,
        background: theme.background.body,
        color: theme.foreground.tertiary,
        font: `${theme.font.bodySize}px ${theme.font.ui}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {state.pkg
        ? `Canvas (${state.pkg.frames.length} frame${state.pkg.frames.length === 1 ? "" : "s"})`
        : "Canvas (no package loaded)"}
    </div>
  );
}
