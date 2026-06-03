import { useState } from "react";
import type React from "react";
import { TECHNICAL_MONO_FONT, vibrancyLabel } from "./styles";

interface TransientSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  testId?: string;
  style?: React.CSSProperties;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export function TransientSlider({
  value,
  min,
  max,
  step,
  disabled,
  testId,
  style,
  format = (next) => next.toFixed(2),
  onChange,
}: TransientSliderProps) {
  const [pill, setPill] = useState<{ x: number; y: number } | null>(null);
  const fill = Math.max(
    0,
    Math.min(100, ((value - min) / Math.max(max - min, 0.000001)) * 100),
  );
  const showPill = (event: React.PointerEvent<HTMLInputElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPill({ x: event.clientX, y: event.clientY });
  };
  const movePill = (event: React.PointerEvent<HTMLInputElement>) => {
    if (!pill) return;
    setPill({ x: event.clientX, y: event.clientY });
  };
  const hidePill = (event?: React.PointerEvent<HTMLInputElement>) => {
    if (
      event &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPill(null);
  };

  return (
    <>
      <input
        data-dev-source="src/editor/TransientSlider.tsx"
        data-dev-note="TransientSlider hides persistent numeric readouts; value appears as a cursor pill only while dragging."
        data-transient-slider="true"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => onChange(parseFloat(event.target.value))}
        onPointerDown={showPill}
        onPointerMove={movePill}
        onPointerUp={hidePill}
        onPointerCancel={hidePill}
        onBlur={() => setPill(null)}
        style={
          {
            ...style,
            cursor: pill ? "none" : style?.cursor,
            "--editor-slider-fill": `${fill}%`,
          } as React.CSSProperties
        }
      />
      {pill && (
        <span
          data-dev-slider-value-pill="true"
          style={{
            ...sliderPillStyle,
            left: pill.x,
            top: pill.y,
          }}
        >
          {format(value)}
        </span>
      )}
    </>
  );
}

const sliderPillStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 5000,
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  minWidth: 42,
  maxWidth: 110,
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(18, 21, 24, 0.92)",
  border: "1px solid rgba(244, 240, 232, 0.22)",
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
  boxShadow: "0 10px 28px rgba(0, 0, 0, 0.34)",
  whiteSpace: "nowrap",
};
