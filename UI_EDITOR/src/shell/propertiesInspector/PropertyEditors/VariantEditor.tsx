import { theme } from "../../styles/theme";

export function VariantEditor({
  label,
  value,
  options,
  disabled,
  onCommit,
}: {
  label: string;
  value: string | "multiple";
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
  onCommit: (next: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <label style={{ width: 90, color: theme.foreground.tertiary, fontSize: 11 }}>
        {label}
      </label>
      <select
        value={value === "multiple" ? "" : value}
        disabled={disabled}
        onChange={(e) => onCommit(e.target.value)}
        style={{
          flex: 1,
          background: theme.background.field,
          color: theme.foreground.primary,
          border: theme.border.hairline,
          borderRadius: theme.radius.control,
          padding: "2px 6px",
          font: "inherit",
        }}
      >
        {value === "multiple" && <option value="">— Multiple values —</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
