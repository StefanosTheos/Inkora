import { Ionicons } from "@expo/vector-icons";
import { useMyAppointments, useMyRequests } from "@inkora/data-access";
import {
  APPOINTMENT_STATUS_LABEL, type AppointmentRequestView, type AppointmentView, REQUEST_STATUS_LABEL,
} from "@inkora/domain";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { registerPushToken, scheduleAppointmentReminders } from "../../lib/notifications";
import { supabase } from "../../lib/supabase";
import { Avatar, fmtDateTime, money, StatusChip } from "./components/ui";

type Tab = "upcoming" | "requests";

export function MyBookingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upcoming");
  const apptsQ = useMyAppointments(supabase);
  const reqsQ = useMyRequests(supabase, "client");

  useEffect(() => { void registerPushToken(); }, []);
  useEffect(() => {
    if (apptsQ.data) void scheduleAppointmentReminders(apptsQ.data);
  }, [apptsQ.data]);

  const appts = apptsQ.data ?? [];
  const reqs = reqsQ.data ?? [];
  const openRequests = reqs.filter((r) => r.status !== "converted");

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.title}>My bookings</Text>
        <View style={{ width: 26 }} />
      </View>
      <View style={s.tabs}>
        <TabButton label={`Upcoming${appts.length ? ` (${appts.length})` : ""}`} active={tab === "upcoming"} onPress={() => setTab("upcoming")} />
        <TabButton label={`Requests${openRequests.length ? ` (${openRequests.length})` : ""}`} active={tab === "requests"} onPress={() => setTab("requests")} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {tab === "upcoming" ? (
          apptsQ.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> :
          appts.length === 0 ? <Empty icon="calendar-outline" text="No appointments yet. When an artist’s offer is accepted, it shows up here." /> :
          appts.map((a) => <AppointmentCard key={a.id} appt={a} onPress={() => router.push(`/booking/${a.id}`)} />)
        ) : (
          reqsQ.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> :
          openRequests.length === 0 ? <Empty icon="paper-plane-outline" text="No open requests. Find an artist and tap “Request booking” to get started." /> :
          openRequests.map((r) => <RequestCard key={r.id} req={r} onPress={() => router.push(`/booking/${r.id}`)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.tab, active && s.tabActive]} onPress={onPress}>
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function AppointmentCard({ appt, onPress }: { appt: AppointmentView; onPress: () => void }) {
  return (
    <Pressable style={s.card} onPress={onPress}>
      <Avatar path={appt.counterparty.avatarPath} name={appt.counterparty.name} />
      <View style={{ flex: 1 }}>
        <Text style={s.cardName}>{appt.counterparty.name}</Text>
        {appt.studioName ? <Text style={s.cardStudio}>🏠 {appt.studioName}</Text> : null}
        <Text style={s.cardSub}>{fmtDateTime(appt.scheduledStart)}</Text>
        {appt.priceAmount != null ? <Text style={s.cardPrice}>{money(appt.priceAmount)}</Text> : null}
      </View>
      <StatusChip status={appt.status} label={APPOINTMENT_STATUS_LABEL[appt.status]} />
    </Pressable>
  );
}

export function RequestCard({ req, onPress }: { req: AppointmentRequestView; onPress: () => void }) {
  const latest = req.offers[0];
  return (
    <Pressable style={s.card} onPress={onPress}>
      <Avatar path={req.counterparty.avatarPath} name={req.counterparty.name} />
      <View style={{ flex: 1 }}>
        <Text style={s.cardName} numberOfLines={1}>{req.title}</Text>
        <Text style={s.cardSub} numberOfLines={1}>{req.studioName ? `🏠 ${req.studioName} · ${req.counterparty.name}` : req.counterparty.name}</Text>
        {latest && latest.status === "pending" ? <Text style={s.cardPrice}>New offer · {money(latest.priceAmount, latest.currencyCode)}</Text> : null}
      </View>
      <StatusChip status={req.status} label={REQUEST_STATUS_LABEL[req.status]} />
    </Pressable>
  );
}

function Empty({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.emptyWrap}>
      <Ionicons name={icon} size={40} color="#D4D4D8" />
      <Text style={s.empty}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 22, fontWeight: "800" },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F4F4F5" },
  tabActive: { backgroundColor: "#18181B" },
  tabText: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  tabTextActive: { color: "#fff" },
  body: { padding: 16, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "#F4F4F5", backgroundColor: "#fff" },
  cardName: { fontWeight: "800", fontSize: 15, color: "#18181B" },
  cardStudio: { color: "#E5484D", fontSize: 12, fontWeight: "700", marginTop: 2 },
  cardSub: { color: "#71717A", fontSize: 13, marginTop: 2 },
  cardPrice: { color: "#E5484D", fontWeight: "700", fontSize: 13, marginTop: 2 },
  emptyWrap: { alignItems: "center", marginTop: 56, paddingHorizontal: 32, gap: 12 },
  empty: { textAlign: "center", color: "#A1A1AA", lineHeight: 20 },
});
