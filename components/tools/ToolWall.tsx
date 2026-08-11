"use client";

// the Tools — the wall. Every tool shows what it makes, made: the thumbnails
// are real renders of each tool's own defaults, so choosing one is looking at a
// post rather than reading a promise.

import Link from "next/link";
import { useEffect, useState } from "react";
import { FORMATS } from "@/lib/postlab";
import { TOOLS, startingParams } from "@/lib/tools";
import { accentHover } from "@/components/Motifs";
import Poster from "@/components/postlab/Poster";
import { loadFonts, type Fonts } from "@/components/postlab/overlay";
import { useClockRunning } from "@/components/postlab/Stage";

export default function ToolWall() {
  const [fonts, setFonts] = useState<Fonts | null>(null);
  /* One clock for the wall, so the counting tools tick in their thumbnails
     instead of sitting on frame zero. */
  useClockRunning(true, 6);
  const [now] = useState(() => new Date());

  useEffect(() => {
    loadFonts().then(setFonts);
  }, []);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-line px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center rounded-full border border-line size-8 text-xs">
            T
          </span>
          <span className="font-serif italic text-lg">the Tools</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Link href="/postlab" className="underline underline-offset-4">
            the Posts Studio
          </Link>
          <Link href="/hub" className="underline underline-offset-4">
            the Hub
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="border-b border-line px-5 py-8">
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            One thing each, and the four questions that actually differ between
            two of its posts. Everything else the tool decides. When a post needs
            more than the tool asks, open it in{" "}
            <Link href="/postlab" className="underline underline-offset-4">
              the studio
            </Link>{" "}
            — it&apos;s the same post, all the way down.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line">
          {TOOLS.map((tool) => {
            const spec = tool.build(startingParams(tool, now), now);
            /* Sized by height rather than width, so a 1:1 tool and a 4:5 tool
               sit on the wall like two sheets on the same shelf instead of one
               dwarfing the other. */
            const { w, h } = FORMATS[spec.format];
            const width = Math.min(360, Math.round((300 * w) / h));
            return (
            <Link
              key={tool.id}
              href={`/tools/${tool.id}`}
              className={`bg-background p-5 flex flex-col gap-4 ${accentHover(tool.id)}`}
            >
              <div className="flex-1 flex items-center">
                <div className="border border-line bg-background" style={{ width }}>
                  <Poster spec={spec} index={0} fonts={fonts} width={width} live />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm">{tool.name}</p>
                <p className="text-xs leading-relaxed accent-hover-sub text-muted">
                  {tool.about}
                </p>
              </div>
            </Link>
            );
          })}
          {/* An odd number of tools would let the line colour show through the
              empty cell, so the last one is filled deliberately. */}
          {TOOLS.length % 3 !== 0 && <span className="hidden lg:block bg-background" />}
          {TOOLS.length % 2 !== 0 && <span className="hidden sm:block lg:hidden bg-background" />}
        </div>
      </main>
    </div>
  );
}
