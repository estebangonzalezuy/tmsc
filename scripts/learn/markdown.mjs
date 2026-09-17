// The club's markdown: the small, explicit subset every written page on the
// site is authored in, and the parser that enforces it.
//
// It started life inside scripts/learn/build.mjs and moved here the day the
// Fundamentals needed the same vocabulary — one parser, one block shape, one
// Prose renderer, so a `:::note` reads the same on a Learn piece and on a
// fundamental. What stays in each build script is the part that is actually
// about that library: which files exist, what its frontmatter must carry, and
// what to write out.
//
// No dependencies on purpose. The deployed app runs on five packages and a
// markdown library would be a sixth for a job this small.

export class SourceError extends Error {
  constructor(file, line, message) {
    super(`${file}:${line}  ${message}`);
    this.name = "SourceError";
  }
}

/* Every directive the writer may use. An unknown one stops the build rather
   than vanishing from the page: silently dropping a block is how a published
   piece quietly loses a paragraph, and this is also the signal to come and
   extend the vocabulary instead of inventing syntax at the page level. */
export const DIRECTIVES = new Set(["note", "do", "video", "audio", "spec", "figure"]);

/* ---------- inline spans ---------- */

// Code first so backticks protect what is inside them, then links, then the
// two weights of emphasis. Anything unmatched stays plain text.
const INLINE =
  /(`[^`]+`)|(\[[^\]\n]+\]\([^)\s]+\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g;

export function spans(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ t: "text", v: text.slice(last, m.index) });
    const [raw] = m;
    if (raw.startsWith("`")) out.push({ t: "code", v: raw.slice(1, -1) });
    else if (raw.startsWith("[")) {
      const cut = raw.indexOf("](");
      out.push({ t: "a", v: raw.slice(1, cut), href: raw.slice(cut + 2, -1) });
    } else if (raw.startsWith("**")) out.push({ t: "strong", v: raw.slice(2, -2) });
    else out.push({ t: "em", v: raw.slice(1, -1) });
    last = m.index + raw.length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out.length ? out : [{ t: "text", v: text }];
}

/* ---------- directive arguments ---------- */

// `youtube hb2bbf` and `caption="three ways"` in one line. Quoted values may
// hold spaces; bare ones may not. A key is lowercase letters only, so a
// `colGap=2` would fall through as a positional — the directives that take
// named arguments count their positionals for exactly that reason.
export function parseArgs(rest) {
  const positional = [];
  const named = {};
  const re = /([a-z]+)=(?:"([^"]*)"|(\S+))|(\S+)/g;
  for (const m of rest.matchAll(re)) {
    if (m[1]) named[m[1]] = m[2] ?? m[3];
    else positional.push(m[4]);
  }
  return { positional, named };
}

/* ---------- frontmatter ---------- */

/* The mechanical half: the fences, the `key: value` lines, and that every
   required key is there. What the values are allowed to be is each library's
   own business, checked by its build script on the raw strings this returns. */
export function frontmatter(file, lines, required) {
  if (lines[0] !== "---") {
    throw new SourceError(file, 1, "a piece must open with a --- frontmatter fence");
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) throw new SourceError(file, 1, "the frontmatter fence is never closed");

  const meta = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cut = line.indexOf(":");
    if (cut === -1) throw new SourceError(file, i + 1, `expected "key: value", got "${line}"`);
    meta[line.slice(0, cut).trim()] = line.slice(cut + 1).trim();
  }

  for (const key of required) {
    if (!meta[key]) throw new SourceError(file, 1, `frontmatter is missing "${key}"`);
  }
  return { meta, bodyStart: end + 1 };
}

/* ---------- body ---------- */

export function parseBody(file, lines, start) {
  const blocks = [];
  let i = start;

  const isBreak = (s) =>
    !s.trim() ||
    s.startsWith(":::") ||
    s.startsWith("#") ||
    s.startsWith("> ") ||
    s.startsWith("- ") ||
    /^\d+\.\s/.test(s) ||
    s.trim() === "---";

  while (i < lines.length) {
    const line = lines[i];
    const n = i + 1; // 1-indexed, for messages

    if (!line.trim()) { i++; continue; }

    /* Where the free preview of a paid piece ends. A marker, not a block: it
       has no body and no closing fence, so it is caught before the fenced
       directives below. Everything after it is dropped on the way out — see
       the Learn build. A library with nothing to sell refuses it. */
    if (line.trim() === ":::more") {
      blocks.push({ t: "more" });
      i++;
      continue;
    }

    /* a fenced directive */
    if (line.startsWith(":::")) {
      const head = line.slice(3).trim();
      const sp = head.indexOf(" ");
      const name = sp === -1 ? head : head.slice(0, sp);
      const { positional, named } = parseArgs(sp === -1 ? "" : head.slice(sp + 1));

      if (!DIRECTIVES.has(name)) {
        throw new SourceError(
          file, n,
          `unknown block ":::${name}". Known blocks: ${[...DIRECTIVES].join(", ")}. ` +
          `Add it to DIRECTIVES in scripts/learn/markdown.mjs and to Prose.tsx if it should exist.`,
        );
      }

      const close = lines.indexOf(":::", i + 1);
      if (close === -1) throw new SourceError(file, n, `":::${name}" is never closed`);
      const inner = lines.slice(i + 1, close).filter((l) => l.trim());
      i = close + 1;

      if (name === "note" || name === "do") {
        if (!inner.length) throw new SourceError(file, n, `":::${name}" is empty`);
        const block = { t: name, text: spans(inner.join(" ")) };
        if (named.minutes) block.minutes = Number(named.minutes);
        blocks.push(block);
      } else if (name === "video") {
        const [provider, id] = positional;
        if (provider !== "youtube" && provider !== "vimeo") {
          throw new SourceError(file, n, `:::video needs "youtube" or "vimeo", got "${provider ?? ""}"`);
        }
        if (!id) throw new SourceError(file, n, ":::video needs a video id");
        const block = { t: "video", provider, id };
        const caption = named.caption ?? inner.join(" ");
        if (caption) block.caption = caption;
        blocks.push(block);
      } else if (name === "audio") {
        const [src] = positional;
        if (!src) throw new SourceError(file, n, ":::audio needs a file path");
        const block = { t: "audio", src };
        if (named.seconds) block.seconds = Number(named.seconds);
        blocks.push(block);
      } else if (name === "spec") {
        const [studio] = positional;
        // "tiles" retired with the Tiles studio itself (AGENTS.md, "What
        // became of the Kinetics and the Tiles") — a Posts Studio graph is
        // the only kind of running example left.
        if (studio !== "postlab") {
          throw new SourceError(file, n, `:::spec needs "postlab", got "${studio ?? ""}"`);
        }
        const spec = inner.join("");
        if (!spec) throw new SourceError(file, n, ":::spec needs an encoded spec in its body");
        const block = { t: "spec", studio, spec };
        if (named.caption) block.caption = named.caption;
        blocks.push(block);
      } else if (name === "figure") {
        /* An interactive figure: a named component from
           components/fundamentals/figures/, with its starting values as
           key=value pairs. The id is the file name. The body, if any, is the
           caption, the way :::video's is. */
        const [id, ...extra] = positional;
        if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
          throw new SourceError(file, n, `:::figure needs an id like "grid-columns", got "${id ?? ""}"`);
        }
        if (extra.length) {
          throw new SourceError(
            file, n,
            `:::figure ${id} has stray words: ${extra.join(" ")}. A setting is key=value, ` +
            `and a key is lowercase letters only.`,
          );
        }
        const { caption, ...params } = named;
        const block = { t: "figure", id, params };
        const cap = caption ?? inner.join(" ");
        if (cap) block.caption = cap;
        blocks.push(block);
      }
      continue;
    }

    /* a heading */
    if (line.startsWith("#")) {
      const hashes = line.match(/^#+/)[0].length;
      if (hashes === 1) {
        throw new SourceError(file, n, `a piece's title comes from frontmatter, so "#" is not used in the body. Start at "##".`);
      }
      if (hashes > 3) throw new SourceError(file, n, "headings go no deeper than ###");
      blocks.push({ t: "h", level: hashes, text: spans(line.slice(hashes).trim()) });
      i++;
      continue;
    }

    /* a rule */
    if (line.trim() === "---") { blocks.push({ t: "hr" }); i++; continue; }

    /* a standalone image */
    const img = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) {
      blocks.push({ t: "img", src: img[2], alt: img[1] });
      i++;
      continue;
    }

    /* a quote */
    if (line.startsWith("> ")) {
      const got = [];
      while (i < lines.length && lines[i].startsWith("> ")) got.push(lines[i++].slice(2));
      blocks.push({ t: "quote", text: spans(got.join(" ")) });
      continue;
    }

    /* a list. An item runs on until a blank line or the next item, so a long
       one can be wrapped in the source the way every other paragraph is —
       without that, a wrapped item ends the list and the next number starts a
       fresh one, which is a numbered list of ones. */
    const bullet = line.startsWith("- ");
    const numbered = /^\d+\.\s/.test(line);
    if (bullet || numbered) {
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const starts = bullet ? l.startsWith("- ") : /^\d+\.\s/.test(l);
        if (!starts) break;
        let text = bullet ? l.slice(2) : l.replace(/^\d+\.\s/, "");
        i++;
        while (i < lines.length && !isBreak(lines[i])) text += " " + lines[i++].trim();
        items.push(spans(text));
      }
      blocks.push({ t: bullet ? "ul" : "ol", items });
      continue;
    }

    /* a paragraph, running until a blank line or the start of anything else */
    const got = [line];
    i++;
    while (i < lines.length && !isBreak(lines[i])) got.push(lines[i++]);
    blocks.push({ t: "p", text: spans(got.join(" ")) });
  }

  return blocks;
}
