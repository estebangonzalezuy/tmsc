import type { Metadata } from "next";
import { site } from "@/lib/data";
import ResourcesPage from "@/components/pages/ResourcesPage";

export const metadata: Metadata = {
  title: `Resources — ${site.name}`,
};

export default function Resources() {
  return <ResourcesPage />;
}
