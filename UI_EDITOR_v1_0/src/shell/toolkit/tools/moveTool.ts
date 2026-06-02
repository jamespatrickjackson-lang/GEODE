import type { ToolDescriptor } from "../toolTypes";

export const moveTool: ToolDescriptor = {
  id: "move",
  label: "Move",
  hint: "M",
  cursorCss: "move",
  keyboardShortcut: "m",
  description: "Translate Selection by drag or arrow nudge.",
  isDrawing: false,
};
