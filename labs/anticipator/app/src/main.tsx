import { createRoot } from "react-dom/client";
import "dialkit/styles.css";
import "./styles.css";
import { loadFonts } from "./fonts.ts";
import App from "./App.tsx";

loadFonts().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
