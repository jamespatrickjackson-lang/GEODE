import {
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { SURFACE_ELEVATION_STOP_GAP } from "../../topoMap/settings";

export function useTopoGradientHandles({
  positions,
  midpoints,
  setPosition,
  setMidpoint,
}: {
  positions: readonly number[];
  midpoints: readonly number[];
  setPosition: (index: number, value: number) => void;
  setMidpoint: (index: number, value: number) => void;
}) {
  const gradientRailRef = useRef<HTMLDivElement | null>(null);

  const gradientPositionFromClientX = (clientX: number): number | null => {
    const rect = gradientRailRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const updateStopFromClientX = (index: number, clientX: number) => {
    if (index <= 0 || index >= positions.length - 1) return;
    const position = gradientPositionFromClientX(clientX);
    if (position !== null) setPosition(index, position);
  };

  const updateMidpointFromClientX = (index: number, clientX: number) => {
    const position = gradientPositionFromClientX(clientX);
    const left = positions[index];
    const right = positions[index + 1];
    if (position === null || right <= left) return;
    setMidpoint(index, (position - left) / (right - left));
  };

  const beginStopDrag =
    (index: number) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (index <= 0 || index >= positions.length - 1) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      updateStopFromClientX(index, event.clientX);
      const onMove = (moveEvent: globalThis.PointerEvent) => {
        moveEvent.preventDefault();
        updateStopFromClientX(index, moveEvent.clientX);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    };

  const beginMidpointDrag =
    (index: number) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      updateMidpointFromClientX(index, event.clientX);
      const onMove = (moveEvent: globalThis.PointerEvent) => {
        moveEvent.preventDefault();
        updateMidpointFromClientX(index, moveEvent.clientX);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    };

  const handleStopKeyDown =
    (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
      if (index <= 0 || index >= positions.length - 1) return;
      const lower = positions[index - 1] + SURFACE_ELEVATION_STOP_GAP;
      const upper = positions[index + 1] - SURFACE_ELEVATION_STOP_GAP;
      const step = event.shiftKey ? 0.05 : 0.01;
      let next = positions[index];
      if (event.key === "ArrowLeft") next -= step;
      else if (event.key === "ArrowRight") next += step;
      else if (event.key === "Home") next = lower;
      else if (event.key === "End") next = upper;
      else return;
      event.preventDefault();
      event.stopPropagation();
      setPosition(index, Math.min(upper, Math.max(lower, next)));
    };

  const handleMidpointKeyDown =
    (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
      const step = event.shiftKey ? 0.05 : 0.01;
      let next = midpoints[index];
      if (event.key === "ArrowLeft") next -= step;
      else if (event.key === "ArrowRight") next += step;
      else if (event.key === "Home") next = 0.05;
      else if (event.key === "End") next = 0.95;
      else return;
      event.preventDefault();
      event.stopPropagation();
      setMidpoint(index, next);
    };

  return {
    gradientRailRef,
    beginStopDrag,
    beginMidpointDrag,
    handleStopKeyDown,
    handleMidpointKeyDown,
  };
}
