"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

/* ---------- the editor shell ---------- */

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; mode: "github" | "local" }
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
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [checking, setChecking] = useState(true);
  const [content, setContent] = useState<Content | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [active, setActive] = useState<Section["id"]>("site");
  const [activePage, setActivePage] = useState("home");
  const [previewReady, setPreviewReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const dirty = content !== null && JSON.stringify(content) !== snapshot;

  const post = useCallback((msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);

  const load = useCallback(async (pw: string) => {
    const res = await fetch("/api/studio/content", {
      headers: { "x-studio-password": pw },
      cache: "no-store",
    });
    if (res.status === 401) return false;
    if (!res.ok) throw new Error(`Could not load content (${res.status})`);
    const data = (await res.json()) as { content: Content };
    setContent(data.content);
    setSnapshot(JSON.stringify(data.content));
    setAuthed(true);
    sessionStorage.setItem("studio-password", pw);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load(sessionStorage.getItem("studio-password") ?? "");
      } catch {
        if (!cancelled) setLoginError("Could not reach the content API.");
      } finally {
        if (!cancelled) setChecking(false);
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

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const ok = await load(password);
      if (!ok) setLoginError("Wrong password.");
    } catch {
      setLoginError("Could not reach the content API.");
    }
  }

  async function save() {
    if (!content || status.kind === "saving") return;
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/studio/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-studio-password":
            sessionStorage.getItem("studio-password") ?? password,
        },
        body: JSON.stringify(content),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        mode?: "github" | "local";
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      setSnapshot(JSON.stringify(content));
      setStatus({ kind: "saved", mode: data.mode ?? "local" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Save failed",
      });
    }
  }

  /* ----- unauthenticated states ----- */

  if (checking) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted">
        Opening the Studio…
      </div>
    );
  }

  if (!authed || !content) {
    return (
      <div className="flex-1 flex items-center justify-center px-5">
        <form onSubmit={unlock} className="w-full max-w-sm border border-line p-8">
          <p className="text-sm underline underline-offset-4">
            the Motion Social Club
          </p>
          <h1 className="mt-3 font-serif text-3xl">the Studio</h1>
          <p className="mt-2 text-sm text-muted">
            Click any section of the site to edit it. Changes publish to the
            live site.
          </p>
          <input
            type="password"
            autoFocus
            placeholder="Password"
            className={`${inputClass} mt-6`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {loginError && (
            <p className="mt-3 text-sm" role="alert">
              {loginError}
            </p>
          )}
          <button
            type="submit"
            className="mt-4 w-full border border-line px-4 py-2 text-sm hover:bg-foreground hover:text-background transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  /* ----- editor ----- */

  const section = sections.find((s) => s.id === active) ?? sections[0];

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
          {status.kind === "error" && <span role="alert">{status.message}</span>}
          {dirty && status.kind !== "saving" && (
            <span className="text-muted">Unsaved changes</span>
          )}
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
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-muted">
            {section.note}. Click any outlined section in the preview to jump
            to its fields.
          </p>
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
