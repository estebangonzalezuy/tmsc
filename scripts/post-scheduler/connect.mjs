// Getting the tokens, once, on your own machine.
//
//   node connect.mjs linkedin     → LINKEDIN_ACCESS_TOKEN
//   node connect.mjs instagram    → INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID
//   node connect.mjs instagram --refresh   renew a long-lived token
//
// Both networks hand a token to a browser redirect, so this starts a tiny
// server on localhost, prints the URL to open, catches the code on the way
// back and swaps it for the token — then prints what to paste into the repo's
// Actions secrets. Nothing is stored anywhere. X needs no flow: its four
// strings come straight off the developer portal. Substack has no flow at
// all: copy the `substack.sid` cookie out of the browser.
//
// You need an app on each side first; the README says how, and the client
// id/secret are asked for here as environment variables so they never sit in
// a file.

import { createServer } from "node:http";
import { refreshToken } from "./networks/instagram.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const REDIRECT = `http://localhost:${PORT}/callback`;

const need = (name, how) => {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set. ${how}`);
    process.exit(2);
  }
  return v;
};

/** Waits for one hit on /callback and resolves with its query. */
function catchCode() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, REDIRECT);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Done — back to the terminal.");
      server.close();
      resolve(Object.fromEntries(url.searchParams));
    });
    server.listen(PORT);
  });
}

async function linkedin() {
  const id = need("LINKEDIN_CLIENT_ID", "From your app at linkedin.com/developers → Auth.");
  const secret = need("LINKEDIN_CLIENT_SECRET", "From the same page.");
  const state = Math.random().toString(36).slice(2);
  const auth = new URL("https://www.linkedin.com/oauth/v2/authorization");
  auth.search = new URLSearchParams({
    response_type: "code",
    client_id: id,
    redirect_uri: REDIRECT,
    state,
    scope: "openid profile w_member_social",
  }).toString();
  console.log(`\nOpen this in a browser where you are signed in to LinkedIn:\n\n${auth}\n`);
  console.log(`(the app's Authorized redirect URLs must include ${REDIRECT})`);
  const q = await catchCode();
  if (q.state !== state || !q.code) throw new Error(`LinkedIn came back without a code: ${JSON.stringify(q)}`);
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: q.code,
      redirect_uri: REDIRECT,
      client_id: id,
      client_secret: secret,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  const days = Math.round((body.expires_in ?? 0) / 86400);
  console.log(`\nLINKEDIN_ACCESS_TOKEN=${body.access_token}\n\nGood for ${days} days. Put it in the repo's Actions secrets; do this again before it runs out.`);
}

async function instagram() {
  if (process.argv.includes("--refresh")) {
    const body = await refreshToken();
    console.log(`\nINSTAGRAM_ACCESS_TOKEN=${body.access_token}\n\nGood for ${Math.round(body.expires_in / 86400)} days.`);
    return;
  }
  const id = need("INSTAGRAM_APP_ID", "The Instagram app id from developers.facebook.com → your app → Instagram → API setup with Instagram login.");
  const secret = need("INSTAGRAM_APP_SECRET", "From the same page.");
  const auth = new URL("https://www.instagram.com/oauth/authorize");
  auth.search = new URLSearchParams({
    client_id: id,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights",
  }).toString();
  console.log(`\nOpen this in a browser where you are signed in to the Instagram account:\n\n${auth}\n`);
  console.log(`(the app's OAuth redirect URIs must include ${REDIRECT})`);
  const q = await catchCode();
  if (!q.code) throw new Error(`Instagram came back without a code: ${JSON.stringify(q)}`);
  const short = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT,
      code: q.code.replace(/#_$/, ""),
    }),
  }).then((r) => r.json());
  if (!short.access_token) throw new Error(JSON.stringify(short));
  const long = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(secret)}&access_token=${encodeURIComponent(short.access_token)}`,
  ).then((r) => r.json());
  if (!long.access_token) throw new Error(JSON.stringify(long));
  const me = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${encodeURIComponent(long.access_token)}`,
  ).then((r) => r.json());
  console.log(
    `\nINSTAGRAM_ACCESS_TOKEN=${long.access_token}\nINSTAGRAM_USER_ID=${me.user_id ?? short.user_id}\n\n@${me.username ?? "?"} · good for ${Math.round(long.expires_in / 86400)} days. Put both in the repo's Actions secrets; run \`node connect.mjs instagram --refresh\` with the old token in INSTAGRAM_ACCESS_TOKEN to renew it.`,
  );
}

const which = process.argv[2];
if (which === "linkedin") await linkedin();
else if (which === "instagram") await instagram();
else {
  console.error("Usage: node connect.mjs linkedin | instagram [--refresh]");
  process.exit(2);
}
