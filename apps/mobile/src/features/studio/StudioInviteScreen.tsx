import { Ionicons } from "@expo/vector-icons";
import { searchArtistsForInvite, studioInviteArtist, useAuth, useMyStudio } from "@inkora/data-access";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "../../components/Toast";
import { supabase } from "../../lib/supabase";
import { Avatar } from "../booking/components/ui";

export function StudioInviteScreen() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const studioQ = useMyStudio(supabase, meId);
  const studioId = studioQ.data?.id ?? "";
  const [query, setQuery] = useState("");
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const q = query.trim();
  const resultsQ = useQuery({
    queryKey: ["invite-search", q],
    queryFn: () => searchArtistsForInvite(supabase, q),
    enabled: q.length >= 2,
  });

  async function invite(artistId: string) {
    setBusy(artistId);
    try {
      await studioInviteArtist(supabase, studioId, artistId);
      setInvited((p) => new Set(p).add(artistId));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-studio", meId] }),
        qc.invalidateQueries({ queryKey: ["studio-overview", studioId] }),
      ]);
      toast.show("Invitation sent");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  const results = resultsQ.data ?? [];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.title}>Invite an artist</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color="#A1A1AA" />
        <TextInput style={s.searchInput} value={query} onChangeText={setQuery} placeholder="Search artists by name" placeholderTextColor="#A1A1AA" autoFocus autoCapitalize="none" />
        {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={18} color="#C4C4C8" /></Pressable> : null}
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {q.length < 2 ? (
          <Text style={s.muted}>Type at least two letters to search.</Text>
        ) : resultsQ.isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : results.length === 0 ? (
          <Text style={s.muted}>No artists match “{q}”.</Text>
        ) : (
          results.map((a) => {
            const done = invited.has(a.id);
            return (
              <View key={a.id} style={s.row}>
                <Pressable style={s.person} onPress={() => router.push(`/artist/${a.id}`)} accessibilityRole="button" accessibilityLabel={`View ${a.displayName}`}>
                  <Avatar path={a.avatarPath} name={a.displayName} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>{a.displayName}</Text>
                    <Text style={s.sub} numberOfLines={1}>{a.ratingCount > 0 ? `★ ${a.ratingAvg.toFixed(1)} · ${a.headline ?? "Artist"}` : a.headline ?? "Artist"}</Text>
                  </View>
                </Pressable>
                <Pressable style={[s.inviteBtn, done && s.inviteBtnDone]} disabled={done || busy === a.id} onPress={() => void invite(a.id)} accessibilityRole="button" accessibilityLabel={`Invite ${a.displayName}`}>
                  <Text style={[s.inviteText, done && s.inviteTextDone]}>{done ? "Invited" : busy === a.id ? "…" : "Invite"}</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 22, fontWeight: "800" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F4F4F5" },
  searchInput: { flex: 1, fontSize: 15, color: "#18181B" },
  body: { padding: 16, gap: 4 },
  muted: { color: "#A1A1AA", marginTop: 24, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontWeight: "800", fontSize: 15, color: "#18181B" },
  sub: { color: "#71717A", fontSize: 13, marginTop: 2 },
  inviteBtn: { backgroundColor: "#18181B", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  inviteBtnDone: { backgroundColor: "#F4F4F5" },
  inviteText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  inviteTextDone: { color: "#71717A" },
});
