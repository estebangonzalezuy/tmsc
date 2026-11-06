# motion instrument — etiquetas

On the club's site this folder is served at `/motion-instrument`. The bare
path opens the tool. `index.html` is the built file and stays as generated;
`OFL.txt` sits beside it. The demo videos are not in the site repo.

![motion instrument](media/poster.png)

**EN** · **[ES](#es)**

## What it is

A small instrument you play from the keyboard. Each note drops a word-label into a
layout that is packed, collides and springs into place, so typography becomes rhythm.
It comes with its own synth and SFX, 15 numbered layouts and 20 colour themes,
and it can record its own canvas. It is a single offline HTML file. The Archivo Narrow
font is embedded, and it makes no network requests and has no dependencies.

Demo: [`media/demo-16x9.mp4`](media/demo-16x9.mp4) · loop: [`media/loop-1x1.mp4`](media/loop-1x1.mp4)

## Run

- Open `index.html` in a desktop browser (Chrome, Edge, Firefox or Safari).
- Or serve the folder with `npx serve .` (or `python3 -m http.server`) and open the URL.
- It works from any sub-path (e.g. `/motion-instrument/` or `/tools/motion-instrument/`)
  because everything is inside `index.html` and no paths are used.
- Sound starts after the first key press (browser autoplay rule).
- `index.html?hero` opens with the interface hidden.

## Controls

Every note grows from the centre of the cluster, from nothing to full size,
and shoves the tags around it. They bump, tilt a little, and the pile pulls
back together. Nothing falls. On the loop, and on `X`, the pile clears one
tag at a time, nearest the centre first, each with a small pop. The same motion is every preset, including the 16ths. The pad sits on the left, compact:
an 8×8 step grid with slightly rounded cells. The word tags have a smaller
corner than the controls, and they still sit edge to edge. Click it or press Space to start; drag
across it to paint the pattern. The other controls are a separate group on the right,
flat white buttons with a black edge and no shadow. A selected control flips
to black with white text: tempo,
subdivision, preset (numbered 01–15), sound, tone, scale, variety, ramp,
theme, and the text. Click the canvas and a word from the text grows at that spot, pushes its neighbours, and shrinks away after a short life. A one-line hint shows until playback starts, and
returns when it stops. Tone is how a note sounds — Pluck,
Soft, Reed, Bell — and only one note rings at a time. The text is the
paragraph the notes spell, one word per note. Reset
puts back the original paragraph, which still ends on Motion Social Club
Barcelona. Keyboard shortcuts keep working unless the cursor is in the text
or on a slider.

| Key | Action |
|---|---|
| `SPACE` | play / stop the sequence |
| `A S D F G H J K` | play notes (each note places a word) |
| `1`–`9`, `0`, `-`, `=` | layouts 01–12 |
| `E` | layout 13, the square editorial |
| `Q` | layout 14, the same grid composed for 16:9 |
| `W` | layout 15, the same grid composed for 9:16 |
| `B` | editorial board colours on layouts 13, 14 and 15. Each press steps a three-pane combination (the club palette, plus blue with white and red with black). The first combination is the original white, yellow and indigo board. `C` still cycles the page background. |
| `O` | sound: SFX + BASS (default) → SYNTH → MONO + SFX |
| `T` | tone: Pluck → Soft → Reed → Bell |
| `L` | tempo ramp 80 → 160 BPM on / off |
| `V` | variety (0 → 100 % in steps of 25) |
| `M` | major / minor |
| `↑` / `↓` | BPM ±5 (`Shift` = ±1) |
| `C` | next colour theme. One is picked at random when the page opens, then C cycles the rest. Each theme is two colours, background and type. |
| `X` | clear the pattern; the pile clears one tag at a time from the centre out |
| `R` | record the canvas and the sound, with no interface in the picture. Frame is 9:16, 16:9 or 1:1. Safari downloads H.264 + AAC `.mp4`. Chrome downloads H.264 `.mp4` (AAC when it offers it, otherwise Opus). Firefox downloads a `.webm`. |
| `U` | hide / show the interface |

## Credits

Design and code: Esteban González · tMSC — The Motion Social Club.
Font: **Archivo Narrow** by Omnibus-Type, licensed under the SIL Open Font License 1.1
(see [`OFL.txt`](OFL.txt)). The font is embedded in `index.html`.

## License

License: TBD. This covers the code and media; the font is under the OFL (`OFL.txt`).

---

<a id="es"></a>

## Qué es

Un pequeño instrumento que se toca con el teclado. Cada nota deja caer una etiqueta-palabra
en una composición que se empaqueta, choca y se asienta con muelles: la tipografía se
convierte en ritmo. Tiene sintetizador y SFX propios, 15 composiciones numeradas y 20 temas de color,
y puede grabar su propio canvas. Es un único archivo HTML offline. La fuente Archivo Narrow
va incrustada, y no hace peticiones de red ni tiene dependencias.

Demo: [`media/demo-16x9.mp4`](media/demo-16x9.mp4) · loop: [`media/loop-1x1.mp4`](media/loop-1x1.mp4)

## Cómo usarlo

- Abre `index.html` en un navegador de escritorio.
- O sirve la carpeta con `npx serve .` (o `python3 -m http.server`).
- Funciona desde cualquier sub-ruta (`/motion-instrument/`, `/tools/motion-instrument/`…).
- El sonido empieza tras la primera tecla.
- `index.html?hero` abre sin interfaz.

## Controles

El pad queda a la izquierda y el resto de los botones, blancos y planos, a la derecha. El texto es el párrafo
que las notas deletrean, una palabra por nota. Reset devuelve el párrafo
original. Los atajos siguen funcionando salvo cuando el cursor está en el
texto o en un deslizador.

| Tecla | Acción |
|---|---|
| `ESPACIO` | reproducir / parar |
| `A S D F G H J K` | notas (cada nota coloca una palabra) |
| `1`–`9`, `0`, `-`, `=` | composiciones 01–12 |
| `E` | composición 13, la editorial cuadrada |
| `Q` | composición 14, la misma retícula en 16:9 |
| `W` | composición 15, la misma retícula en 9:16 |
| `B` | colores del tablero editorial en las composiciones 13, 14 y 15. Cada pulsación avanza una combinación de tres panes (la paleta del club, más azul con blanco y rojo con negro). La primera es el tablero original: blanco, amarillo e índigo. `C` sigue cambiando el fondo de la página. |
| `O` | sonido: SFX + BASS (por defecto) → SYNTH → MONO + SFX |
| `T` | timbre: Pluck → Soft → Reed → Bell |
| `L` | rampa de tempo 80 → 160 BPM |
| `V` | variedad (0 → 100 % en pasos de 25) |
| `M` | mayor / menor |
| `↑` / `↓` | BPM ±5 (`Shift` = ±1) |
| `C` | siguiente tema. Al abrir se elige uno al azar; C recorre el resto. Cada tema son dos colores, fondo y tipo. |
| `X` | borrar el patrón; el racimo se va de a un tag, del centro hacia afuera |
| `R` | grabar el canvas y el sonido, sin la interfaz. El encuadre es 9:16, 16:9 o 1:1. Chrome y Safari bajan un `.mp4`; Firefox un `.webm`. |
| `U` | ocultar / mostrar la interfaz |

## Créditos

Diseño y código: Esteban González · tMSC — The Motion Social Club.
Fuente: **Archivo Narrow** (Omnibus-Type), bajo la SIL Open Font License 1.1 (`OFL.txt`).

## Licencia

Licencia: por definir (TBD). La fuente se rige por la OFL.
