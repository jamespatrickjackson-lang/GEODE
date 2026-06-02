import type { TokenRef } from "./primitives";

export interface Padding {
  x?: number | TokenRef;
  y?: number | TokenRef;
  top?: number | TokenRef;
  right?: number | TokenRef;
  bottom?: number | TokenRef;
  left?: number | TokenRef;
}

export interface ResolvedPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function resolvePaddingScalars(padding: Padding | undefined): ResolvedPadding {
  if (!padding) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const x = typeof padding.x === "number" ? padding.x : 0;
  const y = typeof padding.y === "number" ? padding.y : 0;
  const top = typeof padding.top === "number" ? padding.top : y;
  const right = typeof padding.right === "number" ? padding.right : x;
  const bottom = typeof padding.bottom === "number" ? padding.bottom : y;
  const left = typeof padding.left === "number" ? padding.left : x;
  return { top, right, bottom, left };
}
