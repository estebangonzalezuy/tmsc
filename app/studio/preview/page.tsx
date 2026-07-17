import type { Metadata } from "next";
import PreviewClient from "./PreviewClient";

export const metadata: Metadata = {
  title: "Preview — the Studio",
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  return <PreviewClient />;
}
