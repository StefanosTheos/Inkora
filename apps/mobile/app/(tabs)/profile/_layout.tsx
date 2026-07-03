import { Stack } from "expo-router";

// Anchor the profile tab on its dashboard (index) so navigating to
// /profile/settings or /profile/account always keeps the dashboard beneath —
// Back returns to the dashboard instead of escaping to Home.
export const unstable_settings = { initialRouteName: "index" };

export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
