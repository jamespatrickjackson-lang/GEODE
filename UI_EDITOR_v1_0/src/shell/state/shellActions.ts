import type { Package, SelectionIds } from "../../core/schema/package";
import type { ValidationFinding } from "../../core/schema/validation";
import type {
  PackageListEntry,
  ShellProfile,
  ShellSnapConfig,
  ShellToast,
  ShellViewport,
  ToolId,
} from "./shellState";

export type ShellAction =
  | { type: "PACKAGE_LIST_LOADED"; entries: PackageListEntry[] }
  | { type: "PACKAGE_LOADED"; pkg: Package; pkgPath: string }
  | { type: "PACKAGE_UNLOADED" }
  | { type: "PACKAGE_REPLACED"; pkg: Package }
  | { type: "ACTIVE_FRAME_SET"; frameId: string | null }
  | { type: "SELECTION_SET"; selection: SelectionIds }
  | { type: "TOOL_ACTIVATED"; toolId: ToolId }
  | { type: "VIEWPORT_SET"; patch: Partial<ShellViewport> }
  | { type: "SNAP_CONFIG_SET"; patch: Partial<ShellSnapConfig> }
  | { type: "ACTIVE_BACKGROUND_SET"; backgroundId: string | null }
  | {
      type: "VALIDATION_RAN";
      findings: ReadonlyArray<ValidationFinding>;
      lastValidatedAt: number;
    }
  | { type: "PROFILE_SET"; profile: ShellProfile }
  | { type: "DIRTY_SET"; dirty: boolean }
  | { type: "SAVE_STARTED" }
  | { type: "SAVE_SUCCEEDED" }
  | { type: "SAVE_FAILED"; error: string }
  | { type: "TOAST_PUSHED"; toast: ShellToast }
  | { type: "TOAST_DISMISSED"; id: string };
