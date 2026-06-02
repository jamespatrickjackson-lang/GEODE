import type { ToolDescriptor } from "../toolTypes";

export const resizeTool: ToolDescriptor = {
  id: "resize",
  label: "Resize",
  hint: "S",
  cursorCss: "nwse-resize",
  keyboardShortcut: "s",
  description: "Drag transform handles to resize a single element.",
  isDrawing: false,
};
