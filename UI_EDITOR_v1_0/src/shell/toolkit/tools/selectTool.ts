import type { ToolDescriptor } from "../toolTypes";

export const selectTool: ToolDescriptor = {
  id: "select",
  label: "Select",
  hint: "V",
  cursorCss: "default",
  keyboardShortcut: "v",
  description: "Click / shift-click / marquee select.",
  isDrawing: false,
};
