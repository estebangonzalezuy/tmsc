"use client";

// The node-graph studio's shell: a top bar, an add-node rail docked left, the
// node canvas filling the middle, the inspector docked right with export in
// its footer. State is `graph: PostGraph` (ordinary React state — it changes
// at gesture rate: add a node, drag a wire) plus `selectedNodeId`; pan/zoom
// and any in-progress drag live outside React entirely, in
// canvas/viewport.ts and canvas/positions.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NODE_KINDS_LIST,
  decodeGraph,
  defaultGraph,
  encodeGraph,
  makeNode,
  nodeDef,
  normalizeGraph,
  removeEdgesFor,
  type NodeKind,
  type ParamValue,
  type PostGraph,
} from "@/lib/postgraph";
import { STAGE, TopBar, Panel, Rail, RailItem, Btn, Primary, Segmented, Select, Text, Drawer } from "./toolcraft";
import NodeCanvas from "./canvas/NodeCanvas";
import Inspector from "./canvas/Inspector";
import { useExports, type Quality } from "./useExports";
import { useClockRunning } from "./Stage";

const KIND_ICON: Record<NodeKind, string> = {
  field: "◎",
  photo: "▧",
  type: "T",
  shape: "◇",
  kinetic: "◍",
  filter: "▤",
  mix: "⊕",
  frame: "▭",
  showreel: "▦",
};

export default function PostGraphStudio() {
  const [graph, setGraph] = useState<PostGraph>(() => defaultGraph());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const loadedFromHash = useRef(false);
  const hashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Every node's own thumbnail (GraphPoster, live) and the showreel preview
     are functions of the shared clock — nothing draws a second frame unless
     something actually advances it. "Nothing shipped is still": the studio
     always plays, the same as the old model's stage always did. */
  useClockRunning(true, graph.duration);

  const readHash = useCallback(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const encoded = params.get("graph");
    const decoded = encoded ? decodeGraph(encoded) : null;
    if (decoded) setGraph(decoded);
  }, []);

  /* The address is an external system, and this is a subscription to it — a
     link pasted into a tab that's already open has to land, and our own
     `replaceState` below doesn't fire the event, so there's no loop to worry
     about. The first read is dispatched via rAF rather than run inline in the
     effect body: decoding during mount would be a second render before the
     first had painted. */
  useEffect(() => {
    window.addEventListener("hashchange", readHash);
    const first = requestAnimationFrame(() => {
      readHash();
      loadedFromHash.current = true;
    });
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("hashchange", readHash);
    };
  }, [readHash]);

  useEffect(() => {
    if (!loadedFromHash.current) return;
    if (hashTimer.current) clearTimeout(hashTimer.current);
    hashTimer.current = setTimeout(() => {
      window.history.replaceState(null, "", `#graph=${encodeGraph(graph)}`);
    }, 400);
    return () => {
      if (hashTimer.current) clearTimeout(hashTimer.current);
    };
  }, [graph]);

  const showreel = graph.nodes.find((n) => n.kind === "showreel") ?? null;
  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const say = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus((s) => (s === msg ? "" : s)), 3000);
  };

  const exports = useExports({ graph, showreelId: showreel?.id ?? null, say });

  const addNode = (kind: NodeKind) => {
    /* Dropped in a loose cascade so a run of adds doesn't stack every box on
       top of the last one. */
    const n = graph.nodes.length;
    const node = makeNode(kind, 40 + (n % 5) * 40, 260 + Math.floor(n / 5) * 40);
    setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
    setSelectedNodeId(node.id);
  };

  const updateNodeParams = (id: string, patch: Record<string, ParamValue>) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === id ? { ...n, params: { ...n.params, ...patch } } : n)),
    }));
  };

  const commitMove = (id: string, x: number, y: number) => {
    setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) }));
  };

  const toggleMute = (id: string) => {
    setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, mute: !n.mute } : n)) }));
  };

  const deleteNode = (id: string) => {
    setGraph((g) => ({ ...g, nodes: g.nodes.filter((n) => n.id !== id), edges: removeEdgesFor(g, id) }));
    setSelectedNodeId((s) => (s === id ? null : s));
  };

  const onUpdateGraph = (next: PostGraph) => setGraph(next);

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#graph=${encodeGraph(graph)}`;
    try {
      await navigator.clipboard.writeText(url);
      say("Link copied");
    } catch {
      say(url);
    }
  };

  const doImport = () => {
    const text = importText.trim();
    let next: PostGraph | null = null;
    const afterHash = text.includes("#graph=") ? text.split("#graph=")[1] : text;
    if (/^[A-Za-z0-9_-]+$/.test(afterHash)) next = decodeGraph(afterHash);
    if (!next) {
      try {
        next = normalizeGraph(JSON.parse(text));
      } catch {
        next = null;
      }
    }
    if (next) {
      setGraph(next);
      setSelectedNodeId(null);
      setImportOpen(false);
      setImportText("");
      say("Loaded");
    } else {
      say("Couldn't read that");
    }
  };

  return (
    <div className={`${STAGE} fixed inset-0 flex flex-col`}>
      <TopBar title="the Posts Studio" mark="✦">
        <Btn onClick={() => setImportOpen(true)}>Import</Btn>
        <Btn onClick={() => void share()}>Share</Btn>
        {status && <span className="text-[12px] text-[color:var(--tc-ink-3)] px-1">{status}</span>}
      </TopBar>
      <div className="flex-1 min-h-0 flex md:flex-row flex-col">
        <Panel title="Add a node" dock="left" width={220}>
          <div className="p-3">
            <Rail cols={2}>
              {NODE_KINDS_LIST.map((kind) => (
                <RailItem key={kind} label={nodeDef(kind).label} onClick={() => addNode(kind)} title={nodeDef(kind).hint}>
                  <span className="text-[20px] text-[color:var(--tc-ink-2)]">{KIND_ICON[kind]}</span>
                </RailItem>
              ))}
            </Rail>
          </div>
        </Panel>
        <div className="flex-1 min-h-0 relative">
          <NodeCanvas
            graph={graph}
            selectedNodeId={selectedNodeId}
            onSelect={setSelectedNodeId}
            onUpdateGraph={onUpdateGraph}
            onCommitMove={commitMove}
            onToggleMute={toggleMute}
            onDeleteNode={deleteNode}
          />
        </div>
        <Inspector
          node={selectedNode}
          onChange={updateNodeParams}
          footer={
            <ExportFooter
              format={graph.format}
              onFormat={(format) => setGraph((g) => ({ ...g, format }))}
              duration={graph.duration}
              onDuration={(duration) => setGraph((g) => ({ ...g, duration }))}
              quality={exports.quality}
              onQuality={exports.setQuality}
              job={exports.job}
              frames={exports.frames}
              onSavePng={() => (exports.frames.length > 1 ? exports.saveAllPngs() : exports.savePng(exports.frames[0]))}
              onSaveVideo={() => exports.frames[0] && exports.saveVideo(exports.frames[0])}
              onSaveGif={() => exports.frames[0] && exports.saveGif(exports.frames[0])}
            />
          }
        />
      </div>
      {importOpen && (
        <Drawer title="Import a graph" onClose={() => setImportOpen(false)}>
          <div className="space-y-3">
            <Text
              value={importText}
              onChange={setImportText}
              rows={6}
              placeholder="Paste a /postlab#graph=... link, or the raw graph JSON"
              mono
            />
            <Primary onClick={doImport}>Load</Primary>
          </div>
        </Drawer>
      )}
    </div>
  );
}

function ExportFooter({
  format,
  onFormat,
  duration,
  onDuration,
  quality,
  onQuality,
  job,
  frames,
  onSavePng,
  onSaveVideo,
  onSaveGif,
}: {
  format: PostGraph["format"];
  onFormat: (f: PostGraph["format"]) => void;
  duration: number;
  onDuration: (d: number) => void;
  quality: Quality;
  onQuality: (q: Quality) => void;
  job: { label: string; frac: number } | null;
  frames: string[];
  onSavePng: () => void;
  onSaveVideo: () => void;
  onSaveGif: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={format} onChange={(v) => onFormat(v as PostGraph["format"])} options={FORMAT_OPTIONS} />
        <input
          type="number"
          value={duration}
          min={2}
          max={20}
          onChange={(e) => onDuration(Math.max(2, Number(e.target.value) || 6))}
          className="tc-field w-16 h-[var(--tc-h)] px-2 text-[12.5px] text-right"
          title="Duration, seconds"
        />
      </div>
      <Segmented value={quality} options={QUALITY_OPTIONS} onChange={(v) => onQuality(v)} />
      {job ? (
        <div className="space-y-1">
          <div className="h-1 rounded-full overflow-hidden bg-[color:var(--tc-track)]">
            <div className="h-full bg-[color:var(--tc-live)]" style={{ width: `${Math.round(job.frac * 100)}%` }} />
          </div>
          <p className="text-[11px] text-[color:var(--tc-ink-3)]">{job.label}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          <Btn wide disabled={!frames.length} onClick={onSavePng} title="Save PNG">
            PNG
          </Btn>
          <Btn wide disabled={!frames.length} onClick={onSaveVideo} title="Record video">
            Video
          </Btn>
          <Btn wide disabled={!frames.length} onClick={onSaveGif} title="Record GIF">
            GIF
          </Btn>
        </div>
      )}
      {!frames.length && <p className="text-[11px] text-[color:var(--tc-ink-3)]">Wire a frame into the showreel to export.</p>}
    </div>
  );
}

const FORMAT_OPTIONS = [
  { value: "square", label: "1:1 square" },
  { value: "portrait", label: "4:5 portrait" },
  { value: "story", label: "9:16 story" },
  { value: "landscape", label: "16:9 landscape" },
];

const QUALITY_OPTIONS: { value: Quality; label: string }[] = [
  { value: "mid", label: "1080" },
  { value: "high", label: "2160" },
  { value: "max", label: "4K" },
];
