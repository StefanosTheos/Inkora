import { Ionicons } from "@expo/vector-icons";
import { useAuth, useMyStudio, useStudioCalendarBookings } from "@inkora/data-access";
import type { StudioCalendarBooking } from "@inkora/domain";
import { APPOINTMENT_STATUS_LABEL } from "@inkora/domain";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { MonthCalendar, toIsoDate } from "../booking/components/MonthCalendar";
import { Avatar, money, StatusChip } from "../booking/components/ui";

const RED = "#E5484D";
const WDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format a local yyyy-mm-dd without the UTC-parse shift `new Date(iso)` causes. */
const fmtSelected = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return `${WDAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS3[dt.getMonth()]} ${dt.getFullYear()}`;
};

const fmtHours = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};
const timeLabel = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function StudioCalendarScreen() {
  const router = useRouter();
  const { ctx } = useAuth();
  const studioQ = useMyStudio(supabase, ctx.userId ?? "");
  const st = studioQ.data;
  const sym = st?.currencyCode;

  // Load a wide window around today so navigating months always has data.
  const range = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 120);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }, []);

  const bookingsQ = useStudioCalendarBookings(supabase, st?.id ?? "", range.startISO, range.endISO);
  const rows = useMemo(() => bookingsQ.data ?? [], [bookingsQ.data]);

  const [selected, setSelected] = useState<string>(() => toIsoDate(new Date()));

  const marked = useMemo(() => new Set(rows.map((r) => toIsoDate(new Date(r.scheduledStart)))), [rows]);
  const dayRows = useMemo(() => rows.filter((r) => toIsoDate(new Date(r.scheduledStart)) === selected), [rows, selected]);
  const dayRevenue = dayRows.filter((r) => r.status === "completed").reduce((sum, r) => sum + (r.priceAmount ?? 0), 0);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#18181B" />
        </Pressable>
        <Text style={s.headerTitle} accessibilityRole="header">Calendar</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <View style={s.calCard}>
          <MonthCalendar selected={selected} onSelect={setSelected} markedDates={marked} allowPast />
        </View>

        <View style={s.dayHead}>
          <View style={s.dayHeadLeft}>
            <View style={s.dayAccent} />
            <Text style={s.dayTitle}>{fmtSelected(selected)}</Text>
          </View>
          {dayRows.length > 0 ? (
            <Text style={s.dayCount}>{dayRows.length} booking{dayRows.length === 1 ? "" : "s"}</Text>
          ) : null}
        </View>
        {dayRevenue > 0 ? (
          <Text style={s.dayRevenue}>Completed revenue: <Text style={s.dayRevenueVal}>{money(dayRevenue, sym)}</Text></Text>
        ) : null}

        {bookingsQ.isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : dayRows.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-clear-outline" size={30} color="#D4D4D8" />
            <Text style={s.emptyText}>Nothing booked this day.</Text>
          </View>
        ) : (
          dayRows.map((r) => <CalCard key={r.appointmentId} row={r} sym={sym} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CalCard({ row, sym }: { row: StudioCalendarBooking; sym?: string }) {
  const past = row.status === "completed";
  const meta = [
    fmtHours(row.durationMinutes),
    row.placement,
    row.approxSize,
    row.isColor == null ? null : row.isColor ? "Color" : "Black & grey",
  ].filter(Boolean) as string[];
  return (
    <View style={[s.card, past && s.cardPast]}>
      <View style={[s.cardAccent, past ? s.accentPast : s.accentUpcoming]} />
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <Text style={s.cardTime}>{timeLabel(row.scheduledStart)}–{timeLabel(row.scheduledEnd)}</Text>
          <StatusChip status={row.status} label={APPOINTMENT_STATUS_LABEL[row.status]} />
        </View>
        {row.title ? <Text style={s.cardTitle} numberOfLines={1}>{row.title}</Text> : null}

        <View style={s.people}>
          <View style={s.person}>
            <Avatar path={row.artistAvatarPath} name={row.artistName} size={30} />
            <View style={{ flex: 1 }}>
              <Text style={s.personRole}>Artist</Text>
              <Text style={s.personName} numberOfLines={1}>{row.artistName}</Text>
            </View>
          </View>
          <View style={s.person}>
            <Avatar path={row.clientAvatarPath} name={row.clientName} size={30} />
            <View style={{ flex: 1 }}>
              <Text style={s.personRole}>Client</Text>
              <Text style={s.personName} numberOfLines={1}>{row.clientName}</Text>
            </View>
          </View>
        </View>

        <View style={s.cardFoot}>
          <View style={s.chips}>
            {meta.map((m, i) => <View key={i} style={s.chip}><Text style={s.chipText}>{m}</Text></View>)}
          </View>
          <Text style={s.cardPrice}>{row.priceAmount != null ? money(row.priceAmount, sym) : "—"}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  body: { padding: 16, paddingBottom: 40 },
  calCard: { borderWidth: 1, borderColor: "#F0F0F2", borderRadius: 18, padding: 12 },

  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 4 },
  dayHeadLeft: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  dayAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: RED },
  dayTitle: { fontSize: 16, fontWeight: "800", color: "#18181B" },
  dayCount: { fontSize: 13, fontWeight: "700", color: "#A1A1AA" },
  dayRevenue: { fontSize: 13, fontWeight: "700", color: "#71717A", marginBottom: 12, marginLeft: 13 },
  dayRevenueVal: { color: RED, fontWeight: "800" },

  empty: { alignItems: "center", gap: 8, paddingVertical: 36 },
  emptyText: { color: "#A1A1AA", fontSize: 14, fontWeight: "600" },

  card: { flexDirection: "row", borderWidth: 1, borderColor: "#F0F0F2", borderRadius: 16, marginBottom: 10, overflow: "hidden" },
  cardPast: { backgroundColor: "#FCFCFC" },
  cardAccent: { width: 4 },
  accentUpcoming: { backgroundColor: RED },
  accentPast: { backgroundColor: "#E4E4E7" },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTime: { fontSize: 14, fontWeight: "800", color: "#18181B" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#3F3F46", marginTop: 4 },
  people: { flexDirection: "row", gap: 12, marginTop: 12 },
  person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  personRole: { fontSize: 11, fontWeight: "700", color: "#A1A1AA", textTransform: "uppercase", letterSpacing: 0.3 },
  personName: { fontSize: 14, fontWeight: "700", color: "#18181B" },
  cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  chip: { backgroundColor: "#F4F4F5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: "600", color: "#52525B" },
  cardPrice: { fontSize: 16, fontWeight: "800", color: RED },
});
