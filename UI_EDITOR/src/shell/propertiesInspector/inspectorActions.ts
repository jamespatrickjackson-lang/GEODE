import type { Dispatch } from "react";
import type { ShellAction } from "../state/shellActions";
import type { ShellState } from "../state/shellState";
import type { Package, SelectionId } from "../../core/schema/package";
import type { Container } from "../../core/schema/container";
import type { Component } from "../../core/schema/component";
import type { Rect } from "../../core/schema/primitives";
import type { Effects, Shadow } from "../../core/schema/effects";
import type { IntentAnnotations } from "../../core/schema/intent";
import { applyEdit } from "../../core/editing/applyEdit";

export type SelectionItem =
  | { kind: "component"; element: Component }
  | { kind: "container"; element: Container };

export function resolveSelection(
  pkg: Package | null,
  selection: ShellState["selection"],
): SelectionItem[] {
  if (!pkg) return [];
  const out: SelectionItem[] = [];
  for (const id of selection) {
    if (id.kind === "component") {
      const el = pkg.components[id.id];
      if (el) out.push({ kind: "component", element: el });
    } else {
      const el = pkg.containers[id.id];
      if (el) out.push({ kind: "container", element: el });
    }
  }
  return out;
}

export function dispatchPropertyChange(
  pkg: Package,
  dispatch: Dispatch<ShellAction>,
  sel: SelectionId,
  propertyPath: string,
  value: unknown,
): void {
  const result = applyEdit(pkg, {
    type: "PROPERTY_CHANGED",
    targetKind: sel.kind,
    targetId: sel.id,
    propertyPath,
    value,
  });
  if (result.ok) {
    dispatch({ type: "PACKAGE_REPLACED", pkg: result.pkg });
    dispatch({ type: "DIRTY_SET", dirty: true });
  } else {
    dispatch({
      type: "TOAST_PUSHED",
      toast: {
        id: `refusal-${Date.now()}`,
        severity: "warning",
        message: result.findings[0]?.message ?? "Edit refused",
        createdAt: Date.now(),
      },
    });
  }
}

export function dispatchIntentEdit(
  pkg: Package,
  dispatch: Dispatch<ShellAction>,
  sel: SelectionId,
  patch: Partial<IntentAnnotations>,
): void {
  const result = applyEdit(pkg, {
    type: "INTENT_EDITED",
    targetKind: sel.kind,
    targetId: sel.id,
    patch,
  });
  if (result.ok) {
    dispatch({ type: "PACKAGE_REPLACED", pkg: result.pkg });
    dispatch({ type: "DIRTY_SET", dirty: true });
  }
}

export function dispatchResize(
  pkg: Package,
  dispatch: Dispatch<ShellAction>,
  sel: SelectionId,
  rect: Rect,
): void {
  const result = applyEdit(pkg, {
    type: "RESIZE",
    targetKind: sel.kind,
    targetId: sel.id,
    rect,
  });
  if (result.ok) {
    dispatch({ type: "PACKAGE_REPLACED", pkg: result.pkg });
    dispatch({ type: "DIRTY_SET", dirty: true });
  }
}

export function dispatchEffectsPatch(
  pkg: Package,
  dispatch: Dispatch<ShellAction>,
  sel: SelectionId,
  patch: Partial<Effects>,
): void {
  const result = applyEdit(pkg, {
    type: "EFFECTS_CHANGED",
    targetKind: sel.kind,
    targetId: sel.id,
    patch,
  });
  if (result.ok) {
    dispatch({ type: "PACKAGE_REPLACED", pkg: result.pkg });
    dispatch({ type: "DIRTY_SET", dirty: true });
  }
}

export function dispatchShadowAdd(
  pkg: Package,
  dispatch: Dispatch<ShellAction>,
  sel: SelectionId,
  shadow: Shadow,
): void {
  const result = applyEdit(pkg, {
    type: "SHADOW_ADDED",
    targetKind: sel.kind,
    targetId: sel.id,
    shadow,
  });
  if (result.ok) {
    dispatch({ type: "PACKAGE_REPLACED", pkg: result.pkg });
    dispatch({ type: "DIRTY_SET", dirty: true });
  }
}

export function dispatchShadowRemove(
  pkg: Package,
  dispatch: Dispatch<ShellAction>,
  sel: SelectionId,
  shadowIndex: number,
): void {
  const result = applyEdit(pkg, {
    type: "SHADOW_REMOVED",
    targetKind: sel.kind,
    targetId: sel.id,
    shadowIndex,
  });
  if (result.ok) {
    dispatch({ type: "PACKAGE_REPLACED", pkg: result.pkg });
    dispatch({ type: "DIRTY_SET", dirty: true });
  }
}

export function dispatchStyleApplied(
  pkg: Package,
  dispatch: Dispatch<ShellAction>,
  selection: ShellState["selection"],
  styleId: string,
): void {
  const result = applyEdit(pkg, {
    type: "STYLE_APPLIED",
    selection,
    styleId,
  });
  if (result.ok) {
    dispatch({ type: "PACKAGE_REPLACED", pkg: result.pkg });
    dispatch({ type: "DIRTY_SET", dirty: true });
  }
}

export function dispatchStyleDetached(
  pkg: Package,
  dispatch: Dispatch<ShellAction>,
  selection: ShellState["selection"],
): void {
  const result = applyEdit(pkg, { type: "STYLE_DETACHED", selection });
  if (result.ok) {
    dispatch({ type: "PACKAGE_REPLACED", pkg: result.pkg });
    dispatch({ type: "DIRTY_SET", dirty: true });
  }
}

export function sharedPropertyValue<T>(
  items: SelectionItem[],
  read: (item: SelectionItem) => T,
): { value: T | "multiple"; allSame: boolean } {
  if (items.length === 0) return { value: undefined as unknown as T, allSame: true };
  const first = read(items[0]!);
  for (let i = 1; i < items.length; i++) {
    if (read(items[i]!) !== first) return { value: "multiple", allSame: false };
  }
  return { value: first, allSame: true };
}
