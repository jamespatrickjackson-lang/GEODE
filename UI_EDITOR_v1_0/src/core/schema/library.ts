import type { ColourOrRef, BorderSpec, TokenRef } from "./primitives";
import type { Padding } from "./padding";
import type { Effects } from "./effects";
import type { LibraryIntentAnnotations } from "./intent";
import type { DesignToken } from "./tokens";
import type { Swatch, SwatchSemanticRole } from "./swatch";
import type { IconLibraryEntry } from "./icon";

export type LibraryKind = "components" | "colours" | "icons" | "tokens" | "styles";

export interface ComponentLibraryEntry {
  id: string;
  name: string;
  kind: "component" | "container";
  archetype: string;
  defaultProps: Record<string, unknown>;
  defaultSize: { w: number; h: number };
  rationale?: string;
  thumbnail?: string;
  intent?: LibraryIntentAnnotations;
}

export interface ColourLibraryEntry extends Swatch {
  semanticRole?: SwatchSemanticRole;
  intent?: LibraryIntentAnnotations;
}

export interface TokenLibraryEntry extends DesignToken {
  intent?: LibraryIntentAnnotations;
}

export interface IconLibraryEntryWithIntent extends IconLibraryEntry {
  intent?: LibraryIntentAnnotations;
}

export type StyleSemanticRole =
  | "card"
  | "panel"
  | "control"
  | "input"
  | "elevated"
  | "ghost"
  | "accent"
  | "warning"
  | "error";

export interface StyleLibraryEntry {
  id: string;
  name: string;
  semanticRole?: StyleSemanticRole;
  rationale?: string;
  intent?: LibraryIntentAnnotations;
  fill?: ColourOrRef;
  border?: BorderSpec & {
    width: number | TokenRef;
  };
  padding?: Padding;
  effects?: Effects;
}

export interface Libraries {
  components: ComponentLibraryEntry[];
  colours: ColourLibraryEntry[];
  icons: IconLibraryEntryWithIntent[];
  tokens: TokenLibraryEntry[];
  styles: StyleLibraryEntry[];
}

export interface LibrariesFile {
  schemaVersion: 1;
  libraries: Libraries;
}

export type { IconLibraryEntry };
