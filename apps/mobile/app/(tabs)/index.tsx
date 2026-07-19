// Tab: HOME — role-aware. Studio owners get their business dashboard here (no
// discovery/AI); artists get their business home (bookings, requests, schedule);
// everyone else gets the seeker home feed.
import { useAuth } from "@inkora/data-access";

import { ArtistHomeScreen } from "../../src/features/dashboard/ArtistHomeScreen";
import { HomeScreen } from "../../src/features/home/HomeScreen";
import { StudioDashboardScreen } from "../../src/features/studio/StudioDashboardScreen";

export default function HomeTab() {
  const { ctx } = useAuth();
  if (ctx.roles.includes("studio_admin")) return <StudioDashboardScreen />;
  if (ctx.roles.includes("artist")) return <ArtistHomeScreen />;
  return <HomeScreen />;
}
