# Catalog

9 specs. Built on [Pixel Point's animate-text](https://github.com/pixel-point/animate-text) spec format.

| id | name | target | intent | ζ | overshoot | wind-up | unit ms | fallback max error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `anticipate-pop-words` | Anticipate Pop Words | per-word | playful | 0.54 | 13.6% | 18% / 110ms | 729 | 0.2292 |
| `spring-rise-letters` | Spring Rise Letters | per-character | precise | 0.74 | 3.0% | 8% / 80ms | 573 | 0.0318 |
| `spring-rise-letters-calm` | Spring Rise Letters, Calm | per-character | calm | 1.00 | 0.0% | none | 854 | 0.0238 |
| `spring-rise-letters-energetic` | Spring Rise Letters, Energetic | per-character | energetic | 0.39 | 25.9% | 12% / 70ms | 846 | 0.4679 |
| `heavy-drop-lines` | Heavy Drop Lines | per-line | heavy | 0.67 | 6.0% | 10% / 160ms | 1198 | 0.0933 |
| `weight-wave-letters` | Weight Wave Letters | per-character | editorial | 0.67 | 5.8% | 6% / 90ms | 864 | 0.0867 |
| `hold-aware-rise` | Hold-Aware Rise | per-word | editorial | 0.88 | 0.3% | 5% / 80ms | 668 | 0.0245 |
| `anticipate-pop-words-calm` | Anticipate Pop Words, Calm | per-word | calm | 0.93 | 0.0% | 6% / 120ms | 549 | 0.0329 |
| `anticipate-pop-words-energetic` | Anticipate Pop Words, Energetic | per-word | energetic | 0.36 | 29.9% | 22% / 80ms | 767 | 0.5924 |

## Descriptions

- **`anticipate-pop-words`**: Each word pinches down a hair, then pops past full size and settles: a cartoon wind-up on a real spring. *Per-word only: per-character at this bounce reads as jitter. Keep phrases short (2–5 words). The anticipation is what sells it, so if opacity_duration grows past ~180ms the wind-up happens while the word is still invisible and the effect collapses into a plain pop.*
- **`spring-rise-letters`**: Letters rise from below on a firm spring with a short dip first, and land with a single small overshoot. *Headlines 40px and up. Base effect for the calm/energetic variants, which share its from/to and change only the physics. Below ~20ms stagger the staircase flattens into a block.*
- **`spring-rise-letters-calm`**: The same rise, critically damped and unhurried: no overshoot, no wind-up, letters arrive and stay. *Variant of spring-rise-letters (same from/to). ζ = 1.0 is the fastest a spring can arrive without passing its target. The bezier fallback is almost exact here (one smooth curve).*
- **`spring-rise-letters-energetic`**: The same rise, stiff and under-damped with a quick wind-up: letters snap up, overshoot and ring once. *Variant of spring-rise-letters (same from/to). ζ ≈ 0.39 rings twice; a cubic-bezier can only show one overshoot, so the fallback's max_error is large. Prefer x_spring or x_css_linear wherever the runtime allows.*
- **`heavy-drop-lines`**: Whole lines drop in from above with real mass: they lift first, fall, and land with a short, heavy settle. *Two or three short lines. mass 3 is the point: raising stiffness to compensate keeps the duration but loses the heaviness. Exits fall down (away), same direction as gravity.*
- **`weight-wave-letters`**: Letters swell from hairline to heavy on a spring, rippling through the word, with a small rise underneath. *Needs a variable font with a wght axis spanning 100–800 (the lab uses Archivo, wght 100–900, condensed). Without one, a runtime that ignores x_font_weight still plays the fade + rise, which is the honest fallback. The overshoot pushes weight briefly past 800 (still inside Archivo's 900). Layout is measured at the final weight, so letters breathe inside their own slot rather than reflowing.*
- **`hold-aware-rise`**: A firm per-word rise that declares how long the copy must stay on screen to be read before anything exits. *Hold = x_hold_ms + words × x_hold_per_word_ms, counted from the end of the enter (last word settled), not its start. An agent cycling phrases must not start the exit sooner, even if the surrounding loop is shorter: lengthen the loop instead. 250ms/word is a comfortable reading pace for short display copy; 300+ for body-like lines.*
- **`anticipate-pop-words-calm`**: The pop with the cartoon taken out: a barely-there pinch, a near-critical spring, no second ring. *Variant of anticipate-pop-words (same from/to). ζ ≈ 0.93: the overshoot is under 1% of travel.*
- **`anticipate-pop-words-energetic`**: Each word pinches down a hair, then pops past full size and settles: a cartoon wind-up on a real spring. *Per-word only: per-character at this bounce reads as jitter. Keep phrases short (2–5 words). The anticipation is what sells it, so if opacity_duration grows past ~180ms the wind-up happens while the word is still invisible and the effect collapses into a plain pop.*
