// the Tools — the club's small tools, each one a single thing done well.
//
// A tool is not a template. A template is a file you copy and then have to
// know how to change; a tool asks you the four questions that actually differ
// between two of its posts and makes the rest itself. That is the whole idea
// here, and the reason the studio isn't the front door for everyday work: most
// posts don't need a layer stack, they need a date and a name.
//
// The contract is one function. A tool is `build(params) -> PostSpec`, so every
// tool inherits the whole studio for free — the same renderer, the same
// exporter, the same shareable link — and "open this in the studio" is not an
// integration, it's just handing over the spec it already built. Nothing here
// can produce a post the studio can't reopen.
//
// Params travel in the URL the same way a spec does, so a tool with its fields
// filled in *is* a link: send it to someone and they get the tool, set up, and
// can change one word and re-export.

import {
  GROUNDS,
  PALETTE,
  SPEC_VERSION,
  defaultLayer,
  defaultSlide,
  normalizeSpec,
  type PostFormat,
  type PostSpec,
  type SlideSpec,
} from "./postlab";

/* ----------------------------------------------------------------- fields */

/** One question a tool asks. Deliberately few kinds: a tool with a control
    that needs explaining is a tool that should have decided for you. */
export type Field =
  | { key: string; label: string; kind: "text"; placeholder?: string; rows?: number }
  /** A list — one item per line. This is how a carousel gets written. */
  | { key: string; label: string; kind: "lines"; placeholder?: string }
  | { key: string; label: string; kind: "date" }
  | { key: string; label: string; kind: "number"; min: number; max: number; step: number }
  | { key: string; label: string; kind: "choice"; values: { value: string; label: string }[] }
  /** The paper: the neutral grounds. */
  | { key: string; label: string; kind: "ground" }
  /** A colour from the club palette. */
  | { key: string; label: string; kind: "ink" }
  | { key: string; label: string; kind: "format" }
  | { key: string; label: string; kind: "switch"; hint?: string };

export type Params = Record<string, string | number | boolean>;

export type ToolDef = {
  id: string;
  name: string;
  /** What it makes, in one line, for the wall. */
  about: string;
  fields: Field[];
  defaults: Params;
  /** Params in, a whole post out. `now` is passed rather than read so the
      same params always render the same post in an export, a thumbnail and a
      test — and so a countdown can be a function of today. */
  build: (p: Params, now: Date) => PostSpec;
};

const str = (p: Params, k: string) => String(p[k] ?? "");
const int = (p: Params, k: string, def = 0) => {
  const n = Number(p[k]);
  return Number.isFinite(n) ? Math.round(n) : def;
};
const on = (p: Params, k: string) => p[k] === true || p[k] === "true";
const fmt = (p: Params, k = "format"): PostFormat => {
  const v = str(p, k);
  return v === "square" || v === "story" || v === "landscape" ? v : "portrait";
};

const PAPER = "#f4f3ef";
const ASH = "#e6e5e1";
const ground = (p: Params, def = ASH) => {
  const v = str(p, "ground");
  return GROUNDS.some((g) => g.hex === v) ? v : def;
};

const GROUND_FIELD: Field = { key: "ground", label: "ground", kind: "ground" };
const FORMAT_FIELD: Field = { key: "format", label: "format", kind: "format" };

/* The sheet every tool starts from: ruled paper, no graphic, nothing on it
   that wasn't asked for. Tools add to this; they never rebuild it. */
const sheet = (partial: Partial<SlideSpec>): SlideSpec =>
  defaultSlide({
    kicker: "",
    body: "",
    footer: "@themotionsocialclub",
    letter: "",
    mark: "none",
    veil: 0,
    grid: 7,
    layers: [defaultLayer("none")],
    off: ["kicker", "body", "mark", "rules"],
    ...partial,
  });

const post = (format: PostFormat, duration: number, slides: SlideSpec[]): PostSpec =>
  normalizeSpec({ v: SPEC_VERSION, format, duration, slides });

/* Days from today to a date, counted in whole local days so "tomorrow" is 1
   all day rather than 0 after lunch. */
function daysUntil(iso: string, now: Date): number {
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000));
}

/* Break a thought into headline lines.

   The renderer will size a headline to fill the frame but it will never add a
   break of its own — where the lines fall is the writer's decision, and a
   headline that re-flowed as it grew would wreck the one thing the sheet is
   for. That promise holds for someone typing into the studio with the post in
   front of them. It can't hold for a sentence dictated into a box on the Desk,
   which arrives with no breaks at all and would otherwise be set as one long
   line shrunk to nothing.

   So the tool places them, the way a setter does by eye: pick the number of
   lines from the length, then divide the words as evenly as possible between
   them, rather than filling each line to the brim and leaving a short one at
   the bottom. Typed breaks always win — the moment someone has placed one, the
   decision is theirs again. */
function balance(text: string, per: number): string {
  const clean = text.trim();
  if (!clean || clean.includes("\n")) return clean;
  const words = clean.split(/\s+/);
  const lines = Math.max(1, Math.round(clean.length / per));
  if (lines === 1 || words.length === 1) return clean;

  /* Aim every line at the same length instead of the maximum one, which is
     what stops the last line being an orphan. */
  const target = Math.ceil(clean.length / lines);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const grown = line ? `${line} ${word}` : word;
    /* The last line takes whatever is left, so the count can't creep up. */
    if (line && grown.length > target && out.length < lines - 1) {
      out.push(line);
      line = word;
    } else {
      line = grown;
    }
  }
  if (line) out.push(line);
  return out.join("\n");
}

const dayMonth = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" })}`.toUpperCase();
};

/* --------------------------------------------------------------- the tools */

export const TOOLS: ToolDef[] = [
  {
    id: "note",
    name: "the Note",
    about: "A thought, set as a sheet — the shortest way from a sentence to a post.",
    fields: [
      {
        key: "line",
        label: "the thought",
        kind: "text",
        rows: 5,
        placeholder: "what you'd say if someone asked",
      },
      { key: "label", label: "top left", kind: "text", placeholder: "a note" },
      {
        key: "voice",
        label: "voice",
        kind: "choice",
        values: [
          { value: "serif", label: "editorial" },
          { value: "sans", label: "plain" },
        ],
      },
      GROUND_FIELD,
      FORMAT_FIELD,
    ],
    defaults: {
      line: "The work nobody sees\nis the work *everybody* sees.",
      label: "a note",
      voice: "serif",
      ground: PAPER,
      format: "portrait",
    },
    /* The one tool that takes a thought of any length, which is why the
       headline is set to "fit": two sentences and twenty words have to arrive
       looking deliberate, and only the fit search can promise that. The voice
       carries the alignment with it — an editorial sheet is centred and a
       plain one is ranged left — because that pairing is a decision the club
       has already made, and a tool that asked would be a template. */
    build: (p) => {
      const serif = str(p, "voice") !== "sans";
      const label = str(p, "label").trim();
      /* A centred serif headline carries a shorter line than a ranged-left
         sans one before it stops looking like a headline. */
      const line = balance(str(p, "line"), serif ? 26 : 30);
      return post(fmt(p), 6, [
        sheet({
          kicker: label,
          title: line || "…",
          titleFont: serif ? "serif" : "sans",
          titleSize: "fit",
          titleWeight: serif ? undefined : 500,
          align: serif ? "center" : "left",
          margin: 132,
          footer: "@themotionsocialclub",
          background: ground(p, PAPER),
          grid: 7,
          gridAlpha: 0.1,
          off: label ? ["body", "mark"] : ["kicker", "body", "mark"],
        }),
      ]);
    },
  },
  {
    id: "countdown",
    name: "the Countdown",
    about:
      "Save the date: the day, the number of days left, and the number counting down as it plays.",
    fields: [
      { key: "what", label: "what", kind: "text", placeholder: "the next session" },
      { key: "date", label: "when", kind: "date" },
      { key: "where", label: "where", kind: "text", placeholder: "online, 18:00 CET" },
      {
        key: "counting",
        label: "count it down",
        kind: "switch",
        hint: "The number runs to zero over the loop — for a reel. Off holds today's number, for a still.",
      },
      GROUND_FIELD,
      FORMAT_FIELD,
    ],
    defaults: {
      what: "the next practice session",
      date: "",
      where: "online · 18:00 CET",
      counting: true,
      ground: ASH,
      format: "portrait",
    },
    build: (p, now) => {
      const iso = str(p, "date");
      const left = daysUntil(iso, now);
      const counting = on(p, "counting") && left > 0;
      /* The number is the headline and the words underneath are a label, not
         the other half of a sentence. One size for a whole headline is the
         studio's rule, so "12" and "days to go" set at the same size would
         make the number just another word — and the number is the post. */
      const title = counting ? "#" : left === 0 ? "*today*" : String(left);
      /* The words change with the count, not just the digits: "1 day", "0
         days" and "today" are three different sentences, and a countdown that
         says "0 days to go" on the day is one nobody proofread. A counting
         slide can't change sentence mid-loop, so it keeps the plural and lets
         the number do the talking. */
      const label = counting
        ? "days to go"
        : left === 0
          ? ""
          : left === 1
            ? "day to go"
            : "days to go";
      return post(fmt(p), 6, [
        sheet({
          kicker: str(p, "what"),
          tag: dayMonth(iso) || "save the date",
          title,
          body: label,
          titleFont: "serif",
          titleSize: "fit",
          align: "center",
          margin: 140,
          footer: str(p, "where") || "@themotionsocialclub",
          background: ground(p),
          off: ["mark", "rules"],
          count: counting ? { from: left, to: 0 } : undefined,
        }),
      ]);
    },
  },
  {
    id: "quote",
    name: "the Quote card",
    about: "Someone else's words, set the way a book would set them.",
    fields: [
      { key: "quote", label: "the words", kind: "text", rows: 4, placeholder: "one sentence, broken where you want it" },
      { key: "who", label: "who said it", kind: "text", placeholder: "Patti Smith" },
      {
        key: "marks",
        label: "quotation marks",
        kind: "switch",
        hint: "The club sets quotes with the low opening mark.",
      },
      {
        key: "voice",
        label: "voice",
        kind: "choice",
        values: [
          { value: "roman", label: "roman" },
          { value: "italic", label: "italic" },
        ],
      },
      GROUND_FIELD,
      FORMAT_FIELD,
    ],
    defaults: {
      quote: "The work nobody sees\nis the work *everybody* sees.",
      who: "the club",
      marks: true,
      voice: "roman",
      ground: ASH,
      format: "square",
    },
    build: (p) => {
      const words = str(p, "quote").trim();
      const marks = on(p, "marks") && words;
      const who = str(p, "who").trim();
      return post(fmt(p), 6, [
        sheet({
          title: marks ? `„${words}”` : words,
          titleFont: "serif",
          italic: str(p, "voice") === "italic",
          titleSize: "fit",
          align: "center",
          margin: 144,
          footer: who ? `— ${who}` : "",
          background: ground(p),
          grid: 6,
          gridAlpha: 0.12,
        }),
      ]);
    },
  },
  {
    id: "roundup",
    name: "the Round-up",
    about:
      "A month's worth of finds as one carousel: a cover, then a sheet per line you write.",
    fields: [
      { key: "month", label: "month", kind: "text", placeholder: "August" },
      { key: "issue", label: "oval", kind: "text", placeholder: "08/26" },
      {
        key: "items",
        label: "one per line",
        kind: "lines",
        placeholder: "A title — and a note after a dash",
      },
      GROUND_FIELD,
      FORMAT_FIELD,
    ],
    defaults: {
      month: "August",
      issue: "08/26",
      items:
        "Loewe, 180 years — 2,000 sheets of watercolour paper and ten artists\nThe Bauhaus title cards — still the cleanest lesson in hierarchy\nA countdown made of one weight — proof that timing beats decoration",
      ground: ASH,
      format: "portrait",
    },
    build: (p) => {
      const items = str(p, "items")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 9);
      const bg = ground(p);
      const cover = sheet({
        tag: str(p, "issue"),
        title: `What the club\n*saved for later*\nin ${str(p, "month")}`,
        titleFont: "serif",
        titleSize: "fit",
        align: "center",
        margin: 128,
        background: bg,
      });
      /* "Title — note" is one line to write and two things to set: the dash is
         the only piece of syntax in the whole tool, and it earns its place by
         saving a second field per item. */
      const pages = items.map((item, i) => {
        const [head, ...rest] = item.split(/\s+—\s+/);
        return sheet({
          tag: String(i + 1).padStart(2, "0"),
          title: head,
          body: rest.join(" — "),
          titleFont: "serif",
          titleSize: "m",
          align: "left",
          background: bg,
          off: ["kicker", "mark", "rules"],
        });
      });
      return post(fmt(p), 6, [cover, ...pages]);
    },
  },
  {
    id: "number",
    name: "the Number",
    about: "One statistic, enormous, with the ruling straight across it.",
    fields: [
      { key: "value", label: "the number", kind: "number", min: 0, max: 99999, step: 1 },
      { key: "what", label: "what it is", kind: "text", placeholder: "designers in the club" },
      {
        key: "counting",
        label: "count up to it",
        kind: "switch",
        hint: "Runs from zero to the number over the loop. Past a few hundred it reads as a blur, which is its own effect.",
      },
      GROUND_FIELD,
      FORMAT_FIELD,
    ],
    defaults: {
      value: 26000,
      what: "designers reading along",
      counting: false,
      ground: ASH,
      format: "square",
    },
    build: (p) => {
      const value = int(p, "value");
      const counting = on(p, "counting") && value > 0;
      return post(fmt(p), 6, [
        sheet({
          title: counting ? "#" : String(value),
          body: str(p, "what"),
          titleFont: "sans",
          titleSize: "fit",
          titleWeight: 700,
          align: "center",
          margin: 96,
          background: ground(p),
          grid: 6,
          gridAlpha: 0.22,
          gridTop: true,
          off: ["kicker", "mark", "rules"],
          count: counting ? { from: 0, to: value } : undefined,
        }),
      ]);
    },
  },
  {
    id: "practice",
    name: "the Practice card",
    about: "The club's series slide: a number, one word, and the exercise under it.",
    fields: [
      { key: "no", label: "number", kind: "text", placeholder: "01" },
      { key: "title", label: "the word", kind: "text", placeholder: "Contrast" },
      { key: "brief", label: "the exercise", kind: "text", rows: 3 },
      GROUND_FIELD,
      FORMAT_FIELD,
    ],
    defaults: {
      no: "01",
      title: "Contrast",
      brief: "Black and white only. One bounded exercise, no pressure for perfection.",
      ground: ASH,
      format: "square",
    },
    build: (p) => {
      const no = str(p, "no").trim();
      return post(fmt(p), 6, [
        sheet({
          tag: no ? `the practice file — ${no}` : "the practice file",
          title: str(p, "title"),
          body: str(p, "brief"),
          titleFont: "serif",
          italic: true,
          titleSize: "fit",
          align: "center",
          margin: 160,
          background: ground(p),
          off: ["kicker", "mark", "rules"],
        }),
      ]);
    },
  },
  {
    id: "pixels",
    name: "the Pixel note",
    about: "A line worth keeping, with the club's pixels loose above it.",
    fields: [
      { key: "line", label: "the line", kind: "text", rows: 3 },
      { key: "label", label: "top left", kind: "text", placeholder: "design inspiration" },
      { key: "ink", label: "colour", kind: "ink" },
      { key: "pixel", label: "pixel", kind: "number", min: 4, max: 16, step: 1 },
      GROUND_FIELD,
      FORMAT_FIELD,
    ],
    defaults: {
      line: "A mind too full of information\nhas no space left\nfor inspiration.",
      label: "design inspiration",
      ink: "#3d3deb",
      pixel: 10,
      ground: PAPER,
      format: "portrait",
    },
    build: (p) => {
      const ink = PALETTE.includes(str(p, "ink") as (typeof PALETTE)[number])
        ? str(p, "ink")
        : "#3d3deb";
      return post(fmt(p), 8, [
        sheet({
          kicker: str(p, "label"),
          note: "@themotionsocialclub",
          title: str(p, "line"),
          titleFont: "sans",
          titleSize: "m",
          titleWeight: 500,
          align: "left",
          /* The words take the bottom half and the pixels the top. Where a
             procedural form lands can't be promised, so the type is given a
             half of the sheet rather than asked to survive whatever turns up
             behind it. */
          anchor: "bottom",
          grid: 0,
          background: ground(p, PAPER),
          off: ["body", "mark", "rules", "footer"],
          layers: [
            {
              ...defaultLayer("forms"),
              pattern: "blobs",
              density: 21,
              pixel: int(p, "pixel", 10),
              warp: 0.25,
              speed: 0.3,
              scale: 0.58,
              offsetY: -0.18,
              ink,
              motion: { warp: { to: 0.6, wave: "sin", cycles: 1, phase: 0 } },
            },
          ],
        }),
      ]);
    },
  },
];

export const toolDef = (id: string) => TOOLS.find((t) => t.id === id);

/* ------------------------------------------------------------ params in URL */

/* Same bargain as a spec: the state of a tool is in its link, so a filled-in
   tool can be sent to someone and arrive filled in. Only keys the tool asks
   about survive a round trip, which is what stops an old link from carrying a
   field that has since been renamed into something that no longer means it. */
export function encodeParams(tool: ToolDef, p: Params): string {
  const keep: Params = {};
  for (const f of tool.fields) if (p[f.key] !== undefined) keep[f.key] = p[f.key];
  const bytes = new TextEncoder().encode(JSON.stringify(keep));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeParams(tool: ToolDef, encoded: string): Params | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const raw = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))),
    ) as Params;
    const out: Params = { ...tool.defaults };
    for (const f of tool.fields) {
      const v = raw[f.key];
      if (v === undefined) continue;
      out[f.key] = f.kind === "switch" ? v === true || v === "true" : v;
    }
    return out;
  } catch {
    return null;
  }
}

/** A tool's params with today's date filled in where it asks for one, so a
    countdown opens on something rather than on nothing. */
export function startingParams(tool: ToolDef, now = new Date()): Params {
  const p = { ...tool.defaults };
  for (const f of tool.fields) {
    if (f.kind !== "date" || p[f.key]) continue;
    const soon = new Date(now.getTime() + 12 * 86_400_000);
    p[f.key] = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(
      soon.getDate(),
    ).padStart(2, "0")}`;
  }
  return p;
}
