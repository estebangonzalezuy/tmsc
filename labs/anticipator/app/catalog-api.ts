// Dev-server middleware: the Lab's "Save preset" writes real files.
//
//   GET  /api/catalog            → { catalog, specs }
//   GET  /api/projects           → { [name]: project }
//   POST /api/projects {project} → writes projects/<name>.json (for npm run export)
//   POST /api/specs {spec, overwrite?} → validates, fits the bezier fallback,
//        writes catalog/text-animations/specs/<id>.json and lists it in catalog.json
//
// Dev only (configureServer). A static build has no API; the app then
// downloads JSON instead.

import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
// @ts-expect-error: plain .mjs shared with the node scripts
import { loadCatalog, saveSpec, ROOT } from "../scripts/lib.mjs";
import { validateSpec } from "../core/validate.ts";
import { applyFallback } from "../core/fit.ts";
import type { Spec } from "../core/types.ts";

const PROJECTS = path.join(ROOT as string, "projects");

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

export function catalogApi(): Plugin {
  return {
    name: "anticipator-catalog-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (req.url === "/api/catalog" && req.method === "GET") return send(res, 200, loadCatalog());
          if (req.url === "/api/projects" && req.method === "GET") {
            const out: Record<string, unknown> = {};
            for (const f of fs.readdirSync(PROJECTS).filter((f) => f.endsWith(".json")).sort()) {
              out[f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(PROJECTS, f), "utf8"));
            }
            return send(res, 200, out);
          }
          if (req.url === "/api/projects" && req.method === "POST") {
            const { project } = JSON.parse(await readBody(req));
            const name = String(project.name || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
            if (!name) return send(res, 422, { error: "project needs a name" });
            project.name = name;
            fs.writeFileSync(path.join(PROJECTS, `${name}.json`), JSON.stringify(project, null, 2) + "\n");
            return send(res, 200, { ok: true, name });
          }
          if (req.url === "/api/specs" && req.method === "POST") {
            const { spec, overwrite } = JSON.parse(await readBody(req)) as { spec: Spec; overwrite?: boolean };
            const { specs } = loadCatalog();
            if (specs[spec.id] && !overwrite) return send(res, 409, { error: `"${spec.id}" already exists`, exists: true });
            if (spec.enter?.x_spring) applyFallback(spec.enter);
            if (spec.exit?.x_spring) applyFallback(spec.exit);
            if (spec.enter?.x_spring) spec.signature_easing = spec.enter.easing;
            const errors = validateSpec(spec, { fileId: spec.id });
            if (errors.length) return send(res, 422, { error: "invalid spec", errors });
            saveSpec(spec, { group: "lab" });
            return send(res, 200, { ok: true, id: spec.id, spec });
          }
        } catch (e) {
          return send(res, 500, { error: (e as Error).message });
        }
        next();
      });
    },
  };
}
