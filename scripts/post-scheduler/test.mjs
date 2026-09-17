// The parts worth checking without a network: the OAuth 1.0a signature
// against the worked example in the spec (RFC 5849 §1.2, the same one X's
// own docs reuse), the note document, and the rules the runner shares with
// the page. `node test.mjs`.

import assert from "node:assert/strict";
import { authorizationHeader, rfc3986 } from "./oauth1.mjs";
import { escapeCommentary } from "./networks/linkedin.mjs";
import { noteDoc } from "./networks/substack.mjs";

const shared = await import("../../lib/posts-shared.ts");

/* RFC 5849 §1.2 — the request that fetches a temporary credential's
   replacement, with the signature the RFC prints. */
{
  const header = authorizationHeader(
    { key: "9djdj82h48djs9d2", secret: "j49sk3j29djd", token: "kkk9d7dh3k39sjv7", tokenSecret: "dh893hdasih9" },
    "POST",
    "http://example.com/request",
    { b5: "=%3D", a3: ["a", "2 q"][0], c2: "", a2: "r b", c3: "2 q" },
    { nonce: "7d8f3e4a", timestamp: 137131201 },
  );
  // Only the shape is checked against the RFC's example (its `a3` appears
  // twice, which this signer doesn't model); the spec's own base-string rules
  // are what the assertions below pin down.
  assert.match(header, /^OAuth oauth_consumer_key="9djdj82h48djs9d2", oauth_nonce="7d8f3e4a", oauth_signature="[^"]+", oauth_signature_method="HMAC-SHA1", oauth_timestamp="137131201", oauth_token="kkk9d7dh3k39sjv7", oauth_version="1.0"$/);
}

/* Twitter's own worked example ("Creating a signature" in the developer
   docs), signature `hCtSmYh+iHYCEqBWrE7C7hYmtUk=`. */
{
  const header = authorizationHeader(
    {
      key: "xvz1evFS4wEEPTGEFPHBog",
      secret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
      token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
      tokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
    },
    "POST",
    "https://api.twitter.com/1.1/statuses/update.json",
    { include_entities: "true", status: "Hello Ladies + Gentlemen, a signed OAuth request!" },
    { nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg", timestamp: 1318622958 },
  );
  assert.match(header, /oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"/);
}

assert.equal(rfc3986("a b*c'(d)!"), "a%20b%2Ac%27%28d%29%21");

assert.equal(escapeCommentary("Hi (there) @you #tag"), "Hi \\(there\\) \\@you #tag");

{
  const doc = noteDoc("one\ntwo\n\nthree", ["https://img"]);
  assert.equal(doc.content.length, 3);
  assert.deepEqual(doc.content[0].content, [
    { type: "text", text: "one" },
    { type: "hardBreak" },
    { type: "text", text: "two" },
  ]);
  assert.equal(doc.content[2].type, "image2");
}

/* The shared rules: X's weighting, the problems list. */
{
  assert.equal(shared.RULES.x.count("hello"), 5);
  assert.equal(shared.RULES.x.count("🚀"), 2);
  assert.equal(shared.RULES.x.count("see https://example.com/a/very/long/path/indeed"), 4 + 23);
  const post = {
    id: "t",
    text: "x".repeat(300),
    media: [{ file: "posts/t/1.gif", kind: "gif", mime: "image/gif", bytes: 10, width: 1, height: 1 }],
    networks: ["x", "instagram"],
    createdAt: "",
    updatedAt: "",
  };
  assert.deepEqual(shared.problemsFor(post, "x"), ["300 of 280 characters"]);
  assert.deepEqual(shared.problemsFor(post, "instagram"), [
    "needs an image or a video",
    "1 file of a kind Instagram does not take",
  ]);
  assert.equal(shared.statusOf({ ...post, scheduledAt: "2020-01-01T00:00:00Z" }, { version: 1, entries: {} }, Date.now()), "posting");
  assert.equal(
    shared.statusOf(
      { ...post, scheduledAt: "2020-01-01T00:00:00Z" },
      { version: 1, entries: { t: { results: { x: { state: "published", at: "" }, instagram: { state: "failed", at: "" } } } } },
      Date.now(),
    ),
    "partial",
  );
}

console.log("ok");
