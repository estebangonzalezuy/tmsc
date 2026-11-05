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
| `anticipate-pop-words-calm` | per-word | opacity, scale | 0.91 | 5% / 160ms | 679 | ζ ≈ 0.91, 5% squash. |
| `spring-rise-letters-calm` | per-character | opacity, y_px | 1.00 | none | 854 | ζ = 1.0 (crítico): nothing to notice but the words. |
| `heavy-drop-lines-calm` | per-line | opacity, y_px | 1.02 | 4% / 160ms | 1596 | Same mass, no bounce: the slab is lowered, not dropped. |

### editorial

| id | target | moves | ζ | wind-up | unit ms | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `weight-wave-letters` | per-character | opacity, y_px, x_font_weight | 0.67 | 6% / 90ms | 864 | ζ ≈ 0.67 on weight, not position: the word fills in. |
| `hold-aware-rise` | per-word | opacity, y_px | 0.56 | 12% / 120ms | 899 | Same physics as spring-rise-letters, per word, plus a reading contract. |

### energetic

| id | target | moves | ζ | wind-up | unit ms | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `anticipate-pop-words-energetic` | per-word | opacity, scale | 0.32 | 22% / 90ms | 932 | ζ ≈ 0.32, 22% squash. |
| `spring-rise-letters-energetic` | per-character | opacity, y_px | 0.39 | 15% / 70ms | 846 | ζ ≈ 0.39 (rebota): cut it to music. |

### heavy

| id | target | moves | ζ | wind-up | unit ms | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `heavy-drop-lines` | per-line | opacity, y_px | 0.55 | 10% / 160ms | 1554 | mass 2.2, ζ ≈ 0.55 (pesado): slow to start, hard to stop. |

### playful

| id | target | moves | ζ | wind-up | unit ms | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `anticipate-pop-words` | per-word | opacity, scale | 0.39 | 15% / 140ms | 1135 | ζ ≈ 0.39: a clear pop and a second ring. |

### precise

| id | target | moves | ζ | wind-up | unit ms | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `spring-rise-letters` | per-character | opacity, y_px | 0.56 | 12% / 120ms | 899 | ζ ≈ 0.56: one overshoot you can see. |

## Same effect, different physics

These share `from`/`to` with their base and change only the spring, so they are
safe to swap for one another without touching layout.

- **anticipate-pop-words**: `anticipate-pop-words` (playful, ζ 0.39) · `anticipate-pop-words-calm` (calm, ζ 0.91) · `anticipate-pop-words-energetic` (energetic, ζ 0.32)
- **spring-rise-letters**: `spring-rise-letters` (precise, ζ 0.56) · `spring-rise-letters-calm` (calm, ζ 1.00) · `spring-rise-letters-energetic` (energetic, ζ 0.39)
- **heavy-drop-lines**: `heavy-drop-lines` (heavy, ζ 0.55) · `heavy-drop-lines-calm` (calm, ζ 1.02)

## By request

- "make it calm / quieter / less bouncy" → same family, `calm` intent (ζ ≈ 1).
- "more punch / energy / snappy" → same family, `energetic` intent.
- "heavy / weighty / lands" → `heavy-drop-lines`, or raise `mass`.
- "playful / cartoon / pop" → `anticipate-pop-words`.
- "variable font / weight" → `weight-wave-letters`.
- "subtitles / lower third / make sure it's readable" → `hold-aware-rise`, and respect `x_hold_ms`.
- Anything in Pixel Point's animate-text catalog (soft blur, typewriter, shared axis…) → use **that** skill. This one adds physics on top; it doesn't replace it.
