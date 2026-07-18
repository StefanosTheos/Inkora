import { Ionicons } from "@expo/vector-icons";
import { deleteConversation, publicStorageUrl, useConversations } from "@inkora/data-access";
import { type ConversationSummary, timeAgo } from "@inkora/domain";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";
import { EmptyState } from "../../components/EmptyState";
import { RowSkeleton } from "../../components/Skeleton";
import { useToast } from "../../components/Toast";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);

export function ConversationsScreen() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const convs = useConversations(supabase);
  // Refresh when returning to the list so a chat just opened (which marks it
  // read) no longer shows the unread dot / bold text.
  const refetch = convs.refetch;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));

  async function onDelete(conv: ConversationSummary) {
    const ok = await confirm({
      title: "Are you sure you want to delete this chat?",
      message: "Any bookings or requests are still valid after the chat is deleted.",
      confirmLabel: "Yes",
      cancelLabel: "No",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteConversation(supabase, conv.id);
      await refetch();
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <Text style={s.title}>Chats</Text>
      <FlashList
        data={convs.data ?? []}
        estimatedItemSize={72}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <Row conv={item} onPress={() => router.push(`/chats/${item.id}`)} onDelete={() => void onDelete(item)} />}
        ListEmptyComponent={
          convs.isLoading ? (
            <View style={{ paddingTop: 8 }}>{Array.from({ length: 7 }).map((_, i) => <RowSkeleton key={i} />)}</View>
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title="No conversations yet"
              message="Message an artist or studio, and your chats will show up here."
              actionLabel="Find an artist"
              onAction={() => router.push("/discover")}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

function Row({ conv, onPress, onDelete }: { conv: ConversationSummary; onPress: () => void; onDelete: () => void }) {
  return (
    <View style={s.row}>
      <Pressable style={s.rowMain} onPress={onPress} onLongPress={onDelete} delayLongPress={350} accessibilityHint="Long-press or use the trash button to delete this chat">
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
      <Pressable onPress={onDelete} hitSlop={8} style={s.trash} accessibilityRole="button" accessibilityLabel={`Delete chat with ${conv.otherName}`}>
        <Ionicons name="trash-outline" size={20} color="#C4C4C8" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "800", paddingHorizontal: 16, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingRight: 8 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16, paddingVertical: 10 },
  trash: { padding: 10 },
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
});
