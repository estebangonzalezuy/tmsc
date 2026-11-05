# Anticipator spec format

One JSON file per effect in `specs/<id>.json`. The format has two layers:

1. **The compatible core.** It uses the same field names and frame keys as
   Pixel Point's [animate-text](https://github.com/pixel-point/animate-text)
   portable specs, so a runtime written for animate-text can play any
   Anticipator spec as-is.
2. **`x_*` extensions.** Real spring physics, anticipation, an independent
   opacity clock, reading time and intent. Every extension is optional and
   prefixed `x_`. A runtime that ignores `x_*` still plays a correct, slightly
   less physical version of the effect, using the `easing` + `duration_ms`
   that `npm run fit:catalog` fitted to the spring.

`npm run validate:catalog` enforces everything below and exits non-zero on
the first broken spec.

## Compatible core

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | kebab-case, same as the file name |
| `display_name` | string | yes | |
| `description` | string | yes | one sentence |
| `inspiration` | string | no | where the motion comes from |
| `target` | enum | yes | `whole`, `per-character`, `per-word`, `per-line` |
| `signature_easing` | string | yes | the dominant CSS easing (the fitted enter fallback) |
| `enter` | phase | yes | see below |
| `exit` | phase | yes | see below |
| `swap` | object | no | `mode` (`crossfade` / `sequential` / `morph`), `overlap_ms`, `micro_delay_ms` |
| `stagger_mode` | enum | no | `normal` (default), `center-out`, `edges-in`, `reverse` |
| `usage_notes` | string | yes | how to use it and what to avoid |

### Phase (`enter` / `exit`)

| Field | Type | Notes |
| --- | --- | --- |
| `duration_ms` | number > 0 | length of one unit's animation |
| `stagger_ms` | number ≥ 0 | delay between consecutive units |
| `easing` | CSS easing | `cubic-bezier(x1, y1, x2, y2)` (x in [0,1], y free), a keyword, or `linear(...)` |
| `from` / `to` | frame | endpoints |

### Frame keys

`opacity`, `x_px`, `y_px`, `z_px`, `scale`, `rotate_deg`, `rotate_x_deg`,
`rotate_y_deg`, `blur_px`, `letter_spacing_em`, `color`. Plus one extension:

| Key | Notes |
| --- | --- |
| `x_font_weight` | variable-font `wght` (e.g. 100 → 800). Needs a variable font; the lab uses Archivo (wght 100–900). Runtimes that ignore it keep the rest of the frame. |

`px` values are authored for **48px type**. The lab scales them with font
size (`value × fontPx / 48`), so a 14px rise on a 48px label becomes 35px on a
120px headline. Other runtimes may do the same.

## Extensions

### Phase extensions

```json
"enter": {
  "duration_ms": 729,
  "stagger_ms": 70,
  "easing": "cubic-bezier(0.378, -0.4, 0, 1.652)",
  "from": { "opacity": 0, "scale": 0.6, "y_px": 14 },
  "to":   { "opacity": 1, "scale": 1,   "y_px": 0 },
  "x_spring": { "stiffness": 320, "damping": 14, "mass": 1, "velocity": 0, "rest_delta": 0.001 },
  "x_anticipation": { "duration_ms": 140, "amount": 0.15, "easing": "cubic-bezier(0.45, 0, 0.55, 1)" },
  "x_opacity_duration_ms": 160,
  "x_hold_ms": 900,
  "x_hold_per_word_ms": 180,
  "x_fallback": { "fitted_from": "9f3c1a2b", "rms_error": 0.11, "max_error": 0.22, "spring_phase_ms": 729 }
}
```

| Field | Notes |
| --- | --- |
| `x_spring.stiffness` | k > 0. Higher is faster. |
| `x_spring.damping` | c ≥ 0. Higher means less bounce. |
| `x_spring.mass` | m > 0. Higher is heavier: slower, and it carries through. |
| `x_spring.velocity` | initial velocity when the spring releases, in travel units per second (default 0). Positive pushes toward `to`. |
| `x_spring.rest_delta` | settle tolerance as a fraction of travel (default `0.001`). Decides when the phase ends. |
| `x_anticipation.amount` | wind-up away from the target as a fraction of travel (0–0.6). `0.18` on a 14px rise first dips 2.5px the other way. |
| `x_anticipation.duration_ms` | how long the wind-up takes, before the spring releases. |
| `x_anticipation.easing` | easing of the wind-up (default `cubic-bezier(0.45, 0, 0.55, 1)`). |
| `x_hold_ms` | (enter only) minimum time the fully-entered text stays before the exit starts. Default 1200. |
| `x_hold_per_word_ms` | (enter only) added per word: hold = `x_hold_ms + words × x_hold_per_word_ms`. |
| `x_opacity_duration_ms` | opacity runs on its own ease-out clock of this length, starting with the unit. Opacity never springs, and a short value keeps the anticipation visible. |
| `x_fallback` | **generated** by `fit:catalog`. `fitted_from` is a hash of `x_spring` + `x_anticipation`. The validator fails when the physics changed and the fallback wasn't re-fitted. `max_error` says how far the bezier strays from the spring, in travel units. A cubic-bezier can hold one dip and one overshoot but not a second bounce. |

Damping ratio, the number the lab shows live:

```
ζ = damping / (2 · √(stiffness · mass))
ζ < 1 overshoots · ζ = 1 critical (fastest with no overshoot) · ζ > 1 creeps
```

**How a spring phase plays:** progress `p` runs in travel units (0 = `from`,
1 = `to`). During the wind-up, `p = −amount · easing(t / duration)`. Then
the spring `F = −k(x − 1) − c·v`, `a = F/m` runs from `p = −amount` with
initial velocity `velocity` towards `p = 1` until it stays within `rest_delta`.
The runtime solves it in closed form, which is the exact integral of that
ODE (`core/spring.test.ts` checks it against step integration). That makes
it deterministic in `t`. Every key except
`opacity` and `color` follows `p`, so `scale` pinches, `y_px` dips and
`blur_px` clamps at 0.

### Spec extensions

| Field | Notes |
| --- | --- |
| `x_intent` | `calm`, `energetic`, `heavy`, `playful`, `precise`, `editorial`. The character, in words. |
| `x_intent_notes` | one line on what that intent means for this spec |
| `x_variant_of` | id of the base effect when this spec only changes the physics (same `from`/`to`) |
| `x_exit_stagger_mode` | stagger order for the exit if it differs from `stagger_mode` |
| `x_built_on` | always `"pixel-point/animate-text"`. Credit travels with the file. |

### Generated only (in `skills/anticipator/assets/specs/`)

`generate:skill` adds `x_css_linear` to each spring phase. It is the exact
spring sampled into a CSS `linear()` easing over `duration_ms`. Use it where
`linear()` is supported (Chrome 113+, Safari 17.2+, Firefox 112+) for a
1:1 spring with no JS. These fields are never written into `catalog/`.

## catalog.json

```json
{
  "visible_ids": ["anticipate-pop-words", "..."],
  "groups": { "seed": ["..."], "variants": ["..."] }
}
```

Every id in `visible_ids` must have a spec file, and every spec file must be
listed. `groups` is presentation only.
