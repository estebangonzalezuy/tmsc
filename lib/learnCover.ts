import {
  SPEC_VERSION,
  applyStyle,
  defaultSlide,
  randomSlide,
  type PostSpec,
} from "@/lib/postlab";

/* A piece's cover.
   
   The club has no photography and should not start collecting any. What it has
   is four studios and one renderer, and /tools already draws a wall of live
   posters with it. So a cover is a rolled Posts Studio sheet carrying the
   piece's own title.

   It is rolled from the slug, not from Math.random, so a piece keeps the same
   cover between visits, between builds, and between the grid and the article —
   the same "stable, not shuffled" rule accentHover follows. A cover that
   reshuffled on every render would make the library feel like a slot machine. */

/* FNV-1a. Its own copy rather than the one behind lib/accent.ts: sharing a hash
   would tie a piece's cover to its hover colour, and those two should be able to
   change independently. */
function seedOf(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

/* mulberry32: small, fast, and deterministic from one 32-bit seed, which is all
   a roll needs. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function coverSpec(slug: string, title: string): PostSpec {
  /* A cover carries no words.

     It used to set the title into the sheet, and that was wrong twice over. The
     card already prints the title underneath, on white, where it is legible — so
     the cover was saying it a second time. And a rolled look decides its own
     ground and its own ink, which means nothing can promise the type will be
     readable against it. The club's rule is that a roll decides the graphic
     only, because whether the words can be read is not the dice's call. Turning
     the type off honours that rule instead of fighting it with a scrim.

     The ruling stays: it belongs to the paper rather than to the type, so a
     cover is still a sheet and not just a texture. */
  let style = randomSlide(rng(seedOf(slug)));

  /* Skip the Kinetics looks. They draw the slide's headline as the picture,
     which is a lovely thing on a post and the one thing a wordless cover cannot
     have — it would put the title back, at whatever contrast the roll chose.
     Re-roll rather than special-case: eight tries is plenty, and the seed still
     comes from the slug, so a piece keeps one cover forever. */
  for (let i = 1; i <= 8 && style.layers.some((l) => l.type === "kinetics"); i++) {
    style = randomSlide(rng(seedOf(`${slug}#${i}`)));
  }

  const slide = applyStyle(
    defaultSlide({ title, kicker: "", body: "", footer: "", letter: "" }),
    style,
  );

  slide.text = false;

  return { v: SPEC_VERSION, format: "square", duration: 6, slides: [slide] };
}
