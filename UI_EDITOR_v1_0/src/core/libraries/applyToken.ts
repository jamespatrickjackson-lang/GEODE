import type { Package, SelectionIds } from "../schema/package";
import { clone } from "../util/clone";

export function applyToken(
  selection: SelectionIds,
  tokenId: string,
  targetProperty: string,
  pkg: Package,
): Package {
  if (!pkg.tokens[tokenId]) return pkg;
  const next = clone(pkg);
  const ref = { tokenRef: tokenId };
  for (const sel of selection) {
    const target =
      sel.kind === "component"
        ? (next.components[sel.id]?.props as unknown as Record<string, unknown> | undefined)
        : (next.containers[sel.id] as unknown as Record<string, unknown> | undefined);
    if (!target) continue;
    writePath(target, targetProperty, ref);
  }
  return next;
}

function writePath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let node: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (typeof node[key] !== "object" || node[key] == null) {
      node[key] = {};
    }
    node = node[key] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]!] = value;
}
