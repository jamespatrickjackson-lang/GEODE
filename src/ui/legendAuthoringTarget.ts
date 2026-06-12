import { selectedAuthoringPage } from "../editor/authoringTarget";
import type { EditorState } from "../editor/types";
import type { PresentationPage } from "../pages/types";

export function selectedLegendAuthoringPage(
  state: EditorState,
): PresentationPage | null {
  return selectedAuthoringPage(state);
}

export interface LegendWriteGateArgs {
  /** Page-transition frame is currently active. */
  transitionActive: boolean;
  /** Transition target index when a navigation is in flight, else null. */
  targetIndex: number | null;
  /** Page the legend would author (sidebar selection), if any. */
  authoringPage: PresentationPage | null;
  /** Page the viewport is actually displaying. */
  displayedPage: PresentationPage | null;
  /** Global Settings / environment authoring scope is selected. */
  editingEnvironment: boolean;
}

/**
 * Shared landed gate for viewport quick legends (review finding 8.1).
 * Legend writes mutate live scene state and persist to the authoring
 * page, so they are allowed only when no page transition is running and
 * the authoring page is the page the viewport shows. Environment-scope
 * authoring has no page mismatch and only requires a settled transition.
 */
export function legendWritesLanded({
  transitionActive,
  targetIndex,
  authoringPage,
  displayedPage,
  editingEnvironment,
}: LegendWriteGateArgs): boolean {
  if (transitionActive || targetIndex !== null) return false;
  if (editingEnvironment) return true;
  if (!authoringPage) return true;
  return displayedPage != null && authoringPage.id === displayedPage.id;
}
