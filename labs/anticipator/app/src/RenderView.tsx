// #render: a bare canvas for the CLI exporter. No UI, no clock. The script
// loads a project and asks for exact frames through window.__render.
import { useEffect, useRef } from "react";
import { renderAt, projectDuration } from "@core/render.ts";
import type { Project } from "@core/types.ts";
import type { CatalogState } from "./catalog.ts";

export default function RenderView({ cat }: { cat: CatalogState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const specsRef = useRef(cat.specs);
  specsRef.current = cat.specs;
  useEffect(() => {
    let project: Project | null = null;
    window.__render = {
      ready: true,
      load(p) {
        project = p;
        ref.current!.width = p.width;
        ref.current!.height = p.height;
        const missing = p.clips.filter((c) => !c.static && !(c.specId && specsRef.current[c.specId])).map((c) => String(c.specId));
        return { duration: projectDuration(p), missing };
      },
      renderAt(ms) {
        if (project) renderAt(ref.current!.getContext("2d")!, project, specsRef.current, ms);
      },
      frame() {
        return ref.current!.toDataURL("image/png");
      },
    };
  }, []);
  return <canvas ref={ref} style={{ display: "block" }} />;
}
