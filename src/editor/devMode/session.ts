import type { EditorChromeSettings } from "../../pages/types";

// Phase 3 (D1): a dev-mode edit session applies changes live but lets the
// operator decide to Save (persist) or Discard (revert). All dev-editable state
// lives inside EditorChromeSettings (chrome layout fields + devTextOverrides), so
// a snapshot of that object captures the whole session.

export type DevSessionSnapshot = EditorChromeSettings;

export function captureSnapshot(
  settings: EditorChromeSettings,
): DevSessionSnapshot {
  // Shallow copy is enough for scalar chrome fields; devTextOverrides is replaced
  // wholesale on restore, so its reference is preserved as the baseline.
  return { ...settings };
}

// Builds a patch that, when merged over the current settings, restores every
// key to its snapshot value (including resetting session-added keys to
// undefined). Relies on the patch merge semantics of patchEditorChrome.
export function buildRestorePatch(
  current: EditorChromeSettings,
  snapshot: DevSessionSnapshot,
): EditorChromeSettings {
  const patch: Record<string, unknown> = {};
  const keys = new Set<string>([
    ...Object.keys(current),
    ...Object.keys(snapshot),
  ]);
  for (const key of keys) {
    patch[key] = (snapshot as Record<string, unknown>)[key];
  }
  return patch as EditorChromeSettings;
}
