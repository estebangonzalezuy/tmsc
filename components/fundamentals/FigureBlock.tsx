import { FIGURES } from "./figures";

/* A `:::figure` block, rendered. A server component on purpose: the lookup
   happens while the page is prerendered, so an id nothing answers to fails
   the build with its name in the message rather than leaving a hole in a
   published page — the same promise the markdown parser makes about an
   unknown directive, kept one step later. */

export default function FigureBlock({
  id,
  params,
  caption,
}: {
  id: string;
  params: Record<string, string>;
  caption?: string;
}) {
  const Figure = FIGURES[id];
  if (!Figure) {
    throw new Error(
      `:::figure "${id}" has no entry in components/fundamentals/figures/index.ts. ` +
      `Known figures: ${Object.keys(FIGURES).join(", ")}.`,
    );
  }
  return <Figure params={params} caption={caption} />;
}
