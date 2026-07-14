import { Ionicons } from "@expo/vector-icons";
import { respondStudioApplication, useAuth, useMyStudio, useStudioApplications } from "@inkora/data-access";
import type { StudioApplication } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { supabase } from "../../lib/supabase";
import { Avatar } from "../booking/components/ui";

const DAY = 24 * 60 * 60 * 1000;
const APPLICATION_DAYS = 5;

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}
/** Days until the 5-day auto-reject window closes. */
function expiresIn(iso: string): string {
  const ms = new Date(iso).getTime() + APPLICATION_DAYS * DAY - Date.now();
  if (ms <= 0) return "expiring now";
  const d = Math.ceil(ms / DAY);
  return d === 1 ? "auto-rejects in 1 day" : `auto-rejects in ${d} days`;
}

export function StudioApplicationsScreen() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const studioQ = useMyStudio(supabase, meId);
  const studioId = studioQ.data?.id ?? "";
  const appsQ = useStudioApplications(supabase, studioId);
  const [busy, setBusy] = useState<string | null>(null);

  async function respond(artistId: string, accept: boolean) {
    setBusy(artistId);
    try {
      await respondStudioApplication(supabase, studioId, artistId, accept);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["studio-applications", studioId] }),
        qc.invalidateQueries({ queryKey: ["studio-overview", studioId] }),
        qc.invalidateQueries({ queryKey: ["studio-artist-stats", studioId] }),
        qc.invalidateQueries({ queryKey: ["my-studio", meId] }),
      ]);
      toast.show(accept ? "Artist added to your studio" : "Application declined");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }
  const onDecline = (a: StudioApplication) => {
    void confirm({ title: `Decline ${a.displayName}?`, message: "They'll be free to apply to another studio.", confirmLabel: "Decline", destructive: true })
      .then((ok) => { if (ok) void respond(a.artistId, false); });
  };

  const apps = appsQ.data ?? [];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.title}>Applications</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {appsQ.isLoading ? (
          <ActivityIndicator style={{ marginTop: 32 }} />
        ) : apps.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="mail-open-outline" size={40} color="#D4D4D8" />
            <Text style={s.emptyText}>No pending applications. When an artist applies to join, they&apos;ll appear here.</Text>
          </View>
        ) : (
          apps.map((a) => (
            <View key={a.artistId} style={s.card}>
              <Pressable style={s.cardHead} onPress={() => router.push(`/artist/${a.artistId}`)} accessibilityRole="button" accessibilityLabel={`View ${a.displayName}'s profile`}>
                <Avatar path={a.avatarPath} name={a.displayName} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{a.displayName}</Text>
                  <Text style={s.sub} numberOfLines={1}>{a.headline ?? "Tattoo artist"}</Text>
                  <View style={s.metaRow}>
                    {a.ratingCount > 0 ? <Text style={s.meta}>★ {a.ratingAvg.toFixed(1)} · {a.ratingCount}</Text> : <Text style={s.meta}>New artist</Text>}
                    <Text style={s.metaDot}>·</Text>
                    <Text style={s.meta}>Applied {daysAgo(a.appliedAt)}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D4D4D8" />
              </Pressable>
              <Text style={s.expiry}>⏳ {expiresIn(a.appliedAt)}</Text>
              <View style={s.actions}>
                <Pressable style={[s.btn, s.decline]} disabled={busy === a.artistId} onPress={() => onDecline(a)} accessibilityRole="button" accessibilityLabel={`Decline ${a.displayName}`}>
                  <Text style={s.declineText}>Decline</Text>
                </Pressable>
                <Pressable style={[s.btn, s.accept]} disabled={busy === a.artistId} onPress={() => void respond(a.artistId, true)} accessibilityRole="button" accessibilityLabel={`Accept ${a.displayName}`}>
                  <Text style={s.acceptText}>{busy === a.artistId ? "…" : "Accept"}</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 22, fontWeight: "800" },
  body: { padding: 16, gap: 12 },
  empty: { alignItems: "center", marginTop: 56, paddingHorizontal: 32, gap: 12 },
  emptyText: { textAlign: "center", color: "#A1A1AA", lineHeight: 20 },
  card: { borderWidth: 1, borderColor: "#EEEEF0", borderRadius: 16, padding: 14 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontWeight: "800", fontSize: 16, color: "#18181B" },
  sub: { color: "#71717A", fontSize: 13, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  meta: { color: "#52525B", fontSize: 12, fontWeight: "600" },
  metaDot: { color: "#D4D4D8" },
  expiry: { color: "#B45309", fontSize: 12, fontWeight: "700", marginTop: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  decline: { borderWidth: 1, borderColor: "#E4E4E7" },
  declineText: { fontWeight: "800", color: "#52525B", fontSize: 14 },
  accept: { backgroundColor: "#18181B" },
  acceptText: { fontWeight: "800", color: "#fff", fontSize: 14 },
});
