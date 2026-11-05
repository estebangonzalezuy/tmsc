import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogApi } from "./catalog-api.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export default defineConfig({
  root: here,
  plugins: [react(), catalogApi()],
  resolve: {
    alias: {
      "@core": path.join(root, "core"),
      "@catalog": path.join(root, "catalog"),
      "@projects": path.join(root, "projects"),
    },
  },
  server: { port: 5178, host: true, fs: { allow: [root] } },
  preview: { port: 5179, host: true },
  build: { outDir: path.join(here, "dist"), emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
