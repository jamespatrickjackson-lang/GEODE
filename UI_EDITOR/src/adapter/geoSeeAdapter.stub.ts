import type {
  ApplyResult,
  ChangeLogSink,
  ComponentMapping,
  EditableSurface,
  HostAppAdapter,
  PermissionSet,
  ProjectOverride,
} from "./HostAppAdapter";
import type { ValidationRule } from "../core/schema/validation";

const NOT_IMPLEMENTED =
  "HostAppAdapter not implemented in v1 — embedded mode is v2+";

// Type-check anchor: the stub satisfies the HostAppAdapter interface exactly.
// Any breaking change to the interface flags here at compile time. Every
// method throws at runtime so a v2 implementer cannot mistake the stub for a
// wired adapter.
export class GeoSeeAdapterStub implements HostAppAdapter {
  listEditableSurfaces(): EditableSurface[] {
    throw new Error(NOT_IMPLEMENTED);
  }
  componentMappings(): ComponentMapping[] {
    throw new Error(NOT_IMPLEMENTED);
  }
  loadProjectOverrides(): ProjectOverride[] {
    throw new Error(NOT_IMPLEMENTED);
  }
  saveProjectOverride(): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  hostValidationRules(): ValidationRule[] {
    throw new Error(NOT_IMPLEMENTED);
  }
  saveDraft(): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  applyToHost(): Promise<ApplyResult> {
    throw new Error(NOT_IMPLEMENTED);
  }
  permissions(): PermissionSet {
    throw new Error(NOT_IMPLEMENTED);
  }
  changeLogSink(): ChangeLogSink {
    throw new Error(NOT_IMPLEMENTED);
  }
}
