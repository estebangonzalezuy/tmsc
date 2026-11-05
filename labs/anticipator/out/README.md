# out/

Rendered demos. Every file here is generated. Regenerate with:

```bash
npm run export -- springs-side-by-side tmsc-timeline --verify
```

| File | What | Source |
| --- | --- | --- |
| `springs-side-by-side.{mp4,webm,png}` | 1920×1080 @ 60fps, 9.8s. Same specs, two runtimes: the familiar back-out bezier `cubic-bezier(0.34, 1.56, 0.64, 1)` (left) vs real spring + anticipation (right), three rounds: pop, heavy drop, energetic ring. | `projects/springs-side-by-side.json` |
| `tmsc-timeline.{mp4,webm,png}` | 1080×1080 @ 30fps, 11s. A short tMSC title sequence on the acid/ink pair, five clips from the catalog. | `projects/tmsc-timeline.json` |

How it's made: `scripts/export-video.mjs` starts the app's Vite server, opens
the `#render` route in headless Chromium, calls `renderAt(i / fps)` for every
frame (the same `renderProject` the editor preview uses), saves PNGs to
`out/frames/<name>/` (git-ignored, deleted after encoding unless
`--keep-frames`), and encodes H.264 (yuv420p, CRF 18) and VP9 with ffmpeg.
`--verify` re-renders sample frames and fails if any byte differs.

The editor's **Export WebM** button is the quick path: same renderer,
MediaRecorder, real-time paced. Use the CLI for anything you'll post.
