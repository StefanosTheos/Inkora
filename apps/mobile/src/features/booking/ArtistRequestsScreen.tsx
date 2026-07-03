import { useMyRequests } from "@inkora/data-access";
import type { AppointmentRequestView } from "@inkora/domain";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { RequestCard } from "./MyBookingsScreen";

export function ArtistRequestsScreen() {
  const router = useRouter();
  const reqsQ = useMyRequests(supabase, "artist");
  const reqs = reqsQ.data ?? [];
  const needsAction = reqs.filter((r) => r.status === "pending" || r.status === "reviewing");
  const waiting = reqs.filter((r) => r.status === "offered");
  const closed = reqs.filter((r) => !["pending", "reviewing", "offered"].includes(r.status));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <Text style={s.title}>Requests</Text>
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
  title: { fontSize: 28, fontWeight: "800", paddingHorizontal: 16, paddingVertical: 8 },
  body: { padding: 16, gap: 18 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#52525B" },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 48, paddingHorizontal: 32, lineHeight: 20 },
});
