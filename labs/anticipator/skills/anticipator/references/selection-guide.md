# Selection guide

Pick by **intent** first (what it should feel like), then by **target** (what
moves: letters, words, lines), then by **physics** (ζ).

| ζ | reads as |
| --- | --- |
| < 0.35 | bouncy, toy-like. Use sparingly. |
| 0.35–0.65 | lively, with a visible overshoot |
| 0.65–0.95 | firm, one overshoot you feel more than see |
| ≈ 1 | critical: the fastest arrival with no overshoot. Calm. |
| > 1 | soft, creeping, a bit lazy |

Mass is the "heavy" control. Raising stiffness to compensate keeps the
duration but loses the weight.

## By intent

### calm

| id | target | moves | ζ | wind-up | unit ms | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `spring-rise-letters-calm` | per-character | opacity, y_px | 1.00 | none | 854 | ζ = 1.0, no anticipation, long opacity. Nothing to notice but the words. |
| `anticipate-pop-words-calm` | per-word | opacity, scale, y_px | 0.93 | 6% / 120ms | 549 | Same gesture, inside voice. |

### editorial

| id | target | moves | ζ | wind-up | unit ms | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `weight-wave-letters` | per-character | opacity, y_px, x_font_weight | 0.67 | 6% / 90ms | 864 | ζ ≈ 0.67 on weight, not position: the word fills in. |
| `hold-aware-rise` | per-word | opacity, y_px | 0.88 | 5% / 80ms | 668 | Unremarkable on purpose, so the words get read. |

### energetic

| id | target | moves | ζ | wind-up | unit ms | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `spring-rise-letters-energetic` | per-character | opacity, y_px | 0.39 | 12% / 70ms | 846 | ζ ≈ 0.39, short stagger, fast opacity. It wants to be cut to music. |
| `anticipate-pop-words-energetic` | per-word | opacity, scale, y_px | 0.36 | 22% / 80ms | 767 | Stiff and under-damped with a sharper wind-up: the pop lands on the beat and rings once more. |

### heavy

| id | target | moves | ζ | wind-up | unit ms | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `heavy-drop-lines` | per-line | opacity, y_px | 0.67 | 10% / 160ms | 1198 | mass 3, ζ ≈ 0.67: slow to start, hard to stop. |

### playful

| id | target | moves | ζ | wind-up | unit ms | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `anticipate-pop-words` | per-word | opacity, scale, y_px | 0.54 | 18% / 110ms | 729 | ζ ≈ 0.54: one clear overshoot and a small second ring. Friendly, not silly. |

### precise

| id | target | moves | ζ | wind-up | unit ms | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `spring-rise-letters` | per-character | opacity, y_px | 0.74 | 8% / 80ms | 573 | ζ ≈ 0.74: lands with one overshoot you feel more than see. |

## Same effect, different physics

These share `from`/`to` with their base and change only the spring, so they are
safe to swap for one another without touching layout.

- **anticipate-pop-words**: `anticipate-pop-words` (playful, ζ 0.54) · `anticipate-pop-words-calm` (calm, ζ 0.93) · `anticipate-pop-words-energetic` (energetic, ζ 0.36)
- **spring-rise-letters**: `spring-rise-letters` (precise, ζ 0.74) · `spring-rise-letters-calm` (calm, ζ 1.00) · `spring-rise-letters-energetic` (energetic, ζ 0.39)

## By request

- "make it calm / quieter / less bouncy" → same family, `calm` intent (ζ ≈ 1).
- "more punch / energy / snappy" → same family, `energetic` intent.
- "heavy / weighty / lands" → `heavy-drop-lines`, or raise `mass`.
- "playful / cartoon / pop" → `anticipate-pop-words`.
- "variable font / weight" → `weight-wave-letters`.
- "subtitles / lower third / make sure it's readable" → `hold-aware-rise`, and respect `x_hold_ms`.
- Anything in Pixel Point's animate-text catalog (soft blur, typewriter, shared axis…) → use **that** skill. This one adds physics on top; it doesn't replace it.
