import type { Metadata } from "next";
import { site } from "@/lib/data";
import OfferingsPage from "@/components/pages/OfferingsPage";

export const metadata: Metadata = {
  title: `Offerings — ${site.name}`,
};

export default function Offerings() {
  return <OfferingsPage />;
}
