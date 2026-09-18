// The four formats the club posts in. This is the one thing borrowed from the
// Posts Studio (lib/postgraph.ts) — the sizes and aspect ratios, nothing else.
window.FRAMES = window.FRAMES || {};

FRAMES.FORMATS = {
  square:    { w: 1080, h: 1080, label: "1:1",  hint: "feed post" },
  portrait:  { w: 1080, h: 1350, label: "4:5",  hint: "feed / carousel" },
  story:     { w: 1080, h: 1920, label: "9:16", hint: "reel / story" },
  landscape: { w: 1080, h: 608,  label: "16:9", hint: "link / video post" },
};

FRAMES.DEFAULT_FORMAT = "portrait";
