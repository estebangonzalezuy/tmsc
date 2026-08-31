"use client";

// A video, loaded only when somebody asks for it. A page with five videos on it
// would otherwise pull five players before a word was read; this costs a poster
// image each until clicked.

import { useState } from "react";

export default function VideoBlock({
  provider,
  id,
  caption,
}: {
  provider: "youtube" | "vimeo";
  id: string;
  caption?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const src =
    provider === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`
      : `https://player.vimeo.com/video/${id}?autoplay=1`;
  const poster =
    provider === "youtube" ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;

  return (
    <figure className="mt-12">
      <div className="card overflow-hidden p-0 aspect-video">
        {playing ? (
          <iframe
            src={src}
            title={caption ?? "Video"}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative w-full h-full accent-hover transition-colors"
          >
            {poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <span className="relative inline-flex items-center gap-2 pill bg-background">
              Play <span aria-hidden>→</span>
            </span>
          </button>
        )}
      </div>
      {caption && <figcaption className="mt-3 text-xs text-muted">{caption}</figcaption>}
    </figure>
  );
}
