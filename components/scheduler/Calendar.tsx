"use client";

import { chip } from "@/components/scheduler/chrome";
import PostCard from "@/components/scheduler/PostCard";
import {
  sameDay,
  startOfWeek,
  type LogData,
  type ScheduledPost,
} from "@/lib/posts-shared";

// The week. Seven columns on a wide screen, seven stacked days on a phone,
// every scheduled post as a card in its day, in time order.

const DAY = 24 * 60 * 60 * 1000;

export default function Calendar({
  posts,
  log,
  now,
  weekStart,
  onWeek,
  onOpen,
}: {
  posts: ScheduledPost[];
  log: LogData;
  now: number;
  weekStart: Date;
  onWeek: (start: Date) => void;
  onOpen: (id: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY));
  const today = new Date(now);
  const thisWeek = sameDay(startOfWeek(today), weekStart);
  const inWeek = posts.filter((p) => {
    if (!p.scheduledAt) return false;
    const t = new Date(p.scheduledAt).getTime();
    return t >= weekStart.getTime() && t < weekStart.getTime() + 7 * DAY;
  });
  const range = `${days[0].toLocaleDateString([], { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString([], { day: "numeric", month: "short" })}`;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-serif text-xl">
          {thisWeek ? "This week" : range}
          <span className="text-muted"> · {inWeek.length} {inWeek.length === 1 ? "post" : "posts"} scheduled</span>
        </h2>
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => onWeek(new Date(weekStart.getTime() - 7 * DAY))}
            className={chip(false, "prev")}
            aria-label="Previous week"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onWeek(startOfWeek(today))}
            className={chip(false, "today")}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onWeek(new Date(weekStart.getTime() + 7 * DAY))}
            className={chip(false, "next")}
            aria-label="Next week"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-7 gap-3">
        {days.map((day) => {
          const here = inWeek
            .filter((p) => sameDay(new Date(p.scheduledAt!), day))
            .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()} className="space-y-2 min-w-0">
              <p className={`text-xs ${isToday ? "" : "text-muted"}`}>
                <span className={isToday ? "pill" : ""}>
                  {day.toLocaleDateString([], { weekday: "short" })}
                  <span className="tabular-nums"> {day.getDate()}</span>
                </span>
              </p>
              {here.length === 0 ? (
                <div className="inset h-16 md:h-24" aria-hidden />
              ) : (
                here.map((p) => <PostCard key={p.id} post={p} log={log} now={now} onOpen={onOpen} />)
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
