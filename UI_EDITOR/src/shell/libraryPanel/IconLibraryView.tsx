import { theme } from "../styles/theme";
import type { IconLibraryEntryWithIntent } from "../../core/schema/library";

export function IconLibraryView({ entries }: { entries: IconLibraryEntryWithIntent[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "application/x-workbench-library-entry",
              JSON.stringify({ libraryKind: "icons", entryId: entry.id }),
            );
          }}
          title={entry.name}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: 4,
            background: "rgba(255,255,255,0.02)",
            borderRadius: 4,
            cursor: "grab",
            color: theme.foreground.secondary,
          }}
        >
          <svg viewBox={entry.viewBox} width={20} height={20}>
            <path d={entry.svgPath} fill="currentColor" />
          </svg>
          <span style={{ fontSize: 10, marginTop: 2 }}>{entry.name}</span>
        </div>
      ))}
    </div>
  );
}
