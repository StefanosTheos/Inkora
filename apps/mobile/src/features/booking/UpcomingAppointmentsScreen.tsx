import { Ionicons } from "@expo/vector-icons";
import { useMyAppointments, useUpcomingAppointments } from "@inkora/data-access";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CountBadge } from "../../components/CountBadge";
import { useBadgeCounts } from "../../lib/badges";
import { useMarkAppointmentsSeen, useMarkCompletedSeen } from "../../lib/seen-appointments";
import { supabase } from "../../lib/supabase";
import { AppointmentCard } from "./MyBookingsScreen";

type Tab = "upcoming" | "completed";

/** The artist's appointments, split into Upcoming (closest first) and Completed
 *  (most recent first). Reached from the dashboard "Appointments · See all". */
export function UpcomingAppointmentsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upcoming");
  const upcomingQ = useUpcomingAppointments(supabase, 100);
  const allQ = useMyAppointments(supabase);
  const { newBookings, newCompleted, apptReplies } = useBadgeCounts();
  const markApptsSeen = useMarkAppointmentsSeen();
  const markCompletedSeen = useMarkCompletedSeen();

  const upcoming = upcomingQ.data ?? [];
  const completed = (allQ.data ?? [])
    .filter((a) => a.status === "completed")
    .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart)); // most recent first

  // Viewing a tab marks those bookings seen, clearing the matching badge
  // (profile dot, dashboard "See all", and the tab itself).
  const scheduledIds = (allQ.data ?? []).filter((a) => a.status === "scheduled" || a.status === "rescheduled").map((a) => a.id);
  const scheduledKey = scheduledIds.join(",");
  const completedKey = completed.map((a) => a.id).join(",");
  useEffect(() => {
    if (tab === "upcoming") markApptsSeen(scheduledIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, scheduledKey]);
  useEffect(() => {
    if (tab === "completed") markCompletedSeen(completed.map((a) => a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, completedKey]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#18181B" />
        </Pressable>
        <Text style={s.headerTitle}>Appointments</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={s.tabs}>
        <TabButton label={`Upcoming${upcoming.length ? ` (${upcoming.length})` : ""}`} active={tab === "upcoming"} onPress={() => setTab("upcoming")} badge={newBookings + apptReplies} />
        <TabButton label={`Completed${completed.length ? ` (${completed.length})` : ""}`} active={tab === "completed"} onPress={() => setTab("completed")} badge={newCompleted} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {tab === "upcoming" ? (
          upcomingQ.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> :
          upcoming.length === 0 ? <Text style={s.empty}>No upcoming appointments. Accepted offers appear here.</Text> :
          upcoming.map((a) => <AppointmentCard key={a.id} appt={a} onPress={() => router.push(`/booking/${a.id}`)} />)
        ) : (
          allQ.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> :
          completed.length === 0 ? <Text style={s.empty}>No completed appointments yet.</Text> :
          completed.map((a) => <AppointmentCard key={a.id} appt={a} onPress={() => router.push(`/booking/${a.id}`)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress, badge = 0 }: { label: string; active: boolean; onPress: () => void; badge?: number }) {
  return (
    <Pressable style={[s.tab, active && s.tabActive]} onPress={onPress}>
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
      <CountBadge count={badge} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F4F4F5" },
  tabActive: { backgroundColor: "#18181B" },
  tabText: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  tabTextActive: { color: "#fff" },
  body: { padding: 16, gap: 10 },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 48, paddingHorizontal: 32, lineHeight: 20 },
});
