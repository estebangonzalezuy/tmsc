import { createRoot } from "react-dom/client";
import "dialkit/styles.css";
import "./styles.css";
import { loadFonts } from "./fonts.js";
import App from "./App.jsx";

loadFonts().then(() => {
  createRoot(document.getElementById("root")).render(<App />);
});
