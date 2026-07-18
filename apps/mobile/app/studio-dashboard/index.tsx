import { Redirect } from "expo-router";

// The studio owner's real dashboard is the Home tab (StudioDashboardScreen).
// This route only ever held a "coming soon" placeholder; redirect any stray
// navigation to `/studio-dashboard` back to the actual dashboard. (The sibling
// `/studio-dashboard/roster` route is real and unaffected.)
export default function StudioDashboardIndex() {
  return <Redirect href="/" />;
}
