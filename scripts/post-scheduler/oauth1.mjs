// OAuth 1.0a request signing, for X. HMAC-SHA1 over the base string, which is
// the one part of the old protocol that every library gets wrong slightly
// differently; this one is checked against the worked example in the
// specification (see test.mjs). Written here rather than pulled in because it
// is forty lines and the runner has no other dependency.

import { createHmac, randomBytes } from "node:crypto";

/** RFC 3986 percent-encoding, which is stricter than encodeURIComponent. */
export function rfc3986(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * The Authorization header for one request.
 *
 * `params` are the query parameters and, for a form-encoded body, the body
 * fields — both are part of the signature. A multipart body is not, and a
 * JSON body is not, which is why the X calls here send JSON and keep every
 * parameter in the URL.
 */
export function authorizationHeader(
  { key, secret, token, tokenSecret },
  method,
  url,
  params = {},
  { nonce = randomBytes(16).toString("hex"), timestamp = Math.floor(Date.now() / 1000) } = {},
) {
  const oauth = {
    oauth_consumer_key: key,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(timestamp),
    oauth_token: token,
    oauth_version: "1.0",
  };
  const all = { ...params, ...oauth };
  const normalized = Object.keys(all)
    .map((k) => [rfc3986(k), rfc3986(String(all[k]))])
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const base = [method.toUpperCase(), rfc3986(url), rfc3986(normalized)].join("&");
  const signingKey = `${rfc3986(secret)}&${rfc3986(tokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(base).digest("base64");
  const header = { ...oauth, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(header)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(header[k])}"`)
      .join(", ")
  );
}
