// Dev-server middleware: the Lab's "Save to catalog" writes real files.
//
//   GET  /api/catalog          → { catalog, specs }
//   GET  /api/projects         → { [name]: project }
//   POST /api/projects {project} → writes projects/<name>.json (for npm run export)
//   POST /api/specs  {spec}    → validates, fits the fallback, writes
//                                catalog/text-animations/specs/<id>.json and
//                                lists it in catalog.json
//
// Dev only (configureServer). A static build has no API and the Lab falls
// back to downloading the JSON instead.

import fs from "node:fs";
import path from "node:path";
import { loadCatalog, saveSpec, ROOT } from "../scripts/lib.mjs";

const PROJECTS = path.join(ROOT, "projects");
import { validateSpec } from "../core/validate.js";
import { applyFallback } from "../core/fit.js";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

export function catalogApi() {
  return {
    name: "anticipator-catalog-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === "/api/catalog" && req.method === "GET") {
          try { return send(res, 200, loadCatalog()); }
          catch (e) { return send(res, 500, { error: e.message }); }
        }
        if (req.url === "/api/projects" && req.method === "GET") {
          const out = {};
          for (const f of fs.readdirSync(PROJECTS).filter((f) => f.endsWith(".json")).sort()) {
            out[f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(PROJECTS, f), "utf8"));
          }
          return send(res, 200, out);
        }
        if (req.url === "/api/projects" && req.method === "POST") {
          try {
            const { project } = JSON.parse(await readBody(req));
            const name = String(project.name || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
            if (!name) return send(res, 422, { error: "project needs a name" });
            project.name = name;
            fs.writeFileSync(path.join(PROJECTS, `${name}.json`), JSON.stringify(project, null, 2) + "\n");
            return send(res, 200, { ok: true, name });
          } catch (e) { return send(res, 500, { error: e.message }); }
        }
        if (req.url === "/api/specs" && req.method === "POST") {
          try {
            const { spec, overwrite } = JSON.parse(await readBody(req));
            const { specs } = loadCatalog();
            if (specs[spec.id] && !overwrite) return send(res, 409, { error: `"${spec.id}" already exists`, exists: true });
            for (const k of ["enter", "exit"]) if (spec[k]?.x_spring) applyFallback(spec[k]);
            if (spec.enter?.x_spring) spec.signature_easing = spec.enter.easing;
            const errors = validateSpec(spec, { fileId: spec.id });
            if (errors.length) return send(res, 422, { error: "invalid spec", errors });
            saveSpec(spec, { group: "lab" });
            return send(res, 200, { ok: true, id: spec.id, spec });
          } catch (e) { return send(res, 500, { error: e.message }); }
        }
        next();
      });
    },
  };
}
