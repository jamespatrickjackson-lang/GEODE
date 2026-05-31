import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// Click-to-edit text. Renders as plain text until clicked; swaps to a
// borderless input with the same font/color; commits on blur or Enter,
// cancels on Escape. Hover state shows a subtle background tint as the
// only "editable" affordance plus a text cursor.
//
// Used for page titles in PagePanel rows and in OverlayPanel's header.
// Click stops propagation so containers handling clicks (e.g. the page
// row that navigates on click) don't fire too.

interface Props {
  value: string;
  onCommit: (next: string) => void;
  // Style applied to BOTH the display span and the editing input so
  // the swap is visually seamless (same font weight, color, size).
  textStyle?: CSSProperties;
  hoverBackground?: string;
  title?: string; // tooltip
  truncate?: boolean;
  editTrigger?: "click" | "doubleClick";
}

export function InlineEditableTitle({
  value,
  onCommit,
  textStyle,
  hoverBackground = "rgba(255, 255, 255, 0.06)",
  title = "Click to edit",
  truncate = false,
  editTrigger = "click",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Re-sync draft when the source value changes from outside (e.g.
  // navigating to a different page while not editing).
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Focus + select all on edit-mode entry so the user can type
  // immediately or click to position a cursor.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft;
    if (trimmed !== value) onCommit(trimmed);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          fontFamily: "inherit",
          fontSize: "inherit",
          fontWeight: "inherit",
          lineHeight: "inherit",
          ...textStyle,
          background: "transparent",
          border: "none",
          outline: "none",
          padding: 0,
          margin: 0,
          color: "inherit",
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
        data-dev-source="src/editor/InlineEditableTitle.tsx:63"
        data-dev-text-source="src/editor/InlineEditableTitle.tsx:63"
        data-dev-note="InlineEditableTitle edit input for page or overlay title text."
      />
    );
  }

  return (
    <span
      data-dev-source="src/editor/InlineEditableTitle.tsx:95"
      data-dev-text-source="src/editor/InlineEditableTitle.tsx:95"
      data-dev-padding-source="src/editor/InlineEditableTitle.tsx:107"
      data-dev-note="InlineEditableTitle display text. Padding and negative margin create the hover/edit hit area."
      onClick={(e) => {
        if (editTrigger === "click") {
          e.stopPropagation();
          setEditing(true);
        } else if (editTrigger === "doubleClick" && e.detail >= 2) {
          e.stopPropagation();
          setEditing(true);
        }
      }}
      onDoubleClick={(e) => {
        if (editTrigger === "doubleClick") {
          e.stopPropagation();
          setEditing(true);
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...textStyle,
        cursor: editTrigger === "doubleClick" ? "default" : "text",
        background: hover ? hoverBackground : "transparent",
        borderRadius: 0,
        padding: "0 2px",
        margin: "0 -2px",
        display: truncate ? "block" : "inline-block",
        ...(truncate
          ? {
              maxWidth: "100%",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              verticalAlign: "bottom",
            }
          : {}),
      }}
      title={title}
    >
      {value || " "}
    </span>
  );
}
