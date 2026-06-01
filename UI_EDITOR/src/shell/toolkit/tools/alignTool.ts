import type { ToolDescriptor } from "../toolTypes";

export const alignTool: ToolDescriptor = {
  id: "align",
  label: "Align",
  hint: "A",
  cursorCss: "default",
  keyboardShortcut: "a",
  description: "Align Selection to Selection bounds or Frame bounds.",
  isDrawing: false,
};
