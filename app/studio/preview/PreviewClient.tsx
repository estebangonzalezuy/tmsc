"use client";

import { useEffect, useState } from "react";
import { ContentContext, type SiteContent } from "@/components/content";
import defaultContent from "@/content/site.json";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HomePage from "@/components/pages/HomePage";
import AboutPage from "@/components/pages/AboutPage";
import NewsletterPage from "@/components/pages/NewsletterPage";
import DirectoryPage from "@/components/pages/DirectoryPage";
import LearnPage from "@/components/pages/LearnPage";
import PracticePage from "@/components/pages/PracticePage";
import OfferingsPage from "@/components/pages/OfferingsPage";
import StillsPage from "@/components/pages/StillsPage";
import ClipsPage from "@/components/pages/ClipsPage";
import GroundPage from "@/components/pages/GroundPage";
import LinksPage from "@/components/pages/LinksPage";
import type { WallData } from "@/lib/stills-shared";
import type { ClipWall } from "@/lib/clips-shared";

const pages: Record<string, React.ComponentType> = {
  home: HomePage,
  about: AboutPage,
  newsletter: NewsletterPage,
  directory: DirectoryPage,
  learn: LearnPage,
  practice: PracticePage,
  offerings: OfferingsPage,
  ground: GroundPage,
  links: LinksPage,
};

// Editing affordances, only present inside the Studio's iframe.
const previewCss = `
  [data-studio-section] { position: relative; cursor: pointer; }
  [data-studio-section]:hover { outline: 2px dashed #0d0d0d; outline-offset: -2px; }
  [data-studio-section]:hover::before {
    content: "✎ " attr(data-studio-label);
    position: absolute;
    top: 0;
    left: 0;
    z-index: 40;
    background: #0d0d0d;
    color: #ffffff;
    font-size: 11px;
    padding: 3px 8px;
    pointer-events: none;
  }
  .studio-selected { outline: 2px solid #0d0d0d !important; outline-offset: -2px; }
`;

type ParentMessage =
  | { studio: "content"; content: SiteContent }
  | { studio: "page"; page: string }
  | { studio: "active"; section: string; scroll?: boolean };

// the Stills and the Clips are the two pages whose bodies are data rather than
// copy, so the server route reads both and passes them down. Without them the
// preview would show an empty wall while the owner edits the copy above it.
export default function PreviewClient({
  stillsWall,
  clipsWall,
}: {
  stillsWall?: WallData;
  clipsWall?: ClipWall;
}) {
  const [content, setContent] = useState<SiteContent>(defaultContent);
  const [page, setPage] = useState("home");
  const [active, setActive] = useState("");
  const [scrollTo, setScrollTo] = useState(0);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as ParentMessage;
      if (!d || typeof d !== "object") return;
      if (d.studio === "content") setContent(d.content);
      if (d.studio === "page") setPage(d.page);
      if (d.studio === "active") {
        setActive(d.section);
        if (d.scroll) setScrollTo((n) => n + 1);
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage(
      { studio: "preview-ready" },
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // In the preview no link navigates; a click selects the section it is in.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      const target = (e.target as HTMLElement).closest?.(
        "[data-studio-section]",
      );
      if (!target) return;
      const section = target.getAttribute("data-studio-section") ?? "";
      setActive(section);
      window.parent.postMessage(
        { studio: "section-click", section },
        window.location.origin,
      );
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    document.querySelectorAll("[data-studio-section]").forEach((el) => {
      el.classList.toggle(
        "studio-selected",
        el.getAttribute("data-studio-section") === active,
      );
    });
  }, [active, page, content]);

  useEffect(() => {
    if (!scrollTo) return;
    document
      .querySelector(`[data-studio-section="${active}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo]);

  const Page = pages[page] ?? HomePage;

  return (
    <ContentContext.Provider value={content}>
      <style>{previewCss}</style>
      <SiteHeader />
      <main className="flex-1">
        {page === "stills" ? (
          <StillsPage wall={stillsWall} />
        ) : page === "clips" ? (
          <ClipsPage wall={clipsWall} />
        ) : (
          <Page />
        )}
      </main>
      <SiteFooter />
    </ContentContext.Provider>
  );
}
