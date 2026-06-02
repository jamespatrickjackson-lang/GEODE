import type { Package, SelectionIds } from "../schema/package";
import { clone } from "../util/clone";

export function applyStyle(
  selection: SelectionIds,
  styleId: string,
  pkg: Package,
): Package {
  const style = pkg.libraries.styles.find((s) => s.id === styleId);
  if (!style) return pkg;
  const next = clone(pkg);
  for (const sel of selection) {
    if (sel.kind === "component") {
      const c = next.components[sel.id];
      if (!c) continue;
      c.styleRef = styleId;
    } else {
      const c = next.containers[sel.id];
      if (!c) continue;
      c.styleRef = styleId;
    }
  }
  return next;
}

export function detachStyle(selection: SelectionIds, pkg: Package): Package {
  const next = clone(pkg);
  for (const sel of selection) {
    if (sel.kind === "component") {
      const c = next.components[sel.id];
      if (c) delete c.styleRef;
    } else {
      const c = next.containers[sel.id];
      if (c) delete c.styleRef;
    }
  }
  return next;
}
