import type { Metadata } from "next";
import { site } from "@/lib/data";
import LearnPage from "@/components/pages/LearnPage";

export const metadata: Metadata = {
  title: `Learn — ${site.name}`,
};

export default function Learn() {
  return <LearnPage />;
}
