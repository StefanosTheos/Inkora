import { Ionicons } from "@expo/vector-icons";
import {
  updateArtistProfile, useArtistAvailability, useArtistProfile, useAuth,
  useMyAppointments, useMyRequests, useNotifications,
} from "@inkora/data-access";
import { APPOINTMENT_STATUS_LABEL } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CountBadge } from "../../components/CountBadge";
import { useToast } from "../../components/Toast";
import { useBadgeCounts } from "../../lib/badges";
import { supabase } from "../../lib/supabase";
import { Avatar, fmtDateTime, StatusChip } from "../booking/components/ui";
import { RequestCard } from "../booking/MyBookingsScreen";

const isToday = (iso: string): boolean => {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export function ArtistHomeScreen() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";

  const profile = useArtistProfile(supabase, meId);
  const a = profile.data;
  const reqsQ = useMyRequests(supabase, "artist");
  const apptsQ = useMyAppointments(supabase);
  const availQ = useArtistAvailability(supabase, meId);
  const { notifications } = useNotifications(supabase);
  const unread = notifications.filter((n) => !n.readAt).length;
  const { requests: newRequests, newBookings, newCompleted, apptReplies } = useBadgeCounts();

  // Requests awaiting the artist's reply (offered/closed ones live on the full page).
  const needsAction = useMemo(
    () => (reqsQ.data ?? []).filter((r) => r.status === "pending" || r.status === "reviewing"),
    [reqsQ.data],
  );
  // Future active appointments, soonest first.
  const upcoming = useMemo(() => {
    const now = Date.now();
    return (apptsQ.data ?? [])
      .filter((ap) => (ap.status === "scheduled" || ap.status === "rescheduled") && new Date(ap.scheduledStart).getTime() >= now)
      .sort((x, y) => new Date(x.scheduledStart).getTime() - new Date(y.scheduledStart).getTime());
  }, [apptsQ.data]);
  const todayCount = useMemo(() => upcoming.filter((ap) => isToday(ap.scheduledStart)).length, [upcoming]);
  const noAvailability = !availQ.isLoading && (availQ.data ?? []).length === 0;

  // Accepting-bookings quick toggle (optimistic; reverts on failure).
  const [accepting, setAccepting] = useState<boolean | null>(null);
  useEffect(() => { if (a && accepting === null) setAccepting(a.isAccepting); }, [a, accepting]);
  const acceptingValue = accepting ?? a?.isAccepting ?? false;
  async function toggleAccepting(next: boolean) {
    setAccepting(next);
    try {
      await updateArtistProfile(supabase, { isAccepting: next });
      await qc.invalidateQueries({ queryKey: ["artist", meId] });
    } catch (e) {
      setAccepting(!next);
      toast.show((e as Error).message, "error");
    }
  }

  const firstName = a?.displayName?.trim().split(/\s+/)[0];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.topbar}>
          <View style={{ flex: 1 }}>
            <Text style={s.hello} numberOfLines={1}>Hi{firstName ? `, ${firstName}` : ""}</Text>
            <Text style={s.helloSub}>Here&apos;s what needs you today</Text>
          </View>
          <View style={s.topActions}>
            <Pressable onPress={() => router.push("/artist-dashboard")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Calendar">
              <Ionicons name="calendar-outline" size={24} color="#18181B" />
            </Pressable>
            <Pressable onPress={() => router.push("/notifications")} hitSlop={10} accessibilityRole="button" accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
              <Ionicons name="notifications-outline" size={24} color="#18181B" />
              {unread > 0 ? <View style={s.bellDot} /> : null}
            </Pressable>
            <Pressable onPress={() => router.push("/profile/account")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Account settings">
              <Ionicons name="settings-outline" size={24} color="#18181B" />
            </Pressable>
          </View>
        </View>

        {/* Accepting toggle */}
        <View style={s.acceptCard}>
          <View style={[s.acceptDot, { backgroundColor: acceptingValue ? "#16A34A" : "#D4D4D8" }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.acceptTitle}>{acceptingValue ? "Accepting bookings" : "Not accepting bookings"}</Text>
            <Text style={s.acceptSub}>{acceptingValue ? "Clients can request you." : "You're hidden from new requests."}</Text>
          </View>
          <Switch value={acceptingValue} onValueChange={(v) => void toggleAccepting(v)} trackColor={{ true: "#E5484D" }} accessibilityLabel="Accepting bookings" />
        </View>

        {/* KPI tiles */}
        <View style={s.kpis}>
          <KpiTile icon="file-tray-full-outline" label="Requests" value={needsAction.length} alert={needsAction.length > 0} onPress={() => router.push("/artist-dashboard/requests")} />
          <KpiTile icon="calendar-outline" label="Upcoming" value={upcoming.length} onPress={() => router.push("/artist-dashboard/upcoming")} />
          <KpiTile icon="today-outline" label="Today" value={todayCount} onPress={() => router.push("/artist-dashboard")} />
        </View>

        {/* Booking requests */}
        <SectionHeader
          title="Booking requests"
          badge={newRequests}
          onSeeAll={needsAction.length > 0 ? () => router.push("/artist-dashboard/requests") : undefined}
        />
        {reqsQ.isLoading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : needsAction.length === 0 ? (
          <Empty icon="checkmark-done-outline" text="No requests need your reply right now." />
        ) : (
          needsAction.slice(0, 2).map((r) => (
            <RequestCard key={r.id} req={r} onPress={() => router.push(`/booking/${r.id}`)} />
          ))
        )}

        {/* Upcoming appointments */}
        <SectionHeader
          title="Upcoming appointments"
          badge={newBookings + newCompleted + apptReplies}
          onSeeAll={upcoming.length > 0 ? () => router.push("/artist-dashboard/upcoming") : undefined}
        />
        {apptsQ.isLoading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : upcoming.length === 0 ? (
          <Empty icon="calendar-outline" text="Nothing booked yet. Accepted offers show up here." />
        ) : (
          upcoming.slice(0, 3).map((appt) => (
            <Pressable
              key={appt.id}
              style={s.apptRow}
              onPress={() => router.push(`/booking/${appt.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Appointment with ${appt.counterparty.name}, ${fmtDateTime(appt.scheduledStart)}`}
            >
              <Avatar path={appt.counterparty.avatarPath} name={appt.counterparty.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={s.apptName}>{appt.counterparty.name}</Text>
                <Text style={s.apptSub}>{fmtDateTime(appt.scheduledStart)}</Text>
              </View>
              <StatusChip status={appt.status} label={APPOINTMENT_STATUS_LABEL[appt.status]} />
            </Pressable>
          ))
        )}

        {/* Availability nudge — only when none is set */}
        {noAvailability ? (
          <Pressable style={s.nudge} onPress={() => router.push("/artist-dashboard/availability")} accessibilityRole="button" accessibilityLabel="Set your availability">
            <Ionicons name="time-outline" size={20} color="#B45309" />
            <Text style={s.nudgeText}>Set your weekly availability so clients can book you.</Text>
            <Ionicons name="chevron-forward" size={16} color="#B45309" />
          </Pressable>
        ) : null}

        {/* Manage */}
        <SectionHeader title="Manage" />
        <View style={s.card}>
          <ActionRow icon="calendar-outline" label="Calendar & schedule" onPress={() => router.push("/artist-dashboard")} />
          <ActionRow icon="time-outline" label="Availability" onPress={() => router.push("/artist-dashboard/availability")} />
          <ActionRow icon="images-outline" label="Portfolio & flashes" onPress={() => router.push("/artist-dashboard/portfolio")} last />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiTile({ icon, label, value, alert, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; alert?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.kpi, alert && s.kpiAlert]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value} ${label}`}>
      <Ionicons name={icon} size={18} color={alert ? "#E5484D" : "#71717A"} />
      <Text style={[s.kpiValue, alert && { color: "#E5484D" }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </Pressable>
  );
}

function SectionHeader({ title, onSeeAll, badge = 0 }: { title: string; onSeeAll?: () => void; badge?: number }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle} accessibilityRole="header">{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8} style={s.seeAllRow} accessibilityRole="button" accessibilityLabel={badge > 0 ? `See all ${title}, ${badge} new` : `See all ${title}`}>
          <Text style={s.seeAll}>See all</Text>
          <CountBadge count={badge} />
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

function ActionRow({ icon, label, onPress, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable style={[s.actionRow, last && { borderBottomWidth: 0 }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color="#52525B" />
      <Text style={s.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#D4D4D8" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  topbar: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  hello: { fontSize: 26, fontWeight: "800", color: "#18181B" },
  helloSub: { color: "#A1A1AA", fontSize: 13, fontWeight: "600", marginTop: 2 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  bellDot: { position: "absolute", top: -2, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: "#E5484D", borderWidth: 1.5, borderColor: "#fff" },

  acceptCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FAFAFA", borderWidth: 1, borderColor: "#F0F0F2", borderRadius: 16, padding: 14, marginTop: 8 },
  acceptDot: { width: 10, height: 10, borderRadius: 5 },
  acceptTitle: { fontSize: 15, fontWeight: "800", color: "#18181B" },
  acceptSub: { color: "#71717A", fontSize: 12.5, marginTop: 2 },

  kpis: { flexDirection: "row", gap: 10, marginTop: 12 },
  kpi: { flex: 1, alignItems: "center", gap: 4, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#F0F0F2", borderRadius: 16, paddingVertical: 14 },
  kpiAlert: { backgroundColor: "#FEF3F3", borderColor: "#F7D3D4" },
  kpiValue: { fontSize: 22, fontWeight: "900", color: "#18181B" },
  kpiLabel: { color: "#71717A", fontSize: 12, fontWeight: "600" },

  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  seeAll: { color: "#E5484D", fontWeight: "700" },
  seeAllRow: { flexDirection: "row", alignItems: "center", gap: 6 },

  apptRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  apptName: { fontWeight: "700", fontSize: 15 },
  apptSub: { color: "#71717A", fontSize: 13, marginTop: 2 },

  nudge: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEF3C7", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 16 },
  nudgeText: { flex: 1, color: "#92400E", fontSize: 13, fontWeight: "600", lineHeight: 18 },

  card: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, overflow: "hidden" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  actionLabel: { flex: 1, fontWeight: "600", fontSize: 15, color: "#18181B" },

  empty: { alignItems: "center", gap: 6, paddingVertical: 20 },
  emptyText: { color: "#A1A1AA", fontSize: 13, textAlign: "center", paddingHorizontal: 24 },
});
