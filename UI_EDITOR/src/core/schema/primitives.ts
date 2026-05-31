export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ColourValue {
  hex: string;
  alpha: number;
}

export interface TokenRef {
  tokenRef: string;
}

export interface StyleRef {
  styleRef: string;
}

export type ColourOrRef = ColourValue | TokenRef;
export type ColourOrStyleRef = ColourValue | TokenRef | StyleRef;
export type NumberOrRef = number | TokenRef;

export interface BorderSpec {
  width: number | TokenRef;
  colour: ColourOrRef;
  radius?: number | TokenRef;
  sides?: Array<"left" | "top" | "right" | "bottom">;
}
