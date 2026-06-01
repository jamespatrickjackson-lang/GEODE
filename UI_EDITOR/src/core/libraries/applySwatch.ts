import type { Package, SelectionIds } from "../schema/package";
import type { ColourLibraryEntry } from "../schema/library";
import { clone } from "../util/clone";

export type SwatchTargetProperty = "fill" | "text" | "border" | "divider";

export function applySwatch(
  selection: SelectionIds,
  swatchId: string,
  targetProperty: SwatchTargetProperty,
  pkg: Package,
): Package {
  const swatch = pkg.libraries.colours.find((s) => s.id === swatchId);
  if (!swatch) return pkg;
  const next = clone(pkg);
  const colour = { hex: swatch.hex, alpha: swatch.alpha };
  for (const sel of selection) {
    if (sel.kind === "component") {
      const c = next.components[sel.id];
      if (!c) continue;
      applyToComponent(c as unknown as { props: Record<string, unknown> }, targetProperty, colour, swatch);
    } else {
      const c = next.containers[sel.id];
      if (!c) continue;
      applyToContainer(c as unknown as Record<string, unknown>, targetProperty, colour);
    }
  }
  return next;
}

function applyToComponent(
  component: { props: Record<string, unknown> },
  target: SwatchTargetProperty,
  colour: { hex: string; alpha: number },
  _swatch: ColourLibraryEntry,
): void {
  const props = component.props as Record<string, unknown>;
  if (target === "fill") props.fill = colour;
  else if (target === "text") props.colour = colour;
  else if (target === "divider") props.colour = colour;
  else if (target === "border") {
    const border = (props.border as Record<string, unknown>) ?? {};
    border.colour = colour;
    props.border = border;
  }
}

function applyToContainer(
  container: Record<string, unknown>,
  target: SwatchTargetProperty,
  colour: { hex: string; alpha: number },
): void {
  if (target === "fill") container.fill = colour;
  else if (target === "border") {
    const border = (container.border as Record<string, unknown>) ?? { width: 1 };
    border.colour = colour;
    container.border = border;
  }
}
