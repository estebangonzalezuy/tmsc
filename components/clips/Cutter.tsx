"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import ClipEditor from "@/components/clips/ClipEditor";
import { inputClass } from "@/components/clips/ClipFields";
import { GH_REPO, checkAccess, readJson, tokenStore, type Access } from "@/lib/github";
import { CLIPS_FILE, type ClipProject, type ClipsData } from "@/lib/clips-shared";

// the Cutter — where a film becomes a shelf of motion fragments.
//
//   1. Drop in the film. Your browser decodes it, differences frames to find
//      the cuts, and reads the spans between them as shots.
//   2. Watch them move. Drop what isn't worth citing, mark by hand what the
//      scan walked past.
//   3. File each one — what it is, how it moves, how it lands — and publish.
//
// Zero-config like the Curator, the Studio and the Desk: the token lives in the
// browser, every call goes straight to api.github.com, and nothing on Vercel
// holds a secret. Internal, so it is not in the nav and it is not indexed.

const EMPTY: ClipsData = { version: 1, assetBase: "/clips", projects: [] };

/* `next dev` can write to the checkout instead of to the repo, so a token is
   not the way in there. In production it is the only way in. */
const LOCAL = process.env.NODE_ENV === "development";

export default function Cutter() {
  const token =
    useSyncExternalStore(tokenStore.subscribe, tokenStore.get, tokenStore.server) ?? "";
  const [data, setData] = useState<ClipsData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  const [selectedId, setSelectedId] = useState("");

  const saveToken = useCallback((value: string) => {
    tokenStore.set(value || null);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const result = await readJson<ClipsData>(token, CLIPS_FILE);
      setData(result.data);
      setLoaded(true);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token]);

  const verifyAccess = useCallback(async () => {
    if (!token) return;
    try {
      setAccess(await checkAccess(token));
    } catch {
      // Not being able to ask is not the same as being told no; publishing
      // will report the truth either way.
      setAccess(null);
    }
  }, [token]);

  // Deferred to a timeout rather than run in the effect body: the first read is
  // a network call, and setting state synchronously while the effect runs just
  // cascades a render for nothing.
  useEffect(() => {
    if (!token) return;
    const id = window.setTimeout(() => {
      load();
      verifyAccess();
    }, 0);
    return () => window.clearTimeout(id);
  }, [token, load, verifyAccess]);

  if (!token && !LOCAL) {
    return (
      <Shell>
        <TokenField token={token} onChange={saveToken} />
      </Shell>
    );
  }

  const selected = data.projects.find((p) => p.id === selectedId);
  const drafts = data.projects.filter((p) => p.status === "draft");
  const published = data.projects.filter((p) => p.status === "published");

  return (
    <Shell>
      {error && (
        <p
          role="alert"
          className="border border-line bg-foreground text-background px-4 py-3 text-sm"
        >
          {error}
        </p>
      )}

      {LOCAL && !token && (
        <p className="border border-line px-4 py-3 text-sm text-muted leading-relaxed">
          Running locally with no token. Cut what you like and press{" "}
          <strong>Save to this checkout</strong> — it writes the JSON and the
          sheets into this working copy instead of the repo.
        </p>
      )}

      {access && !access.canWrite && (
        <p
          role="alert"
          className="border border-line bg-foreground text-background px-4 py-3 text-sm leading-relaxed"
        >
          {access.problem}{" "}
          <button onClick={verifyAccess} className="underline underline-offset-4">
            Check again
          </button>
        </p>
      )}

      {/* Keyed, so choosing another project remounts the editor with its own
          state instead of an effect chasing the prop. */}
      <ClipEditor
        key={selected?.id ?? "new"}
        token={token}
        assetBase={data.assetBase}
        existing={selected}
        onPublished={load}
        onClose={selected ? () => setSelectedId("") : undefined}
      />

      <section className="border border-line p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-2xl">Projects</h2>
          <button
            onClick={load}
            className="text-xs underline underline-offset-4 hover:text-muted transition-colors"
          >
            Reload
          </button>
        </div>
        {!loaded ? (
          <p className="text-sm text-muted">Reading…</p>
        ) : data.projects.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet. Drop in a film above.</p>
        ) : (
          <div className="space-y-4">
            <ProjectRow
              label="In the library"
              hint="public"
              projects={published}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <ProjectRow
              label="Drafts"
              hint="saved, not public"
              projects={drafts}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <p className="text-xs text-muted">
              Pick one to change how its clips are filed, to cut more out of the
              film, or to move it between the two rows.
            </p>
          </div>
        )}
      </section>

      <section className="border border-line p-5 space-y-3">
        <h2 className="font-serif text-xl">The token</h2>
        <TokenField token={token} onChange={saveToken} />
      </section>
    </Shell>
  );
}

/* ---------- pieces ---------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line px-5 md:px-6 py-4 flex items-baseline justify-between gap-4">
        <p className="text-sm underline underline-offset-4">the Cutter</p>
        <nav className="flex items-center gap-5 text-xs text-muted">
          <Link href="/clips" className="hover:text-foreground transition-colors">
            Clips
          </Link>
          <Link href="/curate" className="hover:text-foreground transition-colors">
            the Curator
          </Link>
          <Link href="/desk" className="hover:text-foreground transition-colors">
            the Desk
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 md:px-6 py-10 space-y-6">
        {children}
      </main>
    </div>
  );
}

function TokenField({
  token,
  onChange,
}: {
  token: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted">
        GitHub token for {GH_REPO}, kept in this browser only. It needs one
        repository permission: <strong>Contents: Read and write</strong> — the
        same token the Curator uses.
      </label>
      <input
        type="password"
        value={token}
        onChange={(e) => onChange(e.target.value)}
        placeholder="github_pat_…"
        className={inputClass}
      />
    </div>
  );
}

function ProjectRow({
  label,
  hint,
  projects,
  selectedId,
  onSelect,
}: {
  label: string;
  hint: string;
  projects: ClipProject[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (!projects.length) return null;
  return (
    <div className="grid md:grid-cols-[8rem_1fr] gap-2 md:gap-4 items-baseline">
      <p className="text-xs">
        {label}
        <span className="block text-muted">{hint}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {projects.map((project) => {
          const on = project.id === selectedId;
          return (
            <button
              key={project.id}
              onClick={() => onSelect(on ? "" : project.id)}
              aria-pressed={on}
              className={`border border-line rounded-full px-3 py-1 text-xs transition-colors ${
                on ? "bg-foreground text-background" : "accent-hover"
              }`}
            >
              {project.title}{" "}
              <span className={on ? "text-background/60" : "text-muted accent-hover-sub"}>
                {project.clips.length}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
