import type { ColourOrRef, BorderSpec, TokenRef } from "./primitives";
import type { Padding } from "./padding";
import type { Effects } from "./effects";
import type { LibraryIntentAnnotations } from "./intent";
import type { DesignToken } from "./tokens";
import type { Swatch, SwatchSemanticRole } from "./swatch";
import type { IconLibraryEntry } from "./icon";

export type LibraryKind = "components" | "colours" | "icons" | "tokens" | "styles";

// Three-tier authoring scope (see docs_v1/23_v1_1_direction.md §2). Missing
// `tier` is treated as "component" for v1.0 backward compatibility.
export type LibraryTier = "component" | "assembly" | "product";

// AI Note promoted to a first-class library-entry field in v1.1
// (docs_v1/23_v1_1_direction.md §3). `intent` is the only required member;
// `notes` is author-private and excluded from downstream-agent briefs.
export interface AiNote {
  name?: string;
  intent: string;
  behaviour?: string;
  dataBinding?: string;
  notes?: string;
}

// A child slot inside an Assembly or Product composition recipe. Each child
// references another library entry by id and gives its placement within the
// parent's local coordinate space. Composition is documented in
// docs_v1/24_geosee_editor_inventory.md and machine-read here in v1.1.
export interface CompositionChild {
  entryId: string;
  rect?: { x: number; y: number; w: number; h: number };
  role?: string;
}

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
  // v1.1 additions.
  tier?: LibraryTier;
  aiNote?: AiNote;
  // Ordered child slots for assemblies/products. Empty/absent for atomic
  // components. Children reference library entry ids; the workbench
  // instantiates them recursively on drop.
  composition?: CompositionChild[];
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
