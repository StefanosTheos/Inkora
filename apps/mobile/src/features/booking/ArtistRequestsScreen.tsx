import { Ionicons } from "@expo/vector-icons";
import { markTypeEntityNotificationsRead, useMyRequests } from "@inkora/data-access";
import type { AppointmentRequestView } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { RequestCard } from "./MyBookingsScreen";

export function ArtistRequestsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const reqsQ = useMyRequests(supabase, "artist");

  // Opening the page clears the "client responded to your offer" badge (offer
  // accepted/declined) and pulls the latest statuses so a just-answered offer
  // shows correctly. New unanswered requests keep their badge until answered.
  useEffect(() => {
    void reqsQ.refetch();
    void (async () => {
      await markTypeEntityNotificationsRead(supabase, "booking_update", "appointment_request");
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);
  // Accepted requests (status "converted") become appointments shown under
  // Upcoming, so they're excluded here to avoid duplication — this page only
  // lists requests that haven't turned into a booking.
  const reqs = (reqsQ.data ?? []).filter((r) => r.status !== "converted");
  const needsAction = reqs.filter((r) => r.status === "pending" || r.status === "reviewing");
  const waiting = reqs.filter((r) => r.status === "offered");
  const closed = reqs.filter((r) => !["pending", "reviewing", "offered"].includes(r.status));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#18181B" />
        </Pressable>
        <Text style={s.headerTitle}>Requests</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {reqsQ.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> : reqs.length === 0 ? (
          <Text style={s.empty}>No booking requests yet. When a client requests you, it appears here to review and quote.</Text>
        ) : (
          <>
            <Section title="Needs your reply" items={needsAction} router={router} />
            <Section title="Waiting on client" items={waiting} router={router} />
            <Section title="Closed" items={closed} router={router} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, items, router }: { title: string; items: AppointmentRequestView[]; router: ReturnType<typeof useRouter> }) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.sectionTitle}>{title}</Text>
      {items.map((r) => <RequestCard key={r.id} req={r} onPress={() => router.push(`/booking/${r.id}`)} />)}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  body: { padding: 16, gap: 18 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#52525B" },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 48, paddingHorizontal: 32, lineHeight: 20 },
});
