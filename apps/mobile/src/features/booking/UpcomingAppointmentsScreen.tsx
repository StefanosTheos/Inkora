import { Ionicons } from "@expo/vector-icons";
import { useUpcomingAppointments } from "@inkora/data-access";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { AppointmentCard } from "./MyBookingsScreen";

/** All upcoming appointments, closest date first. Reached from the "See all"
 *  button next to the dashboard's Upcoming appointments section. */
export function UpcomingAppointmentsScreen() {
  const router = useRouter();
  const apptsQ = useUpcomingAppointments(supabase, 100);
  const appts = apptsQ.data ?? [];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#18181B" />
        </Pressable>
        <Text style={s.headerTitle}>Upcoming appointments</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {apptsQ.isLoading ? (
          <ActivityIndicator style={{ marginTop: 32 }} />
        ) : appts.length === 0 ? (
          <Text style={s.empty}>No upcoming appointments. Accepted offers appear here.</Text>
        ) : (
          appts.map((a) => <AppointmentCard key={a.id} appt={a} onPress={() => router.push(`/booking/${a.id}`)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  body: { padding: 16, gap: 10 },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 48, paddingHorizontal: 32, lineHeight: 20 },
});
