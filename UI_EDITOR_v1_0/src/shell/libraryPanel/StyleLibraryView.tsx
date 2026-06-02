import { theme } from "../styles/theme";
import type { StyleLibraryEntry } from "../../core/schema/library";

export function StyleLibraryView({ entries }: { entries: StyleLibraryEntry[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "application/x-workbench-library-entry",
              JSON.stringify({ libraryKind: "styles", entryId: entry.id }),
            );
          }}
          title={entry.rationale ?? entry.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 6px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 4,
            cursor: "grab",
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          />
          <span>{entry.name}</span>
          {entry.semanticRole && (
            <span style={{ marginLeft: "auto", color: theme.foreground.tertiary, fontSize: 11 }}>
              {entry.semanticRole}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
