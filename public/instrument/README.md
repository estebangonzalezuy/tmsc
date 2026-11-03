# Motion instrument

A keyboard you play the club's words with. Eight keys, eight scale degrees,
eight words, each with its own entrance — press a note and its word arrives,
in the club's colours, through the same level-2 pixel bleed the posts use.
A small step sequencer loops a pattern, and the whole thing (picture and
sound) records to `.webm`.

Like Frames, it lives beside the site, not in it: one self-contained
`index.html`, no Next, React, Tailwind, build step or dependency. Archivo
Narrow (400 and 700, OFL) is embedded as base64 so it works offline; if the
font fails to load the page says so on screen rather than falling back
silently.

Open it two ways. Double-click `index.html` in this folder, or reach the
deployed copy at `/instrument/index.html` — `public/` is served verbatim and
does no directory-index resolution, so `/instrument/` alone has no page. It is
unlisted, not protected, the way Frames, the Studio and the Desk are.

## Keys

| key            | does                                         |
| -------------- | -------------------------------------------- |
| A S D F G H J K | play a note (and its word)                  |
| Space          | play / pause the sequencer                   |
| M              | major ↔ minor (snappy ↔ heavy, with gravity) |
| ↑ ↓            | tempo ±5 BPM (Shift: ±1)                      |
| C              | next colour pair                             |
| P              | pixel bleed on / off                         |
| X              | clear the pattern                            |
| R              | start / stop recording (downloads a .webm)   |
| click the grid | toggle a step (top right; low notes at the bottom) |

## The voices

| key | word   | motion  |
| --- | ------ | ------- |
| A   | MOTION | pop     |
| S   | SOCIAL | slide in from the left |
| D   | CLUB   | drop    |
| F   | HUMAN  | slide in from the right |
| G   | +      | spin    |
| H   | TOOL   | rise    |
| J   | PLAY   | stack of three |
| K   | LOOP   | letters split apart and close |

Overlapping words are drawn with `xor`, so they knock each other out and the
picture stays two colours. `window.MI` exposes the state for tests.

## Unlike Frames

Frames is a pure function of loop progress, so its exports are frame-exact.
The instrument is live: it records the canvas with `captureStream` and
MediaRecorder in real time, because the performance *is* the piece. Don't
expect two recordings to match.
