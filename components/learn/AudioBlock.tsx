"use client";

// A club episode. The browser's own player, in the club's card — there is no
// design argument here worth a custom transport.

export default function AudioBlock({ src, seconds }: { src: string; seconds?: number }) {
  const mins = seconds ? Math.round(seconds / 60) : null;
  return (
    <figure className="mt-12 card px-6 py-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-xs underline underline-offset-4">Listen</p>
        {mins && <p className="text-xs text-muted">{mins} min</p>}
      </div>
      <audio controls preload="none" src={src} className="mt-4 w-full">
        Your browser can&apos;t play this. <a href={src}>Download the episode</a>.
      </audio>
    </figure>
  );
}
