import type { Metadata } from "next";
import Cutter from "@/components/clips/Cutter";

export const metadata: Metadata = {
  title: "the Cutter — the Motion Social Club",
  robots: { index: false, follow: false },
};

export default function CutPage() {
  return <Cutter />;
}
