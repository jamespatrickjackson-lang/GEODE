import type { DevTextOverride } from "../../pages/types";
import { SOURCE_ATTR, TEXT_SOURCE_ATTR } from "./constants";
import { applyTextStyle, writeEditableText, type TextDraft } from "./text";

// Phase 4 (D1 + R1): text/style edits persist only when the target carries a
// stable author-assigned tag. Untagged edits stay session-only. Persisted
// overrides live in EditorChromeSettings.devTextOverrides, keyed by tag, and are
// re-applied to matching elements on load.

export type { DevTextOverride };
export type DevTextOverrides = Record<string, DevTextOverride>;

const TEXT_PREFIX = "text:";
const SOURCE_PREFIX = "src:";

// Stable, refactor-resilient key (R1): prefer data-dev-text-source, then the
// nearest data-dev-source. Returns null for untagged elements (session-only).
export function overrideKeyForElement(
  element: HTMLElement | null | undefined,
): string | null {
  if (!element) return null;
  const textSource = element.getAttribute(TEXT_SOURCE_ATTR);
  if (textSource) return `${TEXT_PREFIX}${textSource}`;
  const source = element
    .closest(`[${SOURCE_ATTR}]`)
    ?.getAttribute(SOURCE_ATTR);
  if (source) return `${SOURCE_PREFIX}${source}`;
  return null;
}

function selectorForKey(key: string): string | null {
  const escape = (value: string) =>
    typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value;
  if (key.startsWith(TEXT_PREFIX)) {
    return `[${TEXT_SOURCE_ATTR}="${escape(key.slice(TEXT_PREFIX.length))}"]`;
  }
  if (key.startsWith(SOURCE_PREFIX)) {
    return `[${SOURCE_ATTR}="${escape(key.slice(SOURCE_PREFIX.length))}"]`;
  }
  return null;
}

const STYLE_KEYS: (keyof DevTextOverride & keyof TextDraft)[] = [
  "fontSize",
  "fontFamily",
  "fontWeight",
  "fontStyle",
  "textTransform",
  "color",
  "opacity",
];

export function applyOverrideToElement(
  element: HTMLElement,
  override: DevTextOverride,
) {
  if (typeof override.text === "string") {
    writeEditableText(element, override.text);
  }
  for (const key of STYLE_KEYS) {
    const value = override[key];
    if (value !== undefined) {
      applyTextStyle(element, key, value as TextDraft[typeof key]);
    }
  }
}

// Re-applies every stored override to the live DOM. Safe to call repeatedly.
export function applyOverridesToDocument(
  overrides: DevTextOverrides | undefined,
): void {
  if (!overrides || typeof document === "undefined") return;
  for (const [key, override] of Object.entries(overrides)) {
    const selector = selectorForKey(key);
    if (!selector) continue;
    document.querySelectorAll(selector).forEach((node) => {
      if (node instanceof HTMLElement) applyOverrideToElement(node, override);
    });
  }
}

// Merges a single field change into the override map for a key.
export function mergeOverride(
  overrides: DevTextOverrides | undefined,
  key: string,
  patch: DevTextOverride,
): DevTextOverrides {
  const current = overrides ?? {};
  return {
    ...current,
    [key]: { ...current[key], ...patch },
  };
}
