import { Stack } from "expo-router";

// Anchor on chats/index so a thread (/chats/[id]) keeps the list beneath —
// Back returns to the conversation list instead of escaping to Home.
export const unstable_settings = { initialRouteName: "index" };

export default function ChatsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
