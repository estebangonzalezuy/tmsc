import type { Metadata } from "next";
import Scheduler from "@/components/scheduler/Scheduler";

export const metadata: Metadata = {
  title: "the Scheduler — the Motion Social Club",
  robots: { index: false, follow: false },
};

export default function SchedulePage() {
  return <Scheduler />;
}
