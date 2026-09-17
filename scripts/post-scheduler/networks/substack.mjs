// Substack Notes. There is no public API: this speaks to the same endpoints
// the Substack site itself calls when you write a note, signed with your own
// session cookie (SUBSTACK_SID — the `substack.sid` cookie out of the browser's
// devtools). It is unofficial, it may change without notice, and when it
// does the health line on the page will say so. Text and up to four images;
// no video.

const API = "https://substack.com/api/v1";

const need = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

async function call(path, { method = "GET", json } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Cookie: `substack.sid=${need("SUBSTACK_SID")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (tMSC post-scheduler)",
    },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Substack ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

/** The note body as Substack's ProseMirror document: one paragraph per line
 *  break, hard breaks inside a paragraph, images after the words. */
export function noteDoc(text, imageUrls = []) {
  const content = [];
  for (const para of text.split(/\n{2,}/)) {
    const lines = para.split("\n");
    const inner = [];
    lines.forEach((line, i) => {
      if (i > 0) inner.push({ type: "hardBreak" });
      if (line) inner.push({ type: "text", text: line });
    });
    content.push(inner.length ? { type: "paragraph", content: inner } : { type: "paragraph" });
  }
  for (const src of imageUrls) {
    content.push({ type: "image2", attrs: { src } });
  }
  return { type: "doc", attrs: { schemaVersion: "v1" }, content };
}

async function uploadImage(bytes, mime) {
  const dataUri = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  const res = await call("/image", { method: "POST", json: { image: dataUri } });
  if (!res.url) throw new Error("Substack didn't return an image URL.");
  return res.url;
}

export async function publish({ text, media, read }) {
  const urls = [];
  for (const m of media.slice(0, 4)) urls.push(await uploadImage(await read(m), m.mime));
  const res = await call("/comment/feed", {
    method: "POST",
    json: {
      bodyJson: noteDoc(text, urls),
      tabId: "for-you",
      surface: "feed",
      replyMinimumRole: "everyone",
    },
  });
  const id = res.id ? String(res.id) : undefined;
  const handle = res.user?.handle ?? res.author?.handle;
  return {
    id,
    url: id && handle ? `https://substack.com/@${handle}/note/c-${id}` : undefined,
  };
}

export async function metrics({ id }) {
  const res = await call(`/comment/${id}`);
  const note = res.item?.comment ?? res.comment ?? res;
  return {
    likes: note.reaction_count ?? note.reactions?.["❤"],
    comments: note.children_count,
    shares: note.restacks,
  };
}

export async function check() {
  await call("/subscription");
}
