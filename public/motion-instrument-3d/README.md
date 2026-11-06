# Motion Instrument 3D

A 3D mode for the Motion Instrument, beside the 2D one rather than replacing
it. The instrument becomes a device in a soft studio void. It has a step grid
with keys that sink when they sound, A–K note keys, a pixel screen, and PLAY,
REC and CLEAR buttons. Every note drops a thick, rounded word-tag into a
cluster that floats well above it. Each tag is born in the middle, shoves the
others outward, tilts and settles on springs. The active preset is a
cartridge standing in the device's slot; changing preset drops the new one in.
The theme colours the whole studio (the void, the device, the tags), not
only the device.

**This page does not reimplement the instrument.** `app.js` fetches
`../motion-instrument/index.html` and runs it unchanged inside this document.
The 2D tab is therefore the 2D file exactly as it ships, and both tabs share one
audio engine, one sequencer, one set of words and one keyboard handler. The 3D
scene only reads the 2D engine's notes (`window.MI.items`) and gives each one a
body. Edit the 2D file and the 3D mode picks the change up. It never needs
editing to support this page.

## Run

It needs a server, because it fetches the 2D file and loads an ES module.
It does not run from `file://`.

- From the repo root: `npx serve public`, then open
  `http://localhost:3000/motion-instrument-3d/`.
- Or `npx next dev` and open `/motion-instrument-3d/index.html`.
- On the deployed site it would be `/motion-instrument-3d/index.html`. Use the
  full file name, because `public/` has no directory index.
- `#2d` opens on the 2D tab. `?hero` opens with the interface hidden, as in 2D.

Desktop Chrome first. Sound starts after the first key or click (autoplay rule).

## Controls

Every 2D key works in both tabs, because they are the 2D file's own handler.

| Key | Action |
|---|---|
| `A S D F G H J K` | notes (each note drops a tag) |
| `Space` | play / stop the sequence |
| `1`–`9` `0` `-` `=` · `E` `Q` `W` | presets 01–15 |
| `O` / `T` | sound / tone |
| `L` | tempo ramp |
| `V` | variety |
| `M` | major / minor |
| `↑` / `↓` | BPM ±5 (`Shift` ±1) |
| `C` | theme. In 3D it recolours the whole scene: the background, the device and the tags. |
| `P` | 3D only: tag finish, glossy clear-coated plastic ↔ matte (a test; gloss is the default, `?matte` opens matte) |
| `X` | clear the pattern |
| `R` | record. In 2D this is the 2D recorder, unchanged. In 3D it records the WebGL canvas with the sound. |
| `U` | hide / show all chrome, including the tabs |

In 3D you can also:

- drag to orbit, scroll to zoom, and right-drag to pan;
- click a grid key, a note key, PLAY, REC or CLEAR on the device.

While the sequence plays, the camera orbits slowly. The orbit stops as soon as
you move the camera, and starts again on the next Play. **View** resets the
camera.

There is no pixel mode: the 2D file this wraps no longer has one, so `P` is
free and the 3D tab uses it for the tag finish.

## How the 3D tags move

These rules come from the 2D flow (`drawFlow` / `collideAll` in the 2D file):

- The newest tag is pinned at the cluster centre and grows on `spring(age, 18, .45)`.
- The other tags are pulled toward the centre (k = 9, damping 4.2) and pushed
  out of each other with restitution 0.32.
- Each collision adds a little spin, which springs back to level.
- On a new cycle the old pile shrinks back into the centre, from the outside in.

Two things differ, so that the cluster has volume:

- Tags are pushed apart along the line between their centres. That grows a
  round pile.
- Depth is not a collision axis. Each tag rests on a shallow dome (further
  back the further out it is), plus a seeded offset. Seen from the front it is
  the 2D pile; orbit it and it has a curve, a front and a back.

The physics runs on a fixed 1/120 s step and costs well under 1 ms per frame
with 48 tags. `MI3D.stats` reports the per-frame timings.

## Recording (R in 3D)

The recording is the WebGL canvas at window size with the sound, and nothing
else. The HUD is HTML, so it never enters the picture. It saves as `.mp4`
where the browser offers it, otherwise `.webm`, with the same codec list as the
2D recorder.

To get the sound, this page installs one small hook before the 2D script runs.
`AudioContext` is wrapped so that there is a single shared context, and its
`destination` is a gain feeding both the speakers and a `MediaStream`. The 2D
engine connects to `ac.destination` as it always did. Its own recorder is not
touched.

## Files

- `index.html` — the host page: the tabs, the HUD (neutral tool chrome) and the styles.
- `app.js` — loads the 2D instrument, the audio tap, the scene, the physics, input and recording.
- `vendor/three.js` — three.js r186.1 (MIT), bundled and minified with
  esbuild down to what `app.js` imports. `vendor/entry.js` lists those imports
  and holds the command that rebuilds the bundle.
