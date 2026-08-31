import type { Metadata } from "next";
import { site } from "@/lib/data";
import GroundPage from "@/components/pages/GroundPage";

export const metadata: Metadata = {
  title: `the Ground | ${site.name}`,
  description:
    "An open app for practising motion design in public. Post the work that isn't ready, and tell somebody else what you see in theirs.",
};

export default function Ground() {
  return <GroundPage />;
}
