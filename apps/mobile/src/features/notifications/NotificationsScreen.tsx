import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "@inkora/data-access";
import { NOTIFICATION_ICON, type Notification, notificationHref } from "@inkora/domain";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationsScreen() {
  const router = useRouter();
  const { notifications, unread, isLoading, markRead, markAllRead } = useNotifications(supabase);

  function open(n: Notification) {
    void markRead(n.id);
    router.push(notificationHref(n) as never);
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.title}>Notifications</Text>
        {unread > 0 ? (
          <Pressable onPress={() => void markAllRead()} hitSlop={8}><Text style={s.markAll}>Mark all</Text></Pressable>
        ) : <View style={{ width: 60 }} />}
      </View>
      <FlashList
        data={notifications}
        estimatedItemSize={76}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <Pressable style={[s.row, !item.readAt && s.rowUnread]} onPress={() => open(item)}>
            <Text style={s.icon}>{NOTIFICATION_ICON[item.type] ?? "🔔"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowTitle, !item.readAt && s.bold]} numberOfLines={1}>{item.title}</Text>
              {item.body ? <Text style={s.rowBody} numberOfLines={2}>{item.body}</Text> : null}
            </View>
            <View style={s.rightCol}>
              <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
              {!item.readAt && <View style={s.dot} />}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          isLoading ? <ActivityIndicator style={{ marginTop: 40 }} /> : (
            <Text style={s.empty}>You’re all caught up. Notifications about bookings, offers and messages show up here.</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 20, fontWeight: "800" },
  markAll: { color: "#E5484D", fontWeight: "700", width: 60, textAlign: "right" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowUnread: { backgroundColor: "#FEF2F2" },
  icon: { fontSize: 24 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#18181B" },
  bold: { fontWeight: "800" },
  rowBody: { color: "#71717A", fontSize: 13, marginTop: 2 },
  rightCol: { alignItems: "flex-end", gap: 6 },
  time: { color: "#A1A1AA", fontSize: 12 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#E5484D" },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 48, paddingHorizontal: 32, lineHeight: 20 },
});
