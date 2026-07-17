import { promises as fs } from "fs";
import path from "path";
import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

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

const repo = () => process.env.STUDIO_GITHUB_REPO ?? "estebangonzalezuy/tmsc";
const branch = () => process.env.STUDIO_GITHUB_BRANCH ?? "main";
const localFile = () => path.join(process.cwd(), CONTENT_PATH);

function authorized(req: Request): boolean {
  const expected = process.env.STUDIO_PASSWORD;
  // Without a password configured the Studio only works in local development.
  if (!expected) return process.env.NODE_ENV === "development";
  const given = req.headers.get("x-studio-password") ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubRead(token: string) {
  const res = await fetch(
    `https://api.github.com/repos/${repo()}/contents/${CONTENT_PATH}?ref=${branch()}`,
    { headers: githubHeaders(token), cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`GitHub read failed (${res.status})`);
  }
  const data = (await res.json()) as { content: string; sha: string };
  const json = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  return { json, sha: data.sha };
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = process.env.STUDIO_GITHUB_TOKEN;
  try {
    if (token) {
      const { json } = await githubRead(token);
      return NextResponse.json({ content: json, mode: "github" });
    }
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
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const serialized = JSON.stringify(body, null, 2) + "\n";
  const token = process.env.STUDIO_GITHUB_TOKEN;

  try {
    if (token) {
      const { sha } = await githubRead(token);
      const res = await fetch(
        `https://api.github.com/repos/${repo()}/contents/${CONTENT_PATH}`,
        {
          method: "PUT",
          headers: githubHeaders(token),
          body: JSON.stringify({
            message: "Update site content from the Studio",
            content: Buffer.from(serialized, "utf8").toString("base64"),
            sha,
            branch: branch(),
          }),
        },
      );
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`GitHub write failed (${res.status}): ${detail}`);
      }
      return NextResponse.json({ ok: true, mode: "github" });
    }

    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "STUDIO_GITHUB_TOKEN is not configured on the server" },
        { status: 501 },
      );
    }
    await fs.writeFile(localFile(), serialized, "utf8");
    return NextResponse.json({ ok: true, mode: "local" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Write failed" },
      { status: 500 },
    );
  }
}
