export type TokenCategory =
  | "spacing"
  | "radius"
  | "font-size"
  | "font-family"
  | "duration"
  | "shadow"
  | "z-index"
  | "padding";

export type TokenUnit = "px" | "ms" | "rem" | "em" | null;

export interface DesignToken {
  id: string;
  name: string;
  category: TokenCategory;
  value: number | string;
  unit?: TokenUnit;
  rationale?: string;
}

export interface TokensFile {
  schemaVersion: 1;
  tokens: Record<string, DesignToken>;
}
