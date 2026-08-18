import type { Metadata } from "next";
import { site } from "@/lib/data";
import SponsorsPage from "@/components/pages/SponsorsPage";

export const metadata: Metadata = {
  title: `Sponsorship | ${site.name}`,
  description:
    "Reach around 6,000 motion designers by newsletter, 26,000 on LinkedIn, and a directory people arrive at ready to buy. Rates in public.",
};

export default function Sponsors() {
  return <SponsorsPage />;
}
