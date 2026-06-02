import type { Component, ComponentArchetypeId, ComponentProps } from "../schema/component";
import type { Container } from "../schema/container";
import type { ComponentLibraryEntry } from "../schema/library";
import type { Package } from "../schema/package";
import { DEFAULT_CONSTRAINTS } from "../schema/anchor";
import { newId } from "../util/ids";
import { clone } from "../util/clone";

export interface InstantiateResult {
  nextPkg: Package;
  newId: string;
}

export function instantiateComponent(
  entry: ComponentLibraryEntry,
  dropPointFrameSpace: { x: number; y: number },
  parentContainerId: string | null,
  frameId: string,
  pkg: Package,
): InstantiateResult {
  const idSuffix = newId();
  if (entry.kind === "container") {
    const id = `container-${entry.archetype}-${idSuffix}`;
    const container: Container = {
      id,
      name: entry.name,
      archetype: entry.archetype,
      parentId: parentContainerId,
      frameId,
      rect: { ...dropPointFrameSpace, w: entry.defaultSize.w, h: entry.defaultSize.h },
      constraints: { ...DEFAULT_CONSTRAINTS },
      containerIds: [],
      componentIds: [],
      locked: false,
      hidden: false,
    };
    return { nextPkg: addContainerToPackage(pkg, container, parentContainerId, frameId), newId: id };
  }
  const id = `component-${entry.archetype}-${idSuffix}`;
  const archetype = entry.archetype as ComponentArchetypeId;
  const props = defaultPropsFor(archetype, entry.defaultProps);
  const component: Component = {
    id,
    name: entry.name,
    archetype,
    parentId: parentContainerId,
    frameId,
    rect: { ...dropPointFrameSpace, w: entry.defaultSize.w, h: entry.defaultSize.h },
    constraints: { ...DEFAULT_CONSTRAINTS },
    locked: false,
    hidden: false,
    props,
  };
  return { nextPkg: addComponentToPackage(pkg, component, parentContainerId, frameId), newId: id };
}

function addContainerToPackage(
  pkg: Package,
  container: Container,
  parentContainerId: string | null,
  frameId: string,
): Package {
  const containers = clone(pkg.containers);
  containers[container.id] = container;
  let frames = pkg.frames;
  if (parentContainerId == null) {
    frames = pkg.frames.map((f) =>
      f.id === frameId ? { ...f, containerIds: [...f.containerIds, container.id] } : f,
    );
  } else {
    const parent = containers[parentContainerId];
    if (parent) {
      containers[parentContainerId] = { ...parent, containerIds: [...parent.containerIds, container.id] };
    }
  }
  return { ...pkg, containers, frames };
}

function addComponentToPackage(
  pkg: Package,
  component: Component,
  parentContainerId: string | null,
  frameId: string,
): Package {
  const components = clone(pkg.components);
  components[component.id] = component;
  let frames = pkg.frames;
  let containers = pkg.containers;
  if (parentContainerId == null) {
    frames = pkg.frames.map((f) =>
      f.id === frameId ? { ...f, componentIds: [...f.componentIds, component.id] } : f,
    );
  } else {
    containers = clone(pkg.containers);
    const parent = containers[parentContainerId];
    if (parent) {
      containers[parentContainerId] = { ...parent, componentIds: [...parent.componentIds, component.id] };
    }
  }
  return { ...pkg, components, containers, frames };
}

function defaultPropsFor(
  archetype: ComponentArchetypeId,
  fromEntry: Record<string, unknown>,
): ComponentProps {
  const base = { archetype, ...fromEntry };
  switch (archetype) {
    case "pill-button":
      return { archetype, label: "Button", surface: "dark", ...fromEntry };
    case "icon-button":
      return { archetype, iconLibraryEntryId: "icon-add", ariaLabel: "Action", surface: "dark", size: 28, ...fromEntry };
    case "footer-action-button":
      return { archetype, iconLibraryEntryId: "icon-add", ariaLabel: "Action", ...fromEntry };
    case "inline-editable-text":
      return { archetype, value: "Text", fontSize: { tokenRef: "font.body-size" }, ...fromEntry };
    case "dirty-dot":
      return { archetype, size: 8, visible: true, ...fromEntry };
    case "letter-glyph":
      return { archetype, letter: "F", fontSize: { tokenRef: "font.small-size" }, ...fromEntry };
    case "numeric-label":
      return { archetype, value: "00", fontSize: { tokenRef: "font.label-size" }, ...fromEntry };
    case "colour-swatch":
      return {
        archetype,
        size: 16,
        currentColour: { hex: "#facdcd", alpha: 0.496 },
        ...fromEntry,
      };
    case "slider":
      return { archetype, label: "Value", min: 0, max: 100, value: 50, showValueLabel: true, ...fromEntry };
    case "numeric-input":
      return { archetype, value: 0, ...fromEntry };
    case "select-dropdown":
      return { archetype, options: [], value: "", ...fromEntry };
    case "checkbox":
      return { archetype, checked: false, ...fromEntry };
    case "native-details":
      return { archetype, summaryLabel: "Details", defaultOpen: false, contents: [], ...fromEntry };
    case "aria-expanded-row":
      return { archetype, summaryLabel: "Row", isExpanded: false, contents: [], ...fromEntry };
    case "divider":
      return { archetype, orientation: "horizontal", thickness: 1, ...fromEntry };
    case "icon":
      return { archetype, iconLibraryEntryId: "icon-dot", size: 16, ...fromEntry };
    case "text":
      return { archetype, value: "Text", fontSize: { tokenRef: "font.body-size" }, ...fromEntry };
    case "rectangle":
      return { archetype, ...fromEntry };
    case "ellipse":
      return { archetype, ...fromEntry };
    case "line":
      return {
        archetype,
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        thickness: 2,
        ...fromEntry,
      };
    case "image-placeholder":
      return { archetype, placeholderStyle: "labeled-box", ...fromEntry };
    case "tooltip":
      return { archetype, text: "Tooltip", ...fromEntry };
    case "tab-trigger":
      return { archetype, label: "Tab", tabId: "tab-1", isActive: false, ...fromEntry };
    case "menu-item":
      return { archetype, label: "Menu item", ...fromEntry };
    case "menu-divider":
      return { archetype, ...fromEntry };
    case "carousel-indicators":
      return { archetype, count: 3, activeIndex: 0, shape: "dot", position: "below", ...fromEntry };
    case "toggle-button":
      return { archetype, pressed: false, surface: "dark", size: 28, ...fromEntry };
  }
  return base as ComponentProps;
}
