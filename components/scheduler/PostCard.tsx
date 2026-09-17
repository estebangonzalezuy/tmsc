"use client";

import { accentHover } from "@/components/Motifs";
import {
  RULES,
  STATUS_LABEL,
  type LogData,
  type ScheduledPost,
  statusOf,
} from "@/lib/posts-shared";

// One post as a small card — the unit of the calendar, the queue and the
// drafts. Time, the first line, which networks, and where it stands.

export function firstLine(text: string, max = 80): string {
  const line = text.trim().split("\n")[0] ?? "";
  return line.length > max ? line.slice(0, max - 1).trimEnd() + "…" : line || "(no words)";
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

export default function PostCard({
  post,
  log,
  now,
  onOpen,
  withDay = false,
}: {
  post: ScheduledPost;
  log: LogData;
  now: number;
  onOpen: (id: string) => void;
  withDay?: boolean;
}) {
  const status = statusOf(post, log, now);
  const warn = status === "failed" || status === "partial";
  return (
    <button
      type="button"
      onClick={() => onOpen(post.id)}
      className={`card card-sm card-lift ${accentHover(post.id)} w-full text-left p-3 space-y-1.5`}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums whitespace-nowrap accent-hover-sub text-muted">
          {post.scheduledAt
            ? withDay
              ? `${fmtDay(post.scheduledAt)} · ${fmtTime(post.scheduledAt)}`
              : fmtTime(post.scheduledAt)
            : "no date"}
        </span>
        <span className={`pill text-[10px] whitespace-nowrap ${warn ? "font-medium" : ""}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="text-sm leading-snug">{firstLine(post.text)}</p>
      <div className="flex items-center gap-1 text-[11px] accent-hover-sub text-muted">
        {post.networks.map((n) => (
          <span key={n}>{RULES[n].mark}</span>
        ))}
        {post.media.length > 0 && (
          <span className="ml-auto">
            {post.media.length} {post.media.length === 1 ? "file" : "files"}
          </span>
        )}
      </div>
    </button>
  );
}
