import type { Package } from "../schema/package";
import type { EditOperation } from "./editTypes";
import type { ValidationFinding } from "../schema/validation";

export interface RestrictedSurfaceRefusal {
  ruleId: string;
  message: string;
}

export function checkRestrictedSurface(pkg: Package, edit: EditOperation): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const lookup = (kind: "container" | "component", id: string): { locked: boolean; archetype: string; frameId: string } | null => {
    if (kind === "component") {
      const c = pkg.components[id];
      return c ? { locked: c.locked, archetype: c.archetype, frameId: c.frameId } : null;
    }
    const c = pkg.containers[id];
    return c ? { locked: c.locked, archetype: c.archetype, frameId: c.frameId } : null;
  };
  function deny(ruleId: string, message: string, location: ValidationFinding["location"]): void {
    findings.push({
      ruleId,
      severity: "blocker",
      message,
      profileId: "technical-editing",
      location,
    });
  }

  switch (edit.type) {
    case "MOVE":
      for (const t of edit.targets) {
        const el = lookup(t.kind, t.id);
        if (el?.locked) {
          deny(
            "restricted.locked-property-mutated.blocker",
            `Edit refused: element \`${t.id}\` is locked; rect cannot be modified.`,
            { packageId: pkg.manifest.id, frameId: el.frameId, [t.kind === "component" ? "componentId" : "containerId"]: t.id, propertyPath: "rect" },
          );
        }
      }
      break;
    case "RESIZE":
    case "PROPERTY_CHANGED":
    case "EFFECTS_CHANGED":
    case "SHADOW_ADDED":
    case "SHADOW_REMOVED":
    case "PADDING_CHANGED": {
      const el = lookup(edit.targetKind, edit.targetId);
      if (el?.locked) {
        deny(
          "restricted.locked-property-mutated.blocker",
          `Edit refused: element \`${edit.targetId}\` is locked.`,
          { packageId: pkg.manifest.id, frameId: el.frameId, [edit.targetKind === "component" ? "componentId" : "containerId"]: edit.targetId },
        );
      }
      if (edit.type === "PROPERTY_CHANGED" && edit.propertyPath === "archetype") {
        deny(
          "restricted.archetype-mutated.blocker",
          "Edit refused: changing an element's archetype is not supported in v1.",
          { packageId: pkg.manifest.id, frameId: el?.frameId ?? "", propertyPath: "archetype" },
        );
      }
      if (edit.type === "PROPERTY_CHANGED" && edit.propertyPath === "id") {
        deny(
          "restricted.id-rename-attempted.blocker",
          "Edit refused: element id renaming is not supported in v1.",
          { packageId: pkg.manifest.id, propertyPath: "id" },
        );
      }
      break;
    }
    case "COMPONENT_REMOVED": {
      const el = pkg.components[edit.componentId];
      if (el?.locked) {
        deny(
          "restricted.delete-locked-element.blocker",
          `Edit refused: element \`${edit.componentId}\` is locked; deletion is not permitted.`,
          { packageId: pkg.manifest.id, frameId: el.frameId, componentId: edit.componentId },
        );
      }
      break;
    }
    case "CONTAINER_REMOVED": {
      const el = pkg.containers[edit.containerId];
      if (el?.locked) {
        deny(
          "restricted.delete-locked-element.blocker",
          `Edit refused: element \`${edit.containerId}\` is locked; deletion is not permitted.`,
          { packageId: pkg.manifest.id, frameId: el.frameId, containerId: edit.containerId },
        );
      }
      break;
    }
    default:
      break;
  }

  return findings;
}
