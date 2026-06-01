import { theme } from "../../styles/theme";

export function ColourEditor({
  label,
  hex,
  alpha,
  disabled,
  onCommit,
}: {
  label: string;
  hex: string | "multiple";
  alpha?: number;
  disabled?: boolean;
  onCommit: (hex: string, alpha: number) => void;
}) {
  const display = hex === "multiple" ? "#888888" : hex;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
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
        type="color"
        value={display}
        disabled={disabled}
        onChange={(e) => onCommit(e.target.value, alpha ?? 1)}
        style={{
          width: 28,
          height: 22,
          background: theme.background.field,
          border: theme.border.hairline,
          borderRadius: 4,
        }}
      />
      <input
        type="number"
        value={alpha ?? 1}
        min={0}
        max={1}
        step={0.05}
        disabled={disabled}
        onChange={(e) => onCommit(hex === "multiple" ? "#888888" : hex, parseFloat(e.target.value))}
        style={{
          width: 60,
          background: theme.background.field,
          color: theme.foreground.primary,
          border: theme.border.hairline,
          borderRadius: theme.radius.control,
          padding: "2px 6px",
          font: "inherit",
        }}
      />
      {hex === "multiple" && (
        <span style={{ color: theme.foreground.tertiary, fontSize: 11 }}>Multiple</span>
      )}
    </div>
  );
}
