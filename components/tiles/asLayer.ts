// the Tiles, as a layer of a post.
//
// The same bargain the Kinetics made. The two specs stay separate — a tile has
// no words in it and a post is mostly words — and what this does is let the
// Posts Studio *draw* a tile, by building a TileSpec out of the layer's few
// dials and handing it to the same renderer. There is no second
// implementation of a tile, and no second answer to what one looks like.
//
// It qualifies as a `generative` layer, which is the only classification that
// matters: canvas 2D, a pure function of the frame, periodic in the post's
// duration. So the exporter draws it directly at any moment it names, and a
// reel with a tile in it still closes its loop.
//
// A tile brings its own palette rather than taking the slide's two tones,
// because unlike a scene of type a tile is not a graphic that happens to have
// a colour — three or four flat inks *are* the object. The layer can be told
// to take the post's palette instead when the slide has one, which is the
// same escape hatch every other layer has.

import {
  RECIPES,
  applyRecipe,
  defaultSpec,
  normalize,
  paletteOf,
  type PostFormat,
  type TileSpec,
} from "@/lib/tiles";
import { paint } from "./render";

export const TILE_RECIPES = RECIPES.map((r) => r.id);

export type TileLayerOptions = {
  format: PostFormat;
  duration: number;
  /** 0-1, over how many of everything there is. */
  density?: number;
  /** How hard the hand shakes, 0-1. */
  hand?: number;
  /** Redrawings over the loop. */
  boil?: number;
  /** A tile palette by id, or absent for the recipe's own. */
  palette?: string;
  /** The post's palette, when the layer is mixing. It replaces the tile's
      inks and leaves the band and the panel to the tile. */
  inks?: readonly string[];
};

/** The spec a recipe needs, with the layer's dials over the top. */
export function tileSpecFor(recipe: string, o: TileLayerOptions): TileSpec {
  const r = RECIPES.find((x) => x.id === recipe) ?? RECIPES[0];
  const base = applyRecipe(normalize({ ...defaultSpec(), format: o.format, duration: o.duration }), r);
  const d = Math.max(0, Math.min(1, o.density ?? 0.5));
  /* One knob over every count in the tile at once, so "more of it" means the
     same thing whichever recipe is showing. It is a scaling of what the recipe
     chose rather than a number of its own — a tile whose arms all had the same
     count would have lost the thing that makes these compositions work. */
  const scale = 0.5 + d * 1.2;
  return normalize({
    ...base,
    palette: o.palette && paletteOf(o.palette).id === o.palette ? o.palette : base.palette,
    inks: o.inks?.length ? [...o.inks] : undefined,
    wobble: o.hand ?? base.wobble,
    boil: o.boil ?? base.boil,
    arms: base.arms.map((a) => ({ ...a, count: Math.max(1, Math.round(a.count * scale)) })),
    guides: {
      ...base.guides,
      spokes: Math.round(base.guides.spokes * scale),
      arcs: Math.round(base.guides.arcs * scale),
    },
  });
}

/**
 * Draw a tile into a layer's canvas.
 *
 * `t` is seconds into the post, turned into the tile's own `p` here — the one
 * place the two clocks are reconciled, and the reason a tile inside a post
 * loops on the post's duration rather than on its own.
 */
export function drawTileLayer(
  ctx: CanvasRenderingContext2D,
  recipe: string,
  t: number,
  w: number,
  h: number,
  o: TileLayerOptions,
) {
  const spec = tileSpecFor(recipe, o);
  const D = Math.max(0.001, o.duration);
  paint(ctx, spec, (((t % D) + D) % D) / D, w, h);
}
