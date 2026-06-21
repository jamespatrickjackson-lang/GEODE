// Phase 5/6 (D3 + R2): registry mapping a reorderable collection key to how its
// order is committed. Data-backed collections write their own model; manifest-
// governed sidebar STRUCTURE is guard-blocked here so a dev-mode drag can never
// silently diverge from editor-control-manifest.json (devModeReorderGuard).

export type ReorderGroupKind = "data" | "manifest-guarded";

export interface ReorderCommit {
  groupKey: string;
  fromIndex: number;
  toIndex: number;
  itemId: string;
  orderedIds: string[];
}

export interface ReorderGroupDef {
  key: string;
  kind: ReorderGroupKind;
  label: string;
  // Present only for data-backed groups. Manifest-guarded groups intentionally
  // have no dispatch — see Editor-Control-Manifest-Policy.md > Dev-Mode Reorder
  // Guard.
  commit?: (commit: ReorderCommit) => void;
}

const registry = new Map<string, ReorderGroupDef>();

export function registerReorderGroup(def: ReorderGroupDef): void {
  registry.set(def.key, def);
}

// A group key may carry a per-instance suffix (e.g. "layers:Topo",
// "scene-overlays:<pageId>") so the drag groups rows within one sidebar section
// while a single base group ("layers") owns the dispatch. Lookup uses the base.
function baseGroupKey(key: string): string {
  const sep = key.indexOf(":");
  return sep >= 0 ? key.slice(0, sep) : key;
}

export function getReorderGroup(key: string): ReorderGroupDef | undefined {
  return registry.get(baseGroupKey(key));
}

export function clearReorderGroups(): void {
  registry.clear();
}

// Returns true when the reorder was applied; false when blocked (e.g. a
// manifest-guarded group or an unknown key), with a console note for the guard.
export function commitReorder(commit: ReorderCommit): boolean {
  const def = registry.get(baseGroupKey(commit.groupKey));
  if (!def) return false;
  if (def.kind === "manifest-guarded" || !def.commit) {
    if (typeof console !== "undefined") {
      console.warn(
        `[dev-mode reorder] "${commit.groupKey}" is manifest-governed structure. ` +
          "Per devModeReorderGuard, confirm with the operator and rewrite " +
          "editor-control-manifest.json + source order; runtime-only reorder is " +
          "not persisted.",
      );
    }
    return false;
  }
  if (commit.fromIndex === commit.toIndex) return false;
  def.commit(commit);
  return true;
}
