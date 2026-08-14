import type { Metadata } from "next";
import { site } from "@/lib/data";
import LinksPage from "@/components/pages/LinksPage";

export const metadata: Metadata = {
  title: `Links | ${site.name}`,
  description: "Every link the club hands out, gathered on one page.",
};

export default function Links() {
  return <LinksPage />;
}
