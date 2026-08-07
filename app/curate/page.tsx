import type { Metadata } from "next";
import Curator from "@/components/stills/Curator";

export const metadata: Metadata = {
  title: "the Curator — the Motion Social Club",
  robots: { index: false, follow: false },
};

export default function CuratePage() {
  return <Curator />;
}
