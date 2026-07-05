import { Ionicons } from "@expo/vector-icons";
import {
  dashboardKeys, setIdeaSaved, useAuth, useJourney, useMyAppointmentCount, useProfileSummary,
  useRewards, useSavedArtists, useSavedDesigns, useUpcomingAppointments,
} from "@inkora/data-access";
import {
  APPOINTMENT_STATUS_LABEL, fmtMonthYear, JOURNEY_STAGE_LABEL, JOURNEY_STAGES, journeyProgress,
  TIER_COLOR, TIER_LABEL, tierProgress,
} from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { Avatar, fmtDateTime, StatusChip } from "../booking/components/ui";

const monthYear = (iso?: string) => (iso ? fmtMonthYear(iso) : "—");

export function UserDashboardScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { ctx, signOut } = useAuth();
  const profile = useProfileSummary(supabase);
  const { account } = useRewards(supabase);
  const upcomingQ = useUpcomingAppointments(supabase, 3);
  const apptCount = useMyAppointmentCount(supabase);
  const savedArtists = useSavedArtists(supabase);
  const savedDesigns = useSavedDesigns(supabase);
  const journey = useJourney(supabase);

  const p = profile.data;
  const upcoming = upcomingQ.data ?? [];
  const prog = tierProgress(account?.lifetimeEarned ?? 0);
  const jProg = journeyProgress(journey.data ?? []);
  const savedCount = (savedArtists.data?.length ?? 0) + (savedDesigns.data?.length ?? 0);
  const isArtist = ctx.roles.includes("artist");

  const confirmRemoveDesign = (id: string, title: string | null) =>
    Alert.alert(title ? `Remove "${title}"?` : "Remove design?", "This removes it from your saved designs.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await setIdeaSaved(supabase, id, false);
              await qc.invalidateQueries({ queryKey: dashboardKeys.savedDesigns });
            } catch (e) {
              toast.show((e as Error).message, "error");
            }
          })();
        },
      },
    ]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.body}>
        {/* Header */}
        <View style={s.topbar}>
          <Text style={s.topTitle} accessibilityRole="header">You</Text>
          <Pressable hitSlop={10} onPress={() => router.push("/profile/account")} accessibilityRole="button" accessibilityLabel="Account settings">
            <Ionicons name="settings-outline" size={24} color="#18181B" />
          </Pressable>
        </View>

        <View style={s.profileRow}>
          <Avatar path={p?.avatarPath ?? null} name={p?.displayName ?? "You"} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{p?.displayName ?? "Your profile"}</Text>
            <Text style={s.sub}>{[p?.username ? `@${p.username}` : null, p?.city].filter(Boolean).join(" · ") || "Tap edit to complete your profile"}</Text>
            <Text style={s.since}>Member since {monthYear(p?.memberSince)}</Text>
          </View>
          <Pressable style={s.editBtn} onPress={() => router.push("/profile/settings")} accessibilityRole="button" accessibilityLabel="Edit profile">
            <Text style={s.editText}>Edit</Text>
          </Pressable>
        </View>

        {/* Rewards */}
        <Pressable
          style={s.rewardCard}
          onPress={() => router.push("/rewards")}
          accessibilityRole="button"
          accessibilityLabel={`Rewards. ${(account?.balance ?? 0).toLocaleString()} points, ${TIER_LABEL[prog.current]} tier. Tap for details`}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.rewardLabel}>Rewards</Text>
            <Text style={s.rewardBalance}>{(account?.balance ?? 0).toLocaleString()} pts</Text>
            <View style={s.rewardTrack}><View style={[s.rewardFill, { width: `${Math.round(prog.pct * 100)}%` }]} /></View>
            <Text style={s.rewardNext}>{prog.next ? `${prog.toNext.toLocaleString()} pts to ${TIER_LABEL[prog.next]}` : "Top tier 🏆"}</Text>
          </View>
          <View style={[s.tierBadge, { backgroundColor: TIER_COLOR[prog.current] }]}>
            <Ionicons name="star" size={12} color="#fff" />
            <Text style={s.tierText}>{TIER_LABEL[prog.current]}</Text>
          </View>
        </Pressable>

        {/* Stats */}
        <View style={s.stats}>
          <Stat label="Points" value={(account?.balance ?? 0).toLocaleString()} />
          <Stat label="Saved" value={String(savedCount)} />
          <Stat label="Bookings" value={String(apptCount.data ?? 0)} />
        </View>

        {/* Upcoming appointments */}
        <SectionHeader title="Upcoming" onSeeAll={() => router.push("/bookings")} />
        {upcoming.length === 0 ? (
          <Empty icon="calendar-outline" text="No upcoming appointments." />
        ) : (
          upcoming.map((a) => (
            <Pressable
              key={a.id}
              style={s.apptRow}
              onPress={() => router.push(`/booking/${a.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Appointment with ${a.counterparty.name}, ${fmtDateTime(a.scheduledStart)}, ${APPOINTMENT_STATUS_LABEL[a.status]}`}
            >
              <Avatar path={a.counterparty.avatarPath} name={a.counterparty.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={s.apptName}>{a.counterparty.name}</Text>
                <Text style={s.apptSub}>{fmtDateTime(a.scheduledStart)}</Text>
              </View>
              <StatusChip status={a.status} label={APPOINTMENT_STATUS_LABEL[a.status]} />
            </Pressable>
          ))
        )}

        {/* Tattoo journey */}
        <SectionHeader title="Your tattoo journey" />
        <View style={s.journeyCard}>
          {jProg.stageIndex < 0 ? (
            <Text style={s.muted}>Save ideas and book a session to start tracking your tattoo journey.</Text>
          ) : (
            <>
              <View style={s.journeyTrack}><View style={[s.journeyFill, { width: `${Math.round(jProg.pct * 100)}%` }]} /></View>
              <View style={s.stageRow}>
                {JOURNEY_STAGES.map((st, i) => (
                  <View key={st} style={s.stage}>
                    <View style={[s.stageDot, i <= jProg.stageIndex && s.stageDotOn]}>
                      {i <= jProg.stageIndex ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                    </View>
                    <Text style={[s.stageLabel, i <= jProg.stageIndex && s.stageLabelOn]}>{JOURNEY_STAGE_LABEL[st]}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Saved artists */}
        <SectionHeader title="Saved artists" />
        {(savedArtists.data ?? []).length === 0 ? (
          <Empty icon="heart-outline" text="Artists you save will appear here." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
            {(savedArtists.data ?? []).map((a) => (
              <Pressable key={a.id} style={s.savedArtist} onPress={() => router.push(`/artist/${a.id}`)} accessibilityRole="button" accessibilityLabel={`View ${a.displayName}'s profile`}>
                <Avatar path={a.avatarPath} name={a.displayName} size={64} />
                <Text style={s.savedArtistName} numberOfLines={1}>{a.displayName}</Text>
                <Text style={s.savedArtistMeta} numberOfLines={1}>{a.ratingAvg > 0 ? `★ ${a.ratingAvg.toFixed(1)}` : "New"}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Saved designs */}
        <SectionHeader title="Saved designs" />
        {(savedDesigns.data ?? []).length === 0 ? (
          <Empty icon="images-outline" text="Save inspiration from Discover to build your collection." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
            {(savedDesigns.data ?? []).map((d) => (
              <View key={d.id} style={s.designWrap}>
                <Pressable
                  onPress={() => router.push({ pathname: "/image-viewer", params: { path: d.imagePath, title: d.title ?? "" } })}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={d.title ? `View design: ${d.title}` : "View saved design"}
                >
                  <Image source={{ uri: imageUrl(d.imagePath, 110) }} style={s.designThumb} contentFit="cover" accessibilityElementsHidden importantForAccessibility="no" />
                </Pressable>
                <Pressable
                  style={s.designRemove}
                  onPress={() => confirmRemoveDesign(d.id, d.title)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={d.title ? `Remove ${d.title} from saved designs` : "Remove design from saved"}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Settings / actions */}
        <SectionHeader title="Settings" />
        <View style={s.settingsCard}>
          <SettingRow icon="notifications-outline" label="Notifications" onPress={() => router.push("/notifications")} />
          <SettingRow icon="gift-outline" label="Rewards & referrals" onPress={() => router.push("/rewards")} />
          <SettingRow icon="person-outline" label="Edit profile" onPress={() => router.push("/profile/settings")} />
          <SettingRow icon="settings-outline" label="Account settings" onPress={() => router.push("/profile/account")} />
          {isArtist && <SettingRow icon="briefcase-outline" label="Artist dashboard" onPress={() => router.push("/artist-dashboard")} />}
          <SettingRow icon="log-out-outline" label="Sign out" danger onPress={signOut} />
        </View>
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
function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle} accessibilityRole="header">{title}</Text>
      {onSeeAll ? <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See all ${title}`}><Text style={s.seeAll}>See all</Text></Pressable> : null}
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
function SettingRow({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={s.settingRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={danger ? "#DC2626" : "#52525B"} />
      <Text style={[s.settingLabel, danger && { color: "#DC2626" }]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color="#D4D4D8" />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  muted: { color: "#A1A1AA", lineHeight: 20 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  topTitle: { fontSize: 28, fontWeight: "800" },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  name: { fontSize: 18, fontWeight: "800" },
  sub: { color: "#71717A", marginTop: 2 },
  since: { color: "#A1A1AA", fontSize: 12, marginTop: 2 },
  editBtn: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  editText: { fontWeight: "700" },
  rewardCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#18181B", borderRadius: 20, padding: 16, marginTop: 4 },
  rewardLabel: { color: "#A1A1AA", fontWeight: "600", fontSize: 13 },
  rewardBalance: { color: "#fff", fontSize: 26, fontWeight: "900", marginTop: 2 },
  rewardTrack: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", marginTop: 8 },
  rewardFill: { height: 5, borderRadius: 3, backgroundColor: "#E5484D" },
  rewardNext: { color: "#D4D4D8", fontSize: 12, marginTop: 6, fontWeight: "600" },
  tierBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tierText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  stats: { flexDirection: "row", gap: 10, marginTop: 12 },
  statTile: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "900", color: "#18181B" },
  statLabel: { color: "#71717A", fontSize: 12, fontWeight: "600", marginTop: 2 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  seeAll: { color: "#E5484D", fontWeight: "700" },
  apptRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  apptName: { fontWeight: "700", fontSize: 15 },
  apptSub: { color: "#71717A", fontSize: 13, marginTop: 2 },
  journeyCard: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, padding: 16 },
  journeyTrack: { height: 6, borderRadius: 3, backgroundColor: "#F4F4F5" },
  journeyFill: { height: 6, borderRadius: 3, backgroundColor: "#E5484D" },
  stageRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  stage: { alignItems: "center", flex: 1, gap: 4 },
  stageDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  stageDotOn: { backgroundColor: "#E5484D" },
  stageLabel: { fontSize: 10, color: "#A1A1AA", fontWeight: "600" },
  stageLabelOn: { color: "#18181B" },
  hRow: { gap: 12, paddingVertical: 4 },
  savedArtist: { width: 84, alignItems: "center", gap: 4 },
  savedArtistName: { fontWeight: "700", fontSize: 12, textAlign: "center" },
  savedArtistMeta: { color: "#A1A1AA", fontSize: 11 },
  designWrap: { width: 110 },
  designThumb: { width: 110, height: 140, borderRadius: 14, backgroundColor: "#E4E4E7" },
  designRemove: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 6, paddingVertical: 20 },
  emptyText: { color: "#A1A1AA", fontSize: 13, textAlign: "center", paddingHorizontal: 24 },
  settingsCard: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  settingLabel: { flex: 1, fontWeight: "600", fontSize: 15, color: "#18181B" },
});
