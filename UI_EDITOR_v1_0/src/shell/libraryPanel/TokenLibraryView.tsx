import { theme } from "../styles/theme";
import type { TokenLibraryEntry } from "../../core/schema/library";

export function TokenLibraryView({ entries }: { entries: TokenLibraryEntry[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          title={entry.rationale ?? entry.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 6px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 4,
          }}
        >
          <span style={{ color: theme.foreground.tertiary, fontSize: 11, width: 70 }}>
            {entry.category}
          </span>
          <span style={{ font: `12px ${theme.font.mono}` }}>{entry.id}</span>
          <span
            style={{
              marginLeft: "auto",
              font: `12px ${theme.font.mono}`,
              color: theme.foreground.secondary,
            }}
          >
            {String(entry.value)}
            {entry.unit ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}
