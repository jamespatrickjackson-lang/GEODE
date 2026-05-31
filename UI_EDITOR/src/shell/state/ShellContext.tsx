import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useMemo,
  useReducer,
} from "react";
import { INITIAL_SHELL_STATE, type ShellState } from "./shellState";
import type { ShellAction } from "./shellActions";
import { shellReducer } from "./shellReducer";

interface ShellContextValue {
  state: ShellState;
  dispatch: Dispatch<ShellAction>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(shellReducer, INITIAL_SHELL_STATE);
  const value = useMemo<ShellContextValue>(() => ({ state, dispatch }), [state]);
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used within a ShellProvider");
  }
  return ctx;
}
