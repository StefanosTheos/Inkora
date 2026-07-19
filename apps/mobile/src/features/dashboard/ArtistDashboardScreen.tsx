import { Ionicons } from "@expo/vector-icons";
import { useArtistProfile, useArtistReviews, useArtistStats, useAuth, useMyAppointmentCount } from "@inkora/data-access";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";
import { supabase } from "../../lib/supabase";
import { Avatar } from "../booking/components/ui";

// Artist Profile tab — identity, reputation and account. Operational tools
// (bookings, requests, schedule, availability) live on the artist Home tab.
export function ArtistDashboardScreen() {
  const router = useRouter();
  const confirm = useConfirm();
  const { ctx, signOut } = useAuth();
  const meId = ctx.userId ?? "";
  const profile = useArtistProfile(supabase, meId);
  const stats = useArtistStats(supabase);
  const apptCount = useMyAppointmentCount(supabase);
  const reviews = useArtistReviews(supabase, meId);

  const a = profile.data;

  const confirmSignOut = () => {
    void confirm({
      title: "Sign out?",
      message: "You'll need to sign in again to manage your bookings and profile.",
      confirmLabel: "Sign out",
      destructive: true,
    }).then((ok) => { if (ok) void signOut(); });
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.topbar}>
          <Text style={s.topTitle} accessibilityRole="header">Profile</Text>
          <Pressable hitSlop={10} onPress={() => router.push("/profile/account")} accessibilityRole="button" accessibilityLabel="Account settings">
            <Ionicons name="settings-outline" size={24} color="#18181B" />
          </Pressable>
        </View>

        {/* Identity — tap to edit your profile */}
        <Pressable style={s.profileRow} onPress={() => router.push("/profile/settings")} accessibilityRole="button" accessibilityLabel="Edit your profile">
          <Avatar path={a?.avatarPath ?? null} name={a?.displayName ?? "You"} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{a?.displayName ?? "Your profile"}</Text>
            <Text style={s.sub} numberOfLines={1}>{a?.headline ?? "Add a headline in Edit profile"}</Text>
            <Text style={s.meta}>
              {a && a.ratingCount > 0 ? `★ ${a.ratingAvg.toFixed(1)} · ${a.ratingCount} review${a.ratingCount === 1 ? "" : "s"}` : "No reviews yet"}
              {a ? (a.isAccepting ? " · Accepting" : " · Not accepting") : ""}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D4D4D8" />
        </Pressable>
        <Pressable style={s.viewPublic} onPress={() => router.push(`/artist/${meId}`)} accessibilityRole="button" accessibilityLabel="View public profile">
          <Text style={s.viewPublicText}>View public profile</Text>
          <Ionicons name="open-outline" size={16} color="#E5484D" />
        </Pressable>

        {/* Audience / reputation stats */}
        <View style={s.stats}>
          <Stat label="Saved you" value={String(stats.data?.savedBy ?? 0)} />
          <Stat label="Design saves" value={String(stats.data?.designSaves ?? 0)} />
          <Stat label="Reviews" value={String(a?.ratingCount ?? 0)} />
          <Stat label="Bookings" value={String(apptCount.data ?? 0)} />
        </View>

        {/* Manage — identity & account (operational tools live on Home) */}
        <SectionHeader title="Manage" />
        <View style={s.card}>
          <ActionRow icon="images-outline" label="Portfolio & flashes" onPress={() => router.push("/artist-dashboard/portfolio")} />
          <ActionRow icon="person-outline" label="Edit profile" onPress={() => router.push("/profile/settings")} />
          <ActionRow icon="settings-outline" label="Account settings" onPress={() => router.push("/profile/account")} />
          <ActionRow icon="log-out-outline" label="Sign out" danger onPress={confirmSignOut} />
        </View>

        {/* Reviews */}
        <SectionHeader
          title="Recent reviews"
          onSeeAll={(reviews.data ?? []).length > 3 ? () => router.push(`/artist/${meId}?tab=reviews`) : undefined}
          seeAllLabel={`See all (${reviews.data?.length ?? 0})`}
        />
        {reviews.isLoading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : (reviews.data ?? []).length === 0 ? (
          <Empty icon="star-outline" text="No reviews yet. They'll appear here after completed appointments." />
        ) : (
          (reviews.data ?? []).slice(0, 3).map((r) => (
            <Pressable
              key={r.id}
              style={s.reviewCard}
              onPress={() => { if (r.authorId) router.push({ pathname: "/seeker/[id]", params: { id: r.authorId, reviewId: r.id } }); }}
              disabled={!r.authorId}
              accessibilityRole="button"
              accessibilityLabel={`Review by ${r.authorName}, ${r.overallRating} stars. Tap to open`}
            >
              <Text style={s.reviewHead}>{r.authorName} · ★ {r.overallRating}</Text>
              {r.title ? <Text style={s.reviewTitle}>{r.title}</Text> : null}
              {r.body ? <Text style={s.reviewBody} numberOfLines={3}>{r.body}</Text> : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statTile} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}
function SectionHeader({ title, onSeeAll, seeAllLabel }: { title: string; onSeeAll?: () => void; seeAllLabel?: string }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle} accessibilityRole="header">{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8} style={s.seeAllRow} accessibilityRole="button" accessibilityLabel={seeAllLabel ?? `See all ${title}`}>
          <Text style={s.seeAll}>{seeAllLabel ?? "See all"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
function Empty({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={26} color="#D4D4D8" />
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}
function ActionRow({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={s.actionRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={danger ? "#DC2626" : "#52525B"} />
      <Text style={[s.actionLabel, danger && { color: "#DC2626" }]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color="#D4D4D8" />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  topTitle: { fontSize: 28, fontWeight: "800" },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  name: { fontSize: 18, fontWeight: "800" },
  sub: { color: "#71717A", marginTop: 2 },
  meta: { color: "#A1A1AA", fontSize: 12, marginTop: 2 },
  viewPublic: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 999, paddingVertical: 10, marginTop: 4 },
  viewPublicText: { color: "#E5484D", fontWeight: "700" },
  stats: { flexDirection: "row", gap: 8, marginTop: 12 },
  statTile: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "900", color: "#18181B" },
  statLabel: { color: "#71717A", fontSize: 11, fontWeight: "600", marginTop: 2, textAlign: "center" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  seeAll: { color: "#E5484D", fontWeight: "700" },
  seeAllRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  card: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, overflow: "hidden" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  actionLabel: { flex: 1, fontWeight: "600", fontSize: 15, color: "#18181B" },
  empty: { alignItems: "center", gap: 6, paddingVertical: 20 },
  emptyText: { color: "#A1A1AA", fontSize: 13, textAlign: "center", paddingHorizontal: 24 },
  reviewCard: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 12, padding: 12, marginBottom: 8 },
  reviewHead: { fontWeight: "700" },
  reviewTitle: { fontWeight: "600", marginTop: 4 },
  reviewBody: { color: "#3F3F46", marginTop: 2 },
});
