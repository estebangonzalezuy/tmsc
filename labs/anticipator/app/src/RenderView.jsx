// #render: a bare canvas for the CLI exporter. No UI, no clock. The script
// loads a project and asks for exact frames:
//   window.__render.load(project) → { duration }
//   window.__render.renderAt(ms)  → draws that instant
//   window.__render.frame()       → PNG data URL of the canvas
import { useEffect, useRef } from "react";
import { renderProject, projectDuration } from "@core/render.js";

export default function RenderView({ cat }) {
  const ref = useRef(null);
  const specsRef = useRef(cat.specs);
  specsRef.current = cat.specs;
  useEffect(() => {
    let project = null;
    window.__render = {
      ready: true,
      load(p) {
        project = p;
        ref.current.width = p.width;
        ref.current.height = p.height;
        const missing = p.clips.filter((c) => !c.static && !specsRef.current[c.specId]).map((c) => c.specId);
        return { duration: projectDuration(p), missing };
      },
      renderAt(ms) {
        renderProject(ref.current.getContext("2d"), project, specsRef.current, ms);
      },
      frame() {
        return ref.current.toDataURL("image/png");
      },
    };
  }, []);
  return <canvas ref={ref} style={{ display: "block" }} />;
}
