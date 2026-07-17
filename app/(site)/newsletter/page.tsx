import type { Metadata } from "next";
import { site } from "@/lib/data";
import NewsletterPage from "@/components/pages/NewsletterPage";

export const metadata: Metadata = {
  title: `Newsletter — ${site.name}`,
};

export default function Newsletter() {
  return <NewsletterPage />;
}
