// Tab: TEAM — studio owners only. The roster, suspended members, reviews and
// account settings that used to sit below the studio dashboard.
import { useAuth } from "@inkora/data-access";
import { Redirect } from "expo-router";

import { StudioTeamScreen } from "../../src/features/studio/StudioTeamScreen";

export default function TeamTab() {
  const { ctx } = useAuth();
  if (!ctx.roles.includes("studio_admin")) return <Redirect href="/" />;
  return <StudioTeamScreen />;
}
