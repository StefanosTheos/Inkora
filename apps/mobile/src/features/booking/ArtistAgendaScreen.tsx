import { Ionicons } from "@expo/vector-icons";
import { useMyAppointments } from "@inkora/data-access";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { scheduleAppointmentReminders } from "../../lib/notifications";
import { supabase } from "../../lib/supabase";
import { MonthCalendar, toIsoDate } from "./components/MonthCalendar";
import { AppointmentCard } from "./MyBookingsScreen";

export function ArtistAgendaScreen() {
  const router = useRouter();
  const apptsQ = useMyAppointments(supabase);
  const appts = useMemo(() => (apptsQ.data ?? []).filter((a) => a.status !== "cancelled"), [apptsQ.data]);
  const [selected, setSelected] = useState<string>(() => toIsoDate(new Date()));

  useEffect(() => { if (apptsQ.data) void scheduleAppointmentReminders(apptsQ.data); }, [apptsQ.data]);

  const marked = useMemo(() => new Set(appts.map((a) => toIsoDate(new Date(a.scheduledStart)))), [appts]);
  const dayAppts = appts.filter((a) => toIsoDate(new Date(a.scheduledStart)) === selected);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#18181B" />
        </Pressable>
        <Text style={s.headerTitle}>Your schedule</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.calCard}>
          <MonthCalendar selected={selected} onSelect={setSelected} markedDates={marked} />
        </View>
        {apptsQ.isLoading ? <ActivityIndicator style={{ marginTop: 24 }} /> : dayAppts.length === 0 ? (
          <Text style={s.empty}>Nothing booked this day.</Text>
        ) : (
          dayAppts.map((a) => <AppointmentCard key={a.id} appt={a} onPress={() => router.push(`/booking/${a.id}`)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  body: { padding: 16, gap: 12 },
  calCard: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, padding: 12 },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 24 },
});
