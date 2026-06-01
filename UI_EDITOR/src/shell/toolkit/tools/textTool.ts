import type { ToolDescriptor } from "../toolTypes";

export const textTool: ToolDescriptor = {
  id: "text",
  label: "Text",
  hint: "T",
  cursorCss: "text",
  keyboardShortcut: "t",
  description: "Click to insert an inline editable text Component.",
  isDrawing: true,
};
