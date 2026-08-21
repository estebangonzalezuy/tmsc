import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

// Local-development helper only: lets the Cutter land a project on disk —
// content/clips/clips.json plus every sheet — instead of committing it to main.
// In production this route simply does not exist, exactly like the Studio's
// own helper next door in app/api/studio/content.
//
// It is here because the alternative was untestable. The wall is a build-time
// derivation of a data file the Cutter writes through the GitHub API, so the
// only way to see a real clip on a real wall used to be to publish one to the
// live site and wait for Vercel. Now `next dev` is the whole loop.
//
// Same zero-config contract as everything else in the club: no env vars, no
// secrets, no server-side token. It writes files under the repo it is running
// in and nothing else.

export const dynamic = "force-dynamic";

const DATA_PATH = "content/clips/clips.json";
const ASSET_DIR = "public/clips";

const isDev = () => process.env.NODE_ENV === "development";
const notHere = () =>
  NextResponse.json({ error: "Not available" }, { status: 404 });

/** Repo-relative asset paths only, and only under public/clips. The route is
 *  dev-only, but a path arriving from a browser is still a path arriving from
 *  a browser, and `..` in one of these would write anywhere on the disk. */
function safeAssetPath(name: string): string | null {
  const full = path.normalize(path.join(process.cwd(), name));
  const root = path.join(process.cwd(), ASSET_DIR) + path.sep;
  return name.startsWith(`${ASSET_DIR}/`) && full.startsWith(root) ? full : null;
}

export async function GET() {
  if (!isDev()) return notHere();
  try {
    const raw = await fs.readFile(path.join(process.cwd(), DATA_PATH), "utf8");
    return NextResponse.json({ data: JSON.parse(raw), mode: "local" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Read failed" },
      { status: 500 },
    );
  }
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
    !Array.isArray((parsed as { projects?: unknown }).projects)
  ) {
    return NextResponse.json(
      { error: "That isn't a Clips file — no projects array" },
      { status: 400 },
    );
  }

  try {
    let written = 0;
    for (const [name, value] of form.entries()) {
      if (name === "data" || typeof value === "string") continue;
      const full = safeAssetPath(name);
      if (!full) {
        return NextResponse.json(
          { error: `Refusing to write outside ${ASSET_DIR}: ${name}` },
          { status: 400 },
        );
      }
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, Buffer.from(await value.arrayBuffer()));
      written++;
    }

    await fs.writeFile(
      path.join(process.cwd(), DATA_PATH),
      JSON.stringify(parsed, null, 2) + "\n",
      "utf8",
    );
    return NextResponse.json({ ok: true, written, mode: "local" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Write failed" },
      { status: 500 },
    );
  }
}
