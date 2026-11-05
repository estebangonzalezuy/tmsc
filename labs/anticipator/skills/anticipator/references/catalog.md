# Catalog

10 specs. Built on [Pixel Point's animate-text](https://github.com/pixel-point/animate-text) spec format.

| id | name | target | intent | ζ | overshoot | wind-up | unit ms | fallback max error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `anticipate-pop-words` | Anticipate Pop Words | per-word | playful | 0.39 | 26.3% | 15% / 140ms | 1135 | 0.418 |
| `anticipate-pop-words-calm` | Anticipate Pop Words, Calm | per-word | calm | 0.91 | 0.1% | 5% / 160ms | 679 | 0.0388 |
| `anticipate-pop-words-energetic` | Anticipate Pop Words, Energetic | per-word | energetic | 0.32 | 34.4% | 22% / 90ms | 932 | 0.6216 |
| `spring-rise-letters` | Spring Rise Letters | per-character | precise | 0.56 | 12.1% | 12% / 120ms | 899 | 0.1977 |
| `spring-rise-letters-calm` | Spring Rise Letters, Calm | per-character | calm | 1.00 | 0.0% | none | 854 | 0.0238 |
| `spring-rise-letters-energetic` | Spring Rise Letters, Energetic | per-character | energetic | 0.39 | 25.9% | 15% / 70ms | 846 | 0.4946 |
| `heavy-drop-lines` | Heavy Drop Lines | per-line | heavy | 0.55 | 12.4% | 10% / 160ms | 1554 | 0.197 |
| `weight-wave-letters` | Weight Wave Letters | per-character | editorial | 0.67 | 5.8% | 6% / 90ms | 864 | 0.0869 |
| `hold-aware-rise` | Hold-Aware Rise | per-word | editorial | 0.56 | 12.1% | 12% / 120ms | 899 | 0.1977 |
| `heavy-drop-lines-calm` | Heavy Drop Lines, Calm | per-line | calm | 1.02 | 0.0% | 4% / 160ms | 1596 | 0.0229 |

## Descriptions

- **`anticipate-pop-words`**: Each word squashes smaller first (anticipation), then pops on an underdamped spring. *Per-word only; per-character at ζ 0.39 reads as jitter. Short phrases (2–5 words). Keep x_opacity_duration_ms short (≤ ~180ms) or the squash happens while the word is still invisible. Pixel Point's equivalent 'spring' is cubic-bezier(0.34, 1.56, 0.64, 1): one fake overshoot; the Lab shows it on the left.*
- **`anticipate-pop-words-calm`**: The same pop, near-critically damped with a barely-there squash: care, not a joke. *Variant of anticipate-pop-words: same from/to, only the physics changes.*
- **`anticipate-pop-words-energetic`**: The same pop, stiff and loose with a deep squash: it lands on the beat and rings. *Variant of anticipate-pop-words. Two bounces: the bezier fallback can only show one (see x_fallback.max_error).*
- **`spring-rise-letters`**: Letters dip, then rise from below on a lively spring and land with a small overshoot. *Headlines 40px+. Base of the calm/energetic variants (same from/to). Below ~20ms stagger the staircase flattens.*
- **`spring-rise-letters-calm`**: The same rise, critically damped: no wind-up, no overshoot, letters arrive and stay. *Variant of spring-rise-letters. ζ = 1 is the fastest arrival without passing the target; the bezier fallback is almost exact.*
- **`spring-rise-letters-energetic`**: The same rise, stiff and under-damped with a quick dip: letters snap up and ring. *Variant of spring-rise-letters. ζ ≈ 0.39 rings twice: prefer x_spring or x_css_linear over the bezier fallback.*
- **`heavy-drop-lines`**: Whole lines lift, then drop in from above with real mass and a short, heavy settle. *Two or three short lines. mass 2.2 is the point: raising stiffness instead keeps the duration but loses the weight. Exits fall away, with gravity.*
- **`weight-wave-letters`**: Letters swell from hairline (wght 100) to heavy (800) on a spring, rippling out from the centre. *Needs a variable font whose wght axis spans 100–800; the lab uses Archivo (wght 100–900, condensed), so this is real, not a stub. A runtime that ignores x_font_weight still plays the fade + rise. Overshoot pushes weight briefly past 800. Layout is measured at the final weight.*
- **`hold-aware-rise`**: A firm per-word rise that declares how long the copy must stay up to be read before anything exits. *Hold = enter.x_hold_ms + words × enter.x_hold_per_word_ms, counted from the moment the last word settles. Never start the exit sooner to fit a loop: lengthen the loop. 250ms/word suits short display copy; 300+ for body-like lines.*
- **`heavy-drop-lines-calm`**: Whole lines lift, then drop in from above with real mass and a short, heavy settle. *Two or three short lines. mass 2.2 is the point: raising stiffness instead keeps the duration but loses the weight. Exits fall away, with gravity.*
