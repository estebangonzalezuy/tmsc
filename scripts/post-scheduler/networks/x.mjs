// X: the v2 posts endpoint and the v2 chunked media upload, signed with
// OAuth 1.0a user context — four strings off the developer portal
// (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET) that never
// expire, which for one account posting as itself beats an OAuth 2 refresh
// dance. The free tier allows posting; reading a post's public_metrics needs
// the Basic tier, so `metrics` says so rather than failing quietly.

import { authorizationHeader } from "../oauth1.mjs";

const API = "https://api.x.com/2";

function creds() {
  const out = {
    key: process.env.X_API_KEY,
    secret: process.env.X_API_SECRET,
    token: process.env.X_ACCESS_TOKEN,
    tokenSecret: process.env.X_ACCESS_SECRET,
  };
  for (const [k, v] of Object.entries(out)) if (!v) throw new Error(`X credential ${k} is not set`);
  return out;
}

/** One signed call. `query` goes in the URL and the signature; a JSON or a
 *  multipart body is not signed, per the spec. */
async function call(method, path, { query = {}, json, form } = {}) {
  const url = API + path;
  const qs = new URLSearchParams(query).toString();
  const auth = authorizationHeader(creds(), method, url, query);
  const headers = { Authorization: auth };
  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(url + (qs ? `?${qs}` : ""), { method, headers, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`X ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const CHUNK = 4 * 1024 * 1024;

async function uploadMedia(m, bytes) {
  const category = m.kind === "video" ? "tweet_video" : m.kind === "gif" ? "tweet_gif" : "tweet_image";
  const init = await call("POST", "/media/upload/initialize", {
    json: { media_type: m.mime, total_bytes: bytes.length, media_category: category },
  });
  const id = init.data.id;
  for (let i = 0, seg = 0; i < bytes.length; i += CHUNK, seg++) {
    const form = new FormData();
    form.set("segment_index", String(seg));
    form.set("media", new Blob([bytes.subarray(i, i + CHUNK)], { type: m.mime }), "chunk");
    await call("POST", `/media/upload/${id}/append`, { form });
  }
  const fin = await call("POST", `/media/upload/${id}/finalize`);
  let info = fin.data?.processing_info;
  while (info && info.state !== "succeeded") {
    if (info.state === "failed") throw new Error("X couldn't process the media.");
    await new Promise((r) => setTimeout(r, (info.check_after_secs ?? 3) * 1000));
    const status = await call("GET", "/media/upload", { query: { command: "STATUS", media_id: id } });
    info = status.data?.processing_info;
  }
  return id;
}

export async function publish({ text, media, read }) {
  const ids = [];
  for (const m of media) ids.push(await uploadMedia(m, await read(m)));
  const body = { text };
  if (ids.length) body.media = { media_ids: ids };
  const res = await call("POST", "/tweets", { json: body });
  const id = res.data?.id;
  return { id, url: id ? `https://x.com/i/status/${id}` : undefined };
}

export async function metrics({ id }) {
  const res = await call("GET", `/tweets/${id}`, { query: { "tweet.fields": "public_metrics" } });
  const m = res.data?.public_metrics ?? {};
  return {
    impressions: m.impression_count,
    likes: m.like_count,
    comments: m.reply_count,
    shares: (m.retweet_count ?? 0) + (m.quote_count ?? 0),
    saves: m.bookmark_count,
  };
}

export async function check() {
  await call("GET", "/users/me");
}
