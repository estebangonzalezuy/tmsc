import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Frames (public/frames/) is a standalone tool beside the site: plain
    // browser scripts with no build step, deliberately outside the site's
    // toolchain. It lives under public/ so Vercel serves it as-is.
    "public/frames/**",
  ]),
]);

export default eslintConfig;
