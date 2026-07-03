import { Stack } from "expo-router";

// Anchor on discover/index so /discover/map keeps it beneath — Back returns
// here instead of escaping to Home.
export const unstable_settings = { initialRouteName: "index" };

export default function DiscoverLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
