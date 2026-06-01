import { VariantEditor } from "./VariantEditor";
import type { AnchorKind } from "../../../core/schema/anchor";

const ANCHOR_OPTIONS: ReadonlyArray<{ value: AnchorKind; label: string }> = [
  { value: "left", label: "Left / Top" },
  { value: "right", label: "Right / Bottom" },
  { value: "centre", label: "Centre" },
  { value: "scale", label: "Scale" },
  { value: "stretch", label: "Stretch" },
];

export function AnchorEditor({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: AnchorKind | "multiple";
  disabled?: boolean;
  onCommit: (next: AnchorKind) => void;
}) {
  return (
    <VariantEditor
      label={label}
      value={value}
      options={ANCHOR_OPTIONS}
      disabled={disabled}
      onCommit={(v) => onCommit(v as AnchorKind)}
    />
  );
}
