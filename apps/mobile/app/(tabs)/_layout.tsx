import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@inkora/data-access";
import { router, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import { useBadgeCounts } from "../../src/lib/badges";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type IconProps = { color: string; size: number; focused: boolean };

/** Tab icon that swaps to the filled variant when focused. */
function tabIcon(active: IoniconName, inactive: IoniconName) {
  return ({ color, size, focused }: IconProps) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}

/** Icon with an optional red notification dot in the top-right corner. */
function DotIcon({ active, inactive, color, size, focused, show }: IconProps & { active: IoniconName; inactive: IoniconName; show: boolean }) {
  return (
    <View>
      <Ionicons name={focused ? active : inactive} size={size} color={color} />
      {show ? <View style={s.dot} /> : null}
    </View>
  );
}

function ChatsTabIcon(props: IconProps) {
  const { chats } = useBadgeCounts();
  return <DotIcon {...props} active="chatbubble" inactive="chatbubble-outline" show={chats > 0} />;
}

function ProfileTabIcon(props: IconProps) {
  const { ctx } = useAuth();
  const { rewards, offers, requests, journey, openRequests, newBookings, newCompleted, apptReplies } = useBadgeCounts();
  const show = ctx.roles.includes("artist")
    ? requests + newBookings + newCompleted + apptReplies > 0
    : rewards + offers + journey + openRequests + newBookings + apptReplies > 0;
  return <DotIcon {...props} active="person" inactive="person-outline" show={show} />;
}

export default function TabsLayout() {
  const { ctx } = useAuth();
  // Studio owners get a business-only tab set: Studio dashboard + Chats. The
  // discovery/AI/profile tabs are hidden (routes still exist for deep links).
  const isStudio = ctx.roles.includes("studio_admin");
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#E5484D",
        tabBarInactiveTintColor: "#71717A",
      }}
    >
      <Tabs.Screen name="index" options={{ title: isStudio ? "Studio" : "Home", tabBarIcon: tabIcon(isStudio ? "business" : "home", isStudio ? "business-outline" : "home-outline") }} />
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarIcon: tabIcon("search", "search-outline"), href: isStudio ? null : undefined }} />
      <Tabs.Screen name="create" options={{ title: "Create", tabBarIcon: tabIcon("add-circle", "add-circle-outline"), href: isStudio ? null : undefined }} />
      <Tabs.Screen
        name="chats"
        options={{ title: "Chats", tabBarIcon: (p) => <ChatsTabIcon {...p} /> }}
        listeners={{
          // Always land on the conversation list, even if a thread is still
          // on top of the Chats stack from a previous deep-link.
          tabPress: (e) => {
            e.preventDefault();
            router.navigate("/chats");
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: (p) => <ProfileTabIcon {...p} />, href: isStudio ? null : undefined }}
        listeners={{
          // Always land on the dashboard, even if Edit profile / Account
          // settings is still on top of the Profile stack from a deep-link
          // (e.g. Rewards → "complete your profile" → Edit profile).
          tabPress: (e) => {
            e.preventDefault();
            router.navigate("/profile");
          },
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  dot: { position: "absolute", top: -2, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: "#E5484D", borderWidth: 1.5, borderColor: "#fff" },
});
