import type { Metadata } from "next";
import Kinetics from "@/components/kinetics/Kinetics";

export const metadata: Metadata = {
  title: "the Kinetics — the Motion Social Club",
  description: "Where the words are the picture: seven ways of animating type.",
  robots: { index: false, follow: false },
};

export default function KineticsPage() {
  return <Kinetics />;
}
