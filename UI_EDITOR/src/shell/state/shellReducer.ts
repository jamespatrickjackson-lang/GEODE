import type { ShellAction } from "./shellActions";
import { INITIAL_SHELL_STATE, type ShellState } from "./shellState";

export function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case "PACKAGE_LIST_LOADED":
      return { ...state, availablePackages: action.entries };
    case "PACKAGE_LOADED": {
      const activeFrameId =
        action.pkg.activeFrameId ?? action.pkg.frames[0]?.id ?? null;
      return {
        ...state,
        pkg: action.pkg,
        pkgPath: action.pkgPath,
        activeFrameId,
        selection: [],
        viewport: INITIAL_SHELL_STATE.viewport,
        findings: action.pkg.findings,
        lastValidatedAt: null,
        dirty: false,
        saveStatus: "idle",
        saveError: null,
        activeBackgroundId: null,
      };
    }
    case "PACKAGE_UNLOADED":
      return { ...state, pkg: null, pkgPath: null, activeFrameId: null, selection: [], dirty: false };
    case "PACKAGE_REPLACED": {
      const activeFrameId =
        state.activeFrameId && action.pkg.frames.some((f) => f.id === state.activeFrameId)
          ? state.activeFrameId
          : action.pkg.activeFrameId ?? action.pkg.frames[0]?.id ?? null;
      return { ...state, pkg: action.pkg, activeFrameId, dirty: true };
    }
    case "ACTIVE_FRAME_SET":
      return { ...state, activeFrameId: action.frameId, selection: [] };
    case "SELECTION_SET":
      return { ...state, selection: action.selection };
    case "TOOL_ACTIVATED":
      return { ...state, activeToolId: action.toolId };
    case "VIEWPORT_SET":
      return { ...state, viewport: { ...state.viewport, ...action.patch } };
    case "SNAP_CONFIG_SET":
      return { ...state, snap: { ...state.snap, ...action.patch } };
    case "ACTIVE_BACKGROUND_SET":
      return { ...state, activeBackgroundId: action.backgroundId };
    case "VALIDATION_RAN":
      return {
        ...state,
        findings: action.findings,
        lastValidatedAt: action.lastValidatedAt,
      };
    case "PROFILE_SET":
      return { ...state, profile: action.profile };
    case "DIRTY_SET":
      return { ...state, dirty: action.dirty };
    case "SAVE_STARTED":
      return { ...state, saveStatus: "saving", saveError: null };
    case "SAVE_SUCCEEDED":
      return { ...state, saveStatus: "idle", saveError: null, dirty: false };
    case "SAVE_FAILED":
      return { ...state, saveStatus: "error", saveError: action.error };
    case "TOAST_PUSHED":
      return { ...state, toasts: [...state.toasts, action.toast] };
    case "TOAST_DISMISSED":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}
