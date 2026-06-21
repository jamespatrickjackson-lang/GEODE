// Polish (F5): snapshot an element's original text + inline style the FIRST time
// dev mode edits it, so Discard can revert live DOM mutations that have no
// persisted override (untagged text, or a key with no prior override). Keyed by
// element so edits across multiple locks in one session all revert. Cleared on
// Save (accept) and on dev-mode disable.

interface DomEditOriginal {
  text: string | null;
  css: string;
}

const snapshots = new Map<HTMLElement, DomEditOriginal>();

export function recordOriginal(element: HTMLElement): void {
  if (snapshots.has(element)) return;
  snapshots.set(element, {
    text: element.textContent,
    css: element.style.cssText,
  });
}

export function restoreAllDomEdits(): void {
  for (const [element, original] of snapshots) {
    element.textContent = original.text;
    element.style.cssText = original.css;
  }
  snapshots.clear();
}

export function clearDomEditSnapshots(): void {
  snapshots.clear();
}
