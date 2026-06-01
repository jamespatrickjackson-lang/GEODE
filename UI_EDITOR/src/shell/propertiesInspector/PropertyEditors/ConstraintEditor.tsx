import type { Constraints } from "../../../core/schema/anchor";
import { AnchorEditor } from "./AnchorEditor";

export function ConstraintEditor({
  value,
  disabled,
  onCommit,
}: {
  value: Constraints | "multiple";
  disabled?: boolean;
  onCommit: (next: Constraints) => void;
}) {
  if (value === "multiple") {
    return (
      <>
        <AnchorEditor label="Horizontal" value="multiple" disabled={disabled} onCommit={() => {}} />
        <AnchorEditor label="Vertical" value="multiple" disabled={disabled} onCommit={() => {}} />
      </>
    );
  }
  return (
    <>
      <AnchorEditor
        label="Horizontal"
        value={value.horizontal}
        disabled={disabled}
        onCommit={(h) => onCommit({ ...value, horizontal: h })}
      />
      <AnchorEditor
        label="Vertical"
        value={value.vertical}
        disabled={disabled}
        onCommit={(v) => onCommit({ ...value, vertical: v })}
      />
    </>
  );
}
