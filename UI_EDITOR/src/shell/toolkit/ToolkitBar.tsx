import { theme } from "../styles/theme";
import { useShell } from "../state/ShellContext";
import { ALL_TOOLS } from "./tools";

export function ToolkitBar() {
  const { state, dispatch } = useShell();
  return (
    <div
      style={{
        height: 44,
        background: theme.background.panel,
        borderTop: theme.border.hairline,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: `0 ${theme.spacing.md}px`,
      }}
    >
      {ALL_TOOLS.map((tool) => {
        const isActive = state.activeToolId === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            title={`${tool.label} (${tool.hint}) — ${tool.description}`}
            onClick={() => dispatch({ type: "TOOL_ACTIVATED", toolId: tool.id })}
            style={{
              background: isActive ? theme.accent.active : theme.background.panelRaised,
              color: isActive ? "rgba(18,21,24,1)" : theme.foreground.primary,
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: theme.radius.control,
              padding: `4px 10px`,
              font: `${theme.font.bodySize}px ${theme.font.ui}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{tool.label}</span>
            <span style={{ opacity: 0.6, fontSize: 10 }}>{tool.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
