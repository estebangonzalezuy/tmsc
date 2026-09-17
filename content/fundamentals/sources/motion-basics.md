---
title: Motion basics
blurb: Easing, duration and stagger. The three numbers that decide how a move feels, before you touch anything else.
minutes: 12
updated: 2026-09-17
---

Everything on the three pages before this one was still. Now it moves, and
the first thing to know is that the software does not decide how a move
feels. Three numbers do: the curve, the duration, and the gap between one
thing starting and the next. Every tool exposes them. Most tutorials skip
them to get to the effect.

## Easing is a claim about weight

A move that starts slowly and arrives fast reads as something falling. A
move that leaves fast and settles slowly reads as something thrown, or
something with brakes. Linear reads as a machine. The distance and the time
are identical in all three; only the curve changed, and the curve is what
your eye reads as weight.

The plot on the left is the thing every animation tool hands you as a graph
editor: time across, distance up. Pick a curve, then take the two handles
and make your own. An overshoot is the second handle pulled past the top and
allowed to come back.

:::figure motion-easing curve=out caption="Same distance, same 1.4 seconds. Only the curve changes. Drag the handles on Custom and watch the mark believe you."
:::

:::note
"Ease out" (fast start, slow settle) is the right default for most things
that appear, because the reader wants to know where it is going as early as
possible. "Ease in" is for things that leave. If you remember one thing from
this page, remember that.
:::

## Duration is relative

A number means nothing on its own. 300 milliseconds is fast for a page
transition and slow for a button. So the figure keeps a reference move
running above yours, always 300 ms, always the same curve, and lets you
drag the other one.

Under about 180 ms a move reads as a cut. Between 200 and 400 it reads as an
interface responding. Between 400 and 800 it starts to have weight, and past
that it had better be worth watching, because the reader has started
waiting.

:::figure motion-duration duration=700 caption="Two identical moves. The top one is always 300 ms. Drag the bottom one and feel where it stops being quick and starts being heavy."
:::

## Stagger is how many things become one thing

When several things arrive, the gap between one starting and the next
decides whether the reader sees a group or a sequence. At zero they are one
object. A few dozen milliseconds apart they become countable, which is
where a list or a grid usually wants to be. A lot more than that and the
last one is still arriving after the reader has moved on.

Each item's own move never changes here. It is always the same 500 ms. Only
the gap does.

:::figure motion-stagger count=5 stagger=80 curve=out caption="Five things arriving. Zero stagger is one thing. Eighty is a sequence. Two hundred is a queue."
:::

Notice that the total time grows with every item you add. Eight items at
80 ms apart is over a second before the last one lands. That is the usual
reason a stagger that looked great on three cards feels slow on twelve: the
gap has to shrink as the count grows.

## What to do with this

:::do minutes=40
Animate one rectangle moving across a frame. Two properties at most. Make it
read fast, then heavy, then thrown, changing only the curve and the
duration. Then duplicate it into five and stagger them. Export the version
that felt right, and write down the three numbers you used. Those numbers
are your first taste.
:::

That is the base. The rest of the club is what you do with it: the
[Learn](/learn) library goes deeper into each of these, and the
[Practice](/practice) page has the exercises.
