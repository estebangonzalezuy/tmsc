import type { Metadata } from "next";
import { site } from "@/lib/data";
import AboutPage from "@/components/pages/AboutPage";

export const metadata: Metadata = {
  title: `About — ${site.name}`,
};

export default function About() {
  return <AboutPage />;
}
