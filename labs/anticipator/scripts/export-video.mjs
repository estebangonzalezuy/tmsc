// npm run export -- <project> [more projects…] [--fps 30] [--keep-frames] [--verify]
//
// Deterministic export. Starts the app's Vite server, opens the #render route
// in headless Chromium, calls renderAt(i / fps) for every frame (the same
// renderProject the preview uses), writes PNGs, and encodes with ffmpeg:
//   out/<project>.mp4   H.264, yuv420p, for posting
//   out/<project>.webm  VP9, for the web
//   out/<project>.png   poster (a frame from the middle)
// Frames go to out/frames/<project>/ (git-ignored) and are deleted unless
// --keep-frames. --verify renders a few frames twice and fails if any differ.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { ROOT, readJson } from "./lib.mjs";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null; };
const names = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--fps"));
if (!names.length) {
  console.error("usage: npm run export -- <project-name> [...] [--fps 30] [--keep-frames] [--verify]");
  console.error("projects: " + fs.readdirSync(path.join(ROOT, "projects")).map((f) => f.replace(/\.json$/, "")).join(", "));
  process.exit(1);
}

let chromium;
try { ({ chromium } = require("playwright")); }
catch { console.error("Playwright isn't available. Install it (npm i -D playwright) or use the in-app Export WebM."); process.exit(1); }

const OUT = path.join(ROOT, "out");
const sha = (b) => crypto.createHash("sha1").update(b).digest("hex").slice(0, 12);

const server = await createServer({ configFile: path.join(ROOT, "app", "vite.config.ts"), server: { port: 0 }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
let failed = false;

try {
  for (const name of names) {
    const project = readJson(path.join(ROOT, "projects", `${name}.json`));
    const fps = Number(opt("--fps")) || project.fps || 30;
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.error("  page error:", e.message));
    await page.goto(`${url}#render`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__render?.ready && document.fonts.status === "loaded");
    const { duration, missing } = await page.evaluate((p) => window.__render.load(p), project);
    if (missing.length) throw new Error(`${name}: unknown spec(s) ${missing.join(", ")}`);
    const frames = Math.ceil((duration / 1000) * fps) + 1;
    const dir = path.join(OUT, "frames", name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    console.log(`${name}: ${project.width}×${project.height}, ${(duration / 1000).toFixed(2)}s, ${frames} frames @ ${fps}fps`);

    const grab = async (ms) => {
      const data = await page.evaluate((t) => { window.__render.renderAt(t); return window.__render.frame(); }, ms);
      return Buffer.from(data.split(",")[1], "base64");
    };
    for (let i = 0; i < frames; i++) {
      const png = await grab(Math.min(duration, (i * 1000) / fps));
      fs.writeFileSync(path.join(dir, `${String(i).padStart(5, "0")}.png`), png);
      if (i % 60 === 0) process.stdout.write(`  frame ${i}/${frames}\r`);
    }
    process.stdout.write("\n");

    if (flag("--verify")) {
      for (const i of [0, Math.floor(frames / 3), Math.floor(frames / 2), frames - 1]) {
        const again = await grab(Math.min(duration, (i * 1000) / fps));
        const first = fs.readFileSync(path.join(dir, `${String(i).padStart(5, "0")}.png`));
        if (sha(again) !== sha(first)) { console.error(`  ✗ frame ${i} differs on re-render`); failed = true; }
      }
      if (!failed) console.log("  ✓ re-rendered frames are byte-identical");
    }
    await page.close();

    const input = ["-framerate", String(fps), "-i", path.join(dir, "%05d.png")];
    const ff = (a) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...a], { stdio: "inherit" });
    ff([...input, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", path.join(OUT, `${name}.mp4`)]);
    ff([...input, "-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-b:v", "0", "-crf", "32", "-row-mt", "1", path.join(OUT, `${name}.webm`)]);
    fs.copyFileSync(path.join(dir, `${String(Math.floor(frames * 0.45)).padStart(5, "0")}.png`), path.join(OUT, `${name}.png`));
    if (!flag("--keep-frames")) fs.rmSync(dir, { recursive: true, force: true });
    for (const ext of ["mp4", "webm", "png"]) {
      const f = path.join(OUT, `${name}.${ext}`);
      console.log(`  → out/${name}.${ext} (${(fs.statSync(f).size / 1024).toFixed(0)} KB)`);
    }
  }
} catch (e) {
  console.error(e.message);
  failed = true;
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
