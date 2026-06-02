import { theme } from "../../styles/theme";
import { useEffect, useState } from "react";

export function TextEditor({
  label,
  value,
  disabled,
  multiline,
  onCommit,
}: {
  label: string;
  value: string | "multiple";
  disabled?: boolean;
  multiline?: boolean;
  onCommit: (next: string) => void;
}) {
  const stringValue = value === "multiple" ? "" : value;
  const [local, setLocal] = useState(stringValue);
  useEffect(() => {
    setLocal(stringValue);
  }, [stringValue]);
  const InputTag = multiline ? "textarea" : "input";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: multiline ? "column" : "row",
        alignItems: multiline ? "stretch" : "center",
        gap: 8,
        padding: "4px 0",
      }}
    >
      <label
        style={{
          width: multiline ? "auto" : 90,
          color: theme.foreground.tertiary,
          fontSize: 11,
        }}
      >
        {label}
      </label>
      <InputTag
        value={local}
        placeholder={value === "multiple" ? "Multiple values" : undefined}
        disabled={disabled}
        onChange={(e) => setLocal((e.target as HTMLInputElement | HTMLTextAreaElement).value)}
        onBlur={() => {
          if (local !== stringValue) onCommit(local);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !multiline) {
            (e.target as HTMLInputElement).blur();
          }
        }}
        style={{
          flex: 1,
          minHeight: multiline ? 60 : undefined,
          background: theme.background.field,
          color: theme.foreground.primary,
          border: theme.border.hairline,
          borderRadius: theme.radius.control,
          padding: "2px 6px",
          font: "inherit",
          resize: multiline ? "vertical" : undefined,
        }}
      />
    </div>
  );
}
