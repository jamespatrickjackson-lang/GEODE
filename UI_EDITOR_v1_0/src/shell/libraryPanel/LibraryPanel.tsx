import { useState } from "react";
import { theme } from "../styles/theme";
import { useShell } from "../state/ShellContext";
import { ComponentLibraryView } from "./ComponentLibraryView";
import { ColourLibraryView } from "./ColourLibraryView";
import { IconLibraryView } from "./IconLibraryView";
import { TokenLibraryView } from "./TokenLibraryView";
import { StyleLibraryView } from "./StyleLibraryView";

type LibraryTab = "components" | "colours" | "icons" | "tokens" | "styles";

const TABS: ReadonlyArray<{ id: LibraryTab; label: string }> = [
  { id: "components", label: "Components" },
  { id: "colours", label: "Colours" },
  { id: "icons", label: "Icons" },
  { id: "tokens", label: "Tokens" },
  { id: "styles", label: "Styles" },
];

export function LibraryPanel() {
  const { state } = useShell();
  const [active, setActive] = useState<LibraryTab>("components");

  if (!state.pkg) {
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
        Library — no package loaded.
      </div>
    );
  }

  const libs = state.pkg.libraries;

  return (
    <div
      style={{
        flex: 1,
        background: theme.background.panel,
        color: theme.foreground.primary,
        font: `${theme.font.bodySize}px ${theme.font.ui}`,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 2,
          borderBottom: theme.border.hairline,
          padding: 4,
        }}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              style={{
                background: isActive ? theme.background.panelRaised : "transparent",
                color: isActive ? theme.foreground.primary : theme.foreground.secondary,
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: theme.radius.control,
                padding: `2px 8px`,
                font: `inherit`,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: theme.spacing.sm }}>
        {active === "components" && <ComponentLibraryView entries={libs.components} />}
        {active === "colours" && <ColourLibraryView entries={libs.colours} />}
        {active === "icons" && <IconLibraryView entries={libs.icons} />}
        {active === "tokens" && <TokenLibraryView entries={libs.tokens} />}
        {active === "styles" && <StyleLibraryView entries={libs.styles} />}
      </div>
    </div>
  );
}
