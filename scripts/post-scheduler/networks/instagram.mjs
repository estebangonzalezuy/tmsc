// Instagram: the content publishing API, on a Business or Creator account.
//
// Needs INSTAGRAM_ACCESS_TOKEN (a long-lived token from an "Instagram API with
// Instagram Login" app, scopes instagram_business_basic +
// instagram_business_content_publish; `node connect.mjs instagram` walks
// through it and `--refresh` renews it) and INSTAGRAM_USER_ID.
//
// The one network that will not take an upload: it fetches the file from a
// public URL itself, so the page's media has to be live on the site first —
// which it is, because the page commits it to public/ and Vercel deploys
// main. JPEG only for images, hence the `.ig.jpg` siblings the page writes.
// A single video posts as a Reel; several files post as a carousel.

const API = "https://graph.instagram.com/v21.0";

const need = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

async function call(path, { method = "GET", params = {} } = {}) {
  const token = need("INSTAGRAM_ACCESS_TOKEN");
  const body = new URLSearchParams({ ...params, access_token: token });
  const url = method === "GET" ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    body: method === "GET" ? undefined : body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `${res.status}`;
    throw new Error(`Instagram ${method} ${path} → ${msg}`);
  }
  return json;
}

async function waitFinished(containerId) {
  for (let i = 0; i < 40; i++) {
    const s = await call(`/${containerId}`, { params: { fields: "status_code,status" } });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      throw new Error(`Instagram couldn't process the media: ${s.status ?? s.status_code}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Instagram is still processing the media; try again later.");
}

/** `url(m)` gives the public URL of a file — the JPEG sibling for an image. */
export async function publish({ text, media, url }) {
  const user = need("INSTAGRAM_USER_ID");
  const items = media.filter((m) => m.kind === "image" || m.kind === "video");
  if (items.length === 0) throw new Error("Instagram needs an image or a video.");

  const container = async (m, extra = {}) => {
    const params =
      m.kind === "video"
        ? { media_type: extra.is_carousel_item ? "VIDEO" : "REELS", video_url: url(m) }
        : { image_url: url(m) };
    const res = await call(`/${user}/media`, { method: "POST", params: { ...params, ...extra } });
    if (m.kind === "video" || extra.is_carousel_item) await waitFinished(res.id);
    return res.id;
  };

  let creation;
  if (items.length === 1) {
    creation = await container(items[0], { caption: text });
  } else {
    const children = [];
    for (const m of items.slice(0, 10)) children.push(await container(m, { is_carousel_item: "true" }));
    const res = await call(`/${user}/media`, {
      method: "POST",
      params: { media_type: "CAROUSEL", children: children.join(","), caption: text },
    });
    creation = res.id;
    await waitFinished(creation);
  }

  const pub = await call(`/${user}/media_publish`, { method: "POST", params: { creation_id: creation } });
  const info = await call(`/${pub.id}`, { params: { fields: "permalink" } }).catch(() => ({}));
  return { id: pub.id, url: info.permalink };
}

export async function metrics({ id }) {
  const base = await call(`/${id}`, { params: { fields: "like_count,comments_count,media_type" } });
  const out = { likes: base.like_count, comments: base.comments_count };
  const wanted = base.media_type === "VIDEO" ? "reach,saved,shares,views" : "reach,saved,shares";
  try {
    const ins = await call(`/${id}/insights`, { params: { metric: wanted } });
    for (const row of ins.data ?? []) {
      const v = row.values?.[0]?.value ?? row.total_value?.value;
      if (row.name === "reach") out.reach = v;
      if (row.name === "saved") out.saves = v;
      if (row.name === "shares") out.shares = v;
      if (row.name === "views") out.impressions = v;
    }
  } catch {
    // Insights are refused on some media (and for a day after posting);
    // likes and comments are still worth writing down.
  }
  return out;
}

export async function check() {
  await call(`/${need("INSTAGRAM_USER_ID")}`, { params: { fields: "id,username" } });
}

/** A long-lived token lasts 60 days and can be renewed any time after 24
 *  hours; the new one has to be put in the secrets by hand. */
export async function refreshToken() {
  const token = need("INSTAGRAM_ACCESS_TOKEN");
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
  );
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `${res.status}`);
  return json;
}
