import type { Metadata } from "next";
import StudioEditor from "./StudioEditor";

export const metadata: Metadata = {
  title: "Studio — the Motion Social Club",
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  return <StudioEditor />;
}
