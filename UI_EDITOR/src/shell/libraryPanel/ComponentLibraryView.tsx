import { useState } from "react";
import { theme } from "../styles/theme";
import type { ComponentLibraryEntry } from "../../core/schema/library";

export function ComponentLibraryView({ entries }: { entries: ComponentLibraryEntry[] }) {
  const [q, setQ] = useState("");
  const filtered = entries.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <input
        type="text"
        placeholder="Search components…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={searchStyle}
      />
      {filtered.length === 0 && (
        <div style={{ color: theme.foreground.tertiary, padding: 4 }}>No entries.</div>
      )}
      {filtered.map((entry) => (
        <div
          key={entry.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "application/x-workbench-library-entry",
              JSON.stringify({ libraryKind: "components", entryId: entry.id }),
            );
          }}
          title={entry.intent?.intent ?? entry.id}
          style={entryRowStyle}
        >
          <span style={{ color: theme.foreground.tertiary, fontSize: 11 }}>{entry.kind === "container" ? "⬚" : "▢"}</span>
          <span>{entry.name}</span>
          <span style={{ marginLeft: "auto", color: theme.foreground.tertiary, fontSize: 11 }}>
            {entry.defaultSize.w}×{entry.defaultSize.h}
          </span>
        </div>
      ))}
    </div>
  );
}

const searchStyle: React.CSSProperties = {
  background: theme.background.field,
  color: theme.foreground.primary,
  border: theme.border.hairline,
  borderRadius: theme.radius.control,
  padding: "4px 8px",
  font: "inherit",
};

const entryRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 6px",
  borderRadius: 4,
  cursor: "grab",
  background: "rgba(255,255,255,0.02)",
};
