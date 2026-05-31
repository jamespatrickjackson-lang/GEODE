import type { ColourOrRef, NumberOrRef, TokenRef } from "./primitives";

export interface Shadow {
  offsetX: NumberOrRef;
  offsetY: NumberOrRef;
  blur: NumberOrRef;
  spread?: NumberOrRef;
  colour: ColourOrRef;
  inset?: boolean;
}

export interface Effects {
  shadows?: Shadow[];
  blur?: number | TokenRef;
  opacity?: number;
}
