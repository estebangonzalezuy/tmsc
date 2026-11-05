# Estrategia — Anticipator Skill Lab

Copiado de la sección *Estrategia* del brief de la noche (2026-11-05), para que
el repo se explique solo.

Alex Barashkov / Pixel Point publicó **animate-text**: un catálogo de
animaciones de texto como recetas JSON + un script que genera un **SKILL**
instalable para agentes (`npx skills add pixel-point/animate-text --skill animate-text`).
La web es Next.js.

- Repo: https://github.com/pixel-point/animate-text
- Página: https://pixelpoint.io/skills/animate-text
- Post de lanzamiento: https://x.com/alex_barashkov/status/2047309188569666010
- Handle: @alex_barashkov

**Este producto no es un fork hostil: es una expansión suya.** Posicionamiento
público (cuando Esteban publique, no un agente):

- "built on / expansion of Pixel Point's animate-text"
- mismos conceptos de recipe JSON + skill generado
- aporte propio: springs **reales** (masa / stiffness / damping),
  **anticipación**, UI de diales para diseñar presets, más ejemplos con
  carácter de motion designer, y un **editor de video chico** encima para
  componer clips con esas recetas
- crédito explícito a Alex en README, SKILL.md, UI y borrador de tweet

**Licencia:** el repo de Alex aparece **sin LICENSE** (ver `LICENSE-NOTES.md`).
No se copia su código de Next, adapters ni assets. Se puede:

- leer su `catalog/text-animations/schema.md` y la forma de los specs como
  **referencia de formato**
- reimplementar el runtime de preview (canvas) por nuestra cuenta
- mantener **compatibilidad de schema** (mismos campos `target`,
  `enter`/`exit`, `duration_ms`, `stagger_ms`, `easing`, `from`/`to`, `swap`,
  `stagger_mode`) y extender con campos opcionales prefijados `x_`, para que
  un runtime que ignore `x_*` siga andando con la bezier de fallback.

## Un producto, dos capas

- **Capa A — Lab:** diseñar specs con diales (spring real + anticipación,
  side-by-side contra la referencia bezier), guardarlos al catálogo, y
  regenerar el skill con `npm run generate:skill`.
- **Capa B — Editor:** componer clips de texto sobre un timeline (DialKit),
  cada clip usa un spec del catálogo, preview determinista por `t`, export.
