import { Ionicons } from "@expo/vector-icons";
import { useMyAppointments, useMyRequests } from "@inkora/data-access";
import {
  APPOINTMENT_STATUS_LABEL, type AppointmentRequestView, type AppointmentView,
} from "@inkora/domain";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CountBadge } from "../../components/CountBadge";
import { Pager } from "../../components/Pager";
import { useBadgeCounts } from "../../lib/badges";
import { scheduleAppointmentReminders } from "../../lib/notifications";
import { useMarkAppointmentsSeen, useMarkCompletedSeen, useSeenAppointments, useSeenCompleted } from "../../lib/seen-appointments";
import { useMarkRequestSeen, useSeenRequests } from "../../lib/seen-requests";
import { supabase } from "../../lib/supabase";
import { Avatar, fmtDateTime, money, requestChip, StatusChip } from "./components/ui";

type Tab = "upcoming" | "completed" | "requests";

const PAGE_SIZE = 6;

export function MyBookingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [page, setPage] = useState(0);
  const goTab = (t: Tab) => { setTab(t); setPage(0); };
  const apptsQ = useMyAppointments(supabase);
  const reqsQ = useMyRequests(supabase, "client");
  const { offers: offersUnread, openRequests: openReqBadge, newBookings, newCompleted, apptReplies } = useBadgeCounts();
  const seenSet = new Set(useSeenRequests());
  const seenApptSet = new Set(useSeenAppointments());
  const seenCompletedSet = new Set(useSeenCompleted());
  const markSeen = useMarkRequestSeen();
  const markApptsSeen = useMarkAppointmentsSeen();
  const markCompletedSeen = useMarkCompletedSeen();

  useEffect(() => {
    if (apptsQ.data) void scheduleAppointmentReminders(apptsQ.data);
  }, [apptsQ.data]);
  // Refetch on focus so accepting/declining an offer elsewhere (e.g. in chat)
  // is reflected here: the converted request drops off Requests and the new
  // appointment appears under Upcoming.
  useFocusEffect(useCallback(() => {
    void apptsQ.refetch();
    void reqsQ.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const appts = apptsQ.data ?? [];
  const reqs = reqsQ.data ?? [];
  // Completed bookings live in their own tab for clarity; everything else
  // (scheduled/rescheduled/cancelled) stays under Upcoming.
  const upcomingAppts = appts.filter((a) => a.status !== "completed");
  const completedAppts = appts.filter((a) => a.status === "completed");
  // New bookings/completions carry a per-card "unread" mark (like requests):
  // the badge on the tab + a red dot on the card, cleared by tapping that card.
  // Unread requests (not yet opened) float to the top, separated from read ones.
  const openRequests = reqs
    .filter((r) => r.status !== "converted")
    .sort((a, b) => Number(seenSet.has(a.id)) - Number(seenSet.has(b.id)));

  // Paginate the active tab, 6 items per page.
  const activeCount = tab === "upcoming" ? upcomingAppts.length : tab === "completed" ? completedAppts.length : openRequests.length;
  const totalPages = Math.max(1, Math.ceil(activeCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = <T,>(arr: T[]): T[] => arr.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.title}>My bookings</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabs}>
        <TabButton label={`Upcoming${upcomingAppts.length ? ` (${upcomingAppts.length})` : ""}`} active={tab === "upcoming"} onPress={() => goTab("upcoming")} badge={newBookings + apptReplies} />
        <TabButton label={`Completed${completedAppts.length ? ` (${completedAppts.length})` : ""}`} active={tab === "completed"} onPress={() => goTab("completed")} badge={newCompleted} />
        <TabButton label={`Requests${openRequests.length ? ` (${openRequests.length})` : ""}`} active={tab === "requests"} onPress={() => goTab("requests")} badge={offersUnread + openReqBadge} />
      </ScrollView>

      <ScrollView contentContainerStyle={s.body}>
        {tab === "upcoming" ? (
          apptsQ.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> :
          upcomingAppts.length === 0 ? <Empty icon="calendar-outline" text="No upcoming appointments. When an artist’s offer is accepted, it shows up here." /> :
          paged(upcomingAppts).map((a) => <AppointmentCard key={a.id} appt={a} unread={!seenApptSet.has(a.id)} onPress={() => { markApptsSeen([a.id]); router.push(`/booking/${a.id}`); }} />)
        ) : tab === "completed" ? (
          apptsQ.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> :
          completedAppts.length === 0 ? <Empty icon="checkmark-done-outline" text="No completed bookings yet. Finished sessions move here." /> :
          paged(completedAppts).map((a) => <AppointmentCard key={a.id} appt={a} unread={!seenCompletedSet.has(a.id)} onPress={() => { markCompletedSeen([a.id]); router.push(`/booking/${a.id}`); }} />)
        ) : (
          reqsQ.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> :
          openRequests.length === 0 ? <Empty icon="paper-plane-outline" text="No open requests. Find an artist and tap “Request booking” to get started." /> :
          paged(openRequests).map((r) => (
            <RequestCard
              key={r.id}
              req={r}
              unread={!seenSet.has(r.id)}
              onPress={() => { markSeen(r.id); router.push(`/booking/${r.id}`); }}
            />
          ))
        )}
        <Pager page={safePage} totalPages={totalPages} onChange={setPage} />
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

export function AppointmentCard({ appt, onPress, unread = false }: { appt: AppointmentView; onPress: () => void; unread?: boolean }) {
  return (
    <Pressable style={[s.card, unread && s.cardUnread]} onPress={onPress}>
      <Avatar path={appt.counterparty.avatarPath} name={appt.counterparty.name} />
      <View style={{ flex: 1 }}>
        <View style={s.nameRow}>
          {unread ? <View style={s.unreadDot} accessibilityLabel="New" /> : null}
          <Text style={[s.cardName, { flex: 1 }]} numberOfLines={1}>{appt.counterparty.name}</Text>
        </View>
        {appt.studioName ? <Text style={s.cardStudio}>🏠 {appt.studioName}</Text> : null}
        <Text style={s.cardSub}>{fmtDateTime(appt.scheduledStart)}</Text>
        {appt.priceAmount != null ? <Text style={s.cardPrice}>{money(appt.priceAmount)}</Text> : null}
      </View>
      {appt.rescheduleStatus !== "none"
        ? <StatusChip status="pending" label="Reschedule pending" />
        : <StatusChip status={appt.status} label={APPOINTMENT_STATUS_LABEL[appt.status]} />}
    </Pressable>
  );
}

export function RequestCard({ req, onPress, unread = false }: { req: AppointmentRequestView; onPress: () => void; unread?: boolean }) {
  const latest = req.offers[0];
  // Reconcile request + latest-offer status (cancelled/booked win over the offer).
  const chip = requestChip(req);
  return (
    <Pressable style={[s.card, unread && s.cardUnread]} onPress={onPress}>
      <Avatar path={req.counterparty.avatarPath} name={req.counterparty.name} />
      <View style={{ flex: 1 }}>
        <View style={s.nameRow}>
          {unread ? <View style={s.unreadDot} accessibilityLabel="New" /> : null}
          <Text style={[s.cardName, { flex: 1 }]} numberOfLines={1}>{req.title}</Text>
        </View>
        <Text style={s.cardSub} numberOfLines={1}>{req.studioName ? `🏠 ${req.studioName} · ${req.counterparty.name}` : req.counterparty.name}</Text>
        {latest && latest.status === "pending" ? <Text style={s.cardPrice}>New offer · {money(latest.priceAmount, latest.currencyCode)}</Text> : null}
      </View>
      <StatusChip status={chip.status} label={chip.label} />
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
  // minHeight stops the horizontal scroll row's frame from collapsing/clipping
  // the buttons on first render (the default Upcoming tab).
  tabsScroll: { flexGrow: 0, minHeight: 44, marginBottom: 4 },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, alignItems: "center" },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F4F4F5" },
  tabActive: { backgroundColor: "#18181B" },
  tabText: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  tabTextActive: { color: "#fff" },
  body: { padding: 16, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "#F4F4F5", backgroundColor: "#fff" },
  cardUnread: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E5484D" },
  cardName: { fontWeight: "800", fontSize: 15, color: "#18181B" },
  cardStudio: { color: "#E5484D", fontSize: 12, fontWeight: "700", marginTop: 2 },
  cardSub: { color: "#71717A", fontSize: 13, marginTop: 2 },
  cardPrice: { color: "#E5484D", fontWeight: "700", fontSize: 13, marginTop: 2 },
  emptyWrap: { alignItems: "center", marginTop: 56, paddingHorizontal: 32, gap: 12 },
  empty: { textAlign: "center", color: "#A1A1AA", lineHeight: 20 },
});
