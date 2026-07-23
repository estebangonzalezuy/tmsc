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
    tool: "the Post Lab — the Motion Social Club",
    version: SPEC_VERSION,
    about:
      "Generates the club's animated Instagram posts, carousels, and reels: grayscale shader backgrounds with the club's typography. A PostSpec (JSON) fully describes a post. Open the tool with a spec preloaded via <site-origin>/postlab#spec=<encoded>.",
    how_to_build_a_link: [
      "1. Build a PostSpec JSON (see `spec` below; omitted fields fall back to defaults).",
      "2. Encode it as base64url of the UTF-8 JSON string (standard base64 with + -> -, / -> _, padding stripped). Node: Buffer.from(JSON.stringify(spec)).toString('base64url').",
      "3. Return <site-origin>/postlab#spec=<encoded> — opening it loads the post ready to tweak and export.",
      "Alternatively hand the raw JSON to the user; the tool's 'claude' panel has a paste-to-load box that accepts JSON, a bare encoded spec, or a full link.",
    ],
    writing_guidance: [
      "Voice: honest, human, lowercase-friendly, anti-hype. Short lines. Use \\n in titles to control line breaks.",
      "Design is strictly black & white — there are no color options by design.",
      "The Post Lab is a dithering instrument — every background is dithered pixels in the slide's two tones. 'dithering' (Paper Shaders) has shapes simplex|warp|dots|wave|ripple|swirl|sphere and dither matrices 4x4|8x8|2x2|random. 'forms' (canvas ordered-dither) adds patterns the shader lacks: rings|ramp|bars|letter (giant dithered type from a club word), with `warp` (0-1) bending the source through a flow field. Older type names from previous spec versions are auto-mapped to their closest dithering equivalent.",
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
          title: "headline; supports \\n for manual line breaks (string)",
          body: "supporting paragraph under the title (string, optional)",
          footer: "bottom-left line, default '@themotionsocialclub'",
          letter: "single character drawn as a circled letter top right; '' hides it",
          text: "boolean (default true) — false hides the whole typographic layer for a pure background slide",
          titleFont: "'serif' (Lora, editorial) | 'sans' (Archivo, poster)",
          italic: "boolean, serif italic is the club's emphasis voice",
          titleSize: "'s' | 'm' | 'l'",
          boxed: "boolean — outlined box around the headline (poster motif)",
          plate: "boolean — filled background behind the headline, guarantees legibility over busy shaders",
          align: "'left' | 'center'",
          ring: "boolean — orbit ring of circled letters behind the text",
          veil: "number 0-0.9 — background-colored wash dimming the background (default 0.25); raise it when text sits on dense patterns",
          theme: "'light' (white bg, black ink) | 'dark' (inverted)",
          layers:
            "array of 1-4 background layers, bottom first. Each layer is { type, ...params } (see backgrounds below) plus: opacity (0-1, default 1), blend ('normal'|'multiply'|'screen'|'overlay'|'darken'|'lighten'|'difference'|'exclusion', default 'normal'), offsetX/offsetY (-1..1 position, default 0), rotation (degrees, default 0), scale (0.1-4, default per type). Blending a texture over a gradient (e.g. mesh + dithering multiplied on top) is the tool's signature look.",
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
            `one of ${c.values.join(" | ")} (default ${c.def})`,
          ]),
        ]),
      })),
    },
    example: {
      spec: example,
      encoded: encodeSpec(example),
      link: "/postlab#spec=" + encodeSpec(example),
    },
    presets: PRESETS.map((p) => ({ name: p.name, spec: p.spec })),
  };

  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
