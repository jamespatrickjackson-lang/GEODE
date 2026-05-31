import { selectedAuthoringPage } from "../editor/authoringTarget";
import type { EditorState } from "../editor/types";
import type { PresentationPage } from "../pages/types";

export function selectedLegendAuthoringPage(
  state: EditorState,
): PresentationPage | null {
  return selectedAuthoringPage(state);
}
