import HomePage from "@/components/pages/HomePage";
import { roomCounts } from "@/lib/home";

export default function Home() {
  return <HomePage counts={roomCounts()} />;
}
