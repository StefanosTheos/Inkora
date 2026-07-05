import { Ionicons } from "@expo/vector-icons";
import { usePublicSeekerProfile, useSeekerReviews } from "@inkora/data-access";
import type { SeekerReview } from "@inkora/domain";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { Avatar, fmtDate } from "../booking/components/ui";

// Journey milestones the user will fill in later (upload flow comes later).
const JOURNEY_MILESTONES = [
  { key: "week", label: "1 week after" },
  { key: "month", label: "1 month after" },
  { key: "year", label: "1 year after" },
];

export function SeekerProfileScreen({ id }: { id: string }) {
  const router = useRouter();
  const profile = usePublicSeekerProfile(supabase, id);
  const reviews = useSeekerReviews(supabase, id);

  if (profile.isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <TopBar onBack={() => router.back()} />
        <View style={s.center}><ActivityIndicator /></View>
      </SafeAreaView>
    );
  }
  const p = profile.data;
  if (!p) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <TopBar onBack={() => router.back()} />
        <View style={s.center}><Text style={s.muted}>This profile isn&apos;t available.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.body}>
        {/* Header */}
        <View style={s.header}>
          <Avatar path={p.avatarPath} name={p.displayName} size={80} />
          <Text style={s.name} accessibilityRole="header">{p.displayName}</Text>
          <Text style={s.sub}>
            {[p.username ? `@${p.username}` : null, p.city].filter(Boolean).join(" · ") || "Inkora member"}
          </Text>
          <Text style={s.since}>Member since {fmtDate(p.memberSince)}</Text>
        </View>

        {/* Stats */}
        <View style={s.stats}>
          <Stat label="Bookings" value={String(p.bookingsCount)} />
          <Stat label="Reviews" value={String(p.reviewsCount)} />
        </View>

        {/* Tattoo journey */}
        <Text style={s.sectionTitle} accessibilityRole="header">Tattoo journey</Text>
        <Text style={s.sectionHint}>Healing progress shared by {p.displayName.split(" ")[0]}.</Text>
        <View style={s.journeyRow}>
          {JOURNEY_MILESTONES.map((m) => (
            <View key={m.key} style={s.journeyCard}>
              <View style={s.journeyPlaceholder}>
                <Ionicons name="image-outline" size={22} color="#D4D4D8" />
              </View>
              <Text style={s.journeyLabel}>{m.label}</Text>
              <Text style={s.journeyEmpty}>Not shared yet</Text>
            </View>
          ))}
        </View>

        {/* Reviews written by this seeker */}
        <Text style={s.sectionTitle} accessibilityRole="header">Reviews</Text>
        {reviews.isLoading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : (reviews.data ?? []).length === 0 ? (
          <Text style={s.muted}>No reviews yet.</Text>
        ) : (
          (reviews.data ?? []).map((r: SeekerReview) => (
            <View key={r.id} style={s.reviewCard}>
              <Text style={s.reviewHead}>{r.subjectName} · ★ {r.overallRating}</Text>
              {r.title ? <Text style={s.reviewTitle}>{r.title}</Text> : null}
              {r.body ? <Text style={s.reviewBody}>{r.body}</Text> : null}
              <Text style={s.reviewDate}>{fmtDate(r.createdAt)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.topbar}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons name="chevron-back" size={26} color="#18181B" onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topbar: { paddingHorizontal: 12, paddingVertical: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#A1A1AA" },
  body: { padding: 16, paddingBottom: 40 },
  header: { alignItems: "center", gap: 4, marginBottom: 8 },
  name: { fontSize: 22, fontWeight: "800", marginTop: 8 },
  sub: { color: "#52525B", fontWeight: "600" },
  since: { color: "#A1A1AA", fontSize: 13 },
  stats: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 8 },
  statBox: { flex: 1, backgroundColor: "#F4F4F5", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "900", color: "#18181B" },
  statLabel: { color: "#71717A", fontSize: 12, fontWeight: "600", marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 20 },
  sectionHint: { color: "#A1A1AA", fontSize: 13, marginTop: 2, marginBottom: 10 },
  journeyRow: { flexDirection: "row", gap: 8 },
  journeyCard: { flex: 1, alignItems: "center" },
  journeyPlaceholder: { width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: "#F4F4F5", borderWidth: 1, borderColor: "#EEE", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  journeyLabel: { fontWeight: "700", fontSize: 12, marginTop: 6, color: "#18181B", textAlign: "center" },
  journeyEmpty: { color: "#A1A1AA", fontSize: 11, marginTop: 1 },
  reviewCard: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 12, padding: 12, marginTop: 10 },
  reviewHead: { fontWeight: "700" },
  reviewTitle: { fontWeight: "600", marginTop: 4 },
  reviewBody: { color: "#3F3F46", marginTop: 2 },
  reviewDate: { color: "#A1A1AA", fontSize: 12, marginTop: 6 },
});
