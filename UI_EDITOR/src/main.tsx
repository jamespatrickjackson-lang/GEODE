import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ShellRoot } from "./shell/ShellRoot";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <ShellRoot />
  </StrictMode>,
);
