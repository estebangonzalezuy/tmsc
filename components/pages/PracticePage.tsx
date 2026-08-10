"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import { Boxed, CircleLetter, SectionHeading } from "@/components/Motifs";
import Cta from "@/components/Cta";

// The three questions the picker asks. Times are ceilings: an exercise shows
// up when it fits inside the time you have, longest-that-fits first, so an
// hour gets you an hour's worth of work rather than a warm-up.
const times = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours +" },
];

const tracks = ["Foundations", "Branding", "UI", "Marketing"];

const ANY = "";

type Exercise = ReturnType<typeof useContent>["practiceExercises"][number];

/* The selection lives in the location hash, so a session can be handed to
   someone else — or to yourself next week — as a link. Reading it through
   useSyncExternalStore keeps the server render empty (defaults) and lets the
   client pick up the real hash on hydration, with no effect in between.
   replaceState doesn't fire hashchange, so writes notify the listeners. */
const hashListeners = new Set<() => void>();

function subscribeHash(onChange: () => void) {
  hashListeners.add(onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    hashListeners.delete(onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

function writeHash(params: URLSearchParams) {
  history.replaceState(null, "", "#" + params.toString());
  hashListeners.forEach((l) => l());
}

const readHash = () => window.location.hash.replace(/^#/, "");
const noHash = () => "";

// Widen the search until something comes back: first drop the kind of work,
// then the stage. Whatever we had to let go of is reported to the reader.
function pick(
  exercises: Exercise[],
  minutes: number,
  stage: string,
  track: string,
) {
  const fits = exercises.filter((e) => Number(e.minutes) <= minutes);
  const attempts: { list: Exercise[]; relaxed: "" | "track" | "stage" }[] = [
    {
      list: fits.filter(
        (e) =>
          (!stage || e.stage === stage) && (!track || e.track === track),
      ),
      relaxed: "",
    },
    { list: fits.filter((e) => !stage || e.stage === stage), relaxed: "track" },
    { list: fits, relaxed: "stage" },
  ];
  const hit = attempts.find((a) => a.list.length > 0) ?? attempts[2];
  const list = hit.list
    .slice()
    .sort((a, b) => Number(b.minutes) - Number(a.minutes));
  return { list, relaxed: track && hit.relaxed ? hit.relaxed : "" };
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border border-line px-4 py-1.5 text-sm transition-colors ${
        active
          ? "bg-foreground text-background"
          : "accent-hover"
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`grid gap-4 p-5 md:grid-cols-[9rem_1fr] md:items-center md:p-6 ${
        last ? "" : "border-b border-line/30"
      }`}
    >
      <p className="text-sm text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function PracticePage() {
  const content = useContent();
  const { practiceExercises, practiceStages, practiceRules } = content;
  const hidden = hiddenSet(content);
  const stagesHidden = hidden.has("practiceStages");

  const hash = useSyncExternalStore(subscribeHash, readHash, noHash);
  const params = useMemo(() => new URLSearchParams(hash), [hash]);

  // Anything unrecognised in the hash falls back to the default rather than
  // filtering the shelf down to nothing.
  const rawTime = Number(params.get("t"));
  const minutes = times.some((x) => x.minutes === rawTime) ? rawTime : 30;
  const rawStage = params.get("s") ?? ANY;
  const stage = practiceStages.some((x) => x.number === rawStage)
    ? rawStage
    : ANY;
  const rawTrack = params.get("k") ?? ANY;
  const track = tracks.includes(rawTrack) ? rawTrack : ANY;

  const select = (key: "t" | "s" | "k", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    writeHash(next);
  };

  const { list, relaxed } = useMemo(
    () => pick(practiceExercises, minutes, stage, track),
    [practiceExercises, minutes, stage, track],
  );

  // A new question deserves a fresh answer rather than wherever the last
  // reroll left off, so the counter carries the selection it belongs to.
  const key = `${minutes}|${stage}|${track}`;
  const [reroll, setReroll] = useState({ key, count: 0 });
  const seen = reroll.key === key ? reroll.count : 0;

  const exercise = list.length ? list[seen % list.length] : null;
  const stageOf = (n: string) => practiceStages.find((x) => x.number === n);
  const steps = exercise
    ? exercise.brief.split("\n").filter((line) => line.trim())
    : [];

  return (
    <>
      <section
        {...studioSection("practiceExercises", "Practice exercises")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">Practice</p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          You have the time. <em>We&apos;ll pick the exercise.</em>
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          Tell us how long you&apos;ve got and where you are on the path. You
          get one thing to do: a goal, a constraint, and something to watch if
          you get stuck. Not a library to browse.
        </p>
      </section>

      {!hidden.has("practiceExercises") && (
        <section
          {...studioSection("practiceExercises", "Practice exercises")}
          className="border-t border-line px-5 md:px-6 py-16 md:py-24"
        >
          <div className="border border-line">
            <Row label="I have">
              {times.map((t) => (
                <Chip
                  key={t.minutes}
                  active={minutes === t.minutes}
                  onClick={() => select("t", String(t.minutes))}
                >
                  {t.label}
                </Chip>
              ))}
            </Row>

            {!stagesHidden && (
              <Row label="I'm at">
                <Chip active={!stage} onClick={() => select("s", ANY)}>
                  Anywhere
                </Chip>
                {practiceStages.map((s) => (
                  <Chip
                    key={s.number}
                    active={stage === s.number}
                    onClick={() => select("s", s.number)}
                  >
                    {s.number} · {s.name}
                  </Chip>
                ))}
              </Row>
            )}

            <Row label="I work in" last>
              <Chip active={!track} onClick={() => select("k", ANY)}>
                Anything
              </Chip>
              {tracks.map((t) => (
                <Chip
                  key={t}
                  active={track === t}
                  onClick={() => select("k", t)}
                >
                  {t}
                </Chip>
              ))}
            </Row>
          </div>

          {relaxed && (
            <p className="mt-6 text-sm text-muted">
              Nothing in {track}
              {relaxed === "stage" && stage
                ? ` at stage ${stage}`
                : ""}{" "}
              fits in {times.find((t) => t.minutes === minutes)?.label}. Here is
              one from the rest of the shelf.
            </p>
          )}

          {exercise && (
            <article className="mt-10 border border-line">
              <div className="grid gap-px bg-line sm:grid-cols-3">
                <p className="bg-background px-6 py-4 text-sm">
                  {exercise.tool}
                </p>
                <p className="bg-background px-6 py-4 text-sm">
                  ≈ {exercise.minutes} min
                </p>
                <p className="bg-background px-6 py-4 text-sm text-muted">
                  {stageOf(exercise.stage)?.name ?? exercise.stage} ·{" "}
                  {exercise.track}
                </p>
              </div>

              <div className="border-t border-line p-6 md:p-12">
                <h2 className="font-serif text-3xl md:text-5xl leading-tight max-w-2xl">
                  {exercise.title}
                </h2>
                <p className="mt-6 max-w-xl leading-relaxed">{exercise.goal}</p>

                <div className="mt-12 grid gap-12 md:grid-cols-[1fr_18rem]">
                  <div>
                    <p className="text-sm underline underline-offset-4">
                      The brief
                    </p>
                    <ol className="mt-6 divide-y divide-line/30 border-y border-line/30">
                      {steps.map((s, i) => (
                        <li key={i} className="flex items-start gap-4 py-4">
                          <CircleLetter size="size-7 shrink-0 text-xs">
                            {i + 1}
                          </CircleLetter>
                          <span className="text-sm leading-relaxed">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <aside className="space-y-8">
                    <div>
                      <p className="text-sm underline underline-offset-4">
                        One rule
                      </p>
                      <p className="mt-4 font-serif text-xl italic leading-snug">
                        {exercise.constraint}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm underline underline-offset-4">
                        Finished when
                      </p>
                      <p className="mt-4 text-sm text-muted leading-relaxed">
                        {exercise.done}
                      </p>
                    </div>
                    {exercise.watchHref && (
                      <div>
                        <p className="text-sm underline underline-offset-4">
                          If you get stuck
                        </p>
                        <a
                          href={exercise.watchHref}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 block text-sm leading-relaxed accent-hover-text transition-colors"
                        >
                          {exercise.watch} →
                        </a>
                      </div>
                    )}
                  </aside>
                </div>
              </div>

              <div className="border-t border-line flex items-center justify-between gap-4 px-6 py-4">
                <p className="text-sm text-muted">
                  {(seen % list.length) + 1} of {list.length} that fit
                </p>
                <button
                  type="button"
                  onClick={() => setReroll({ key, count: seen + 1 })}
                  className="rounded-full border border-line px-4 py-1.5 text-sm accent-hover transition-colors"
                >
                  Give me another →
                </button>
              </div>
            </article>
          )}
        </section>
      )}

      {!stagesHidden && (
        <section
          {...studioSection("practiceStages", "Practice stages")}
          className="border-t border-line px-5 md:px-6 py-24 md:py-32"
        >
          <SectionHeading
            label="The path"
            title={
              <>
                Four stages, and you only ever <em>need the next one</em>.
              </>
            }
          />
          <p className="mt-6 max-w-md text-sm text-muted leading-relaxed">
            Nobody starts at the timeline. Pick the stage you&apos;re actually
            in. The picker above will only hand you exercises from there.
          </p>
          <ul className="mt-12 grid gap-px bg-line border border-line md:grid-cols-2">
            {practiceStages.map((s) => (
              <li key={s.number} className="bg-background">
                <button
                  type="button"
                  onClick={() => {
                    select("s", s.number);
                    document
                      .querySelector("[data-studio-section='practiceExercises']")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="group block w-full p-8 text-left accent-hover transition-colors"
                >
                  <CircleLetter className="group-hover:bg-transparent group-hover:border-background">
                    {s.number}
                  </CircleLetter>
                  <p className="mt-6 font-serif text-2xl group-hover:underline underline-offset-4">
                    {s.name}
                  </p>
                  <p className="mt-4 text-sm text-muted accent-hover-sub leading-relaxed">
                    {s.goal}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!hidden.has("practiceRules") && practiceRules.length > 0 && (
        <section
          {...studioSection("practiceRules", "How to practice")}
          className="border-t border-line px-5 md:px-6 py-24 md:py-32"
        >
          <SectionHeading
            label="How to practice"
            title={
              <>
                The rules that survive a <em>bad week</em>.
              </>
            }
          />
          <ul className="mt-12 divide-y divide-line/30 border-y border-line/30">
            {practiceRules.map((r, i) => (
              <li key={i} className="flex items-start gap-6 py-6">
                <span className="text-xs text-muted w-8 shrink-0 pt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="max-w-2xl leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
          <div className="mt-12">
            <Boxed className="text-sm text-muted">
              One session a week is a practice. Zero sessions is a plan.
            </Boxed>
          </div>
        </section>
      )}

      <Cta />
    </>
  );
}
