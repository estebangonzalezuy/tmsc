// Builds the references shelf (references/, see its README) into plain,
// unstyled HTML under public/references/, so it can be read in a browser at
// /references without being part of the site: no layout, no CSS, no nav, no
// link from anywhere, and noindex on every page. Unlisted, not private: the
// repo is public and so is anything under public/.
//
// Reuses the club's markdown parser (scripts/learn/markdown.mjs) for the
// bodies, so a card is written in the same vocabulary as a Learn piece.
// Directives are refused here: a reference card has no use for them.
//
//   npm run references:build

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { frontmatter, parseBody, SourceError } from "../learn/markdown.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;
const SRC = join(ROOT, "references");
const OUT = join(ROOT, "public/references");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* `[a, b]` → ["a", "b"]; `""` → ""; anything else as written. */
function value(raw) {
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (raw === '""') return "";
  return raw.replace(/^"(.*)"$/, "$1");
}

function spansHtml(spans) {
  return spans
    .map((s) => {
      if (s.t === "text") return esc(s.v);
      if (s.t === "code") return `<code>${esc(s.v)}</code>`;
      if (s.t === "strong") return `<strong>${esc(s.v)}</strong>`;
      if (s.t === "em") return `<em>${esc(s.v)}</em>`;
      if (s.t === "a") return `<a href="${esc(s.href)}">${esc(s.v)}</a>`;
      return "";
    })
    .join("");
}

function bodyHtml(file, blocks) {
  return blocks
    .map((b) => {
      if (b.t === "p") return `<p>${spansHtml(b.text)}</p>`;
      if (b.t === "h") return `<h${b.level}>${spansHtml(b.text)}</h${b.level}>`;
      if (b.t === "ul" || b.t === "ol") {
        return `<${b.t}>\n${b.items.map((it) => `<li>${spansHtml(it)}</li>`).join("\n")}\n</${b.t}>`;
      }
      if (b.t === "quote") return `<blockquote>${spansHtml(b.text)}</blockquote>`;
      if (b.t === "hr") return "<hr>";
      if (b.t === "img") return `<p><img src="${esc(b.src)}" alt="${esc(b.alt)}"></p>`;
      throw new SourceError(file, 1, `":::${b.t}" blocks are not used in references`);
    })
    .join("\n");
}

function read(dir, required) {
  return readdirSync(join(SRC, dir))
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => {
      const file = `references/${dir}/${f}`;
      const lines = readFileSync(join(SRC, dir, f), "utf8").split("\n");
      const { meta, bodyStart } = frontmatter(file, lines, required);
      const m = Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, value(v)]));
      if (`${m.id}.md` !== f) throw new SourceError(file, 2, `id "${m.id}" must match the file name`);
      return { ...m, file, html: bodyHtml(file, parseBody(file, lines, bodyStart)) };
    });
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
</head>
<body>
${body}
</body>
</html>
`;
}

const link = (id, text) => `<a href="/references/${esc(id)}.html">${esc(text)}</a>`;
const list = (v) => (Array.isArray(v) ? v.join(", ") : v || "");

const items = read("items", ["id", "title", "type", "added", "status"]);
const analyses = read("analyses", ["id", "question", "date"]);
const byId = new Map(items.map((i) => [i.id, i]));

for (const a of analyses) {
  for (const ref of a.references ?? []) {
    if (!byId.has(ref)) throw new SourceError(a.file, 4, `references "${ref}", which has no card in items/`);
  }
}

items.sort((a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title));
analyses.sort((a, b) => b.date.localeCompare(a.date));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const it of items) {
  const source =
    it.source && it.source !== "upload" ? `<a href="${esc(it.source)}">${esc(it.source)}</a>` : esc(it.source || "");
  const used = (it.analyses ?? []).map((id) => link(id, id)).join(", ");
  const body = `<p><a href="/references">References</a></p>
<h1>${esc(it.title)}</h1>
<dl>
<dt>Type</dt><dd>${esc(it.type)}</dd>
<dt>By</dt><dd>${esc(it.by || "")}</dd>
<dt>Source</dt><dd>${source}</dd>
<dt>Added</dt><dd>${esc(it.added)}</dd>
<dt>Tags</dt><dd>${esc(list(it.tags))}</dd>
<dt>Status</dt><dd>${esc(it.status)}</dd>
<dt>Analyses</dt><dd>${used}</dd>
${it.graduated ? `<dt>Graduated to</dt><dd>${esc(it.graduated)}</dd>` : ""}
</dl>
<hr>
${it.html}`;
  writeFileSync(join(OUT, `${it.id}.html`), page(it.title, body));
}

for (const a of analyses) {
  const refs = (a.references ?? []).map((id) => `<li>${link(id, byId.get(id).title)}</li>`).join("\n");
  const body = `<p><a href="/references">References</a></p>
<h1>${esc(a.question)}</h1>
<p>Analysis, ${esc(a.date)}</p>
<ul>
${refs}
</ul>
<hr>
${a.html}`;
  writeFileSync(join(OUT, `${a.id}.html`), page(a.question, body));
}

const rows = items
  .map(
    (it) =>
      `<tr><td>${esc(it.added)}</td><td>${link(it.id, it.title)}</td><td>${esc(it.type)}</td><td>${esc(it.by || "")}</td><td>${esc(list(it.tags))}</td><td>${esc(it.status)}</td></tr>`,
  )
  .join("\n");
const aRows = analyses
  .map((a) => `<li>${esc(a.date)}: ${link(a.id, a.question)} (${(a.references ?? []).length} references)</li>`)
  .join("\n");

writeFileSync(
  join(OUT, "index.html"),
  page(
    "References",
    `<h1>References</h1>
<p>tMSC's internal reference shelf. Not part of the site. Built from references/ in the repo.</p>
<h2>Analyses</h2>
<ul>
${aRows}
</ul>
<h2>References</h2>
<table>
<tr><th>Added</th><th>Title</th><th>Type</th><th>By</th><th>Tags</th><th>Status</th></tr>
${rows}
</table>`,
  ),
);

console.log(`references: ${items.length} cards, ${analyses.length} analyses → public/references/`);
