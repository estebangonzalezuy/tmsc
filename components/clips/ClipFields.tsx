"use client";

import {
  FACETS,
  STAGES,
  STAGE_LABEL,
  stageName,
  type Clip,
  type ClipProject,
  type FacetKey,
  type SourceRef,
  type Stage,
} from "@/lib/clips-shared";

// The fields the Cutter sets, and the facet chips that are the point of the
// whole tool.
//
// The vocabulary is closed (see FACETS), so filing a clip is pressing chips
// rather than typing words — which is exactly what stops "ui", "UI" and
// "interface" becoming three categories. The free tag box is underneath for
// what the vocabulary hasn't caught yet, and it is deliberately the smaller
// control: an overflow, not the main road.

export const inputClass =
  "w-full border border-line bg-background px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

export function ProjectFields({
  project,
  onPatch,
}: {
  project: Pick<
    ClipProject,
    "title" | "credit" | "year" | "note" | "brand" | "stage"
  >;
  onPatch: (changes: Partial<ClipProject>) => void;
}) {
  return (
    <>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Title">
          <input
            value={project.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Credit — studio, director">
          <input
            value={project.credit}
            onChange={(e) => onPatch({ credit: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Year">
          <input
            value={project.year}
            onChange={(e) => onPatch({ year: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      {/* Who is presenting, as distinct from who made the film. Linear is the
          brand, the studio that cut it is the credit, and a library about
          presentation needs to be able to tell them apart. */}
      <Field label="Brand — whose presentation this is, if not the studio's own">
        <input
          value={project.brand ?? ""}
          onChange={(e) => onPatch({ brand: e.target.value })}
          placeholder="Linear, Rivian, Figma…"
          className={inputClass}
        />
      </Field>

      <div className="grid md:grid-cols-[8rem_1fr] gap-1 md:gap-3 items-baseline">
        <p className="text-xs text-muted">{STAGE_LABEL}</p>
        <div className="flex flex-wrap gap-1">
          {STAGES.map((value) => {
            const on = project.stage === value;
            return (
              <button
                key={value}
                type="button"
                /* One value, not many — a company is at one stage. Pressing the
                   one that is on clears it, because "no stage" is a real answer
                   for a studio reel and there has to be a way back to it. */
                onClick={() => onPatch({ stage: on ? undefined : (value as Stage) })}
                aria-pressed={on}
                className={`border border-line rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                  on ? "bg-foreground text-background" : "accent-hover"
                }`}
              >
                {stageName(value)}
              </button>
            );
          })}
        </div>
      </div>
      <Field label="Note — why this film is worth taking apart">
        <textarea
          value={project.note ?? ""}
          onChange={(e) => onPatch({ note: e.target.value })}
          rows={2}
          className={inputClass}
        />
      </Field>
    </>
  );
}

/** Where the video lives, so every clip can point back at the second it came
 *  from. A project cut from a local file starts with nothing here, and until it
 *  has something the wall shows a clip with no way to check it — the one thing
 *  a reference library must not do. */
export function SourceField({
  source,
  onChange,
}: {
  source: SourceRef;
  onChange: (source: SourceRef) => void;
}) {
  return (
    <Field label="Source link — where this video lives, so every clip can point back">
      <input
        value={source.url}
        onChange={(e) => onChange(withUrl(source, e.target.value))}
        placeholder="https://vimeo.com/… or https://youtu.be/…"
        className={inputClass}
      />
    </Field>
  );
}

/** Re-reads the platform and the id from the URL, because a link pasted by hand
 *  is the only thing that knows them for a locally cut project, and momentUrl
 *  needs the id to deep-link a YouTube timestamp. */
export function withUrl(source: SourceRef, url: string): SourceRef {
  const platform: SourceRef["platform"] = /youtu\.?be|youtube\./i.test(url)
    ? "youtube"
    : /vimeo\./i.test(url)
      ? "vimeo"
      : "other";
  const videoId =
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/)?.[1] ??
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)?.[1] ??
    url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
  return { ...source, url, platform, ...(videoId ? { videoId } : {}) };
}

export function LinkField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Project link — the studio's page for this work">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://oddfellows.tv/…"
        className={inputClass}
      />
    </Field>
  );
}

/** The three rails, as chips. One row an axis, in the vocabulary's own order,
 *  so filing a clip is the same shape as filtering for one. */
export function FacetPicker({
  clip,
  onChange,
}: {
  clip: Clip;
  onChange: (changes: Partial<Clip>) => void;
}) {
  return (
    <div className="space-y-2">
      {FACETS.map((facet) => {
        const held = (clip[facet.key as FacetKey] ?? []) as string[];
        return (
          <div
            key={facet.key}
            className="grid md:grid-cols-[8rem_1fr] gap-1 md:gap-3 items-baseline"
          >
            <p className="text-xs text-muted">{facet.label}</p>
            <div className="flex flex-wrap gap-1">
              {facet.values.map((value) => {
                const on = held.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      onChange({
                        [facet.key]: on
                          ? held.filter((v) => v !== value)
                          : [...held, value],
                      } as Partial<Clip>)
                    }
                    aria-pressed={on}
                    className={`border border-line rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                      on ? "bg-foreground text-background" : "accent-hover"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
