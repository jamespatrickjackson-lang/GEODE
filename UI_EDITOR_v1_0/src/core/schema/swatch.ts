export type SwatchSemanticRole =
  | "fill"
  | "text"
  | "divider"
  | "accent"
  | "warning"
  | "error"
  | "success"
  | "info";

export interface Swatch {
  id: string;
  name: string;
  hex: string;
  alpha: number;
  rationale?: string;
  semanticRole?: SwatchSemanticRole;
}
