import { useState } from "react";
import { useCatalog } from "./catalog.js";
import Lab from "./lab/Lab.jsx";
import Editor from "./editor/Editor.jsx";
import RenderView from "./RenderView.jsx";

function initialTab() {
  const h = location.hash.replace("#", "");
  return h === "editor" ? "editor" : "lab";
}

export default function App() {
  const [tab, setTab] = useState(initialTab);
  const cat = useCatalog();
  if (location.hash === "#render") return <RenderView cat={cat} />;
  const go = (t) => { setTab(t); history.replaceState(null, "", `#${t}`); };
  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">Anticipator</span>
        <span className="credit">
          real springs + anticipation for text specs, an expansion of{" "}
          <a href="https://github.com/pixel-point/animate-text" target="_blank" rel="noreferrer">
            Pixel Point&rsquo;s animate-text
          </a>{" "}
          by Alex Barashkov
        </span>
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={tab === "lab"} onClick={() => go("lab")}>Lab</button>
          <button className="tab" role="tab" aria-selected={tab === "editor"} onClick={() => go("editor")}>Editor</button>
        </div>
      </div>
      {tab === "lab" ? <Lab cat={cat} /> : <Editor cat={cat} />}
    </div>
  );
}
