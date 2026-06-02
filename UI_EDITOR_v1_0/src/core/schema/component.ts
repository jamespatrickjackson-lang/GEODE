import type { Rect, ColourOrRef, ColourOrStyleRef, BorderSpec, TokenRef } from "./primitives";
import type { Constraints } from "./anchor";
import type { Padding } from "./padding";
import type { Effects } from "./effects";
import type { IntentAnnotations } from "./intent";

export type ComponentState = "default" | "hover" | "active" | "focus" | "disabled";

export interface ComponentVariant {
  id: string;
  name: string;
  propsPatch: Record<string, unknown>;
}

export interface PillButtonProps {
  archetype: "pill-button";
  label: string;
  surface: "dark" | "tinted";
  fill?: ColourOrRef;
  text?: ColourOrRef;
  icon?: { iconLibraryEntryId: string };
  onClickAction?: string;
  isLoading?: boolean;
}

export interface IconButtonProps {
  archetype: "icon-button";
  iconLibraryEntryId: string;
  ariaLabel: string;
  surface: "dark" | "tinted";
  size: 20 | 24 | 28 | 32;
  onClickAction?: string;
  isLoading?: boolean;
}

export interface FooterActionButtonProps {
  archetype: "footer-action-button";
  iconLibraryEntryId: string;
  ariaLabel: string;
  destructive?: boolean;
  disabled?: boolean;
  onClickAction?: string;
  isLoading?: boolean;
}

export interface InlineEditableTextProps {
  archetype: "inline-editable-text";
  value: string;
  fontSize: number | TokenRef;
  fontFamily?: string | TokenRef;
  colour?: ColourOrRef;
  maxLength?: number;
  onCommitAction?: string;
  truncate?: boolean;
}

export interface DirtyDotProps {
  archetype: "dirty-dot";
  size: 6 | 8 | 10;
  fill?: ColourOrRef;
  visible: boolean;
}

export interface LetterGlyphProps {
  archetype: "letter-glyph";
  letter: string;
  fontSize: number | TokenRef;
  fontFamily?: string | TokenRef;
  colour?: ColourOrRef;
}

export interface NumericLabelProps {
  archetype: "numeric-label";
  value: string;
  fontSize: number | TokenRef;
  colour?: ColourOrRef;
  trailingSeparator?: "." | " " | "";
}

export interface ColourSwatchProps {
  archetype: "colour-swatch";
  size: 12 | 16 | 20 | 24;
  currentColour: ColourOrRef;
  onChangeAction?: string;
}

export interface SliderProps {
  archetype: "slider";
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;
  showValueLabel: boolean;
  onChangeAction?: string;
  onCommitAction?: string;
}

export interface NumericInputProps {
  archetype: "numeric-input";
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  unit?: string;
  onChangeAction?: string;
}

export interface SelectDropdownProps {
  archetype: "select-dropdown";
  label?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  placeholder?: string;
  onChangeAction?: string;
}

export interface CheckboxProps {
  archetype: "checkbox";
  label?: string;
  checked: boolean;
  indeterminate?: boolean;
  onChangeAction?: string;
}

export interface NativeDetailsProps {
  archetype: "native-details";
  summaryLabel: string;
  defaultOpen: boolean;
  contents: string[];
}

export interface AriaExpandedRowProps {
  archetype: "aria-expanded-row";
  summaryLabel: string;
  isExpanded: boolean;
  contents: string[];
  onToggleAction?: string;
}

export interface DividerProps {
  archetype: "divider";
  orientation: "horizontal" | "vertical";
  thickness: number;
  colour?: ColourOrRef;
  length?: number;
}

export interface IconProps {
  archetype: "icon";
  iconLibraryEntryId: string;
  size: number;
  colour?: ColourOrRef;
}

export interface TextProps {
  archetype: "text";
  value: string;
  fontSize: number | TokenRef;
  fontFamily?: string | TokenRef;
  fontWeight?: 400 | 500 | 600 | 700;
  colour?: ColourOrRef;
  alignment?: "left" | "centre" | "right";
  truncate?: boolean;
}

export interface RectangleProps {
  archetype: "rectangle";
  fill?: ColourOrStyleRef;
  border?: BorderSpec;
  effects?: Effects;
}

export interface EllipseProps {
  archetype: "ellipse";
  fill?: ColourOrStyleRef;
  border?: {
    width: number | TokenRef;
    colour: ColourOrRef;
  };
  effects?: Effects;
}

export interface LineProps {
  archetype: "line";
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness: number;
  colour?: ColourOrRef;
  endCap?: "butt" | "round" | "square";
  effects?: Effects;
}

export interface ImagePlaceholderProps {
  archetype: "image-placeholder";
  altText?: string;
  aspectRatio?: number;
  placeholderStyle: "checkerboard" | "diagonal-stripes" | "labeled-box";
}

export interface TooltipProps {
  archetype: "tooltip";
  text: string;
  arrowPosition?: "none" | "top" | "right" | "bottom" | "left";
  fill?: ColourOrStyleRef;
  text_colour?: ColourOrRef;
  border?: {
    width: number | TokenRef;
    colour: ColourOrRef;
    radius?: number | TokenRef;
  };
  padding?: Padding;
  effects?: Effects;
  describesElementId?: string;
}

export interface TabTriggerProps {
  archetype: "tab-trigger";
  label: string;
  tabId: string;
  iconLibraryEntryId?: string;
  badge?: string;
  isActive: boolean;
}

export interface MenuItemProps {
  archetype: "menu-item";
  label: string;
  iconLibraryEntryId?: string;
  description?: string;
  trailingHint?: string;
  destructive?: boolean;
  disabled?: boolean;
  onClickAction?: string;
}

export interface MenuDividerProps {
  archetype: "menu-divider";
}

export interface CarouselIndicatorsProps {
  archetype: "carousel-indicators";
  count: number;
  activeIndex: number;
  shape: "dot" | "bar" | "number";
  position: "below" | "above" | "overlay-bottom" | "overlay-top";
}

export interface ToggleButtonProps {
  archetype: "toggle-button";
  label?: string;
  iconLibraryEntryId?: string;
  pressed: boolean;
  surface: "dark" | "tinted";
  size: 24 | 28 | 32;
  onPressedChangeAction?: string;
}

export type ComponentProps =
  | PillButtonProps
  | IconButtonProps
  | FooterActionButtonProps
  | InlineEditableTextProps
  | DirtyDotProps
  | LetterGlyphProps
  | NumericLabelProps
  | ColourSwatchProps
  | SliderProps
  | NumericInputProps
  | SelectDropdownProps
  | CheckboxProps
  | NativeDetailsProps
  | AriaExpandedRowProps
  | DividerProps
  | IconProps
  | TextProps
  | RectangleProps
  | EllipseProps
  | LineProps
  | ImagePlaceholderProps
  | TooltipProps
  | TabTriggerProps
  | MenuItemProps
  | MenuDividerProps
  | CarouselIndicatorsProps
  | ToggleButtonProps;

export type ComponentArchetypeId = ComponentProps["archetype"];

export interface Component {
  id: string;
  name: string;
  archetype: ComponentArchetypeId;
  parentId: string | null;
  frameId: string;
  rect: Rect;
  constraints: Constraints;
  locked: boolean;
  hidden: boolean;
  props: ComponentProps;
  variant?: string;
  state?: ComponentState;
  styleRef?: string;
  effects?: Effects;
  hostRef?: string;
  rationale?: string;
  intent?: IntentAnnotations;
}

export interface ComponentsFile {
  schemaVersion: 1;
  components: Record<string, Component>;
}
