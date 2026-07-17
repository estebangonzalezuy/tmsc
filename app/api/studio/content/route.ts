import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

// Local-development helper only: lets the Studio read/write
// content/site.json on disk while running `next dev`. In production the
// Studio talks to the GitHub API directly from the browser, so this route
// simply does not exist there.

export const dynamic = "force-dynamic";

const CONTENT_PATH = "content/site.json";
const REQUIRED_KEYS = [
  "site",
  "stats",
  "pillars",
  "threads",
  "practiceFiles",
  "learningPaths",
  "resources",
  "worksheets",
  "offerings",
  "archive",
  "quotes",
];

const localFile = () => path.join(process.cwd(), CONTENT_PATH);
const isDev = () => process.env.NODE_ENV === "development";

export async function GET() {
  if (!isDev()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  try {
    const raw = await fs.readFile(localFile(), "utf8");
    return NextResponse.json({ content: JSON.parse(raw), mode: "local" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Read failed" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  if (!isDev()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    REQUIRED_KEYS.some((k) => !(k in body))
  ) {
    return NextResponse.json(
      { error: "Content is missing one of its sections" },
      { status: 400 },
    );
  }
  try {
    await fs.writeFile(
      localFile(),
      JSON.stringify(body, null, 2) + "\n",
      "utf8",
    );
    return NextResponse.json({ ok: true, mode: "local" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Write failed" },
      { status: 500 },
    );
  }
}
