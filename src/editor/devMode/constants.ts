import { TECHNICAL_MONO_FONT } from "../styles";
import type { EditorChromeSettings } from "../../pages/types";

export const SOURCE_ATTR = "data-dev-source";
export const NOTE_ATTR = "data-dev-note";
export const TEXT_SOURCE_ATTR = "data-dev-text-source";
export const PADDING_SOURCE_ATTR = "data-dev-padding-source";
export const CONTAINER_ATTR = "data-dev-container";
export const CONTAINER_TYPE_ATTR = "data-dev-container-type";
export const CONTAINER_NAME_ATTR = "data-dev-container-name";
export const CONTAINER_SCOPE_ATTR = "data-dev-container-scope";

// Phase 5: a reorderable item declares its collection and stable id. The drag
// primitive maps a drop to a registered model dispatch (reorderRegistry).
export const ORDER_GROUP_ATTR = "data-dev-order-group";
export const ORDER_ID_ATTR = "data-dev-order-id";

export const ALIGN_ITEM_OPTIONS: NonNullable<
  EditorChromeSettings["containerAlignItems"]
>[] = ["flex-start", "center", "flex-end", "stretch", "baseline"];

export const JUSTIFY_CONTENT_OPTIONS: NonNullable<
  EditorChromeSettings["containerJustifyContent"]
>[] = [
  "flex-start",
  "center",
  "flex-end",
  "space-between",
  "space-around",
  "space-evenly",
];

export const FONT_FAMILY_OPTIONS = [
  "inherit",
  TECHNICAL_MONO_FONT,
  "system-ui, sans-serif",
  "Arial, Helvetica, sans-serif",
  "Georgia, serif",
  "Consolas, monospace",
] as const;

export const FONT_WEIGHT_OPTIONS = ["400", "500", "600", "700", "800"] as const;
export const FONT_STYLE_OPTIONS = ["normal", "italic"] as const;
export const TEXT_TRANSFORM_OPTIONS = [
  "none",
  "uppercase",
  "lowercase",
  "capitalize",
] as const;
