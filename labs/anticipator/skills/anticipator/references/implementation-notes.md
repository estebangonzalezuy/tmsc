# Implementation notes

## The phase, exactly

Progress `p` is in travel units: 0 = `from`, 1 = `to`. For one unit, at
`ms` since its own start (after stagger):

```
a  = x_anticipation.amount        (0 if absent)
Ta = x_anticipation.duration_ms   (0 if absent)

ms < Ta:  p = −a · (1 − cos(π·ms/Ta)) / 2                  // wind-up, ease-in-out sine
ms ≥ Ta:  p = 1 + d(t),  t = (ms − Ta)/1000,  d(0) = −(1 + a),  d'(0) = 0
          ω0 = √(k/m),  ζ = c / (2√(k·m))
          ζ < 1: d = e^(−ζω0t) · (d0·cos ωd t + (ζω0·d0/ωd)·sin ωd t),  ωd = ω0√(1−ζ²)
          ζ = 1: d = e^(−ω0t) · d0 · (1 + ω0 t)
          ζ > 1: two real roots; see scripts/runtime/spring.js
end:      first ms after which |d| stays < rest_delta · (1 + a)
```

Every key except `opacity` and `color` is `from + (to − from) · p`, so it can go
below `from` (wind-up) and past `to` (overshoot). Clamp `blur_px` and
`scale` at 0.

Opacity has its own clock: `easeOutCubic(min(1, ms / x_opacity_duration_ms))`,
starting with the unit. Never spring opacity.

`px` values are authored for 48px type. Scale them by `fontSize / 48`.

## Stagger

`delay(i) = rank(i) · stagger_ms`, where for `n` units and `mid = (n−1)/2`:

- `normal`: `rank = i`
- `reverse`: `rank = n − 1 − i`
- `center-out`: `rank = round(|i − mid|)` (minus 1 when `n` is even, so the middle pair starts together)
- `edges-in`: `rank = round(mid) − round(|i − mid|)`

## A clip: enter → hold → exit

- enter total = `maxRank · enter.stagger_ms + unit ms`
- hold = `x_hold_ms + words · x_hold_per_word_ms`, counted **after** the enter total
- exit starts at enter total + hold, staggered with `exit.stagger_ms` (and `x_exit_stagger_mode` if set)

When a layout or loop is longer than the natural clip, stretch the **hold**,
never the springs. A slowed-down spring is a different spring.

## Determinism

The runtime in `scripts/runtime/` is closed form with no integrator, so the
frame at time `t` is a pure function of `t`. Scrubbing, rendering at any fps
and real-time playback all agree. That's what lets the Anticipator Lab
export video frame by frame and have it match the preview.
