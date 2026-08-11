// GitHub from the browser, for the Curator.
//
// Same contract as the Studio and the Desk: the token is pasted into the page
// and kept in localStorage, every call goes straight to api.github.com, and
// nothing on Vercel holds a secret. The deployed app needs no environment at
// all, which is the whole reason the club's tools work this way.
//
// Publishing a project means one commit carrying content/stills/projects.json
// and every image it just cut, so it goes through the Git Data API rather than
// the contents API. What the public wall shows is derived from that file when
// the site builds.

export const GH_REPO = "estebangonzalezuy/tmsc";
export const GH_BRANCH = "main";
export const GH_FILE = "content/stills/projects.json";
/** Shared with the Desk on purpose: it's the same token doing the same job,
 *  and being asked for it twice is friction with nothing behind it. */
export const TOKEN_KEY = "desk-github-token";

/* The token as an external store rather than component state, which is what
   it is: something that lives in the browser and can change in another tab.
   Same shape the Desk uses. */
const listeners = new Set<() => void>();

export const tokenStore = {
  get: () =>
    typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY),
  server: () => null,
  set(value: string | null) {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    window.addEventListener("storage", l);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", l);
    };
  },
};

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function b64decode(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Throws with GitHub's own words attached. `explain` covers the status codes
 *  worth translating, but a 403 on the Git Data API usually says exactly which
 *  permission is missing, and swallowing that turns a fixable problem into
 *  "publish not working". */
async function fail(res: Response): Promise<never> {
  let detail = "";
  try {
    const body = (await res.json()) as {
      message?: string;
      errors?: { message?: string; code?: string; field?: string }[];
    };
    detail = body.message ?? "";
    const errors = (body.errors ?? [])
      .map((e) => e.message ?? [e.field, e.code].filter(Boolean).join(" "))
      .filter(Boolean);
    if (errors.length) detail += ` (${errors.join("; ")})`;
  } catch {
    // A body that isn't JSON tells us nothing the status hasn't already.
  }
  throw new Error(explain(res.status) + (detail ? ` GitHub said: ${detail}` : ""));
}

/** The permission the Curator needs, written out. The token key is shared with
 *  the Desk, and the Desk only ever needed Actions — so arriving here with a
 *  token that cannot commit is the normal way to arrive, not an exotic one. */
export const PERMISSION_HELP =
  "In GitHub → Settings → Developer settings → Personal access tokens → this token → Repository permissions, set Contents to Read and write.";

function explain(status: number): string {
  if (status === 403) {
    return `This token can't write to ${GH_REPO}. ${PERMISSION_HELP}`;
  }
  if (status === 401) {
    return "GitHub rejected the token — check it and try again.";
  }
  if (status === 404) {
    return `GitHub can't see the repo with this token — make sure it has access to ${GH_REPO}.`;
  }
  if (status === 409) {
    return "Somebody else pushed while you were editing. Reload and redo the change.";
  }
  return `GitHub said ${status}.`;
}

export type Access = {
  canRead: boolean;
  canWrite: boolean;
  /** Empty when everything is in order. */
  problem: string;
};

/** Asks GitHub what this token may do, before anything depends on the answer.
 *
 *  Publishing is the end of a long piece of work — decode a film, cut the
 *  frames, judge them one by one — and finding out only then that the token
 *  can read but not write costs all of it. The repo endpoint reports the
 *  permissions the token actually carries, so the panel can say so on the way
 *  in instead. */
export async function checkAccess(token: string): Promise<Access> {
  const res = await fetch(`https://api.github.com/repos/${GH_REPO}`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (!res.ok) {
    return { canRead: false, canWrite: false, problem: explain(res.status) };
  }
  const body = (await res.json()) as {
    permissions?: { push?: boolean; admin?: boolean; maintain?: boolean };
  };
  const p = body.permissions ?? {};
  const canWrite = Boolean(p.push || p.maintain || p.admin);
  return {
    canRead: true,
    canWrite,
    problem: canWrite
      ? ""
      : `This token can read ${GH_REPO} but not write to it, so Publish will fail. ${PERMISSION_HELP}`,
  };
}

export async function readProjects<T>(
  token: string,
): Promise<{ data: T; sha: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}?ref=${GH_BRANCH}`,
    { headers: headers(token), cache: "no-store" },
  );
  if (!res.ok) await fail(res);
  const body = (await res.json()) as { content: string; sha: string };
  return { data: JSON.parse(b64decode(body.content)) as T, sha: body.sha };
}

/* ---------- committing a whole project at once ---------- */

/** Base64 of a Blob, in chunks: a 200KB frame is 200k arguments to
 *  String.fromCharCode otherwise, and that overflows the call stack. */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function gh<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${GH_REPO}${path}`, {
    ...init,
    headers: { ...headers(token), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) await fail(res);
  return (await res.json()) as T;
}

export type CommitProgress = (done: number, total: number) => void;

/** One commit carrying the project's JSON and every image it just cut.
 *
 *  The contents API writes a single file, which is all the Curator needed
 *  while the extractor lived in Actions. A local extraction produces forty
 *  blobs and a JSON that references them, and forty commits would mean forty
 *  broken intermediate states on main, each one a deploy. So this goes
 *  through the Git Data API: blobs, one tree, one commit, one ref move.
 *
 *  `text` and `binaries` are keyed by repo-relative path. */
export async function commitFiles(
  token: string,
  {
    message,
    text = {},
    binaries = new Map<string, Blob>(),
    onProgress,
  }: {
    message: string;
    text?: Record<string, string>;
    binaries?: Map<string, Blob>;
    onProgress?: CommitProgress;
  },
): Promise<string> {
  const total = Object.keys(text).length + binaries.size + 3;
  let done = 0;
  const tick = () => onProgress?.(++done, total);

  const ref = await gh<{ object: { sha: string } }>(
    token,
    `/git/ref/heads/${GH_BRANCH}`,
  );
  const headSha = ref.object.sha;
  const head = await gh<{ tree: { sha: string } }>(
    token,
    `/git/commits/${headSha}`,
  );
  tick();

  const tree: { path: string; mode: "100644"; type: "blob"; sha: string }[] = [];

  for (const [path, content] of Object.entries(text)) {
    const blob = await gh<{ sha: string }>(token, "/git/blobs", {
      method: "POST",
      body: JSON.stringify({ content, encoding: "utf-8" }),
    });
    tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
    tick();
  }

  for (const [path, file] of binaries) {
    const blob = await gh<{ sha: string }>(token, "/git/blobs", {
      method: "POST",
      body: JSON.stringify({
        content: await blobToBase64(file),
        encoding: "base64",
      }),
    });
    tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
    tick();
  }

  const created = await gh<{ sha: string }>(token, "/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: head.tree.sha, tree }),
  });
  tick();

  const commit = await gh<{ sha: string }>(token, "/git/commits", {
    method: "POST",
    body: JSON.stringify({ message, tree: created.sha, parents: [headSha] }),
  });

  // Not forced: if the Studio published while this was uploading, the ref has
  // moved and this must fail loudly rather than drop somebody else's commit.
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/git/refs/heads/${GH_BRANCH}`,
    {
      method: "PATCH",
      headers: headers(token),
      body: JSON.stringify({ sha: commit.sha, force: false }),
    },
  );
  if (!res.ok) {
    if (res.status === 422) {
      throw new Error(
        "Something else pushed to main while this was uploading. Reload and publish again — the frames are still in the browser.",
      );
    }
    await fail(res);
  }
  tick();
  return commit.sha;
}
