// Machine-readable description of the Post Lab spec, served publicly so any
// Claude session (claude.ai, Claude Code, a Notion workflow) can fetch it,
// turn a prompt or document into a PostSpec, and hand back a ready-to-open
// /postlab#spec=<base64url> link. No secrets, no state — documentation as an
// endpoint.

import { NextResponse } from "next/server";
import {
  FORMATS,
  PRESETS,
  SHADERS,
  SPEC_VERSION,
  defaultSpec,
  encodeSpec,
} from "@/lib/postlab";

export const dynamic = "force-static";

export function GET() {
  const example = defaultSpec();
  const body = {
    tool: "the Posts Studio — the Motion Social Club",
    version: SPEC_VERSION,
    about:
      "Generates the club's Instagram posts, carousels, and reels. Two registers, one spec: a sheet — ruled paper, an oval label, an editorial headline that mixes roman and italic — and the club's dithered graphics, which can be layered behind or instead of it. A PostSpec (JSON) fully describes a post. Open the tool with a spec preloaded via <site-origin>/postlab#spec=<encoded>.",
    how_to_build_a_link: [
      "1. Build a PostSpec JSON (see `spec` below; omitted fields fall back to defaults).",
      "2. Encode it as base64url of the UTF-8 JSON string (standard base64 with + -> -, / -> _, padding stripped). Node: Buffer.from(JSON.stringify(spec)).toString('base64url').",
      "3. Return <site-origin>/postlab#spec=<encoded> — opening it loads the post ready to tweak and export.",
      "Alternatively hand the raw JSON to the user; the tool's 'claude' panel has a paste-to-load box that accepts JSON, a bare encoded spec, or a full link.",
    ],
    writing_guidance: [
      "Voice: honest, human, lowercase-friendly, anti-hype. Short lines. Use \\n in titles to control line breaks.",
      "Start from the sheet, not the shader. The club's reference register is a ruled paper ground with almost nothing behind the words: `background` a neutral ground (#f4f3ef paper, #e6e5e1 ash, #fffdf0 cream, #1a1a1a slate), `grid` a column count for the hairline ruling, `veil` 0, and a single layer of type 'none'. Reach for a dithered layer when the post wants a graphic, not by default.",
      "Emphasis is markup inside the headline: `*a run like this*` switches that run to the other voice — italic in a roman headline, roman in an italic one. Mixing the two mid-sentence (\"What the club *saved for later* in August\") is the club's editorial move; use it on one phrase, not on every other word.",
      "`tag` is a short label in an outlined oval above the headline — an issue number, a date, a chapter ('08/26', '01'). `note` is a small label in the top-right corner — a handle, a source, a credit; it takes the circled mark's slot while it's there. `anchor` ('top' | 'middle' | 'bottom', default middle) is where the headline block sits.",
      "Design is black & white by default. Colour is set per layer, with `ink`: a hex for one flat colour, \"mix\" to scatter the club palette across the pixels, or leave it out for the theme's ink (the black-and-white default, and the right answer unless colour was asked for). The club palette is periwinkle, green, black, white, orange red, indigo, cream; a slide can override it wholesale with `palette`, and can set its own `background` hex.",
      "A \"mix\" layer has four optional dials, all of which can be left out: `inks` (array of hexes — the subset of the palette this layer may use, so one layer can hold three colours and another the rest), `mixMode` (blocks|bands|radial|source|noise — how colour is handed out across the pixels; 'source' makes colour follow the shape's own shading), `mixScale` (1-12, how big one patch of colour is), and `mixSpeed` (0-3, how fast colour travels through the list; 0 freezes it). `colorSeed` on the slide decides which colour starts where.",
      "The older `color: true` switch still works and is read as \"put the palette on every layer\"; new specs should set `ink` per layer instead.",
      "The Post Lab is a dithering instrument — every background is dithered pixels in the slide's two tones. 'dithering' (Paper Shaders) has shapes simplex|warp|dots|wave|ripple|swirl|sphere and dither matrices 4x4|8x8|2x2|random. 'forms' (canvas ordered-dither) adds shapes the shader lacks: rings|ramp|bars|letter (giant dithered type from a club word)|spiral|grid|blobs|tunnel|noise|moire, with `warp` (0-1) bending the source through a flow field. Older type names from previous spec versions are auto-mapped to their closest dithering equivalent.",
      "Forms combine. A 'forms' layer can name a second shape in `pattern2` and fold it into the first with `mix` (add|sub|mul|diff|max|min; 'solo' ignores it), and mirror the result with `fold` (x|y|quad|radial). Both sources are mixed as grayscale and dithered once, so the output is still hard-edged pixels — that is the rule the tool keeps. `dtype` picks the screen: 4x4|8x8|2x2 ordered matrices, 'lines' for an engraving screen, 'noise' for a grainy one. Combining is where the interesting backgrounds are: moire + rings on diff, grid + blobs on mul, letter + noise on sub.",
      "What's on a slide is switchable without deleting the words. `off` is an array of parts to leave out: kicker, title, body, mark, footer, rules ('rules' is the two decorative lines — the underline under the kicker and the hairline above the footer). Omit it for everything on. Only a headline is off: ['kicker','body','mark','footer','rules']; only the circled mark is the same list with 'title' instead of 'mark'.",
      "The top-right circle is set by `mark`: 'auto' (the default) makes it the page number on a carousel and the `letter` on a single post; 'letter', 'page' and 'none' say so outright. When it shows the page, the footer drops its counter so the number isn't said twice.",
      "A photograph is a form. Set a forms layer's `pattern` (or `pattern2`) to \"photo\" and give the layer a `src`: a path on this site (\"/stills/x.jpg\") travels in the link; \"local:<id>\" is a file the owner picked, which lives in that one browser. The picture is sampled at the dither cell size and thresholded like every other form, so it can be mixed, folded, screened and inked exactly the same way. `exposure` (0.2-2.5) is gamma on the picture before the threshold — the knob that decides how much of it survives; `fit` is \"cover\" (default) or \"contain\". Never invent a `src`: without a real one the layer draws nothing.",
      "Headlines: `titleSize` is 's' | 'm' | 'l' | 'fit'. 'fit' grows the headline until it fills the frame inside the margin, so short copy comes out enormous and long copy comes out smaller and neither ever overflows — use it for poster-like slides and keep the copy short. `titleWeight` (100-900, capped at 700 for the serif and 400 for the gothic) and `margin` (24-240, default 96) are both optional.",
      "Parameters can travel instead of holding still. A 'forms' layer may carry `motion`: { \"<param>\": { \"to\": <number>, \"wave\": \"sin\"|\"tri\"|\"saw\"|\"square\", \"cycles\": <whole number 1-8>, \"phase\": 0-1 } }. The parameter's own value is where the trip starts and `to` is where it goes; `cycles` is trips per loop and is forced to a whole number, which is what keeps the post seamless. Animatable: every numeric parameter of the layer plus offsetX, offsetY, scale, rotation. This is the single biggest difference between a background that reads as a pattern and one that reads as motion — a drifting `density` or `warp` is usually enough.",
      "Looping: the club's own 'forms' renderer always returns to its first frame at the end of the post, so an exported reel loops. The WebGL 'dithering' shader does not, except for shape 'swirl' (which ignores time) or speed 0 — a clip containing any other dithering shape has a visible jump. Prefer 'forms' for anything that will be posted as a loop.",
      "Instant zero-AI links also work: /postlab?title=...&body=...&kicker=...&format=square|portrait|story|landscape&theme=dark&shape=sphere — '//' in title/body becomes a line break. Use the encoded #spec= form when you need carousels or fine control.",
      "Carousels: first slide is the hook (often dark theme), one idea per slide, keep body text to one or two sentences.",
      "Reels: format 'story', one slide, duration 6-10s, pick an animated background — generative ones loop perfectly.",
    ],
    spec: {
      v: SPEC_VERSION,
      format: {
        options: Object.fromEntries(
          Object.entries(FORMATS).map(([k, f]) => [
            k,
            `${f.w}x${f.h} — ${f.hint}`,
          ]),
        ),
        default: "portrait",
      },
      duration: "seconds of video recorded for reels (2-15, default 6)",
      slides: {
        about: "1-10 slides; more than one makes a carousel",
        fields: {
          kicker: "small underlined label, top left (string)",
          title:
            "headline; \\n breaks a line, and *a run in asterisks* flips to the other voice — italic in a roman headline, roman in an italic one (string)",
          tag: "optional short label in an outlined oval above the headline — an issue number, a date, a chapter ('08/26')",
          note: "optional small label top right — a handle, a source, a credit. It takes the circled mark's slot while it's set.",
          grid: "optional number 2-24 — columns of a hairline grid ruled over the whole frame, in square cells. Omit for no grid. This is the reference register's signature: 6-8 columns on a paper ground.",
          gridAlpha: "optional number 0-1 (default 0.16) — how present the ruling is",
          gridTop:
            "optional boolean — draw the ruling over the type instead of under it, so the sheet's lines cross the words (the technical-drawing look)",
          anchor:
            "optional 'top' | 'middle' (default) | 'bottom' — where the headline block sits in the frame",
          body: "supporting paragraph under the title (string, optional)",
          footer: "bottom-left line, default '@themotionsocialclub'",
          letter: "single character drawn as a circled letter top right; '' hides it",
          mark: "'auto' (default) | 'letter' | 'page' | 'none' — what the top-right circle is. Auto is the page number on a carousel, the letter on a single post.",
          off: "optional array of parts to leave out: 'kicker' | 'tag' | 'title' | 'body' | 'mark' | 'note' | 'footer' | 'rules'. The words stay in the spec, so a part switched back on brings its text with it.",
          text: "boolean (default true) — false hides the whole typographic layer for a pure background slide",
          titleFont:
            "'serif' (Lora, editorial) | 'sans' (Archivo, poster) | 'gothic' (Pirata One, blackletter)",
          italic: "boolean, serif italic is the club's emphasis voice",
          titleSize:
            "'s' | 'm' | 'l' | 'fit' — 'fit' grows the headline to fill the frame inside the margin, whatever the length",
          titleWeight:
            "optional number 100-900 on the variable fonts (serif caps at 700, gothic at 400). Omit for each family's usual weight.",
          margin:
            "optional number 24-240 (default 96) — the frame's breathing room, in design units at 1080 wide",
          boxed: "boolean — outlined box around the headline (poster motif)",
          plate: "boolean — filled background behind the headline, guarantees legibility over busy shaders",
          align: "'left' | 'center'",
          ring: "boolean — orbit ring of circled letters behind the text",
          color:
            "boolean (default false) — paint the dithered pixels from the club palette instead of the two theme tones. The canvas 'forms' renderer colours pixel by pixel; the WebGL 'dithering' shader has only two tones, so it takes a single palette colour for the whole layer.",
          colorSeed:
            "number (default 1) — which colours land where. Change it to re-roll; the same seed always renders the same post.",
          palette:
            "optional array of hex strings — overrides the club palette for this slide only. Leave it out (the normal case) and the slide follows the palette in the code, so changing the club's colours restyles every post that never overrode them.",
          veil: "number 0-0.9 — background-colored wash dimming the background (default 0.25); raise it when text sits on dense patterns",
          titlePixel:
            "number 0-32 (default 0) — ordered-dithers the title glyphs into sharp binary ink/transparent blocks at this cell size (px); 0 is off, the crisp default. Same Bayer-threshold technique as the dithering shapes, applied to rendered type — no gray, no gradient, hard edges.",
          metaPixel:
            "number 0-32 (default 0) — the same dithering, sized independently, applied to every other glyph: kicker, letter mark, body, footer, and the ring's circled letters.",
          theme: "'light' (white bg, black ink) | 'dark' (inverted)",
          layers:
            "array of 1-4 background layers, bottom first. Each layer is { type, ...params } (see backgrounds below) plus: opacity (0-1, default 1), blend ('normal'|'multiply'|'screen'|'overlay'|'darken'|'lighten'|'difference'|'exclusion', default 'normal'), offsetX/offsetY (-1..1 position, default 0), rotation (degrees, default 0), scale (0.1-4, default per type). Layers render on transparent canvases, so they already combine without a blend mode; reach for one when you want them to interact. Stacking a fine dithering over a large form is the tool's signature look.",
          "layers[].ink":
            "colour for this layer's pixels: a hex, or \"mix\" for the palette scattered across them. Omit for the theme's ink (black or white) — the default.",
          "layers[].inks":
            "only with ink:\"mix\" — array of hexes this layer may use, a subset of the palette. Omit for all of them.",
          "layers[].mixMode":
            "only with ink:\"mix\" — 'blocks' (default, a mosaic) | 'bands' | 'radial' | 'source' (colour follows the shape's shading) | 'noise' (pixel by pixel).",
          "layers[].mixScale":
            "only with ink:\"mix\" — 1-12 (default 3), the size in dither cells of one patch of colour.",
          "layers[].mixSpeed":
            "only with ink:\"mix\" — 0-3 (default 1), how fast colour travels through the list, as a multiple of the layer's speed. 0 holds it still.",
          "layers[].src":
            "only with pattern 'photo' — a path on this site, or 'local:<id>' for a file kept in the owner's browser. Don't invent one.",
          "layers[].fit": "only with pattern 'photo' — 'cover' (default) | 'contain'",
          "layers[].motion":
            "only on 'forms' layers — parameters that travel over the loop instead of holding still, keyed by parameter name: { \"density\": { \"to\": 18, \"wave\": \"sin\", \"cycles\": 2 } }. See the motion note in writing_guidance.",
          shader:
            "deprecated v1 field — a single { type, ...params }; still accepted and lifted into layers[0]",
        },
      },
      shaders: SHADERS.map((s) => ({
        type: s.type,
        label: s.label,
        kind: s.kind,
        animated: s.animated,
        params: Object.fromEntries([
          ...s.controls.map((c) => [
            c.key,
            `number ${c.min}-${c.max} (default ${c.def})`,
          ]),
          ...(s.choices ?? []).map((c) => [
            c.key,
            /* The "keep" clause is the odds a random roll should leave this
               one alone. The combining choices are off by default, and
               anything rolling all of them at once only ever makes mush. */
            `one of ${c.values.join(" | ")} (default ${c.def}` +
              (c.keepDefault ? `, keep ${Math.round(c.keepDefault * 100)}%)` : ")"),
          ]),
        ]),
      })),
    },
    example: {
      spec: example,
      encoded: encodeSpec(example),
      link: "/postlab#spec=" + encodeSpec(example),
    },
    presets: PRESETS.map((p) => ({ name: p.name, about: p.about, spec: p.spec })),
  };

  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
