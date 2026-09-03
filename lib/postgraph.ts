// The Post Graph — an image-typed DAG that replaced the old PostSpec /
// layer-stack model wholesale (see AGENTS.md, Workstream 4).
//
// A graph is nodes and edges. Every edge carries an *image* — a rendered
// canvas — from one node's output port to another's input port. Structure is
// "like Supabrand": parallel branches (photo/field -> filter(s) -> type/shape
// -> mix) each terminate in their own `frame` node (one carousel slide, with
// its own live preview), and a single `showreel` node takes N `frame` outputs
// as *ordered* input ports (`in-1`, `in-2`, ...) — carousel order is
// structural, not a separate flat array.
//
// Two contracts carry over from the old model unchanged:
//   1. The loop is a contract — every node is a pure, periodic function of a
//      frame position p in [0,1]; any cycle count is forced to a whole number
//      (see `cleanMotion`), so an export can be produced frame-by-frame and
//      two exports of the same graph are byte-identical.
//   2. Nothing animated lives in React state. The graph itself is ordinary
//      React state (it changes at gesture rate — add a node, drag a wire),
//      but the playhead lives in `components/postlab/clock.ts`, untouched.

/* -------------------------------------------------------------- waves -- */

export const WAVES = ["sin", "tri", "saw", "square"] as const;
export type Wave = (typeof WAVES)[number];

export type Motion = {
  to: number;
  wave?: Wave;
  /** Whole trips per loop. Integers only — that's what keeps a graph
      seamless, so anything else is rounded. */
  cycles?: number;
  /** 0-1, where in the trip the loop starts. */
  phase?: number;
};

export type MotionMap = Record<string, Motion>;

/** `x` counts trips. Every shape returns to 0 at every whole x, which is why
    an integer cycle count leaves the loop without a seam. */
export function waveAt(wave: Wave, x: number): number {
  const f = x - Math.floor(x);
  switch (wave) {
    case "tri":
      return 1 - 2 * Math.abs(f - 0.5);
    case "saw":
      return f;
    case "square":
      return f < 0.5 ? 0 : 1;
    default:
      return 0.5 - 0.5 * Math.cos(2 * Math.PI * f);
  }
}

/** Keep only motion a node can actually carry, with whole cycle counts —
    the cycle count is *forced* to a whole number rather than trusted, since a
    fractional one is the one way a graph could hand back a post that doesn't
    loop. Used when the UI writes a new motion entry. */
export function cleanMotion(raw: unknown, controls: { key: string }[]): MotionMap | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const keys = new Set(controls.map((c) => c.key));
  const motion: MotionMap = {};
  for (const [key, m] of Object.entries(raw as MotionMap)) {
    if (!keys.has(key) || !m || typeof m.to !== "number") continue;
    motion[key] = {
      to: m.to,
      wave: WAVES.includes(m.wave as Wave) ? m.wave : "sin",
      cycles: Math.min(8, Math.max(1, Math.round(Number(m.cycles) || 1))),
      phase: Math.min(1, Math.max(0, Number(m.phase) || 0)),
    };
  }
  return Object.keys(motion).length ? motion : undefined;
}

/* Plug-and-play motion, unchanged from the old studio. */
export const LOOPS: { id: string; name: string; about: string; wave: Wave; cycles: number; amount: number }[] = [
  { id: "drift", name: "drift", about: "there and back, once, eased", wave: "sin", cycles: 1, amount: 0.35 },
  { id: "breathe", name: "breathe", about: "there and back, twice", wave: "sin", cycles: 2, amount: 0.25 },
  { id: "pulse", name: "pulse", about: "four times, eased", wave: "sin", cycles: 4, amount: 0.4 },
  { id: "swing", name: "swing", about: "straight there and back", wave: "tri", cycles: 2, amount: 0.3 },
  { id: "sweep", name: "sweep", about: "ramps all the way, then snaps", wave: "saw", cycles: 1, amount: 1 },
  { id: "march", name: "march", about: "ramps and snaps, three times", wave: "saw", cycles: 3, amount: 0.6 },
  { id: "blink", name: "blink", about: "switches hard, four times", wave: "square", cycles: 4, amount: 1 },
  { id: "hold", name: "far and back", about: "all the way to the other end", wave: "sin", cycles: 1, amount: 1 },
];
export const loopDef = (id: string) => LOOPS.find((l) => l.id === id);

export function applyLoop(id: string, control: { min: number; max: number }, from: number): Motion | null {
  const loop = loopDef(id);
  if (!loop) return null;
  const far = from - control.min > control.max - from ? control.min : control.max;
  const to = from + (far - from) * loop.amount;
  return {
    to: Math.round(Math.min(control.max, Math.max(control.min, to)) * 100) / 100,
    wave: loop.wave,
    cycles: loop.cycles,
    phase: 0,
  };
}

export function loopOf(m: Motion | undefined): string {
  if (!m) return "";
  const found = LOOPS.find((l) => l.wave === (m.wave ?? "sin") && l.cycles === Math.round(m.cycles ?? 1));
  return found?.id ?? "custom";
}

/* ------------------------------------------------------------- formats -- */

export type PostFormat = "square" | "portrait" | "story" | "landscape";

export const FORMATS: Record<PostFormat, { w: number; h: number; label: string; hint: string }> = {
  square: { w: 1080, h: 1080, label: "1:1", hint: "feed post" },
  portrait: { w: 1080, h: 1350, label: "4:5", hint: "feed / carousel" },
  story: { w: 1080, h: 1920, label: "9:16", hint: "reel / story" },
  landscape: { w: 1080, h: 608, label: "16:9", hint: "link / video post" },
};

/* --------------------------------------------------------------- graph -- */

export type NodeKind = "field" | "photo" | "type" | "shape" | "kinetic" | "filter" | "mix" | "frame" | "showreel";

export const NODE_KINDS_LIST: NodeKind[] = [
  "field",
  "photo",
  "type",
  "shape",
  "kinetic",
  "filter",
  "mix",
  "frame",
  "showreel",
];

export type ParamValue = number | string | boolean | string[];

export type GraphNode = {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  params: Record<string, ParamValue>;
  motion?: MotionMap;
  mute?: boolean;
};

export type PortRef = { node: string; port: string };
export type GraphEdge = { from: PortRef; to: PortRef };

export type PostGraph = {
  v: number;
  format: PostFormat;
  duration: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export const SPEC_VERSION = 1;

/* ------------------------------------------------------------- node defs */

export type ShaderControl = { key: string; label: string; min: number; max: number; step: number; def: number };
export type ShaderChoice = { key: string; label: string; values: string[]; def: string };
export type TextField = { key: string; label: string; rows?: number };
/** A generic boolean control — mirrors ShaderControl/ShaderChoice. Only
    `kinetic` (whose scene-specific toggles are too numerous to hardcode a
    section per node kind the way `type`'s single `italic` toggle is)
    declares these; the Inspector renders whatever it finds here the same
    generic way it renders `controls`/`choices`. */
export type BoolControl = { key: string; label: string; def: boolean; hint?: string };

/** Metadata for one node kind — what the inspector shows, and what a
    reroll/default reaches for. Mirrors the old ShaderDef/FilterDef shape. */
export type NodeDef = {
  kind: NodeKind;
  label: string;
  hint: string;
  inputs: string[];
  outputs: string[];
  controls: ShaderControl[];
  choices?: ShaderChoice[];
  bools?: BoolControl[];
  texts?: TextField[];
  /** True for a node whose inspector needs a Dropzone rather than sliders
      for its main subject (the `photo` node's picture). */
  media?: boolean;
  /** True for a node whose input-port count is computed from its own params
      (only `showreel`, via `slots`) rather than fixed by `inputs`. */
  dynamicInputs?: boolean;
};

export type NodeKindImpl = {
  def: NodeDef;
  defaultParams: () => Record<string, ParamValue>;
  /** Pure: same params + inputs + p always paints the same pixels. `inputs`
      is keyed by port name; a missing input is `null` and every evaluator
      treats that as "nothing drawn there" rather than throwing. */
  evaluate: (
    params: Record<string, ParamValue>,
    inputs: Record<string, HTMLCanvasElement | null>,
    p: number,
    w: number,
    h: number,
  ) => HTMLCanvasElement;
};

/* Runtime registry of the eight node kinds, assembled in
   components/postlab/nodes/index.ts. Imported here at the bottom of the file
   (not at the top) only to keep the dependency direction obvious: the nodes
   only ever `import type` from this file, so this is the one runtime edge
   between the two and there is no cycle. */
import { NODE_KINDS } from "@/components/postlab/nodes";

export function nodeDef(kind: NodeKind): NodeDef {
  return NODE_KINDS[kind].def;
}

export function inputPorts(node: GraphNode): string[] {
  const def = nodeDef(node.kind);
  if (!def.dynamicInputs) return def.inputs;
  const slots = Math.max(1, Math.min(12, Math.round(Number(node.params.slots) || 1)));
  return Array.from({ length: slots }, (_, i) => `in-${i + 1}`);
}

export function defaultNodeParams(kind: NodeKind): Record<string, ParamValue> {
  return NODE_KINDS[kind].defaultParams();
}

let counter = 1;
export function makeNode(kind: NodeKind, x: number, y: number): GraphNode {
  return { id: `${kind}-${Date.now().toString(36)}-${counter++}`, kind, x, y, params: defaultNodeParams(kind) };
}

/** A node's params with its travelling numbers resolved to the values they
    hold at `p` (0-1 through the loop). Preview and export both go through
    this, so what you watch and what you export are the same arithmetic. */
export function resolveNodeParams(node: GraphNode, p: number): Record<string, ParamValue> {
  if (!node.motion || !Object.keys(node.motion).length) return node.params;
  const out: Record<string, ParamValue> = { ...node.params };
  for (const [key, m] of Object.entries(node.motion)) {
    const from = typeof node.params[key] === "number" ? (node.params[key] as number) : 0;
    const cycles = Math.max(1, Math.round(m.cycles ?? 1));
    const k = waveAt(m.wave ?? "sin", cycles * p + (m.phase ?? 0));
    out[key] = from + (m.to - from) * k;
  }
  return out;
}

/* ----------------------------------------------------------- graph walk -- */

function byId(graph: PostGraph): Map<string, GraphNode> {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}

/** Every node the target depends on, the target included, in an order where
    a node's dependencies always come before it (Kahn's algorithm over the
    reverse-reachable subgraph). Throws only if the graph has an actual
    cycle, which the UI never produces (a wire can't be dropped onto its own
    ancestor) but is worth guarding regardless. */
export function ancestorSubgraph(graph: PostGraph, targetId: string): GraphNode[] {
  const nodes = byId(graph);
  const target = nodes.get(targetId);
  if (!target) return [];
  const reach = new Set<string>([targetId]);
  const stack = [targetId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const e of graph.edges) {
      if (e.to.node === id && !reach.has(e.from.node) && nodes.has(e.from.node)) {
        reach.add(e.from.node);
        stack.push(e.from.node);
      }
    }
  }
  const edges = graph.edges.filter((e) => reach.has(e.from.node) && reach.has(e.to.node));
  const indeg = new Map<string, number>([...reach].map((id) => [id, 0]));
  for (const e of edges) indeg.set(e.to.node, (indeg.get(e.to.node) ?? 0) + 1);
  const ready = [...reach].filter((id) => (indeg.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const e of edges.filter((e) => e.from.node === id)) {
      const left = (indeg.get(e.to.node) ?? 0) - 1;
      indeg.set(e.to.node, left);
      if (left === 0) ready.push(e.to.node);
    }
  }
  // A real cycle leaves nodes out of `order`; append them so renderFrame
  // still produces *something* rather than silently dropping the target.
  for (const id of reach) if (!order.includes(id)) order.push(id);
  return order.map((id) => nodes.get(id)!).filter(Boolean);
}

/** Render one node's ancestor subgraph at loop position `p`, into a fresh
    w x h canvas. This is the whole render path — the live preview, a node's
    own thumbnail, and every exported frame all call exactly this. */
export function renderFrame(graph: PostGraph, targetId: string, p: number, w: number, h: number): HTMLCanvasElement {
  const order = ancestorSubgraph(graph, targetId);
  const outputs = new Map<string, HTMLCanvasElement>();
  for (const node of order) {
    if (node.mute) continue;
    const impl = NODE_KINDS[node.kind];
    const ports = inputPorts(node);
    const inputs: Record<string, HTMLCanvasElement | null> = {};
    for (const port of ports) {
      const edge = graph.edges.find((e) => e.to.node === node.id && e.to.port === port);
      inputs[port] = edge ? (outputs.get(edge.from.node) ?? null) : null;
    }
    const params = resolveNodeParams(node, ((p % 1) + 1) % 1);
    try {
      outputs.set(node.id, impl.evaluate(params, inputs, ((p % 1) + 1) % 1, w, h));
    } catch {
      // A node mid-edit (bad param) shouldn't blank the whole canvas below
      // it; fall through with whatever its input already was.
      const blank = document.createElement("canvas");
      blank.width = w;
      blank.height = h;
      outputs.set(node.id, inputs[ports[0]] ?? blank);
    }
  }
  return outputs.get(targetId) ?? (() => {
    const blank = document.createElement("canvas");
    blank.width = w;
    blank.height = h;
    return blank;
  })();
}

/** The ordered `frame` node ids feeding a `showreel`, port order (`in-1`,
    `in-2`, ...) rather than edge-array order — that's what makes carousel
    order structural instead of a second list to keep in step. */
export function showreelFrames(graph: PostGraph, showreelId: string): string[] {
  const node = graph.nodes.find((n) => n.id === showreelId);
  if (!node) return [];
  return inputPorts(node)
    .map((port) => graph.edges.find((e) => e.to.node === showreelId && e.to.port === port))
    .filter((e): e is GraphEdge => !!e)
    .map((e) => e.from.node);
}

/* --------------------------------------------------------------- CRUD --- */

export function addEdge(graph: PostGraph, edge: GraphEdge): PostGraph {
  // One incoming wire per input port — a new connection replaces the old one,
  // same as dragging a cable out and plugging a different one in.
  const edges = graph.edges.filter((e) => !(e.to.node === edge.to.node && e.to.port === edge.to.port));
  // No self-loops, and no edge onto a node already upstream of the source —
  // that would be a cycle the UI should simply refuse to create.
  const upstream = new Set(ancestorSubgraph(graph, edge.from.node).map((n) => n.id));
  if (edge.from.node === edge.to.node || upstream.has(edge.to.node)) return graph;
  return { ...graph, edges: [...edges, edge] };
}

export function removeEdgesFor(graph: PostGraph, nodeId: string): GraphEdge[] {
  return graph.edges.filter((e) => e.from.node !== nodeId && e.to.node !== nodeId);
}

/* ------------------------------------------------------------- defaults -- */

export function defaultGraph(): PostGraph {
  const field = makeNode("field", 40, 60);
  const type = makeNode("type", 400, 60);
  const frame = makeNode("frame", 760, 60);
  const showreel = makeNode("showreel", 1000, 60);
  type.params.title = "You don't need more tutorials.\nYou need more *practice*.";
  type.params.kicker = "the Motion Social Club";
  type.params.footer = "@themotionsocialclub";
  return {
    v: SPEC_VERSION,
    format: "portrait",
    duration: 6,
    nodes: [field, type, frame, showreel],
    edges: [
      { from: { node: field.id, port: "out" }, to: { node: type.id, port: "in" } },
      { from: { node: type.id, port: "out" }, to: { node: frame.id, port: "in" } },
      { from: { node: frame.id, port: "out" }, to: { node: showreel.id, port: "in-1" } },
    ],
  };
}

/* --------------------------------------------------------- normalize ---- */

export function normalizeGraph(raw: unknown): PostGraph {
  const r = (raw ?? {}) as Partial<PostGraph>;
  if (!Array.isArray(r.nodes) || !r.nodes.length) return defaultGraph();
  const format: PostFormat = r.format && FORMATS[r.format] ? r.format : "portrait";
  const duration = typeof r.duration === "number" && r.duration > 0 ? r.duration : 6;
  const nodes: GraphNode[] = r.nodes
    .filter((n): n is GraphNode => !!n && typeof n === "object" && NODE_KINDS_LIST.includes((n as GraphNode).kind))
    .map((n) => ({
      id: String(n.id),
      kind: n.kind,
      x: Number(n.x) || 0,
      y: Number(n.y) || 0,
      params: { ...defaultNodeParams(n.kind), ...(n.params ?? {}) },
      motion: n.motion && typeof n.motion === "object" ? n.motion : undefined,
      mute: !!n.mute,
    }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = Array.isArray(r.edges)
    ? r.edges.filter(
        (e): e is GraphEdge =>
          !!e && !!e.from && !!e.to && ids.has(e.from.node) && ids.has(e.to.node) && typeof e.from.port === "string" && typeof e.to.port === "string",
      )
    : [];
  return { v: SPEC_VERSION, format, duration, nodes, edges };
}

/** Every node with just the params that differ from its kind's defaults, so
    a link stays short and picks up new fields for free at their default. */
export function minifyGraph(graph: PostGraph): Record<string, unknown> {
  return {
    v: graph.v,
    format: graph.format,
    duration: graph.duration,
    nodes: graph.nodes.map((n) => {
      const def = defaultNodeParams(n.kind);
      const params: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(n.params)) {
        if (JSON.stringify(v) !== JSON.stringify(def[k])) params[k] = v;
      }
      const out: Record<string, unknown> = { id: n.id, kind: n.kind, x: Math.round(n.x), y: Math.round(n.y), params };
      if (n.motion) out.motion = n.motion;
      if (n.mute) out.mute = true;
      return out;
    }),
    edges: graph.edges,
  };
}

export function encodeGraph(graph: PostGraph): string {
  const json = JSON.stringify(minifyGraph(graph));
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeGraph(encoded: string): PostGraph | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return normalizeGraph(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
