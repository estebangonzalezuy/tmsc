// LinkedIn: the Posts API, posting as the member whose token this is.
//
// Needs LINKEDIN_ACCESS_TOKEN — a 60-day token from a Sign In with LinkedIn
// (OpenID Connect) + Share on LinkedIn app, scopes `openid profile
// w_member_social` (`node connect.mjs linkedin` walks through it). LinkedIn
// hands out refresh tokens only to approved partners, so every two months the
// token is made again by hand; the runner says so in the health line when
// LinkedIn starts refusing it.
//
// Images and videos go through the Images / Videos APIs (initialize an
// upload, PUT the bytes, reference the URN). Reactions and comments come back
// through socialActions; impressions for a member's own posts are not in any
// self-serve API, which is why the page lets you type them in.

const API = "https://api.linkedin.com";
const VERSION = "202508";

const need = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

function headers(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
    ...extra,
  };
}

async function call(token, path, init = {}) {
  const res = await fetch(API + path, { ...init, headers: headers(token, init.headers) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn ${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

/** urn:li:person:… for the token's owner. */
async function author(token) {
  const res = await call(token, "/v2/userinfo");
  const me = await res.json();
  return `urn:li:person:${me.sub}`;
}

/* LinkedIn's "little text" format reserves these; unescaped, a bracket can
   turn into a broken mention and the post is refused. `#` is left alone so a
   hashtag stays a hashtag. */
export function escapeCommentary(text) {
  return text.replace(/[\\|{}@[\]()<>*_~]/g, (c) => "\\" + c);
}

async function uploadImage(token, owner, bytes, mime) {
  const init = await call(token, "/rest/images?action=initializeUpload", {
    method: "POST",
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  const { value } = await init.json();
  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": mime },
    body: bytes,
  });
  if (!put.ok) throw new Error(`LinkedIn image upload → ${put.status}`);
  return value.image;
}

async function uploadVideo(token, owner, bytes) {
  const init = await call(token, "/rest/videos?action=initializeUpload", {
    method: "POST",
    body: JSON.stringify({
      initializeUploadRequest: {
        owner,
        fileSizeBytes: bytes.length,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  const { value } = await init.json();
  const etags = [];
  for (const part of value.uploadInstructions) {
    const chunk = bytes.subarray(part.firstByte, part.lastByte + 1);
    const put = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: chunk,
    });
    if (!put.ok) throw new Error(`LinkedIn video upload → ${put.status}`);
    etags.push(put.headers.get("etag"));
  }
  await call(token, "/rest/videos?action=finalizeUpload", {
    method: "POST",
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: value.video,
        uploadToken: value.uploadToken ?? "",
        uploadedPartIds: etags,
      },
    }),
  });
  /* The video is processed after the upload; posting before it's AVAILABLE
     is refused. */
  for (let i = 0; i < 30; i++) {
    const res = await call(token, `/rest/videos/${encodeURIComponent(value.video)}`);
    const body = await res.json();
    if (body.status === "AVAILABLE") return value.video;
    if (body.status === "PROCESSING_FAILED") throw new Error("LinkedIn couldn't process the video.");
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("LinkedIn is still processing the video; try again later.");
}

/**
 * Posts. `media` is the list the page filed, already filtered to what
 * LinkedIn takes; `read(m)` gives the bytes.
 */
export async function publish({ text, media, read }) {
  const token = need("LINKEDIN_ACCESS_TOKEN");
  const owner = await author(token);

  const body = {
    author: owner,
    commentary: escapeCommentary(text),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const video = media.find((m) => m.kind === "video");
  if (video) {
    const urn = await uploadVideo(token, owner, await read(video));
    body.content = { media: { id: urn, title: "" } };
  } else if (media.length === 1) {
    const m = media[0];
    const urn = await uploadImage(token, owner, await read(m), m.mime);
    body.content = { media: { id: urn, altText: m.alt ?? "" } };
  } else if (media.length > 1) {
    const images = [];
    for (const m of media) {
      images.push({ id: await uploadImage(token, owner, await read(m), m.mime), altText: m.alt ?? "" });
    }
    body.content = { multiImage: { images } };
  }

  const res = await call(token, "/rest/posts", { method: "POST", body: JSON.stringify(body) });
  const id = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id") ?? "";
  return {
    id,
    url: id ? `https://www.linkedin.com/feed/update/${id}/` : undefined,
  };
}

/** Reactions and comments. Anything more needs LinkedIn's own export. */
export async function metrics({ id }) {
  const token = need("LINKEDIN_ACCESS_TOKEN");
  const res = await call(token, `/rest/socialActions/${encodeURIComponent(id)}`);
  const body = await res.json();
  return {
    likes: body.likesSummary?.totalLikes,
    comments: body.commentsSummary?.totalFirstLevelComments ?? body.commentsSummary?.aggregatedTotalComments,
  };
}

/** A cheap call that fails the way an expired token fails. */
export async function check() {
  await author(need("LINKEDIN_ACCESS_TOKEN"));
}
