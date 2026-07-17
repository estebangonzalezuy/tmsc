"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import bundledContent from "@/content/site.json";

/* ---------- content types (mirror content/site.json) ---------- */

type Item = Record<string, string>;

type Content = {
  site: Item;
  stats: Item[];
  pillars: Item[];
  threads: Item[];
  practiceFiles: Item[];
  learningPaths: Item[];
  resources: Item[];
  worksheets: string[];
  offerings: Item[];
  archive: { year: string; posts: Item[] }[];
  quotes: string[];
  hidden: string[];
};

type ListKey =
  | "stats"
  | "pillars"
  | "threads"
  | "practiceFiles"
  | "learningPaths"
  | "resources"
  | "offerings";

type StringsKey = "worksheets" | "quotes";

/* ---------- section schema ---------- */

type Field = {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "select";
  options?: string[];
};

type Section =
  | { id: "site"; title: string; note: string; kind: "object"; fields: Field[] }
  | {
      id: ListKey;
      title: string;
      note: string;
      kind: "list";
      itemName: string;
      fields: Field[];
    }
  | {
      id: StringsKey;
      title: string;
      note: string;
      kind: "strings";
      itemName: string;
    }
  | { id: "archive"; title: string; note: string; kind: "archive" };

const sections: Section[] = [
  {
    id: "site",
    title: "Site & links",
    note: "Name, description, and every external link",
    kind: "object",
    fields: [
      { key: "name", label: "Name" },
      { key: "short", label: "Short name" },
      { key: "title", label: "Browser title" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "positioning", label: "Positioning", kind: "textarea" },
      { key: "email", label: "Email" },
      { key: "substack", label: "Substack URL" },
      { key: "subscribe", label: "Subscribe URL" },
      { key: "instagram", label: "Instagram URL" },
      { key: "linkedin", label: "LinkedIn URL" },
    ],
  },
  {
    id: "stats",
    title: "Stats",
    note: "Homepage + newsletter page numbers",
    kind: "list",
    itemName: "stat",
    fields: [
      { key: "value", label: "Value" },
      { key: "label", label: "Label" },
    ],
  },
  {
    id: "pillars",
    title: "Pillars",
    note: "Structure / Criticism / Honesty",
    kind: "list",
    itemName: "pillar",
    fields: [
      { key: "number", label: "Number" },
      { key: "name", label: "Name" },
      { key: "text", label: "Text", kind: "textarea" },
    ],
  },
  {
    id: "threads",
    title: "Recurring threads",
    note: "About page list",
    kind: "list",
    itemName: "thread",
    fields: [
      { key: "name", label: "Name" },
      { key: "text", label: "Text", kind: "textarea" },
    ],
  },
  {
    id: "practiceFiles",
    title: "Practice Files",
    note: "The six exercises, homepage + learn page",
    kind: "list",
    itemName: "exercise",
    fields: [
      { key: "number", label: "Number" },
      { key: "name", label: "Name" },
      { key: "note", label: "Note" },
    ],
  },
  {
    id: "learningPaths",
    title: "Learning paths",
    note: "Learn page cards + homepage preview",
    kind: "list",
    itemName: "path",
    fields: [
      { key: "name", label: "Name" },
      { key: "tag", label: "Tag" },
      { key: "blurb", label: "Blurb", kind: "textarea" },
      { key: "href", label: "Link" },
    ],
  },
  {
    id: "resources",
    title: "Resources",
    note: "Resources page columns + homepage preview",
    kind: "list",
    itemName: "resource",
    fields: [
      { key: "name", label: "Name" },
      { key: "blurb", label: "Blurb", kind: "textarea" },
      { key: "href", label: "Link" },
    ],
  },
  {
    id: "worksheets",
    title: "Worksheets",
    note: "Resources page list",
    kind: "strings",
    itemName: "worksheet",
  },
  {
    id: "offerings",
    title: "Offerings",
    note: "Course, Practice File, Workout, Residency",
    kind: "list",
    itemName: "offering",
    fields: [
      { key: "name", label: "Name" },
      {
        key: "status",
        label: "Status",
        kind: "select",
        options: ["Live", "Paused", "In design"],
      },
      { key: "price", label: "Price (optional)" },
      { key: "blurb", label: "Blurb", kind: "textarea" },
      { key: "href", label: "Link" },
      { key: "cta", label: "Button text" },
    ],
  },
  {
    id: "archive",
    title: "Newsletter archive",
    note: "Every issue, grouped by year",
    kind: "archive",
  },
  {
    id: "quotes",
    title: "Quotes",
    note: "The big serif quote bands",
    kind: "strings",
    itemName: "quote",
  },
];

/* ---------- small helpers ---------- */

function moveItem<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function removeItem<T>(arr: T[], i: number): T[] {
  return arr.filter((_, k) => k !== i);
}

function emptyItem(fields: Field[]): Item {
  return Object.fromEntries(fields.map((f) => [f.key, ""]));
}

const inputClass =
  "w-full border border-line bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground";

/* ---------- field primitives ---------- */

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{field.label}</span>
      {field.kind === "textarea" ? (
        <textarea
          className={`${inputClass} mt-1 min-h-20`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.kind === "select" ? (
        <select
          className={`${inputClass} mt-1`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          className={`${inputClass} mt-1`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function ItemControls({
  onUp,
  onDown,
  onRemove,
}: {
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const btn =
    "border border-line size-7 inline-flex items-center justify-center text-xs hover:bg-foreground hover:text-background transition-colors";
  return (
    <div className="flex gap-1.5">
      <button type="button" className={btn} onClick={onUp} aria-label="Move up">
        ↑
      </button>
      <button
        type="button"
        className={btn}
        onClick={onDown}
        aria-label="Move down"
      >
        ↓
      </button>
      <button
        type="button"
        className={btn}
        onClick={onRemove}
        aria-label="Remove"
      >
        ✕
      </button>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-line px-4 py-2 text-sm hover:bg-foreground hover:text-background transition-colors"
    >
      + Add {label}
    </button>
  );
}

/* ---------- section editors ---------- */

function ObjectEditor({
  fields,
  value,
  onChange,
}: {
  fields: Field[];
  value: Item;
  onChange: (v: Item) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((f) => (
        <div
          key={f.key}
          className={f.kind === "textarea" ? "md:col-span-2" : ""}
        >
          <FieldInput
            field={f}
            value={value[f.key] ?? ""}
            onChange={(v) => onChange({ ...value, [f.key]: v })}
          />
        </div>
      ))}
    </div>
  );
}

function ListEditor({
  fields,
  itemName,
  items,
  onChange,
}: {
  fields: Field[];
  itemName: string;
  items: Item[];
  onChange: (items: Item[]) => void;
}) {
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="border border-line p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <ItemControls
              onUp={() => onChange(moveItem(items, i, -1))}
              onDown={() => onChange(moveItem(items, i, 1))}
              onRemove={() => onChange(removeItem(items, i))}
            />
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {fields.map((f) => (
              <div
                key={f.key}
                className={f.kind === "textarea" ? "md:col-span-2" : ""}
              >
                <FieldInput
                  field={f}
                  value={item[f.key] ?? ""}
                  onChange={(v) =>
                    onChange(
                      items.map((it, k) =>
                        k === i ? { ...it, [f.key]: v } : it,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <AddButton
        label={itemName}
        onClick={() => onChange([...items, emptyItem(fields)])}
      />
    </div>
  );
}

function StringsEditor({
  itemName,
  items,
  onChange,
}: {
  itemName: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((s, i) => (
        <div key={i} className="flex items-center gap-3">
          <input
            type="text"
            className={inputClass}
            value={s}
            onChange={(e) =>
              onChange(items.map((it, k) => (k === i ? e.target.value : it)))
            }
          />
          <ItemControls
            onUp={() => onChange(moveItem(items, i, -1))}
            onDown={() => onChange(moveItem(items, i, 1))}
            onRemove={() => onChange(removeItem(items, i))}
          />
        </div>
      ))}
      <AddButton label={itemName} onClick={() => onChange([...items, ""])} />
    </div>
  );
}

const postFields: Field[] = [
  { key: "date", label: "Date (e.g. Jun 30)" },
  { key: "title", label: "Title" },
  { key: "type", label: "Type" },
];

function ArchiveEditor({
  years,
  onChange,
}: {
  years: { year: string; posts: Item[] }[];
  onChange: (years: { year: string; posts: Item[] }[]) => void;
}) {
  return (
    <div className="space-y-8">
      {years.map((y, i) => (
        <div key={i} className="border border-line p-4">
          <div className="flex items-center justify-between gap-4">
            <label className="flex items-baseline gap-3">
              <span className="text-xs text-muted">Year</span>
              <input
                type="text"
                className="border border-line bg-background px-3 py-1.5 font-serif text-xl w-28 focus:outline-none focus:ring-1 focus:ring-foreground"
                value={y.year}
                onChange={(e) =>
                  onChange(
                    years.map((it, k) =>
                      k === i ? { ...it, year: e.target.value } : it,
                    ),
                  )
                }
              />
            </label>
            <ItemControls
              onUp={() => onChange(moveItem(years, i, -1))}
              onDown={() => onChange(moveItem(years, i, 1))}
              onRemove={() => onChange(removeItem(years, i))}
            />
          </div>
          <div className="mt-4">
            <ListEditor
              fields={postFields}
              itemName="issue"
              items={y.posts}
              onChange={(posts) =>
                onChange(years.map((it, k) => (k === i ? { ...it, posts } : it)))
              }
            />
          </div>
        </div>
      ))}
      <AddButton
        label="year"
        onClick={() => onChange([{ year: "", posts: [] }, ...years])}
      />
    </div>
  );
}

/* ---------- GitHub (from the browser, no server config) ---------- */

const GH_REPO = "estebangonzalezuy/tmsc";
const GH_BRANCH = "main";
const GH_FILE = "content/site.json";
const TOKEN_KEY = "studio-github-token";

function b64encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function b64decode(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghRead(token: string): Promise<{ json: Content; sha: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}?ref=${GH_BRANCH}`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error("GitHub rejected the token — check it and try again.");
  }
  if (res.status === 404) {
    throw new Error(
      "GitHub can't see the repo with this token — make sure it has access to " +
        GH_REPO +
        ".",
    );
  }
  if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
  const data = (await res.json()) as { content: string; sha: string };
  return { json: JSON.parse(b64decode(data.content)) as Content, sha: data.sha };
}

async function ghWrite(token: string, content: Content): Promise<void> {
  const { sha } = await ghRead(token);
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`,
    {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify({
        message: "Update site content from the Studio",
        content: b64encode(JSON.stringify(content, null, 2) + "\n"),
        sha,
        branch: GH_BRANCH,
      }),
    },
  );
  if (!res.ok) throw new Error(`GitHub write failed (${res.status})`);
}

/* ---------- the editor shell ---------- */

type Mode = "github" | "local" | "offline";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; mode: Mode }
  | { kind: "error"; message: string };

const pageTabs = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "newsletter", label: "Newsletter" },
  { id: "resources", label: "Resources" },
  { id: "learn", label: "Learn" },
  { id: "offerings", label: "Offerings" },
];

export default function StudioEditor() {
  const [content, setContent] = useState<Content | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [mode, setMode] = useState<Mode>("offline");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [active, setActive] = useState<Section["id"]>("site");
  const [activePage, setActivePage] = useState("home");
  const [previewReady, setPreviewReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const dirty = content !== null && JSON.stringify(content) !== snapshot;

  const post = useCallback((msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);

  const adopt = useCallback((raw: Content, m: Mode) => {
    const json = { ...raw, hidden: raw.hidden ?? [] };
    setContent(json);
    setSnapshot(JSON.stringify(json));
    setMode(m);
  }, []);

  // Load the freshest content available: GitHub (token) → dev API → bundled.
  const load = useCallback(
    async (token: string): Promise<string> => {
      if (token) {
        try {
          const { json } = await ghRead(token);
          adopt(json, "github");
          return "";
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "GitHub read failed";
          try {
            const res = await fetch("/api/studio/content", {
              cache: "no-store",
            });
            if (res.ok) {
              const data = (await res.json()) as { content: Content };
              adopt(data.content, "local");
              return message;
            }
          } catch {
            /* fall through to bundled */
          }
          adopt(
            JSON.parse(JSON.stringify(bundledContent)) as Content,
            "offline",
          );
          return message;
        }
      }
      try {
        const res = await fetch("/api/studio/content", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { content: Content };
          adopt(data.content, "local");
          return "";
        }
      } catch {
        /* fall through to bundled */
      }
      adopt(JSON.parse(JSON.stringify(bundledContent)) as Content, "offline");
      return "";
    },
    [adopt],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem(TOKEN_KEY) ?? "";
      const problem = await load(token);
      if (!cancelled && problem) {
        setStatus({ kind: "error", message: problem });
        setSettingsOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Messages coming back from the preview iframe.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { studio?: string; section?: string };
      if (d?.studio === "preview-ready") setPreviewReady(true);
      if (d?.studio === "section-click" && d.section) {
        setActive(d.section as Section["id"]);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Keep the preview fed with draft content and the visible page.
  useEffect(() => {
    if (previewReady && content) post({ studio: "content", content });
  }, [previewReady, content, post]);

  useEffect(() => {
    if (previewReady) post({ studio: "page", page: activePage });
  }, [previewReady, activePage, post]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function selectSection(id: Section["id"]) {
    setActive(id);
    post({ studio: "active", section: id, scroll: true });
  }

  async function saveToken() {
    const token = tokenInput.trim();
    setSettingsError("");
    if (!token) {
      setSettingsError("Paste a token first.");
      return;
    }
    try {
      await ghRead(token); // validate before storing
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Could not reach GitHub.",
      );
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
    setTokenInput("");
    setSettingsOpen(false);
    setStatus({ kind: "idle" });
    await load(token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    setMode((m) => (m === "github" ? "offline" : m));
    setSettingsError("");
  }

  async function save() {
    if (!content || status.kind === "saving") return;
    const token = localStorage.getItem(TOKEN_KEY) ?? "";
    if (!token && mode !== "local") {
      setSettingsOpen(true);
      return;
    }
    setStatus({ kind: "saving" });
    try {
      if (token) {
        await ghWrite(token, content);
        setSnapshot(JSON.stringify(content));
        setMode("github");
        setStatus({ kind: "saved", mode: "github" });
        return;
      }
      const res = await fetch("/api/studio/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      setSnapshot(JSON.stringify(content));
      setStatus({ kind: "saved", mode: "local" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Save failed",
      });
    }
  }

  if (!content) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted">
        Opening the Studio…
      </div>
    );
  }

  const section = sections.find((s) => s.id === active) ?? sections[0];
  const connected = mode === "github";

  return (
    <div className="h-dvh flex flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-background px-5 py-3">
        <div className="flex items-center gap-6 min-w-0">
          <p className="text-sm whitespace-nowrap">
            <span className="underline underline-offset-4">the Studio</span>
          </p>
          <nav className="hidden lg:flex items-center gap-1 text-sm">
            {pageTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActivePage(t.id)}
                className={`px-3 py-1 border transition-colors ${
                  activePage === t.id
                    ? "border-line bg-foreground text-background"
                    : "border-transparent hover:border-line"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {status.kind === "saving" && (
            <span className="text-muted">Publishing…</span>
          )}
          {status.kind === "saved" && !dirty && (
            <span className="text-muted">
              {status.mode === "github"
                ? "Published — live in about a minute"
                : "Saved locally"}
            </span>
          )}
          {status.kind === "error" && (
            <span className="max-w-64 truncate" role="alert">
              {status.message}
            </span>
          )}
          {dirty && status.kind !== "saving" && (
            <span className="text-muted">Unsaved changes</span>
          )}
          <button
            type="button"
            onClick={() => {
              setSettingsOpen((o) => !o);
              setSettingsError("");
            }}
            className="border border-line px-3 py-1.5 hover:bg-foreground hover:text-background transition-colors"
          >
            {connected ? "● GitHub" : mode === "local" ? "● Local" : "Connect"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || status.kind === "saving"}
            className="border border-line px-4 py-1.5 disabled:opacity-40 enabled:hover:bg-foreground enabled:hover:text-background transition-colors"
          >
            Publish
          </button>
        </div>
      </header>

      {settingsOpen && (
        <div className="border-b border-line bg-background px-5 py-5">
          <div className="max-w-2xl">
            <p className="text-sm">
              <span className="underline underline-offset-4">
                Connect GitHub to publish
              </span>{" "}
              {connected && <span className="text-muted">— connected ✓</span>}
            </p>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              One-time setup, no Vercel configuration needed: create a
              fine-grained token at{" "}
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                github.com/settings/personal-access-tokens
              </a>{" "}
              with Repository access limited to <strong>{GH_REPO}</strong> and
              the <strong>Contents: Read and write</strong> permission, then
              paste it below. It is stored only in this browser.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                placeholder="github_pat_…"
                className={inputClass}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <button
                type="button"
                onClick={saveToken}
                className="border border-line px-4 py-2 text-sm whitespace-nowrap hover:bg-foreground hover:text-background transition-colors"
              >
                Save token
              </button>
              {connected && (
                <button
                  type="button"
                  onClick={clearToken}
                  className="border border-line px-4 py-2 text-sm whitespace-nowrap hover:bg-foreground hover:text-background transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
            {settingsError && (
              <p className="mt-2 text-sm" role="alert">
                {settingsError}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_26rem]">
        <div className="relative hidden lg:block border-r border-line bg-line/10">
          <iframe
            ref={iframeRef}
            src="/studio/preview"
            title="Site preview"
            className="absolute inset-0 h-full w-full"
          />
        </div>

        <div className="min-h-0 overflow-y-auto p-5">
          <label className="block">
            <span className="text-xs text-muted">Section</span>
            <select
              className={`${inputClass} mt-1`}
              value={section.id}
              onChange={(e) => selectSection(e.target.value as Section["id"])}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                  {content.hidden.includes(s.id) ? " (hidden)" : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-muted">
            {section.note}. Click any outlined section in the preview to jump
            to its fields.
          </p>
          {section.id !== "site" && (
            <button
              type="button"
              onClick={() => {
                const hidden = content.hidden.includes(section.id)
                  ? content.hidden.filter((h) => h !== section.id)
                  : [...content.hidden, section.id];
                setContent({ ...content, hidden });
              }}
              className={`mt-3 w-full border border-line px-3 py-2 text-sm transition-colors ${
                content.hidden.includes(section.id)
                  ? "bg-foreground text-background"
                  : "hover:bg-foreground hover:text-background"
              }`}
            >
              {content.hidden.includes(section.id)
                ? "Hidden on the site — click to show"
                : "Visible on the site — click to hide"}
            </button>
          )}
          <div className="mt-6 pb-16">
            {section.kind === "object" && (
              <ObjectEditor
                fields={section.fields}
                value={content.site}
                onChange={(site) => setContent({ ...content, site })}
              />
            )}
            {section.kind === "list" && (
              <ListEditor
                fields={section.fields}
                itemName={section.itemName}
                items={content[section.id]}
                onChange={(items) =>
                  setContent({ ...content, [section.id]: items })
                }
              />
            )}
            {section.kind === "strings" && (
              <StringsEditor
                itemName={section.itemName}
                items={content[section.id]}
                onChange={(items) =>
                  setContent({ ...content, [section.id]: items })
                }
              />
            )}
            {section.kind === "archive" && (
              <ArchiveEditor
                years={content.archive}
                onChange={(archive) => setContent({ ...content, archive })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
