import { Stack } from "expo-router";

// Anchor on create/index so /create/new and /create/[id] keep it beneath —
// Back returns here instead of escaping to Home.
export const unstable_settings = { initialRouteName: "index" };

export default function CreateLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
