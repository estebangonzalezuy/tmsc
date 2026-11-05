# Reference runtime

Exact, dependency-free JS for the curves in `assets/specs`. These are the same
files the Anticipator Lab and its exporter run.

```js
import { progressAt, opacityProgressAt, phaseMs } from "./phase.js";
const spec = JSON.parse(fs.readFileSync("../../assets/specs/spring-rise-letters.json"));
const total = phaseMs(spec.enter);            // one unit's enter, in ms
const p = progressAt(spec.enter, 120);        // travel at 120ms: <0 wind-up, >1 overshoot
const o = opacityProgressAt(spec.enter, 120); // opacity 0–1 on its own clock
const y = spec.enter.from.y_px + (spec.enter.to.y_px - spec.enter.from.y_px) * p;
```

Use it to drive a JS animation loop (rAF, GSAP ticker, Remotion, After Effects
expression port) when neither a native spring nor CSS `linear()` is available.
