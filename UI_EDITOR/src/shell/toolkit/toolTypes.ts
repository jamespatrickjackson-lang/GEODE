import type { ShellState, ToolId } from "../state/shellState";
import type { ShellAction } from "../state/shellActions";

export type { ToolId };

export interface ToolContext {
  state: ShellState;
  dispatch: (action: ShellAction) => void;
}

export interface ToolDescriptor {
  id: ToolId;
  label: string;
  hint: string;
  cursorCss: string;
  keyboardShortcut: string;
  modifier?: "shift" | "ctrl" | "meta";
  description: string;
  isDrawing: boolean;
}
