import type { Metadata } from "next";
import LinksPage from "@/components/pages/LinksPage";

// Internal. A link-in-bio index of everything the club has, in the shape
// people already know one from — so it stands alone, without the site's own
// header and footer around it.

export const metadata: Metadata = {
  title: "Links | the Motion Social Club",
  robots: { index: false, follow: false },
};

export default function Links() {
  return <LinksPage />;
}
