import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

// Local-development helper only: lets the Scheduler land a post on disk —
// content/posts/posts.json plus its media — instead of committing it to main.
// In production this route simply does not exist, exactly like the Cutter's
// helper in app/api/clips/local and the Studio's in app/api/studio/content.
//
// Same zero-config contract as everything else in the club: no env vars, no
// secrets, no server-side token. It writes files under the repo it is running
// in and nothing else. The runner can then be pointed at the same checkout
// (`node scripts/post-scheduler/index.mjs publish --dry-run`) to close the loop
// without a deploy.

export const dynamic = "force-dynamic";

const POSTS_PATH = "content/posts/posts.json";
const LOG_PATH = "content/posts/log.json";
const ASSET_DIR = "public/posts";

const isDev = () => process.env.NODE_ENV === "development";
const notHere = () => NextResponse.json({ error: "Not available" }, { status: 404 });

/** Repo-relative asset paths only, and only under public/posts. The route is
 *  dev-only, but a path arriving from a browser is still a path arriving from
 *  a browser, and `..` in one of these would write anywhere on the disk. */
function safeAssetPath(name: string): string | null {
  const full = path.normalize(path.join(process.cwd(), name));
  const root = path.join(process.cwd(), ASSET_DIR) + path.sep;
  return name.startsWith(`${ASSET_DIR}/`) && full.startsWith(root) ? full : null;
}

async function readJsonFile(rel: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), rel), "utf8"));
  } catch {
    return null;
  }
}

export async function GET() {
  if (!isDev()) return notHere();
  const [posts, log] = await Promise.all([readJsonFile(POSTS_PATH), readJsonFile(LOG_PATH)]);
  return NextResponse.json({ posts, log, mode: "local" });
}

export async function PUT(req: Request) {
  if (!isDev()) return notHere();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart body" }, { status: 400 });
  }

  const json = form.get("data");
  if (typeof json !== "string") {
    return NextResponse.json({ error: "Missing the data field" }, { status: 400 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return NextResponse.json({ error: "The data field isn't JSON" }, { status: 400 });
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { posts?: unknown }).posts)
  ) {
    return NextResponse.json({ error: "That isn't a posts file — no posts array" }, { status: 400 });
  }

  let remove: unknown = [];
  try {
    remove = JSON.parse(String(form.get("remove") ?? "[]"));
  } catch {
    return NextResponse.json({ error: "The remove field isn't JSON" }, { status: 400 });
  }
  if (!Array.isArray(remove) || remove.some((r) => typeof r !== "string")) {
    return NextResponse.json({ error: "remove must be a list of paths" }, { status: 400 });
  }

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  for (const f of files) {
    if (!safeAssetPath(f.name)) {
      return NextResponse.json({ error: `Refusing to write ${f.name}` }, { status: 400 });
    }
  }
  for (const r of remove as string[]) {
    if (!safeAssetPath(r)) {
      return NextResponse.json({ error: `Refusing to remove ${r}` }, { status: 400 });
    }
  }

  try {
    for (const f of files) {
      const full = safeAssetPath(f.name)!;
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, Buffer.from(await f.arrayBuffer()));
    }
    for (const r of remove as string[]) {
      await fs.rm(safeAssetPath(r)!, { force: true });
      /* An emptied post folder goes too, so the tree stays what the repo's
         would be after the same commit. */
      const dir = path.dirname(safeAssetPath(r)!);
      const left = await fs.readdir(dir).catch(() => null);
      if (left && left.length === 0) await fs.rmdir(dir);
    }
    await fs.writeFile(
      path.join(process.cwd(), POSTS_PATH),
      JSON.stringify(parsed, null, 2) + "\n",
    );
    return NextResponse.json({ ok: true, wrote: files.length, removed: remove.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Write failed" },
      { status: 500 },
    );
  }
}
