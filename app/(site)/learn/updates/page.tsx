import type { Metadata } from "next";
import LearnUpdatesPage from "@/components/pages/LearnUpdatesPage";
import { updates } from "@/lib/learn";

export const metadata: Metadata = {
  title: "Updates | Learn | the Motion Social Club",
  description:
    "Everything added to the club's library, newest first. Buy it once and what comes later is yours too.",
};

export default function Page() {
  return <LearnUpdatesPage updates={updates} />;
}
