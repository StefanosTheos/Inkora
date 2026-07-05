// Route: /profile — role-aware: artists get the artist dashboard, everyone else
// the seeker dashboard (bookings, saved, rewards, journey, stats, settings).
import { useAuth } from "@inkora/data-access";

import { ArtistDashboardScreen } from "../../../src/features/dashboard/ArtistDashboardScreen";
import { UserDashboardScreen } from "../../../src/features/dashboard/UserDashboardScreen";

export default function ProfileScreen() {
  const { ctx } = useAuth();
  return ctx.roles.includes("artist") ? <ArtistDashboardScreen /> : <UserDashboardScreen />;
}
