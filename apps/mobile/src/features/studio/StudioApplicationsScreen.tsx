import { Ionicons } from "@expo/vector-icons";
import { respondStudioApplication, useAuth, useMyStudio, useStudioApplications, useStudioPortfolio } from "@inkora/data-access";
import type { PortfolioImage, StudioApplication } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { Avatar } from "../booking/components/ui";

const DAY = 24 * 60 * 60 * 1000;
const APPLICATION_DAYS = 5;
// The auto-reject cron runs daily at 03:00 UTC (see 20260714150000). An
// application isn't actually rejected the instant it turns 5 days old, but at the
// next 03:00 UTC run — so the countdown is computed from that real moment to
// avoid drifting up to ~24h from what the server does.
const CRON_HOUR_UTC = 3;

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}
/** The actual moment the daily cron will auto-reject this application. */
function autoRejectAt(appliedIso: string): number {
  const threshold = new Date(appliedIso).getTime() + APPLICATION_DAYS * DAY;
  const t = new Date(threshold);
  const cron = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), CRON_HOUR_UTC, 0, 0, 0);
  return cron >= threshold ? cron : cron + DAY;
}
function expiresIn(appliedIso: string): string {
  const ms = autoRejectAt(appliedIso) - Date.now();
  if (ms <= 0) return "expiring now";
  if (ms < DAY) return "auto-rejects within a day";
  const d = Math.round(ms / DAY);
  return d === 1 ? "auto-rejects in ~1 day" : `auto-rejects in ~${d} days`;
}

type SortKey = "expiring" | "rating";

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
  const [sortKey, setSortKey] = useState<SortKey>("expiring");

  const apps = useMemo(() => appsQ.data ?? [], [appsQ.data]);
  // Applicant portfolios for inline previews. Keyed off the RPC's stable order
  // (not the client sort) so the query cache stays hit across sort changes.
  const artistIds = useMemo(() => apps.map((a) => a.artistId), [apps]);
  const portfolioQ = useStudioPortfolio(supabase, artistIds);
  const previewsByArtist = useMemo(() => {
    const map = new Map<string, PortfolioImage[]>();
    for (const img of portfolioQ.data ?? []) {
      const list = map.get(img.artistId) ?? [];
      if (list.length < 4) list.push(img);
      map.set(img.artistId, list);
    }
    return map;
  }, [portfolioQ.data]);

  const sortedApps = useMemo(() => {
    const copy = [...apps];
    if (sortKey === "rating") {
      copy.sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount);
    } else {
      // Expiring first = oldest application first (auto-rejects soonest).
      copy.sort((a, b) => new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime());
    }
    return copy;
  }, [apps, sortKey]);

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

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.title}>Applications{apps.length > 0 ? ` (${apps.length})` : ""}</Text>
        <View style={{ width: 26 }} />
      </View>

      {apps.length > 1 ? (
        <View style={s.sortRow}>
          {([["expiring", "Expiring first"], ["rating", "Top rated"]] as const).map(([key, label]) => (
            <Pressable
              key={key}
              style={[s.sortChip, sortKey === key && s.sortChipActive]}
              onPress={() => setSortKey(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: sortKey === key }}
            >
              <Text style={[s.sortChipText, sortKey === key && s.sortChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={appsQ.isRefetching} onRefresh={() => void appsQ.refetch()} />}
      >
        {appsQ.isLoading ? (
          <ActivityIndicator style={{ marginTop: 32 }} />
        ) : apps.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="mail-open-outline" size={40} color="#D4D4D8" />
            <Text style={s.emptyText}>No pending applications. When an artist applies to join, they&apos;ll appear here.</Text>
          </View>
        ) : (
          sortedApps.map((a) => {
            const previews = previewsByArtist.get(a.artistId) ?? [];
            return (
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

                {/* Inline portfolio so the owner can judge without leaving the inbox. */}
                {previews.length > 0 ? (
                  <View style={s.thumbRow}>
                    {previews.map((img) => (
                      <Image key={img.id} source={{ uri: imageUrl(img.imagePath, 120) }} style={s.thumb} contentFit="cover" accessibilityRole="image" accessibilityLabel="Portfolio work" />
                    ))}
                  </View>
                ) : (
                  <Text style={s.noWork}>No portfolio yet</Text>
                )}

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
  sortRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  sortChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F4F4F5" },
  sortChipActive: { backgroundColor: "#18181B" },
  sortChipText: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  sortChipTextActive: { color: "#fff" },
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
  thumbRow: { flexDirection: "row", gap: 6, marginTop: 12 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: "#F4F4F5" },
  noWork: { color: "#A1A1AA", fontSize: 12, fontStyle: "italic", marginTop: 12 },
  expiry: { color: "#B45309", fontSize: 12, fontWeight: "700", marginTop: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  decline: { borderWidth: 1, borderColor: "#E4E4E7" },
  declineText: { fontWeight: "800", color: "#52525B", fontSize: 14 },
  accept: { backgroundColor: "#18181B" },
  acceptText: { fontWeight: "800", color: "#fff", fontSize: 14 },
});
