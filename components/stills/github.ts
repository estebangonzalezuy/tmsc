// GitHub from the browser, for the Curator.
//
// Same contract as the Studio and the Desk: the token is pasted into the page
// and kept in localStorage, every call goes straight to api.github.com, and
// nothing on Vercel holds a secret. The deployed app needs no environment at
// all, which is the whole reason the club's tools work this way.
//
// The Curator writes one file — content/stills/projects.json — so the plain
// contents API is enough; there is no multi-file tree to keep atomic. What
// the public wall shows is derived from that file when the site builds.

export const GH_REPO = "estebangonzalezuy/tmsc";
export const GH_BRANCH = "main";
export const GH_FILE = "content/stills/projects.json";
export const GH_WORKFLOW = "stills.yml";
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

function b64encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function b64decode(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function explain(status: number): string {
  if (status === 401 || status === 403) {
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

export async function readProjects<T>(
  token: string,
): Promise<{ data: T; sha: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}?ref=${GH_BRANCH}`,
    { headers: headers(token), cache: "no-store" },
  );
  if (!res.ok) throw new Error(explain(res.status));
  const body = (await res.json()) as { content: string; sha: string };
  return { data: JSON.parse(b64decode(body.content)) as T, sha: body.sha };
}

export async function writeProjects(
  token: string,
  data: unknown,
  sha: string,
  message: string,
): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`,
    {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify({
        message,
        content: b64encode(JSON.stringify(data, null, 2) + "\n"),
        sha,
        branch: GH_BRANCH,
      }),
    },
  );
  if (!res.ok) throw new Error(explain(res.status));
  const body = (await res.json()) as { content: { sha: string } };
  return body.content.sha;
}

/** Starts the extractor. `times` empty means "suggest frames"; a list of
 *  seconds means "cut exactly these". */
export async function dispatchExtract(
  token: string,
  inputs: { url: string; times?: string; id?: string; count?: string },
): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: GH_BRANCH,
        inputs: {
          url: inputs.url,
          times: inputs.times ?? "",
          id: inputs.id ?? "",
          count: inputs.count ?? "18",
        },
      }),
    },
  );
  // A dispatch answers 204 with no body when it worked.
  if (!res.ok) {
    if (res.status === 422) {
      throw new Error(
        "GitHub wouldn't start the run — the workflow has to exist on main before it can be dispatched.",
      );
    }
    throw new Error(explain(res.status));
  }
}

export type Run = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  display_title: string;
};

export async function listRuns(token: string, limit = 5): Promise<Run[]> {
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/runs?per_page=${limit}`,
    { headers: headers(token), cache: "no-store" },
  );
  if (!res.ok) throw new Error(explain(res.status));
  const body = (await res.json()) as { workflow_runs: Run[] };
  return body.workflow_runs ?? [];
}
