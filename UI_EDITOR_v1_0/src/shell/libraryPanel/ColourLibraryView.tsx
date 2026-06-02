import { useState } from "react";
import { theme } from "../styles/theme";
import type { ColourLibraryEntry } from "../../core/schema/library";

export function ColourLibraryView({ entries }: { entries: ColourLibraryEntry[] }) {
  const [q, setQ] = useState("");
  const filtered = entries.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <input
        type="text"
        placeholder="Search swatches…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={searchStyle}
      />
      {filtered.map((entry) => {
        const swatchColor = `${entry.hex}${alphaHex(entry.alpha)}`;
        return (
          <div
            key={entry.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(
                "application/x-workbench-library-entry",
                JSON.stringify({ libraryKind: "colours", entryId: entry.id }),
              );
            }}
            style={entryRowStyle}
            title={`${entry.hex} α${entry.alpha}`}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: swatchColor,
                border: "1px solid rgba(255,255,255,0.16)",
              }}
            />
            <span>{entry.name}</span>
            <span style={{ marginLeft: "auto", color: theme.foreground.tertiary, fontSize: 11 }}>
              {entry.hex}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function alphaHex(alpha: number): string {
  const v = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return v.toString(16).padStart(2, "0");
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
