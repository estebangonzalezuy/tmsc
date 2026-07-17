"use client";

import { createContext, useContext } from "react";
import defaultContent from "@/content/site.json";

// Pages read content through this context so the Studio preview can swap in
// draft content live. Outside the preview the default (built) JSON is used,
// which keeps every public page fully static.

export type SiteContent = typeof defaultContent;

export const ContentContext = createContext<SiteContent>(defaultContent);

export const useContent = () => useContext(ContentContext);

// Marks an element as a clickable, editable section inside the Studio
// preview. Inert on the public site.
export function studioSection(id: string, label: string) {
  return { "data-studio-section": id, "data-studio-label": label };
}

// Sections listed in content.hidden are dropped from the site entirely.
// Older published content may predate the field, hence the fallback.
export function hiddenSet(content: SiteContent): Set<string> {
  const hidden = (content as { hidden?: string[] }).hidden ?? [];
  return new Set(hidden);
}
