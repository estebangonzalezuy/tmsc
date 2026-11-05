// Archivo Narrow for everything; Archivo (variable wght 100–900, wdth
// 62–125) for specs that animate x_font_weight. Both OFL, files in
// public/fonts/ with their licences. Rendering waits for both, so the
// first frame (and every exported frame) is measured with the real face.

export async function loadFonts() {
  const faces = [
    new FontFace("Archivo Narrow", "url(/fonts/ArchivoNarrow-wght.ttf)", { weight: "400 700" }),
    new FontFace("Archivo Narrow", "url(/fonts/ArchivoNarrow-Italic-wght.ttf)", { weight: "400 700", style: "italic" }),
    new FontFace("Archivo", "url(/fonts/Archivo-wdth-wght.ttf)", { weight: "100 900", stretch: "62% 125%" }),
  ];
  await Promise.all(
    faces.map((f) =>
      f.load().then((ff) => document.fonts.add(ff)).catch((e) => console.warn("font failed", e)),
    ),
  );
  await document.fonts.ready;
}
