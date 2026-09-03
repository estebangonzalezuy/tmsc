// The Desk's fast path: turn a thought straight into a postable sheet, with
// no network and no token — same promise the old /tools/note made, now built
// as a PostGraph instead of a PostSpec (the Tools were retired with the rest
// of the old model; this is the one path AGENTS.md calls out by name as the
// Desk's landing place for the box, so it gets a small graph of its own
// rather than disappearing with the other seven).
//
// A single `type` node (the sheet, ruled paper defaults) feeding a `frame`
// feeding a `showreel` — the smallest graph the new model can express, built
// with the same makeNode/addEdge/encodeGraph the studio itself uses, so the
// link this hands back is exactly the kind of link "open in the studio"
// already knows how to reopen.

import { addEdge, defaultGraph, encodeGraph, makeNode, type PostGraph } from "@/lib/postgraph";

export function buildNoteGraph(line: string): PostGraph {
  const type = makeNode("type", 40, 60);
  type.params.kicker = "the Motion Social Club";
  type.params.title = line;
  type.params.titleFont = "serif";
  type.params.titleSize = "fit";
  type.params.ground = "#f4f3ef"; // paper, not flat white — the sheet register
  const frame = makeNode("frame", 420, 60);
  const showreel = makeNode("showreel", 680, 60);

  let graph: PostGraph = {
    ...defaultGraph(),
    nodes: [type, frame, showreel],
    edges: [],
  };
  graph = addEdge(graph, { from: { node: type.id, port: "out" }, to: { node: frame.id, port: "in" } });
  graph = addEdge(graph, { from: { node: frame.id, port: "out" }, to: { node: showreel.id, port: "in-1" } });
  return graph;
}

export function noteLink(line: string): string {
  return `/postlab#graph=${encodeGraph(buildNoteGraph(line))}`;
}
