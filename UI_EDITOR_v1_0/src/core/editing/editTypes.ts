import type { Rect } from "../schema/primitives";
import type { Component } from "../schema/component";
import type { Container } from "../schema/container";
import type { SelectionIds } from "../schema/package";
import type { StyleLibraryEntry } from "../schema/library";
import type { Effects, Shadow } from "../schema/effects";
import type { Padding } from "../schema/padding";

export type EditOperation =
  | { type: "MOVE"; targets: ReadonlyArray<{ kind: "container" | "component"; id: string; rect: Rect }> }
  | { type: "RESIZE"; targetKind: "container" | "component"; targetId: string; rect: Rect }
  | { type: "PROPERTY_CHANGED"; targetKind: "container" | "component"; targetId: string; propertyPath: string; value: unknown }
  | { type: "COMPONENT_ADDED"; component: Component }
  | { type: "CONTAINER_ADDED"; container: Container }
  | { type: "COMPONENT_REMOVED"; componentId: string }
  | { type: "CONTAINER_REMOVED"; containerId: string }
  | { type: "SWATCH_APPLIED"; selection: SelectionIds; swatchId: string; target: "fill" | "text" | "border" | "divider" }
  | { type: "TOKEN_APPLIED"; selection: SelectionIds; tokenId: string; propertyPath: string }
  | { type: "STYLE_APPLIED"; selection: SelectionIds; styleId: string }
  | { type: "STYLE_DETACHED"; selection: SelectionIds }
  | { type: "STYLE_ADDED"; entry: StyleLibraryEntry }
  | { type: "STYLE_REMOVED"; styleId: string; orphanPolicy: "literal-replace" | "warn-only" }
  | { type: "EFFECTS_CHANGED"; targetKind: "container" | "component"; targetId: string; patch: Partial<Effects> }
  | { type: "SHADOW_ADDED"; targetKind: "container" | "component"; targetId: string; shadow: Shadow }
  | { type: "SHADOW_REMOVED"; targetKind: "container" | "component"; targetId: string; shadowIndex: number }
  | { type: "PADDING_CHANGED"; targetKind: "container" | "component"; targetId: string; padding: Padding }
  | { type: "INTENT_EDITED"; targetKind: "container" | "component" | "frame"; targetId: string; patch: { name?: string; intent?: string; behaviour?: string; dataBinding?: string; dependsOn?: string[]; authorNotes?: string } };
