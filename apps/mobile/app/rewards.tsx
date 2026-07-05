// Route: /rewards — points, tiers, vouchers, referrals, profile completion.
// Client-only loyalty program: artists don't participate, so bounce them home
// (also covers a stray "reward" notification tapped by an artist).
import { useAuth } from "@inkora/data-access";
import { Redirect } from "expo-router";

import { RewardsScreen } from "../src/features/rewards/RewardsScreen";

export default function RewardsRoute() {
  const { ctx } = useAuth();
  if (ctx.roles.includes("artist")) return <Redirect href="/profile" />;
  return <RewardsScreen />;
}
