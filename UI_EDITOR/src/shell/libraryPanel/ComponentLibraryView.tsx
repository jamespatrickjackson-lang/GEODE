import { useState } from "react";
import { theme } from "../styles/theme";
import type { ComponentLibraryEntry, LibraryTier } from "../../core/schema/library";

// Missing `tier` is treated as "component" per docs_v1/23 §2.1.
function entryTier(entry: ComponentLibraryEntry): LibraryTier {
  return entry.tier ?? "component";
}

export function ComponentLibraryView({
  entries,
  tier,
  searchPlaceholder = "Search…",
}: {
  entries: ComponentLibraryEntry[];
  tier?: LibraryTier;
  searchPlaceholder?: string;
}) {
  const [q, setQ] = useState("");
  const tierScoped = tier ? entries.filter((e) => entryTier(e) === tier) : entries;
  const filtered = tierScoped.filter((e) =>
    e.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <input
        type="text"
        placeholder={searchPlaceholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={searchStyle}
      />
      {filtered.length === 0 && (
        <div style={{ color: theme.foreground.tertiary, padding: 4 }}>No entries.</div>
      )}
      {filtered.map((entry) => {
        const aiIntent = entry.aiNote?.intent ?? entry.intent?.intent;
        const childCount = entry.composition?.length ?? 0;
        return (
          <div
            key={entry.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(
                "application/x-workbench-library-entry",
                JSON.stringify({ libraryKind: "components", entryId: entry.id }),
              );
            }}
            title={aiIntent ?? entry.id}
            style={entryRowStyle}
          >
            <span style={{ color: theme.foreground.tertiary, fontSize: 11 }}>
              {entry.kind === "container" ? "⬚" : "▢"}
            </span>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.name}
            </span>
            {childCount > 0 && (
              <span
                style={{
                  color: theme.foreground.tertiary,
                  fontSize: 10,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 999,
                  padding: "0 6px",
                }}
                title={`${childCount} child slot${childCount === 1 ? "" : "s"}`}
              >
                {childCount}
              </span>
            )}
            <span style={{ marginLeft: "auto", color: theme.foreground.tertiary, fontSize: 11 }}>
              {entry.defaultSize.w}×{entry.defaultSize.h}
            </span>
          </div>
        );
      })}
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
