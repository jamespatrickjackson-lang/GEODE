import type { PresentationPage } from "../pages/types";
import { ENVIRONMENT_SENTINEL, type EditorState } from "./types";

export function isSubMasterPage(page: PresentationPage): boolean {
  return (
    page.envSnapshot != null &&
    (page.parentMasterId == null || page.parentMasterId === "global")
  );
}

export function selectedAuthoringPage(
  state: Pick<EditorState, "selectedPageId" | "pages" | "archivedPages">,
): PresentationPage | null {
  const selectedPageId = state.selectedPageId;
  if (!selectedPageId || selectedPageId === ENVIRONMENT_SENTINEL) return null;
  return (
    state.pages.find((page) => page.id === selectedPageId) ??
    state.archivedPages.find((page) => page.id === selectedPageId) ??
    null
  );
}

export function pageSelectionHasLanded({
  selectedPageIndex,
  currentIndex,
  isTransitioning,
  targetIndex,
}: {
  selectedPageIndex: number;
  currentIndex: number;
  isTransitioning: boolean;
  targetIndex: number | null;
}): boolean {
  return (
    selectedPageIndex >= 0 &&
    selectedPageIndex === currentIndex &&
    !isTransitioning &&
    targetIndex === null
  );
}

export function selectedPageWriteBlocked(
  state: Pick<EditorState, "selectedPageId">,
  pageId: string,
  liveTransitionActive: boolean,
): boolean {
  return state.selectedPageId === pageId && liveTransitionActive;
}
