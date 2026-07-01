import { Ionicons } from "@expo/vector-icons";
import { router, Tabs } from "expo-router";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

/** Tab icon that swaps to the filled variant when focused. */
function tabIcon(active: IoniconName, inactive: IoniconName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#E5484D",
        tabBarInactiveTintColor: "#71717A",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: tabIcon("home", "home-outline") }} />
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarIcon: tabIcon("search", "search-outline") }} />
      <Tabs.Screen name="create" options={{ title: "Create", tabBarIcon: tabIcon("add-circle", "add-circle-outline") }} />
      <Tabs.Screen
        name="chats"
        options={{ title: "Chats", tabBarIcon: tabIcon("chatbubble", "chatbubble-outline") }}
        listeners={{
          // Always land on the conversation list, even if a thread is still
          // on top of the Chats stack from a previous deep-link.
          tabPress: (e) => {
            e.preventDefault();
            router.navigate("/chats");
          },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: tabIcon("person", "person-outline") }} />
    </Tabs>
  );
}
