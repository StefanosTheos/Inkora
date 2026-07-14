import { Ionicons } from "@expo/vector-icons";
import {
  startDirectConversation, useAuth, useMyStudio, useNotifications, useStudioArtistStats,
  useStudioOverview, useStudioReviews,
} from "@inkora/data-access";
import type { ReviewItem, StudioArtistStat, StudioRosterArtist } from "@inkora/domain";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { Avatar, fmtDate } from "../booking/components/ui";

/** Compact currency for headline numbers: €0, €120, €2.4k, €18k. */
const compactMoney = (n: number): string => {
  if (n >= 10000) return `€${Math.round(n / 1000)}k`;
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${Math.round(n)}`;
};

/** The studio-owner home: studio identity, headline stats, and the onboarded
 *  roster with per-artist performance. Business-focused — no discovery/AI. */
export function StudioDashboardScreen() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { ctx, signOut } = useAuth();
  const meId = ctx.userId ?? "";
  const studioQ = useMyStudio(supabase, meId);
  const st = studioQ.data;
  const overviewQ = useStudioOverview(supabase, st?.id ?? "");
  const statsQ = useStudioArtistStats(supabase, st?.id ?? "");
  const reviewsQ = useStudioReviews(supabase, st?.id ?? "");
  const { notifications } = useNotifications(supabase);
  const unread = notifications.filter((n) => !n.readAt).length;
  const ov = overviewQ.data;
  const statsById = new Map((statsQ.data ?? []).map((x) => [x.artistId, x]));

  async function messageArtist(artistId: string) {
    try {
      const cid = await startDirectConversation(supabase, artistId);
      router.push(`/chats/${cid}`);
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }
  const confirmSignOut = () => {
    void confirm({ title: "Sign out?", message: "You'll need to sign in again to manage your studio.", confirmLabel: "Sign out", destructive: true })
      .then((ok) => { if (ok) void signOut(); });
  };

  if (studioQ.isLoading) {
    return <SafeAreaView style={s.safe} edges={["top"]}><View style={s.center}><ActivityIndicator /></View></SafeAreaView>;
  }
  if (!st) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}><Ionicons name="business-outline" size={40} color="#D4D4D8" /><Text style={s.muted}>No studio is linked to your account yet.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.topbar}>
          <Text style={s.topTitle} accessibilityRole="header">Studio</Text>
          <View style={s.topActions}>
            <Pressable onPress={() => router.push("/notifications")} hitSlop={10} accessibilityRole="button" accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
              <Ionicons name="notifications-outline" size={24} color="#18181B" />
              {unread > 0 ? <View style={s.bellDot} /> : null}
            </Pressable>
            <Pressable onPress={() => router.push("/profile/account")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Account settings">
              <Ionicons name="settings-outline" size={24} color="#18181B" />
            </Pressable>
          </View>
        </View>

        {/* Studio identity */}
        <View style={s.studioRow}>
          {st.logoPath ? (
            <Image source={{ uri: imageUrl(st.logoPath, 120) }} style={s.logo} contentFit="cover" accessibilityRole="image" accessibilityLabel="Studio logo" />
          ) : (
            <View style={s.logo}><Text style={s.logoInitial}>{st.name.charAt(0).toUpperCase()}</Text></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{st.name}</Text>
            <Text style={s.sub} numberOfLines={1}>{[st.city, st.country].filter(Boolean).join(", ") || "Your studio"}</Text>
          </View>
        </View>
        <View style={s.headerBtns}>
          <Pressable style={s.outlineBtn} onPress={() => router.push(`/studio/${st.slug}`)} accessibilityRole="button" accessibilityLabel="View public page">
            <Ionicons name="eye-outline" size={16} color="#18181B" />
            <Text style={s.outlineBtnText}>Public page</Text>
          </Pressable>
          <Pressable style={s.outlineBtn} onPress={() => router.push("/studio-edit")} accessibilityRole="button" accessibilityLabel="Edit studio">
            <Ionicons name="create-outline" size={16} color="#18181B" />
            <Text style={s.outlineBtnText}>Edit studio</Text>
          </Pressable>
        </View>

        {/* Overview */}
        <Text style={s.section} accessibilityRole="header">Overview</Text>
        <View style={s.hero}>
          <View style={s.heroBloom} />
          <HeroStat text={String(ov?.activeArtists ?? 0)} label="Artists" />
          <View style={s.heroDivider} />
          <HeroStat text={compactMoney(ov?.revenue ?? 0)} label="Revenue" />
          <View style={s.heroDivider} />
          <HeroStat text={ov && ov.ratingCount > 0 ? `★${ov.ratingAvg.toFixed(1)}` : "—"} label="Rating" />
        </View>
        <View style={s.gridRow}>
          <BigTile label="Completed" value={ov?.completedBookings ?? 0} icon="checkmark-done-outline" />
          <BigTile label="Scheduled" value={ov?.scheduledBookings ?? 0} icon="calendar-outline" />
        </View>
        <View style={s.gridRow}>
          <BigTile label="Cancelled" value={ov?.cancelledBookings ?? 0} icon="close-circle-outline" />
          <BigTile label="Applications" value={ov?.pendingApplications ?? 0} icon="mail-unread-outline" alert={!!ov?.pendingApplications} onPress={() => router.push("/studio-applications")} />
        </View>
        <View style={s.gridRow}>
          <BigTile label="Profile visits" value={ov?.profileVisits ?? 0} icon="eye-outline" />
          <BigTile label="Saved by" value={ov?.studioSaves ?? 0} icon="heart-outline" />
        </View>

        {/* Roster */}
        <Text style={s.section} accessibilityRole="header">Artists</Text>
        {statsQ.isLoading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : st.roster.length === 0 ? (
          <Text style={s.muted}>No artists onboarded yet.</Text>
        ) : (
          st.roster.map((a) => (
            <ArtistStatCard key={a.id} artist={a} stat={statsById.get(a.id)} onOpen={() => router.push(`/artist/${a.id}`)} onMessage={() => void messageArtist(a.id)} />
          ))
        )}

        {/* Recent reviews of the studio */}
        {(reviewsQ.data ?? []).length > 0 ? (
          <>
            <Text style={s.section} accessibilityRole="header">Recent reviews</Text>
            {(reviewsQ.data ?? []).slice(0, 3).map((rv: ReviewItem) => (
              <Pressable
                key={rv.id}
                style={s.reviewCard}
                onPress={() => { if (rv.authorId) router.push(`/seeker/${rv.authorId}`); }}
                accessibilityRole="button"
                accessibilityLabel={`Review by ${rv.authorName}, ${rv.overallRating} stars`}
              >
                <Text style={s.reviewHead}>{rv.authorName} · ★ {rv.overallRating}</Text>
                {rv.title ? <Text style={s.reviewTitle}>{rv.title}</Text> : null}
                {rv.body ? <Text style={s.reviewBody} numberOfLines={2}>{rv.body}</Text> : null}
                <Text style={s.reviewDate}>{fmtDate(rv.createdAt)}</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {/* Settings */}
        <View style={s.settingsCard}>
          <Pressable style={s.settingRow} onPress={() => router.push("/profile/account")} accessibilityRole="button" accessibilityLabel="Account settings">
            <Ionicons name="settings-outline" size={20} color="#52525B" />
            <Text style={s.settingLabel}>Account settings</Text>
            <Ionicons name="chevron-forward" size={16} color="#D4D4D8" />
          </Pressable>
          <Pressable style={s.settingRow} onPress={confirmSignOut} accessibilityRole="button" accessibilityLabel="Sign out">
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={[s.settingLabel, { color: "#DC2626" }]}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ text, label }: { text: string; label: string }) {
  return (
    <View style={s.heroStat} accessible accessibilityLabel={`${text} ${label}`}>
      <Text style={s.heroValue}>{text}</Text>
      <Text style={s.heroLabel}>{label}</Text>
    </View>
  );
}

function BigTile({ label, value, icon, alert, onPress }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; alert?: boolean; onPress?: () => void }) {
  const inner = (
    <>
      <Ionicons name={onPress ? "chevron-forward" : icon} size={16} color="#D4D4D8" style={s.bigIcon} />
      <Text style={[s.bigValue, alert && { color: "#E5484D" }]}>{value}</Text>
      <Text style={s.bigLabel}>{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable style={s.bigTile} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value} ${label}, open`}>{inner}</Pressable>
    );
  }
  return <View style={s.bigTile} accessible accessibilityLabel={`${value} ${label}`}>{inner}</View>;
}

function ArtistStatCard({ artist, stat, onOpen, onMessage }: { artist: StudioRosterArtist; stat?: StudioArtistStat; onOpen: () => void; onMessage: () => void }) {
  return (
    <View style={s.card}>
      <Pressable style={s.cardHead} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`View ${artist.displayName}'s profile`}>
        <Avatar path={artist.avatarPath} name={artist.displayName} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={s.cardName} numberOfLines={1}>{artist.displayName}</Text>
          <Text style={s.cardSub} numberOfLines={1}>{artist.headline ?? "Tattoo artist"}</Text>
        </View>
        <View style={s.rating}>
          <Ionicons name="star" size={13} color="#E5484D" />
          <Text style={s.ratingText}>{artist.ratingAvg > 0 ? artist.ratingAvg.toFixed(1) : "—"}</Text>
        </View>
        <Pressable onPress={onMessage} hitSlop={10} style={s.msgBtn} accessibilityRole="button" accessibilityLabel={`Message ${artist.displayName}`}>
          <Ionicons name="chatbubble-outline" size={18} color="#18181B" />
        </Pressable>
      </Pressable>
      <View style={s.metrics}>
        <Metric label="Revenue" value={compactMoney(stat?.revenue ?? 0)} />
        <Metric label="Done" value={stat?.completed ?? 0} />
        <Metric label="Upcoming" value={stat?.scheduled ?? 0} />
        <Metric label="Reviews" value={stat?.ratingCount ?? 0} />
        <Metric label="Saves" value={(stat?.savedBy ?? 0) + (stat?.workSaves ?? 0)} />
        <Metric label="Visits" value={stat?.profileVisits ?? 0} />
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.metric} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={s.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  muted: { color: "#A1A1AA", textAlign: "center", lineHeight: 20 },
  body: { padding: 16, paddingBottom: 40, gap: 4 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  topTitle: { fontSize: 28, fontWeight: "800" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  bellDot: { position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: 5, backgroundColor: "#E5484D", borderWidth: 1.5, borderColor: "#fff" },
  studioRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 60, height: 60, borderRadius: 16, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoInitial: { color: "#fff", fontSize: 26, fontWeight: "800" },
  name: { fontSize: 20, fontWeight: "800", color: "#18181B" },
  sub: { color: "#71717A", marginTop: 2, fontWeight: "600" },
  headerBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  outlineBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 12, paddingVertical: 11 },
  outlineBtnText: { fontWeight: "700", fontSize: 14, color: "#18181B" },
  section: { fontSize: 18, fontWeight: "800", marginTop: 22, marginBottom: 10 },
  hero: { flexDirection: "row", alignItems: "center", backgroundColor: "#18181B", borderRadius: 22, paddingVertical: 22, paddingHorizontal: 8, overflow: "hidden", marginBottom: 10 },
  heroBloom: { position: "absolute", top: -44, right: -24, width: 160, height: 160, borderRadius: 80, backgroundColor: "#E5484D", opacity: 0.22 },
  heroStat: { flex: 1, alignItems: "center" },
  heroValue: { color: "#fff", fontSize: 28, fontWeight: "900" },
  heroLabel: { color: "#A1A1AA", fontSize: 12, fontWeight: "600", marginTop: 5, letterSpacing: 0.2 },
  heroDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.12)" },
  gridRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  bigTile: { flex: 1, borderRadius: 18, padding: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEEEF0" },
  bigIcon: { position: "absolute", top: 15, right: 15 },
  bigValue: { fontSize: 28, fontWeight: "900", color: "#18181B", marginTop: 4 },
  bigLabel: { color: "#A1A1AA", fontSize: 11, fontWeight: "700", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.7 },
  card: { borderWidth: 1, borderColor: "#F0F0F2", borderRadius: 16, padding: 12, marginBottom: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardName: { fontWeight: "800", fontSize: 15, color: "#18181B" },
  cardSub: { color: "#71717A", fontSize: 13, marginTop: 2 },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontWeight: "800", color: "#18181B", fontSize: 13 },
  msgBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F4F4F5", alignItems: "center", justifyContent: "center" },
  metrics: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F4F4F5" },
  metric: { alignItems: "center", flex: 1 },
  metricValue: { fontWeight: "800", fontSize: 15, color: "#18181B" },
  metricLabel: { color: "#A1A1AA", fontSize: 10, fontWeight: "600", marginTop: 2 },
  reviewCard: { borderWidth: 1, borderColor: "#F0F0F2", borderRadius: 14, padding: 12, marginBottom: 10 },
  reviewHead: { fontWeight: "800", fontSize: 14, color: "#18181B" },
  reviewTitle: { fontWeight: "600", marginTop: 4, color: "#18181B" },
  reviewBody: { color: "#3F3F46", marginTop: 2, lineHeight: 19 },
  reviewDate: { color: "#A1A1AA", fontSize: 12, marginTop: 6 },
  settingsCard: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, overflow: "hidden", marginTop: 24 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  settingLabel: { flex: 1, fontWeight: "600", fontSize: 15, color: "#18181B" },
});
