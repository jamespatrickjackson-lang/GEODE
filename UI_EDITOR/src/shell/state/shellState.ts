import type { Package, SelectionIds } from "../../core/schema/package";
import type { ValidationFinding } from "../../core/schema/validation";

export type ToolId =
  | "select"
  | "move"
  | "resize"
  | "container"
  | "text"
  | "divider"
  | "eyedropper"
  | "colour"
  | "align"
  | "distribute"
  | "rectangle"
  | "ellipse"
  | "line";

export interface ShellViewport {
  panX: number;
  panY: number;
  zoom: number;
}

export interface ShellSnapConfig {
  pixelGridSize: 1 | 2 | 4 | 8;
  thresholdPx: number;
  snapToAnchors: boolean;
  snapToGuides: boolean;
  snapToSmartGuides: boolean;
}

export interface ShellProfile {
  deviceId: string;
  inputId: string;
  useCaseId: string;
}

export type SaveStatus = "idle" | "saving" | "error";

export interface PackageListEntry {
  id: string;
}

export type ToastSeverity = "info" | "warning" | "error";

export interface ShellToast {
  id: string;
  severity: ToastSeverity;
  message: string;
  createdAt: number;
}

export interface ShellState {
  pkg: Package | null;
  pkgPath: string | null;
  availablePackages: PackageListEntry[];

  activeFrameId: string | null;
  selection: SelectionIds;
  activeToolId: ToolId;
  viewport: ShellViewport;
  snap: ShellSnapConfig;

  activeBackgroundId: string | null;

  findings: ReadonlyArray<ValidationFinding>;
  lastValidatedAt: number | null;

  profile: ShellProfile;

  dirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;

  toasts: ShellToast[];
}

export const INITIAL_SHELL_STATE: ShellState = {
  pkg: null,
  pkgPath: null,
  availablePackages: [],
  activeFrameId: null,
  selection: [],
  activeToolId: "select",
  viewport: { panX: 0, panY: 0, zoom: 1 },
  snap: {
    pixelGridSize: 1,
    thresholdPx: 4,
    snapToAnchors: true,
    snapToGuides: true,
    snapToSmartGuides: true,
  },
  activeBackgroundId: null,
  findings: [],
  lastValidatedAt: null,
  profile: {
    deviceId: "desktop-1080p",
    inputId: "mouse-keyboard",
    useCaseId: "technical-editing",
  },
  dirty: false,
  saveStatus: "idle",
  saveError: null,
  toasts: [],
};
