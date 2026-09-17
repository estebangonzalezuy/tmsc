"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleLetter } from "@/components/Motifs";
import EmojiPicker from "@/components/scheduler/EmojiPicker";
import Preview, { type PreviewMedia } from "@/components/scheduler/Preview";
import { attach, fmtBytes, type Attached } from "@/components/scheduler/media";
import { chip } from "@/components/scheduler/chrome";
import { useNow } from "@/components/scheduler/useNow";
import { accentHover } from "@/lib/accent";
import {
  NETWORKS,
  RULES,
  STATUS_LABEL,
  fromLocalInput,
  mediaSrc,
  newPostId,
  problemsFor,
  statusOf,
  textFor,
  toLocalInput,
  type LogData,
  type Network,
  type ScheduledPost,
} from "@/lib/posts-shared";

// The post creator. Words, an emoji picker, images / GIFs / videos, which
// networks, and when. One set of words goes to every network unless a
// network is given its own — X usually needs a shorter one.
//
// Nothing here touches the network until Schedule, Save draft or Post now:
// the files are read in the browser for their size and shape, and travel
// with the JSON in one commit when the post is saved.

export type SaveRequest = {
  post: ScheduledPost;
  add: Map<string, Blob>;
  remove: string[];
  postNow: boolean;
};

type TextKey = "main" | Network;

const HOUR = 60 * 60 * 1000;

function at(hour: number, daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

function nextMonday(hour: number): string {
  const d = new Date();
  const ahead = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + ahead);
  d.setHours(hour, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

export default function Composer({
  existing,
  log,
  assetBase,
  name,
  handle,
  canPostNow,
  busy,
  progress,
  onSave,
  onDelete,
  onClose,
}: {
  existing?: ScheduledPost;
  log: LogData;
  assetBase: string;
  name: string;
  handle: string;
  /** Post now needs a token that can start the runner. */
  canPostNow: boolean;
  busy: boolean;
  progress: string;
  onSave: (req: SaveRequest) => Promise<void>;
  onDelete?: (post: ScheduledPost) => Promise<void>;
  onClose: () => void;
}) {
  const [id] = useState(() => existing?.id ?? newPostId());
  const [text, setText] = useState(existing?.text ?? "");
  const [variants, setVariants] = useState<Partial<Record<Network, string>>>(
    existing?.variants ?? {},
  );
  const [networks, setNetworks] = useState<Network[]>(
    existing?.networks ?? ["linkedin"],
  );
  const [attached, setAttached] = useState<Attached[]>(() =>
    (existing?.media ?? []).map((item) => ({
      item,
      previewUrl: mediaSrc(assetBase, item.file),
    })),
  );
  const [removed, setRemoved] = useState<string[]>([]);
  const [when, setWhen] = useState(
    existing?.scheduledAt ? toLocalInput(existing.scheduledAt) : "",
  );
  const [error, setError] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [previewNet, setPreviewNet] = useState<Network>(networks[0] ?? "linkedin");
  const [dragging, setDragging] = useState(false);
  const now = useNow();

  /* Which box the caret is in, so an emoji lands where you were typing. */
  const focused = useRef<{ key: TextKey; el: HTMLTextAreaElement } | null>(null);
  const caret = useRef<{ key: TextKey; pos: number } | null>(null);
  const counter = useRef(
    (existing?.media ?? []).reduce((max, m) => {
      const n = Number(m.file.match(/\/(\d+)\.[^/]+$/)?.[1] ?? 0);
      return Math.max(max, n);
    }, 0),
  );
  const fileInput = useRef<HTMLInputElement>(null);

  /* Blob URLs are released when the composer goes; the committed ones are
     plain paths and need nothing. */
  useEffect(() => {
    return () => {
      for (const a of attached) if (a.blob) URL.revokeObjectURL(a.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  /* After an emoji is spliced in, put the caret after it. */
  useEffect(() => {
    const c = caret.current;
    const f = focused.current;
    if (!c || !f || f.key !== c.key) return;
    f.el.focus();
    f.el.setSelectionRange(c.pos, c.pos);
    caret.current = null;
  });

  const status = existing ? statusOf(existing, log, now) : "draft";
  const outcomes = existing ? log.entries[existing.id]?.results ?? {} : {};
  const gone = NETWORKS.filter((n) => outcomes[n]?.state === "published");

  const draft: ScheduledPost = {
    id,
    text,
    variants,
    media: attached.map((a) => a.item),
    networks,
    scheduledAt: when ? (fromLocalInput(when) ?? undefined) : undefined,
    metrics: existing?.metrics,
    createdAt: existing?.createdAt ?? "",
    updatedAt: "",
  };

  const problems = networks.map((n) => ({ network: n, list: problemsFor(draft, n) }));
  const blocked = problems.some((p) => p.list.length > 0) || networks.length === 0;
  const scheduledIso = when ? fromLocalInput(when) : null;

  function toggleNetwork(n: Network) {
    setNetworks((list) => {
      const next = list.includes(n) ? list.filter((x) => x !== n) : [...list, n];
      const ordered = NETWORKS.filter((x) => next.includes(x));
      if (!ordered.includes(previewNet) && ordered.length) setPreviewNet(ordered[0]);
      return ordered;
    });
  }

  function setVariant(n: Network, value: string | undefined) {
    setVariants((v) => {
      const next = { ...v };
      if (value === undefined) delete next[n];
      else next[n] = value;
      return next;
    });
  }

  function insertEmoji(glyph: string) {
    const f = focused.current;
    const key: TextKey = f?.key ?? "main";
    const current = key === "main" ? text : (variants[key] ?? "");
    const start = f?.el.selectionStart ?? current.length;
    const end = f?.el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + glyph + current.slice(end);
    if (key === "main") setText(next);
    else setVariant(key, next);
    caret.current = { key, pos: start + glyph.length };
    setEmojiOpen(false);
  }

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setError("");
      const list = Array.from(files);
      const added: Attached[] = [];
      for (const file of list) {
        try {
          counter.current += 1;
          added.push(await attach(file, id, counter.current));
        } catch (err) {
          setError((err as Error).message);
        }
      }
      if (added.length) setAttached((a) => [...a, ...added]);
    },
    [id],
  );

  function removeMedia(index: number) {
    setAttached((list) => {
      const a = list[index];
      if (a.blob) URL.revokeObjectURL(a.previewUrl);
      else {
        setRemoved((r) => [
          ...r,
          `public/${a.item.file}`,
          ...(a.item.jpeg ? [`public/${a.item.jpeg}`] : []),
        ]);
      }
      return list.filter((_, i) => i !== index);
    });
  }

  function moveMedia(index: number, dir: -1 | 1) {
    setAttached((list) => {
      const j = index + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  async function submit(mode: "draft" | "schedule" | "now") {
    setError("");
    if (mode !== "draft" && blocked) return;
    let scheduledAt: string | undefined;
    if (mode === "schedule") {
      if (!scheduledIso) return setError("Pick a date and a time first.");
      scheduledAt = scheduledIso;
    } else if (mode === "now") {
      scheduledAt = new Date().toISOString();
    }
    const now = new Date().toISOString();
    const cleanVariants: Partial<Record<Network, string>> = {};
    for (const n of networks) {
      const v = variants[n];
      if (v !== undefined && v !== text) cleanVariants[n] = v;
    }
    const post: ScheduledPost = {
      ...draft,
      variants: Object.keys(cleanVariants).length ? cleanVariants : undefined,
      scheduledAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const add = new Map<string, Blob>();
    for (const a of attached) {
      if (a.blob) add.set(`public/${a.item.file}`, a.blob);
      if (a.jpegBlob && a.item.jpeg) add.set(`public/${a.item.jpeg}`, a.jpegBlob);
    }
    try {
      await onSave({ post, add, remove: removed, postNow: mode === "now" });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const previewMedia: PreviewMedia[] = attached.map((a) => ({ ...a.item, src: a.previewUrl }));
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <section className="card p-5 md:p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-2xl">
          {existing ? "Edit post" : "New post"}
          {existing && (
            <span className="pill text-xs font-sans align-middle ml-3">{STATUS_LABEL[status]}</span>
          )}
        </h2>
        <button type="button" onClick={onClose} className="text-xs underline underline-offset-4">
          Back
        </button>
      </div>

      {gone.length > 0 && (
        <p className="inset px-4 py-3 text-sm leading-relaxed">
          This one has already gone out on {gone.map((n) => RULES[n].label).join(", ")}.
          Saving again changes the copy here, not what is already published — and it
          asks the runner to try again on any network that failed.
        </p>
      )}

      <div className="grid lg:grid-cols-[1fr_22rem] gap-6">
        <div className="space-y-5 min-w-0">
          {/* Where it goes. */}
          <div className="space-y-2">
            <p className="text-xs text-muted">Where</p>
            <div className="flex flex-wrap gap-2">
              {NETWORKS.map((n) => {
                const on = networks.includes(n);
                const rule = RULES[n];
                const count = rule.count(textFor(draft, n));
                const over = count > rule.maxChars;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNetwork(n)}
                    aria-pressed={on}
                    className={`flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-sm transition-colors ${
                      on ? "bg-foreground text-background" : "inset accent-hover"
                    }`}
                  >
                    <CircleLetter size="size-7">{rule.mark}</CircleLetter>
                    {rule.label}
                    {on && (
                      <span
                        className={`tabular-nums text-xs ${over ? "font-semibold" : "opacity-60"}`}
                      >
                        {count}/{rule.maxChars}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* The words. */}
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={(e) => (focused.current = { key: "main", el: e.currentTarget })}
                rows={8}
                placeholder="What do you want to say?"
                className="w-full inset px-4 py-3 text-base leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-foreground"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEmojiOpen((o) => !o)}
                    className={chip(false, "emoji")}
                  >
                    ☺ Emoji
                  </button>
                  {emojiOpen && (
                    <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-muted">
                  {networks
                    .filter((n) => variants[n] === undefined)
                    .map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setVariant(n, text)}
                        className="underline underline-offset-4 hover:text-foreground transition-colors"
                      >
                        Customise for {RULES[n].label}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {networks
              .filter((n) => variants[n] !== undefined)
              .map((n) => (
                <div key={n} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>For {RULES[n].label}</span>
                    <button
                      type="button"
                      onClick={() => setVariant(n, undefined)}
                      className="underline underline-offset-4 hover:text-foreground transition-colors"
                    >
                      Use the main words
                    </button>
                  </div>
                  <textarea
                    value={variants[n] ?? ""}
                    onChange={(e) => setVariant(n, e.target.value)}
                    onFocus={(e) => (focused.current = { key: n, el: e.currentTarget })}
                    rows={4}
                    className="w-full inset px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-foreground"
                  />
                </div>
              ))}
          </div>

          {/* The files. */}
          <div className="space-y-2">
            <p className="text-xs text-muted">Images, GIFs, videos</p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInput.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}
              className={`inset px-4 py-6 text-center text-sm cursor-pointer transition-colors ${
                dragging ? "bg-foreground/10" : ""
              }`}
            >
              <p>Drop files here, or click to choose</p>
              <p className="text-xs text-muted mt-1">JPG, PNG, WebP, GIF · MP4, MOV, WebM</p>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {attached.length > 0 && (
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {attached.map((a, i) => (
                  <li key={a.item.file} className="inset overflow-hidden text-[11px]">
                    <div className="aspect-square bg-foreground/5">
                      {a.item.kind === "video" ? (
                        <video src={a.previewUrl} muted playsInline className="size-full object-cover" />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element -- a blob URL */
                        <img src={a.previewUrl} alt="" className="size-full object-cover" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                      <span className="text-muted truncate">
                        {a.item.kind} · {fmtBytes(a.item.bytes)}
                        {a.item.seconds ? ` · ${a.item.seconds}s` : ""}
                      </span>
                      <span className="flex gap-0.5 shrink-0">
                        <button type="button" onClick={() => moveMedia(i, -1)} aria-label="Move earlier" className="px-1 hover:bg-foreground hover:text-background rounded">←</button>
                        <button type="button" onClick={() => moveMedia(i, 1)} aria-label="Move later" className="px-1 hover:bg-foreground hover:text-background rounded">→</button>
                        <button type="button" onClick={() => removeMedia(i)} aria-label="Remove" className="px-1 hover:bg-foreground hover:text-background rounded">×</button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* When. */}
          <div className="space-y-2">
            <p className="text-xs text-muted">When · {zone}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="inset px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
              />
              <button type="button" onClick={() => setWhen(toLocalInput(new Date(Date.now() + HOUR).toISOString()))} className={`${chip(false, "hour")} text-xs`}>In an hour</button>
              <button type="button" onClick={() => setWhen(at(9, 1))} className={`${chip(false, "tomorrow")} text-xs`}>Tomorrow 9:00</button>
              <button type="button" onClick={() => setWhen(nextMonday(9))} className={`${chip(false, "monday")} text-xs`}>Monday 9:00</button>
              {when && (
                <button type="button" onClick={() => setWhen("")} className="text-xs underline underline-offset-4 text-muted hover:text-foreground">Clear</button>
              )}
            </div>
            {scheduledIso && now > 0 && new Date(scheduledIso).getTime() < now - 60_000 && (
              <p className="text-xs text-muted">That time has passed — the runner will post it at its next tick.</p>
            )}
          </div>

          {/* What would stop it. */}
          {problems.some((p) => p.list.length) && (
            <ul className="space-y-1 text-sm">
              {problems
                .filter((p) => p.list.length)
                .map((p) => (
                  <li key={p.network}>
                    <span className="font-medium">{RULES[p.network].label}:</span>{" "}
                    {p.list.join(" · ")}
                  </li>
                ))}
            </ul>
          )}
          {networks.length === 0 && <p className="text-sm">Pick at least one network.</p>}

          {error && (
            <p role="alert" className="text-sm bg-foreground text-background px-4 py-3 rounded-[var(--radius-sm)]">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busy || blocked || !scheduledIso}
              onClick={() => submit("schedule")}
              className="rounded-full bg-foreground text-background px-5 py-2 text-sm hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {busy ? progress || "Saving…" : "Schedule"}
            </button>
            <button
              type="button"
              disabled={busy || blocked || !canPostNow}
              onClick={() => submit("now")}
              title={canPostNow ? "Save it and start the runner right away" : "Needs a token that can start the runner"}
              className={`rounded-full inset px-5 py-2 text-sm ${accentHover("now")} disabled:opacity-40`}
            >
              Post now
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => submit("draft")}
              className={`rounded-full inset px-5 py-2 text-sm ${accentHover("draft")} disabled:opacity-40`}
            >
              Save draft
            </button>
            {existing && onDelete && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Delete this post and its files from the repo?")) onDelete(existing);
                }}
                className="ml-auto text-xs underline underline-offset-4 text-muted hover:text-foreground disabled:opacity-40"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* How it will look. */}
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(networks.length ? networks : NETWORKS).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPreviewNet(n)}
                aria-pressed={previewNet === n}
                className={chip(previewNet === n, `preview-${n}`)}
              >
                {RULES[n].label}
              </button>
            ))}
          </div>
          <Preview
            network={previewNet}
            name={name}
            handle={handle}
            text={textFor(draft, previewNet)}
            media={previewMedia}
          />
          <p className="text-xs text-muted leading-relaxed">{RULES[previewNet].note}</p>
        </div>
      </div>
    </section>
  );
}
