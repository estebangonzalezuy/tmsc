import type { Metadata } from "next";
import DirectoryPage from "@/components/pages/DirectoryPage";
import { directoryTotal } from "@/lib/directory";

export const metadata: Metadata = {
  title: "the Directory | the Motion Social Club",
  description: `${directoryTotal} curated motion design resources: YouTube channels, courses, studios, tools, books and the vocabulary, organised and filterable.`,
};

export default function Page() {
  return <DirectoryPage />;
}
