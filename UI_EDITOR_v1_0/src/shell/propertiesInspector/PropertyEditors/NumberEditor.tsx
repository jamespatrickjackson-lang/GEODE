import { theme } from "../../styles/theme";

export function NumberEditor({
  label,
  value,
  disabled,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number | "multiple";
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (next: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 0",
      }}
    >
      <label
        style={{
          width: 90,
          color: theme.foreground.tertiary,
          fontSize: 11,
        }}
      >
        {label}
      </label>
      <input
        type="number"
        value={value === "multiple" ? "" : value}
        placeholder={value === "multiple" ? "Multiple values" : undefined}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        onBlur={(e) => {
          if (e.target.value === "") return;
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onCommit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        style={{
          flex: 1,
          background: theme.background.field,
          color: theme.foreground.primary,
          border: theme.border.hairline,
          borderRadius: theme.radius.control,
          padding: "2px 6px",
          font: "inherit",
        }}
      />
    </div>
  );
}
