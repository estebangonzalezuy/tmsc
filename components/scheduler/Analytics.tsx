"use client";

import { useState } from "react";
import { CircleLetter } from "@/components/Motifs";
import { fmtDay, firstLine } from "@/components/scheduler/PostCard";
import {
  METRIC_KEYS,
  NETWORKS,
  RULES,
  metricsFor,
  type LogData,
  type MetricKey,
  type Metrics,
  type Network,
  type ScheduledPost,
} from "@/lib/posts-shared";

// How the posts landed, network by network. What the runner could pull comes
// from the log; what an API will not give up (LinkedIn impressions, anything
// on Substack) can be typed in from the network's own analytics page and is
// kept on the post. The two are laid over each other here, and the tiles say
// how old their numbers are rather than pretending they are live.

const LABEL: Record<MetricKey, string> = {
  impressions: "Impressions",
  reach: "Reach",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  clicks: "Clicks",
};

/* Which numbers each network can actually report, in the order they matter. */
const SHOWN: Record<Network, MetricKey[]> = {
  linkedin: ["impressions", "likes", "comments", "shares"],
  x: ["impressions", "likes", "comments", "shares"],
  instagram: ["reach", "likes", "comments", "saves", "shares"],
  substack: ["likes", "comments", "shares"],
};

const fmtN = (n: number | undefined) =>
  typeof n === "number" ? n.toLocaleString() : "—";

const ago = (iso: string) => {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

export default function Analytics({
  posts,
  log,
  busy,
  onSaveMetrics,
}: {
  posts: ScheduledPost[];
  log: LogData;
  busy: boolean;
  onSaveMetrics: (postId: string, network: Network, metrics: Metrics) => Promise<void>;
}) {
  const published = posts
    .filter((p) => {
      const r = log.entries[p.id]?.results ?? {};
      return p.networks.some((n) => r[n]?.state === "published");
    })
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));

  const totals = NETWORKS.map((n) => {
    const here = published.filter((p) => log.entries[p.id]?.results?.[n]?.state === "published");
    const sum: Partial<Record<MetricKey, number>> = {};
    let at = "";
    let counted = 0;
    for (const p of here) {
      const m = metricsFor(p, log, n);
      if (!m) continue;
      counted++;
      for (const key of METRIC_KEYS) {
        if (typeof m[key] === "number") sum[key] = (sum[key] ?? 0) + m[key];
      }
      if (m.at > at) at = m.at;
    }
    return { network: n, posts: here.length, counted, sum, at };
  });

  return (
    <section className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {totals.map((t) => (
          <div key={t.network} className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CircleLetter size="size-7">{RULES[t.network].mark}</CircleLetter>
              <p className="text-sm">{RULES[t.network].label}</p>
              <p className="ml-auto text-xs text-muted tabular-nums">
                {t.posts} {t.posts === 1 ? "post" : "posts"}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {SHOWN[t.network].map((key) => (
                <div key={key} className="contents">
                  <dt className="text-muted text-xs self-end">{LABEL[key]}</dt>
                  <dd className="tabular-nums text-right">{fmtN(t.sum[key])}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-muted">
              {t.counted === 0
                ? "No numbers yet"
                : `${t.counted} of ${t.posts} with numbers · ${ago(t.at)}`}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted leading-relaxed max-w-2xl">
        The runner pulls what each API will give: reactions and comments from LinkedIn,
        likes, reach and saves from Instagram, everything from X on a paid tier, nothing
        from Substack. Anything else — LinkedIn impressions especially — is typed in
        here from the network&apos;s own page, and a typed number sits over a pulled one.
      </p>

      {published.length === 0 ? (
        <p className="text-sm text-muted">Nothing has been posted yet.</p>
      ) : (
        <ul className="space-y-3">
          {published.map((p) => (
            <li key={p.id} className="card p-4 md:p-5 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm">{firstLine(p.text, 100)}</p>
                <p className="text-xs text-muted tabular-nums">
                  {p.scheduledAt ? fmtDay(p.scheduledAt) : ""}
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {p.networks.map((n) => (
                  <NetworkRow
                    key={n}
                    post={p}
                    network={n}
                    log={log}
                    busy={busy}
                    onSave={onSaveMetrics}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NetworkRow({
  post,
  network,
  log,
  busy,
  onSave,
}: {
  post: ScheduledPost;
  network: Network;
  log: LogData;
  busy: boolean;
  onSave: (postId: string, network: Network, metrics: Metrics) => Promise<void>;
}) {
  const outcome = log.entries[post.id]?.results?.[network];
  const metrics = metricsFor(post, log, network);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Record<MetricKey, string>>>({});

  function open() {
    const next: Partial<Record<MetricKey, string>> = {};
    for (const key of SHOWN[network]) {
      const v = post.metrics?.[network]?.[key] ?? metrics?.[key];
      next[key] = typeof v === "number" ? String(v) : "";
    }
    setForm(next);
    setEditing(true);
  }

  async function save() {
    const out: Metrics = { at: new Date().toISOString() };
    for (const key of SHOWN[network]) {
      const raw = (form[key] ?? "").replace(/[,\s]/g, "");
      if (raw === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n)) out[key] = n;
    }
    await onSave(post.id, network, out);
    setEditing(false);
  }

  return (
    <div className="inset px-3 py-2.5 text-sm space-y-2">
      <div className="flex items-center gap-2">
        <CircleLetter size="size-6">{RULES[network].mark}</CircleLetter>
        {outcome?.state === "published" ? (
          outcome.url ? (
            <a href={outcome.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 text-xs">
              Open the post
            </a>
          ) : (
            <span className="text-xs text-muted">posted</span>
          )
        ) : (
          <span className="text-xs text-muted" title={outcome?.error}>
            {outcome ? outcome.state : "not yet"}
          </span>
        )}
        {outcome?.state === "published" && !editing && (
          <button type="button" onClick={open} className="ml-auto text-xs underline underline-offset-4 text-muted hover:text-foreground">
            {metrics ? "Edit numbers" : "Add numbers"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {SHOWN[network].map((key) => (
              <label key={key} className="text-xs text-muted space-y-0.5">
                {LABEL[key]}
                <input
                  inputMode="numeric"
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="block w-full bg-surface rounded-md px-2 py-1 text-sm text-foreground tabular-nums focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2 text-xs">
            <button type="button" disabled={busy} onClick={save} className="rounded-full bg-foreground text-background px-3 py-1 hover:opacity-80 disabled:opacity-40">
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="underline underline-offset-4 text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      ) : metrics ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          {SHOWN[network].map((key) => (
            <div key={key} className="contents">
              <dt className="text-muted">{LABEL[key]}</dt>
              <dd className="tabular-nums text-right">{fmtN(metrics[key])}</dd>
            </div>
          ))}
          <dt className="text-muted col-span-2 pt-1">
            {post.metrics?.[network] ? "typed in · " : ""}
            {ago(metrics.at)}
          </dt>
        </dl>
      ) : null}
    </div>
  );
}
