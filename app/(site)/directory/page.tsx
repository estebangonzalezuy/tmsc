import type { Metadata } from "next";
import DirectoryPage from "@/components/pages/DirectoryPage";
import { directoryTotal } from "@/lib/directory";

export const metadata: Metadata = {
  title: "the Directory | the Motion Social Club",
  description: `${directoryTotal} references: channels, courses, studios, tools, books, and the words for them. Organised, and honest about the source.`,
};

export default function Page() {
  return <DirectoryPage />;
}
