import HomePage from "@/components/pages/HomePage";
import { homeWalls, roomCounts } from "@/lib/home";

export default function Home() {
  return <HomePage counts={roomCounts()} walls={homeWalls()} />;
}
