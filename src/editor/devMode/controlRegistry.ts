import { CONTAINER_ATTR, CONTAINER_NAME_ATTR } from "./constants";
import { genericContainerType } from "./inspect";

// Phase 2: scope the control panel to the clicked container instead of showing
// the full global superset. Groups map to the existing editor-chrome control
// blocks; "Text" is handled separately (shown whenever a text element resolves).
export type DevControlGroupId =
  | "padding-bars"
  | "padding-body"
  | "alignment"
  | "panel"
  | "header"
  | "sliders";

export const ALL_CONTROL_GROUP_IDS: DevControlGroupId[] = [
  "padding-bars",
  "padding-body",
  "alignment",
  "panel",
  "header",
  "sliders",
];

const FALLBACK_GROUPS: DevControlGroupId[] = [
  "padding-bars",
  "padding-body",
  "alignment",
];

// Returns the control groups that actually drive a container of this type. The
// "More chrome" expander still exposes everything; this is the default scope.
export function relevantControlGroups(
  containerType: string | undefined,
): DevControlGroupId[] {
  const type = (containerType ?? "").toLowerCase();
  if (!type) return FALLBACK_GROUPS;
  if (type.includes("slider")) return ["sliders"];
  if (type.includes("header")) return ["padding-bars", "header", "alignment"];
  if (type.includes("footer")) return ["padding-body"];
  if (type.includes("panel")) return ["panel", "padding-body"];
  if (type.includes("stack")) return ["padding-body", "alignment"];
  if (
    type.includes("section") ||
    type.includes("bar") ||
    type.includes("row") ||
    type.includes("group")
  ) {
    return ["padding-bars", "padding-body", "alignment"];
  }
  return FALLBACK_GROUPS;
}

export interface InheritedControlSource {
  name: string;
  type: string;
  element: Element;
  groups: DevControlGroupId[];
}

// D2: surface the controls of an ancestor container whose body indent / inner
// gap produces the clicked element's offset, under a separate heading. Limited
// to the nearest annotated ancestor container to avoid a wall of inherited rows.
export function resolveInheritedControlSources(
  element: Element | undefined,
): InheritedControlSource[] {
  if (!element) return [];
  const parent = element.parentElement?.closest(`[${CONTAINER_ATTR}="true"]`);
  if (!parent || parent === element) return [];
  const name =
    parent.getAttribute(CONTAINER_NAME_ATTR) ??
    parent.getAttribute("aria-label") ??
    parent.tagName.toLowerCase();
  return [
    {
      name,
      type: genericContainerType(parent),
      element: parent,
      // Parent layout fields that push child containers around.
      groups: ["padding-body"],
    },
  ];
}
