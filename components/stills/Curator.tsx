"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  GH_REPO,
  checkAccess,
  readProjects,
  tokenStore,
  type Access,
} from "@/components/stills/github";
import ProjectEditor from "@/components/stills/ProjectEditor";
import { inputClass } from "@/components/stills/FrameGrid";
import type { Project, StillsData } from "@/lib/stills-shared";

// the Curator — where a video becomes a curated project.
//
//   1. Drop in the film. Your browser decodes it, differences frames to find
//      the cuts, and cuts the stills. Nothing is uploaded and nothing runs on
//      a server.
//   2. Drop what isn't a style frame. Scrub for what the scan walked past.
//   3. Name it, credit it, link it back, tag it, publish.
//
// There was a second way in once — paste a URL and let a GitHub Actions runner
// fetch it with yt-dlp. It is gone. YouTube refuses datacentre addresses often
// enough that the road was mostly a way to wait four minutes for a failure,
// and every film has to be downloaded to be watched anyway. One way in is also
// one thing to keep working.
//
// Zero-config like the Studio and the Desk: the token lives in the browser,
// every call goes straight to api.github.com, and nothing on Vercel holds a
// secret. Internal, so it is not in the nav and it is not indexed.

const EMPTY: StillsData = { version: 1, assetBase: "/stills", projects: [] };

export default function Curator() {
  const token =
    useSyncExternalStore(
      tokenStore.subscribe,
      tokenStore.get,
      tokenStore.server,
    ) ?? "";
  const [data, setData] = useState<StillsData>(EMPTY);
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
      const result = await readProjects<StillsData>(token);
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

  // Deferred to a timeout rather than run in the effect body: the first read
  // is a network call, and setting state synchronously while the effect runs
  // just cascades a render for nothing.
  useEffect(() => {
    if (!token) return;
    const id = window.setTimeout(() => {
      load();
      verifyAccess();
    }, 0);
    return () => window.clearTimeout(id);
  }, [token, load, verifyAccess]);

  if (!token) {
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
      <ProjectEditor
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
          <p className="text-sm text-muted">
            Nothing yet. Drop in a video above.
          </p>
        ) : (
          <div className="space-y-4">
            <ProjectRow
              label="On the wall"
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
              Pick one to change its words, its tags, its cover, to cut more
              frames from the film, or to move it between the two rows.
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
        <p className="text-sm underline underline-offset-4">the Curator</p>
        <nav className="flex items-center gap-5 text-xs text-muted">
          <Link href="/stills" className="hover:text-foreground transition-colors">
            Stills
          </Link>
          <Link href="/desk" className="hover:text-foreground transition-colors">
            the Desk
          </Link>
          <Link href="/studio" className="hover:text-foreground transition-colors">
            the Studio
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
        repository permission: <strong>Contents: Read and write</strong>. A
        token made for the Desk has Actions instead, and will fail the moment
        you save anything.
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
  /** What the row means for the reader, since "Drafts" only says it to
   *  somebody who already knows this tool. */
  hint: string;
  projects: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (!projects.length) return null;
  return (
    <div className="grid md:grid-cols-[7rem_1fr] gap-2 md:gap-4 items-baseline">
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
                {project.frames.length}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
