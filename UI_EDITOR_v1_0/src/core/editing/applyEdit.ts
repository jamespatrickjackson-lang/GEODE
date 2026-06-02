import type { Package } from "../schema/package";
import type { ValidationFinding } from "../schema/validation";
import type { ChangeRecord, ChangeRecordKind } from "../schema/changeLog";
import type { EditOperation } from "./editTypes";
import { clone } from "../util/clone";
import { newId } from "../util/ids";
import { checkRestrictedSurface } from "./safeEdits";
import { applySwatch } from "../libraries/applySwatch";
import { applyToken } from "../libraries/applyToken";
import { applyStyle, detachStyle } from "../libraries/applyStyle";

export interface ApplyEditOk {
  ok: true;
  pkg: Package;
  change: ChangeRecord;
  editClass: "schema" | "ephemeral";
}
export interface ApplyEditRefused {
  ok: false;
  refused: true;
  findings: ValidationFinding[];
}
export type ApplyEditResult = ApplyEditOk | ApplyEditRefused;

export function applyEdit(pkg: Package, edit: EditOperation): ApplyEditResult {
  const refusals = checkRestrictedSurface(pkg, edit);
  if (refusals.length > 0) return { ok: false, refused: true, findings: refusals };

  const next = clone(pkg);
  const recordKind = changeKindFor(edit);
  const affected: ChangeRecord["affected"] = {};
  let summary = recordKind.replace(/_/g, " ");

  switch (edit.type) {
    case "MOVE":
      for (const t of edit.targets) {
        if (t.kind === "component") {
          const c = next.components[t.id];
          if (c) c.rect = t.rect;
        } else {
          const c = next.containers[t.id];
          if (c) c.rect = t.rect;
        }
      }
      affected.componentIds = edit.targets.filter((t) => t.kind === "component").map((t) => t.id);
      affected.containerIds = edit.targets.filter((t) => t.kind === "container").map((t) => t.id);
      summary = `Moved ${edit.targets.length} element${edit.targets.length === 1 ? "" : "s"}`;
      break;
    case "RESIZE": {
      if (edit.targetKind === "component") {
        const c = next.components[edit.targetId];
        if (c) c.rect = edit.rect;
      } else {
        const c = next.containers[edit.targetId];
        if (c) c.rect = edit.rect;
      }
      affected[edit.targetKind === "component" ? "componentIds" : "containerIds"] = [edit.targetId];
      summary = `Resized ${edit.targetId}`;
      break;
    }
    case "PROPERTY_CHANGED": {
      const target =
        edit.targetKind === "component"
          ? (next.components[edit.targetId]?.props as unknown as Record<string, unknown> | undefined)
          : (next.containers[edit.targetId] as unknown as Record<string, unknown> | undefined);
      if (target) writePath(target, edit.propertyPath, edit.value);
      affected[edit.targetKind === "component" ? "componentIds" : "containerIds"] = [edit.targetId];
      summary = `Changed ${edit.targetId}.${edit.propertyPath}`;
      break;
    }
    case "COMPONENT_ADDED":
      next.components[edit.component.id] = clone(edit.component);
      affected.componentIds = [edit.component.id];
      summary = `Added component ${edit.component.id}`;
      break;
    case "CONTAINER_ADDED":
      next.containers[edit.container.id] = clone(edit.container);
      affected.containerIds = [edit.container.id];
      summary = `Added container ${edit.container.id}`;
      break;
    case "COMPONENT_REMOVED":
      delete next.components[edit.componentId];
      affected.componentIds = [edit.componentId];
      summary = `Removed component ${edit.componentId}`;
      break;
    case "CONTAINER_REMOVED":
      delete next.containers[edit.containerId];
      affected.containerIds = [edit.containerId];
      summary = `Removed container ${edit.containerId}`;
      break;
    case "SWATCH_APPLIED":
      Object.assign(next, applySwatch(edit.selection, edit.swatchId, edit.target, next));
      affected.swatchIds = [edit.swatchId];
      summary = `Applied swatch ${edit.swatchId}`;
      break;
    case "TOKEN_APPLIED":
      Object.assign(next, applyToken(edit.selection, edit.tokenId, edit.propertyPath, next));
      affected.tokenIds = [edit.tokenId];
      summary = `Applied token ${edit.tokenId} → ${edit.propertyPath}`;
      break;
    case "STYLE_APPLIED":
      Object.assign(next, applyStyle(edit.selection, edit.styleId, next));
      affected.styleIds = [edit.styleId];
      summary = `Applied style ${edit.styleId}`;
      break;
    case "STYLE_DETACHED":
      Object.assign(next, detachStyle(edit.selection, next));
      summary = "Detached style";
      break;
    case "STYLE_ADDED":
      next.libraries.styles = [...next.libraries.styles, clone(edit.entry)];
      affected.styleIds = [edit.entry.id];
      summary = `Added style ${edit.entry.id}`;
      break;
    case "STYLE_REMOVED":
      next.libraries.styles = next.libraries.styles.filter((s) => s.id !== edit.styleId);
      affected.styleIds = [edit.styleId];
      summary = `Removed style ${edit.styleId}`;
      break;
    case "EFFECTS_CHANGED": {
      const node =
        edit.targetKind === "component" ? next.components[edit.targetId] : next.containers[edit.targetId];
      if (node) node.effects = { ...node.effects, ...edit.patch };
      affected[edit.targetKind === "component" ? "componentIds" : "containerIds"] = [edit.targetId];
      summary = `Changed effects on ${edit.targetId}`;
      break;
    }
    case "SHADOW_ADDED": {
      const node =
        edit.targetKind === "component" ? next.components[edit.targetId] : next.containers[edit.targetId];
      if (node) {
        const eff = node.effects ?? {};
        node.effects = { ...eff, shadows: [...(eff.shadows ?? []), edit.shadow] };
      }
      summary = `Added shadow to ${edit.targetId}`;
      break;
    }
    case "SHADOW_REMOVED": {
      const node =
        edit.targetKind === "component" ? next.components[edit.targetId] : next.containers[edit.targetId];
      if (node?.effects?.shadows) {
        const list = node.effects.shadows.filter((_, i) => i !== edit.shadowIndex);
        node.effects = { ...node.effects, shadows: list };
      }
      summary = `Removed shadow from ${edit.targetId}`;
      break;
    }
    case "PADDING_CHANGED": {
      if (edit.targetKind === "container") {
        const c = next.containers[edit.targetId];
        if (c) c.padding = edit.padding;
      }
      summary = `Changed padding on ${edit.targetId}`;
      break;
    }
    case "INTENT_EDITED": {
      const merge = { ...edit.patch };
      if (edit.targetKind === "component") {
        const c = next.components[edit.targetId];
        if (c) c.intent = { ...c.intent, ...merge };
      } else if (edit.targetKind === "container") {
        const c = next.containers[edit.targetId];
        if (c) c.intent = { ...c.intent, ...merge };
      } else {
        const f = next.frames.find((fr) => fr.id === edit.targetId);
        if (f) f.intent = { ...f.intent, ...merge };
      }
      summary = `Edited intent for ${edit.targetId}`;
      break;
    }
  }

  const change: ChangeRecord = {
    id: `cr-${newId()}`,
    timestamp: new Date().toISOString(),
    kind: recordKind,
    packageStateBefore: next.manifest.packageState,
    packageStateAfter: next.manifest.packageState,
    affected,
    summary,
    editClass: "schema",
  };
  next.changeLog = [...next.changeLog, change];
  return { ok: true, pkg: next, change, editClass: "schema" };
}

function changeKindFor(edit: EditOperation): ChangeRecordKind {
  switch (edit.type) {
    case "MOVE":
    case "RESIZE":
      return "component_property_changed";
    case "PROPERTY_CHANGED":
      return "component_property_changed";
    case "COMPONENT_ADDED":
      return "component_added";
    case "CONTAINER_ADDED":
      return "container_added";
    case "COMPONENT_REMOVED":
      return "component_removed";
    case "CONTAINER_REMOVED":
      return "container_removed";
    case "SWATCH_APPLIED":
      return "library_entry_edited";
    case "TOKEN_APPLIED":
      return "token_changed";
    case "STYLE_APPLIED":
      return "style_applied";
    case "STYLE_DETACHED":
      return "style_detached";
    case "STYLE_ADDED":
      return "style_added";
    case "STYLE_REMOVED":
      return "style_removed";
    case "EFFECTS_CHANGED":
      return "effects_changed";
    case "SHADOW_ADDED":
      return "shadow_added";
    case "SHADOW_REMOVED":
      return "shadow_removed";
    case "PADDING_CHANGED":
      return "padding_changed";
    case "INTENT_EDITED":
      return "intent_edited";
  }
}

function writePath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let node: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (typeof node[key] !== "object" || node[key] == null) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]!] = value;
}
