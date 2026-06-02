import type { ToolDescriptor } from "../toolTypes";

export const distributeTool: ToolDescriptor = {
  id: "distribute",
  label: "Distribute",
  hint: "⇧A",
  cursorCss: "default",
  keyboardShortcut: "a",
  modifier: "shift",
  description: "Distribute Selection at equal spacing.",
  isDrawing: false,
};
