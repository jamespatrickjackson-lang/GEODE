import type { Package } from "../core/schema/package";
import type { ChangeRecord } from "../core/schema/changeLog";
import type { ValidationRule } from "../core/schema/validation";

export type Permission =
  | "view"
  | "draft"
  | "save_project_override"
  | "apply_to_current_project"
  | "promote_to_app_default"
  | "edit_base_design_system"
  | "export_package"
  | "run_validation"
  | "run_ai_review";

export type PermissionSet = ReadonlySet<Permission>;

export interface EditableSurface {
  id: string;
  workbenchPath: string;
  permission: Permission[];
  safeEditFields: ReadonlyArray<string>;
}

export interface ComponentMapping {
  workbenchComponentId: string;
  hostComponentRef: string;
  mappingNotes?: string;
}

export interface ProjectOverride {
  projectId: string;
  packageId: string;
  patch: Record<string, unknown>;
}

export interface ApplyResult {
  ok: boolean;
  changeRecord: ChangeRecord;
  hostError?: string;
}

export interface ChangeLogSink {
  append(record: ChangeRecord): Promise<void>;
}

export interface HostAppAdapter {
  // What the host considers editable.
  listEditableSurfaces(): EditableSurface[];

  // Map generic workbench components to host-side counterparts.
  componentMappings(): ComponentMapping[];

  // Project override lifecycle.
  loadProjectOverrides(): ProjectOverride[];
  saveProjectOverride(override: ProjectOverride): Promise<void>;

  // Additional validation rules the host wants applied on top of the core rule packs.
  hostValidationRules(): ValidationRule[];

  // Persistence.
  saveDraft(pkg: Package): Promise<void>;
  applyToHost(pkg: Package, permission: Permission): Promise<ApplyResult>;

  // Permission gate.
  permissions(): PermissionSet;

  // Change log destination.
  changeLogSink(): ChangeLogSink;
}
