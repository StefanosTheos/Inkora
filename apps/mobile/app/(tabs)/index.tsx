// Tab: HOME — role-aware. Studio owners get their business dashboard here (no
// discovery/AI); everyone else gets the seeker home feed.
import { useAuth } from "@inkora/data-access";

import { HomeScreen } from "../../src/features/home/HomeScreen";
import { StudioDashboardScreen } from "../../src/features/studio/StudioDashboardScreen";

export default function HomeTab() {
  const { ctx } = useAuth();
  if (ctx.roles.includes("studio_admin")) return <StudioDashboardScreen />;
  return <HomeScreen />;
}
