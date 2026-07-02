import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "@inkora/data-access";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";

export function NotificationBell({ color = "#18181B" }: { color?: string }) {
  const router = useRouter();
  const { unread } = useNotifications(supabase);
  return (
    <Pressable
      hitSlop={10}
      onPress={() => router.push("/notifications")}
      style={s.wrap}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Ionicons name="notifications-outline" size={24} color={color} />
      {unread > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 2 },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#E5484D", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
