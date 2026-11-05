import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogApi } from "./catalog-api.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export default defineConfig({
  root: here,
  plugins: [react(), catalogApi()],
  resolve: {
    alias: {
      "@core": path.join(root, "core"),
      "@catalog": path.join(root, "catalog"),
    },
  },
  server: { port: 5178, fs: { allow: [root] } },
  build: { outDir: path.join(here, "dist"), emptyOutDir: true },
});
