import { Redirect } from "expo-router";

// The studio owner's real dashboard is the Home tab (StudioDashboardScreen), and
// the roster now lives on the Team tab. This legacy route only ever held a
// "coming soon" placeholder; redirect any stray navigation to the home tab.
export default function StudioDashboardIndex() {
  return <Redirect href="/" />;
}
