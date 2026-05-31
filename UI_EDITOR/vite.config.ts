import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { packageWritePlugin } from "./plugins/vite-plugin-package-write";

export default defineConfig({
  plugins: [react(), packageWritePlugin()],
  server: {
    port: 5174,
    strictPort: true,
    host: "127.0.0.1",
  },
});
