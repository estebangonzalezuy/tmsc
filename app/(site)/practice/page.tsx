import type { Metadata } from "next";
import { site } from "@/lib/data";
import PracticePage from "@/components/pages/PracticePage";

export const metadata: Metadata = {
  title: `Practice — ${site.name}`,
  description:
    "Tell the club how long you have and where you are. It hands back one motion exercise to finish in that time.",
};

export default function Practice() {
  return <PracticePage />;
}
