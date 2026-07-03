import { publicStorageUrl, useConversations } from "@inkora/data-access";
import { type ConversationSummary, timeAgo } from "@inkora/domain";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);

export function ConversationsScreen() {
  const router = useRouter();
  const convs = useConversations(supabase);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <Text style={s.title}>Chats</Text>
      <FlashList
        data={convs.data ?? []}
        estimatedItemSize={72}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <Row conv={item} onPress={() => router.push(`/chats/${item.id}`)} />}
        ListEmptyComponent={
          convs.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> : (
            <Text style={s.empty}>No conversations yet. Message an artist to start one.</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

function Row({ conv, onPress }: { conv: ConversationSummary; onPress: () => void }) {
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={s.avatar}>
        {img(conv.otherAvatarPath) ? <Image source={{ uri: img(conv.otherAvatarPath) }} style={s.avatarImg} contentFit="cover" /> : (
          <Text style={s.avatarInitial}>{conv.otherName.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.name, conv.unread && s.unreadName]} numberOfLines={1}>{conv.otherName}</Text>
        <Text style={[s.preview, conv.unread && s.unreadPreview]} numberOfLines={1}>{conv.lastMessagePreview ?? "No messages yet"}</Text>
      </View>
      <View style={s.rightCol}>
        <Text style={s.time}>{timeAgo(conv.lastMessageAt)}</Text>
        {conv.unread && <View style={s.dot} />}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "800", paddingHorizontal: 16, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { color: "#fff", fontSize: 22, fontWeight: "800" },
  name: { fontWeight: "600", fontSize: 16 },
  unreadName: { fontWeight: "800" },
  preview: { color: "#A1A1AA", fontSize: 14, marginTop: 2 },
  unreadPreview: { color: "#18181B", fontWeight: "600" },
  rightCol: { alignItems: "flex-end", gap: 6 },
  time: { color: "#A1A1AA", fontSize: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#E5484D" },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 40, paddingHorizontal: 24 },
});
