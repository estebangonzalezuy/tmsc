import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { type NextRequest } from "next/server";

// The instrument is a built HTML file. public/ does no directory index, so
// this route is what makes the bare path /motion-instrument open the tool.
// It replaces the document title and adds the description and social image.
// The tool's markup and script are not rewritten — index.html on disk stays
// the artifact, and /motion-instrument/index.html still serves that file.

const TITLE = "Motion Instrument — The Motion Social Club";
const DESCRIPTION =
  "A keyboard from the Motion Social Club. Each note drops a word into a layout that packs, collides and springs into place.";

// Resolved from this file so the tracer can see the artifact. process.cwd()
// would look dynamic and pull the rest of the repo into the function.
const HTML_PATH = fileURLToPath(
  new URL("../../public/motion-instrument/index.html", import.meta.url),
);

function withMeta(html: string, origin: string): string {
  const page = `${origin}/motion-instrument`;
  const image = `${page}/media/poster.png`;
  const meta = [
    `<title>${TITLE}</title>`,
    `<meta name="description" content="${DESCRIPTION}">`,
    `<meta property="og:title" content="${TITLE}">`,
    `<meta property="og:description" content="${DESCRIPTION}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${page}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:width" content="1440">`,
    `<meta property="og:image:height" content="900">`,
    `<meta property="og:image:alt" content="Coloured word labels packed on white, with the Motion Instrument sequencer along the bottom.">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${TITLE}">`,
    `<meta name="twitter:description" content="${DESCRIPTION}">`,
    `<meta name="twitter:image" content="${image}">`,
  ].join("\n");

  const titles = html.match(/<title>[^<]*<\/title>/g);
  if (!titles || titles.length !== 1) {
    throw new Error("Motion Instrument index.html should contain exactly one title tag");
  }
  return html.replace(titles[0], meta);
}

export async function GET(request: NextRequest): Promise<Response> {
  const html = await readFile(HTML_PATH, "utf8");
  return new Response(withMeta(html, request.nextUrl.origin), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}
