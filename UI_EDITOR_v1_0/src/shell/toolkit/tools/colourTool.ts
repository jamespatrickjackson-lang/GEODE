import type { ToolDescriptor } from "../toolTypes";

export const colourTool: ToolDescriptor = {
  id: "colour",
  label: "Colour",
  hint: "K",
  cursorCss: "pointer",
  keyboardShortcut: "k",
  description: "Open the Colour picker for the active Selection.",
  isDrawing: false,
};
