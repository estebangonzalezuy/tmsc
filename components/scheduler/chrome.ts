// The one control the Scheduler repeats everywhere: a chip that is either
// selected or hoverable.
//
// `.pill` and `.inset` are unlayered rules in globals.css, and an unlayered
// rule beats any Tailwind utility — so `pill bg-foreground` stays gray, and
// `pill hover:bg-foreground` never fills. A selected chip therefore draws its
// own pill shape without `.pill`, and a resting one takes its hover from
// `accentHover`, which is unlayered too (and what the design rules ask for
// anyway: a hover picks its colour from the palette, keyed by something
// stable about the item).

import { accentHover } from "@/lib/accent";

export function chip(on: boolean, key: string): string {
  return on
    ? "rounded-full px-[0.65rem] py-[0.15rem] bg-foreground text-background"
    : `pill ${accentHover(key)}`;
}
