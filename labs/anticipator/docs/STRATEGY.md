# Estrategia — Anticipator Skill Lab

Del brief cloud de la noche (2026-11-05), para que el repo se explique solo.

Alex Barashkov / Pixel Point publicó **animate-text**: catálogo de animaciones
de texto en JSON + script que genera un **SKILL** para agentes.

- Repo (solo lectura / referencia, clonado en `_ref/animate-text`, gitignored): https://github.com/pixel-point/animate-text
- Página: https://pixelpoint.io/skills/animate-text
- Post: https://x.com/alex_barashkov/status/2047309188569666010 · @alex_barashkov

**Este producto es una expansión suya, no un fork hostil.** Aporte nuestro:

1. Springs **reales** (stiffness / damping / mass / velocity) + **anticipación**
2. Tool UI con diales para diseñar presets (Lab)
3. `generate:skill` que exporta un skill instalable (como el de Alex)
4. Editor de video chico (timeline) sobre **DialKit** (`dialkit` + `motion`)
   para componer clips con esos specs

Crédito explícito a Alex en README, SKILL.md, UI y `docs/tweet-draft.md`.

## Licencia

El repo de Alex no tiene LICENSE (ver `LICENSE-NOTES.md`). Se lee como
referencia de formato; no se copia su código Next, adapters, assets ni
scripts. El runtime de preview es propio. Hay **compatibilidad de schema**
(`target`, `enter`/`exit`, `duration_ms`, `stagger_ms`, `easing`, `from`/`to`,
`swap`, `stagger_mode`) extendida con campos opcionales `x_*`. Nuestro código: MIT.

## Física

`F = −k(x−1) − c·v`, `a = F/m`. Anticipación: primero se easea el progress
a `−amount`, después arranca el spring. `enter.easing` + `duration_ms`
quedan como **fallback bezier** si el runtime ignora `x_*`.
ζ = c / (2√(k·m)), visible en la UI (rebota / crítico / lento).

## Stack

Vite + React + TypeScript · DialKit · Canvas 2D determinista por `t` ms ·
Archivo Narrow / Archivo (OFL) · paleta tMSC, máx. 2 colores + B/N por demo.
