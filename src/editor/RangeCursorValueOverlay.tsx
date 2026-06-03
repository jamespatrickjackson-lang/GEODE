import { useEffect, useState } from "react";

interface RangeCursorPill {
  x: number;
  y: number;
  value: string;
}

function rangeValueLabel(input: HTMLInputElement): string {
  const numericValue = Number(input.value);
  if (!Number.isFinite(numericValue)) return input.value;
  if (input.step && input.step !== "any") {
    const numericStep = Number(input.step);
    if (Number.isFinite(numericStep) && Number.isInteger(numericStep)) {
      return numericValue.toFixed(0);
    }
    const decimalPart = input.step.split(".")[1];
    return numericValue.toFixed(Math.min(decimalPart?.length ?? 2, 4));
  }
  return input.value;
}

export function RangeCursorValueOverlay() {
  const [pill, setPill] = useState<RangeCursorPill | null>(null);

  useEffect(() => {
    let activeInput: HTMLInputElement | null = null;
    let activeCursor = "";

    const setFromPointer = (event: PointerEvent) => {
      if (!activeInput) return;
      setPill({
        x: event.clientX,
        y: event.clientY,
        value: rangeValueLabel(activeInput),
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== "range" || target.dataset.transientSlider === "true") {
        return;
      }
      activeInput = target;
      activeCursor = target.style.cursor;
      target.style.cursor = "none";
      setFromPointer(event);
    };

    const handleInput = () => {
      if (!activeInput) return;
      setPill((current) =>
        current ? { ...current, value: rangeValueLabel(activeInput!) } : current,
      );
    };

    const restoreActiveInput = () => {
      if (activeInput) activeInput.style.cursor = activeCursor;
      activeInput = null;
      activeCursor = "";
    };

    const handlePointerEnd = () => {
      restoreActiveInput();
      setPill(null);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", setFromPointer, true);
    window.addEventListener("pointerup", handlePointerEnd, true);
    window.addEventListener("pointercancel", handlePointerEnd, true);
    window.addEventListener("input", handleInput, true);
    window.addEventListener("change", handleInput, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", setFromPointer, true);
      window.removeEventListener("pointerup", handlePointerEnd, true);
      window.removeEventListener("pointercancel", handlePointerEnd, true);
      window.removeEventListener("input", handleInput, true);
      window.removeEventListener("change", handleInput, true);
      restoreActiveInput();
    };
  }, []);

  if (!pill) return null;

  return (
    <span
      data-dev-slider-value-pill="true"
      style={{
        position: "fixed",
        left: pill.x + 14,
        top: pill.y - 34,
        zIndex: 100000,
        minWidth: 36,
        padding: "5px 8px",
        borderRadius: 999,
        background: "rgba(14, 16, 17, 0.92)",
        border: "1px solid rgba(244, 240, 232, 0.24)",
        color: "rgba(244, 240, 232, 0.92)",
        fontSize: 11,
        fontFamily: "monospace",
        lineHeight: 1,
        textAlign: "center",
        pointerEvents: "none",
        boxShadow: "0 8px 20px rgba(0, 0, 0, 0.32)",
      }}
    >
      {pill.value}
    </span>
  );
}
