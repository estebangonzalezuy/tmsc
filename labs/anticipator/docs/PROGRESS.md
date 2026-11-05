# Progress — Anticipator Skill Lab

## Estado (2026-11-05, brief cloud)

**Anda:** etapas 0–6. Vite + React + TS. 10 specs (física real + anticipación, fallback bezier ajustado con error declarado), `validate:catalog`, Lab (side-by-side vs bezier de Pixel 360ms, diales, ζ, Save preset / Copy enter JSON), `generate:skill` idempotente, Editor con timeline DialKit (5 clips en loop), export determinista a `out/`.
**Falta / revisar:** exits todavía bezier (el runtime ya soporta `exit.x_spring`); sin audio en el export; en build estático Save descarga JSON en vez de escribir.
**Cómo correr:**
```
cd labs/anticipator && npm install
npm run dev        # http://localhost:5178 · Lab / #editor
npm test           # física + validate:catalog + check:skill + typecheck
npm run generate:skill
npm run export -- springs-side-by-side tmsc-timeline --verify
```
**Nada publicado:** sin PR a Pixel Point, sin npm, sin Vercel, sin X. Solo el branch `claude/new-session-3sl55y` de `estebangonzalezuy/tmsc` (no `main`).

---

## Etapa 0 — Recon ✅

- Referencia: `labs/anticipator/_ref/animate-text` (clone de
  `pixel-point/animate-text@0f783e4`, gitignored). **Sin LICENSE**,
  `"private": true`, así que solo se leyó como formato. Ver `LICENSE-NOTES.md`.
- DialKit: `dialkit@2.1.0` (MIT), docs leídas del paquete (README + `.d.ts`):
  `useDialKit` / `useDialKitController`, `useDialTimeline`, `<DialTimeline />`,
  `<DialRoot mode="inline" />`.
- Dónde vive: `labs/anticipator/` dentro del repo tmsc, con su propio
  `package.json` (como `scripts/content-cycle/`). El ESLint/tsconfig del sitio
  lo ignoran, no está en `app/` y no se mergea a `main`, así que no se deploya.
  El sitio sigue pasando `npm run lint` + `npm run build`.

## Etapa 1 — Skeleton + schema ✅

- `core/*.ts`: types, spring, easing, phase, fit, timeline, render, validate,
  canonical. Node 22 los corre nativo (type stripping), así que scripts, app y
  export comparten exactamente el mismo código.
- `catalog/text-animations/schema.md`: core compatible con animate-text + `x_*`
  (`x_spring{stiffness,damping,mass,velocity,rest_delta}`,
  `x_anticipation{duration_ms,amount,easing}`, `x_opacity_duration_ms`,
  `x_hold_ms`, `x_hold_per_word_ms`, `x_font_weight`, `x_intent`, `x_variant_of`).
- Specs semilla con los valores del brief: `anticipate-pop-words` (320/14/1,
  15%/140ms), `spring-rise-letters` (260/18/1, 12%/120ms, y 24→0),
  `heavy-drop-lines` (180/22/2.2, 10%/160ms, y −40→0), `weight-wave-letters`
  (wght 100→800; **real, no stub**: Archivo variable 100–900), `hold-aware-rise`
  (`x_hold_ms` 900). Variantes calm/energetic de `spring-rise-letters` y de
  `anticipate-pop-words`.
- `npm run validate:catalog` falla ante claves desconocidas, from/to
  desparejos, id ≠ archivo, archivo no listado, o fallback desactualizado.

**Decisiones:**
- **Física en forma cerrada, no integrada paso a paso.** Es la solución exacta
  de `F = −k(x−1) − c·v`, `a = F/m` (sub-, crítico y sobre-amortiguado, con
  `velocity`), y hace que cada frame sea función pura de `t`. `npm run
  test:physics` la compara contra integración semi-implícita (error máx. 7.5e-5).
- **El fallback bezier se ajusta a la física** (`npm run fit:catalog`,
  Nelder–Mead). El `easing` / `duration_ms` del brief (p. ej.
  `cubic-bezier(0.34, 1.56, 0.64, 1)` / 1000ms en `anticipate-pop-words`) se usa
  como punto de partida y se reemplaza por la curva que mejor aproxima el spring
  real; `x_fallback.max_error` dice cuánto se aleja. Ese bezier de Pixel sigue
  siendo la referencia izquierda del Lab (360ms).

## Etapa 2 — Runtime + diales + save ✅

- Lab: side-by-side **bezier de Pixel** (`cubic-bezier(0.34, 1.56, 0.64, 1)`,
  360ms, ajustable) o el fallback ajustado del spec vs **spring + anticipación**,
  un solo reloj y gráfico de curvas. Los dos lados salen juntos.
- Diales: stiffness, damping, mass, velocity, anticipation %, anticipation ms,
  stagger, opacity ms, rest_delta. ζ en vivo con rebota / crítico / lento,
  overshoot y settle.
- Save preset (nombre + intención calm / energetic / heavy / playful / precise /
  editorial) → `POST /api/specs` (middleware de Vite) → valida, ajusta el
  fallback, escribe `catalog/text-animations/specs/<id>.json` y lo lista en
  `catalog.json`. Copy enter JSON y Copy spec.
- Verificado con Playwright: `heavy-drop-lines-calm` se creó desde la UI.

## Etapa 3 — generate:skill ✅

- `npm run generate:skill` → `skills/anticipator/`: SKILL.md (expansion of
  pixel-point/animate-text; **prefer `x_spring` when supported, else bezier
  fallback**), references (schema, selection-guide, catalog,
  implementation-notes), assets/specs con `x_css_linear` exacto, helpers
  `list-specs` / `get-spec [--portable]`, y `scripts/runtime/*.js` (el mismo
  core, con los tipos quitados).
- Idempotente: borra y reescribe; `npm run check:skill` regenera en tmp y
  compara byte a byte, valida estructura y crédito, corre los helpers.

## Etapa 4 — Editor DialKit ✅

- **DialKit alcanzó como timeline de producto**, así que no hizo falta un
  timeline propio: `useDialTimeline` + `<DialTimeline />` manejan el transport
  y las barras. Arrastrar o redimensionar en el dock escribe al proyecto;
  redimensionar estira el *hold*, nunca el spring. Panel inline
  `useDialKitController` "Clip": texto (`/` = salto de línea), color (par tMSC +
  B/N), tamaño, y, stagger, override de spring.
- `renderAt(ctx, project, specs, ms)` dibuja cada frame en el playhead: la
  misma función que el export.
- Verificado: 5 clips en loop (wrap a los 11.0s), drag en el dock (3000→4020ms),
  edición de texto desde el panel, Add clip con su largo natural.

## Etapa 5 — Export ✅

- `npm run export -- <proyecto…> [--fps N] [--verify]`: Vite + Chromium
  headless + ruta `#render`, `renderAt(i/fps)` por frame → PNG → ffmpeg MP4
  (H.264) + WebM (VP9) + póster. `--verify` re-renderiza y compara bytes.
- `out/springs-side-by-side.mp4` (1920×1080, 60fps, 9.8s) y
  `out/tmsc-timeline.mp4` (1080×1080, 30fps, 11s), más .webm y .png.
- Botón **Export WebM** en el Editor (MediaRecorder, frame a frame) para pruebas rápidas.

## Etapa 6 — Docs ✅

`STRATEGY.md`, `LICENSE-NOTES.md`, `SHIP-CHECKLIST.md`, `tweet-draft.md`
(minúsculas, @alex_barashkov, `YOUR_DEMO_URL`), `README-PUBLIC.md` ("Built on
Pixel Point animate-text" arriba de todo), `LICENSE` (MIT).
