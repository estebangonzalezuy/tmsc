import { balance } from "@/lib/tools";
import {
  GROUNDS,
  SPEC_VERSION,
  defaultLayer,
  defaultSlide,
  type PostSpec,
} from "@/lib/postlab";

/* A piece's cover: a title card.
   
   It used to be a rolled graphic with no words on it, and the words were taken
   off because a roll picks its own ground and its own ink, so nothing could
   promise the title would be readable over whatever turned up. Making the card
   *be* the title removes that problem at the root rather than working around it.

   So a cover is the club's own default register — the sheet: ruled paper, a
   neutral ground, an editorial headline, and a layer of type "none" that draws
   no graphic at all. There is nothing behind the words, which is exactly why
   they can always be read.

   Nothing on it moves, and nothing should: a printed sheet has nothing to
   animate. That is why the grid pages no longer start the shared clock. */

/* The light neutrals only. GROUNDS also carries slate and black, and a dark
   ground needs the type inverted with `theme` to stay legible — a real option,
   but one that would make some tiles read as a different kind of thing. The
   grid is calmer when every card is paper. */
const PAPERS = GROUNDS.filter((g) =>
  ["white", "paper", "ash", "cream"].includes(g.label),
);

/* FNV-1a. Its own copy rather than the one behind lib/accent.ts: sharing a hash
   would tie a piece's paper to its hover colour, and those two should be able to
   change independently. */
function seedOf(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

/* `fit` will size a headline to fill the frame but never add a break — where the
   lines fall belongs to whoever typed them. A title arrives as one sentence, so
   on a square card it would set as a single wide line with the paper empty above
   and below it. balance() places the breaks, and stands aside the moment the
   writer types one of their own.

   Two lines at most. Asked for three, balance's greedy fill leaves the first
   line an orphan — "What / motion / design actually is" — because it commits to
   a line the moment the next word passes the target. Over two lines that same
   pass reads as an editorial headline, which is the register these are in. */
function coverTitle(title: string): string {
  const len = title.trim().length;
  return len <= 13 ? title : balance(title, Math.ceil(len / 2));
}

export function coverSpec(slug: string, title: string): PostSpec {
  /* Seeded by the slug, so a piece keeps its paper between visits, between
     builds, and between the grid and the article — the same "stable, not
     shuffled" rule accentHover follows. */
  const ground = PAPERS[seedOf(slug) % PAPERS.length];

  /* The shape of the studio's own `sheet()` helper, which is module-private, so
     it is written out here from the exported defaultSlide. Everything the sheet
     doesn't need is switched off: the card is the title and the ruling, and
     nothing else competes with it. */
  const slide = defaultSlide({
    title: coverTitle(title),
    kicker: "",
    body: "",
    footer: "",
    note: "",
    letter: "",
    mark: "none",
    off: ["kicker", "tag", "body", "mark", "note", "footer", "rules", "shapes"],
    layers: [defaultLayer("none")],
    background: ground.hex,
    theme: "light",
    grid: 7,
    /* A whisper. The ruling is the paper, not a table — and it reads heavier on
       white than on ash, so it is set low enough to sit under every ground. */
    gridAlpha: 0.32,
    veil: 0,
    text: true,
    titleFont: "serif",
    titleSize: "fit",
    align: "left",
    anchor: "middle",
    margin: 112,
  });

  return { v: SPEC_VERSION, format: "square", duration: 6, slides: [slide] };
}
