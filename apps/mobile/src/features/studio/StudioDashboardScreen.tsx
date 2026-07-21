import { Ionicons } from "@expo/vector-icons";
import { useAuth, useMyStudio, useNotifications, useStudioOverview, useStudioOverviewPeriod } from "@inkora/data-access";
import type { StatsPeriod } from "@inkora/domain";
import { currencySymbol, STATS_PERIOD_LABEL } from "@inkora/domain";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBadgeCounts } from "../../lib/badges";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";

/** Compact currency for headline numbers: €0, €120, €2.4k, €18k. `sym` is the
 *  studio's currency symbol (€/$/£/"SEK "). */
const compactMoney = (n: number, sym = "€"): string => {
  if (n >= 10000) return `${sym}${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}k`;
  return `${sym}${Math.round(n)}`;
};

/** The studio-owner home: studio identity + a headline performance overview.
 *  Roster, reviews and account settings live on the Team tab. */
export function StudioDashboardScreen() {
  const router = useRouter();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const [period, setPeriod] = useState<StatsPeriod>("wtd");
  const studioQ = useMyStudio(supabase, meId);
  const st = studioQ.data;
  const overviewQ = useStudioOverview(supabase, st?.id ?? "");
  const periodQ = useStudioOverviewPeriod(supabase, st?.id ?? "", period);
  const { notifications } = useNotifications(supabase);
  const unread = notifications.filter((n) => !n.readAt).length;
  const { applications: newApplications } = useBadgeCounts();
  const ov = overviewQ.data;
  const pv = periodQ.data;

  if (studioQ.isLoading) {
    return <SafeAreaView style={s.safe} edges={["top"]}><View style={s.center}><ActivityIndicator /></View></SafeAreaView>;
  }
  if (!st) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}><Ionicons name="business-outline" size={40} color="#D4D4D8" /><Text style={s.muted}>No studio is linked to your account yet.</Text></View>
      </SafeAreaView>
    );
  }

  const sym = currencySymbol(st.currencyCode);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.topbar}>
          <Text style={s.topTitle} accessibilityRole="header">Studio</Text>
          <View style={s.topActions}>
            <Pressable onPress={() => router.push("/studio-calendar")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Calendar">
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

        {/* Studio identity */}
        <View style={s.studioRow}>
          {st.logoPath ? (
            <Image source={{ uri: imageUrl(st.logoPath, 120) }} style={s.logo} contentFit="cover" accessibilityRole="image" accessibilityLabel="Studio logo" />
          ) : (
            <View style={s.logo}><Text style={s.logoInitial}>{st.name.charAt(0).toUpperCase()}</Text></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{st.name}</Text>
            <Text style={s.sub} numberOfLines={1}>{[st.city, st.country].filter(Boolean).join(", ") || "Your studio"}</Text>
          </View>
        </View>
        <View style={s.headerBtns}>
          <Pressable style={s.outlineBtn} onPress={() => router.push(`/studio/${st.slug}`)} accessibilityRole="button" accessibilityLabel="View public page">
            <Ionicons name="eye-outline" size={16} color="#18181B" />
            <Text style={s.outlineBtnText}>Public page</Text>
          </Pressable>
          <Pressable style={s.outlineBtn} onPress={() => router.push("/studio-edit")} accessibilityRole="button" accessibilityLabel="Edit studio">
            <Ionicons name="create-outline" size={16} color="#18181B" />
            <Text style={s.outlineBtnText}>Edit studio</Text>
          </Pressable>
        </View>

        {/* Overview */}
        <Text style={s.section} accessibilityRole="header">Overview</Text>
        {/* Period selector — scopes the activity metrics (revenue, completed,
            cancelled, visits); current-state metrics stay all-time. */}
        <View style={s.periodSeg}>
          {(["wtd", "mtd", "ytd"] as const).map((p) => (
            <Pressable
              key={p}
              style={[s.periodBtn, period === p && s.periodBtnActive]}
              onPress={() => setPeriod(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: period === p }}
              accessibilityLabel={STATS_PERIOD_LABEL[p]}
            >
              <Text style={[s.periodText, period === p && s.periodTextActive]}>{STATS_PERIOD_LABEL[p]}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={s.hero}
          onPress={() => router.push(`/studio-insights?g=${period === "wtd" ? "week" : period === "ytd" ? "year" : "month"}`)}
          accessibilityRole="button"
          accessibilityLabel="View studio insights"
        >
          <View style={s.heroBloom} />
          <HeroStat text={String(ov?.activeArtists ?? 0)} label="Artists" />
          <View style={s.heroDivider} />
          <HeroStat
            text={compactMoney(pv?.revenue ?? 0, sym)}
            label="Revenue"
            trend={<TrendBadge cur={pv?.revenue ?? 0} prev={pv?.prevRevenue ?? 0} />}
          />
          <View style={s.heroDivider} />
          <HeroStat text={ov && ov.ratingCount > 0 ? `★${ov.ratingAvg.toFixed(1)}` : "—"} label="Rating" />
        </Pressable>
        {/* Drill into every completed booking (artist, client, price, length),
            filterable per day/week/month. Opens at the selected period's grain. */}
        <Pressable
          style={s.insightsCta}
          onPress={() => router.push(`/studio-insights?g=${period === "wtd" ? "week" : period === "ytd" ? "year" : "month"}`)}
          accessibilityRole="button"
          accessibilityLabel="See all completed bookings and details"
        >
          <Ionicons name="receipt-outline" size={17} color="#18181B" />
          <Text style={s.insightsCtaText}>See all completed bookings</Text>
          <Ionicons name="chevron-forward" size={16} color="#A1A1AA" />
        </Pressable>
        {/* Period-scoped tiles (from the wtd/mtd/ytd view) — these track the
            toggle above. */}
        <Text style={s.periodNote}>Revenue, completed, cancelled, no-shows &amp; visits shown for {STATS_PERIOD_LABEL[period].toLowerCase()}</Text>
        <View style={s.gridRow}>
          <BigTile label="Completed" value={pv?.completed ?? 0} icon="checkmark-done-outline" trend={<TrendBadge cur={pv?.completed ?? 0} prev={pv?.prevCompleted ?? 0} />} />
          <BigTile label="Cancelled" value={pv?.cancelled ?? 0} icon="close-circle-outline" trend={<TrendBadge cur={pv?.cancelled ?? 0} prev={pv?.prevCancelled ?? 0} higherIsBetter={false} />} />
        </View>
        <View style={s.gridRow}>
          <BigTile label="No-shows" value={pv?.noShow ?? 0} icon="person-remove-outline" alert={!!pv?.noShow} trend={<TrendBadge cur={pv?.noShow ?? 0} prev={pv?.prevNoShow ?? 0} higherIsBetter={false} />} />
          <BigTile label="Profile visits" value={pv?.profileVisits ?? 0} icon="eye-outline" trend={<TrendBadge cur={pv?.profileVisits ?? 0} prev={pv?.prevProfileVisits ?? 0} />} />
        </View>
        {/* Overall tiles — not tied to the period toggle: upcoming bookings, the
            studio's all-time saves, and the current pending application count. */}
        <Text style={s.allTimeNote}>Overall</Text>
        <View style={s.gridRow}>
          <BigTile label="Scheduled" value={ov?.scheduledBookings ?? 0} icon="calendar-outline" />
          <BigTile label="Saved by" value={ov?.studioSaves ?? 0} icon="heart-outline" />
        </View>
        <View style={s.gridRow}>
          <BigTile label="Applications" value={ov?.pendingApplications ?? 0} icon="mail-unread-outline" alert={!!ov?.pendingApplications} badge={newApplications} onPress={() => router.push("/studio-applications")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ text, label, trend }: { text: string; label: string; trend?: ReactNode }) {
  return (
    <View style={s.heroStat} accessible accessibilityLabel={`${text} ${label}`}>
      <Text style={s.heroValue}>{text}</Text>
      <Text style={s.heroLabel}>{label}</Text>
      {/* Always reserve the trend row's height so all three columns stay the
          same height and their value/label rows line up — with or without a
          percentage under any one of them. */}
      <View style={s.heroTrend}>{trend}</View>
    </View>
  );
}

/** Percentage change vs. the previous window. null when there's no baseline. */
function trendPct(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 100);
}

/** Arrow + % vs. the previous equal-length window. Colour reflects whether the
 *  move is good — inverted for metrics where up is bad (e.g. cancellations). */
function TrendBadge({ cur, prev, higherIsBetter = true }: { cur: number; prev: number; higherIsBetter?: boolean }) {
  const pct = trendPct(cur, prev);
  if (pct === null || pct === 0) return null; // no baseline / no change → show nothing
  const up = pct > 0;
  const good = higherIsBetter ? up : !up;
  const color = good ? "#16A34A" : "#DC2626";
  return (
    <View style={s.trendRow} accessible accessibilityLabel={`${up ? "up" : "down"} ${Math.abs(pct)} percent vs previous period`}>
      <Ionicons name={up ? "arrow-up" : "arrow-down"} size={11} color={color} />
      <Text style={[s.trendText, { color }]}>{Math.abs(pct)}%</Text>
    </View>
  );
}

function BigTile({ label, value, icon, alert, onPress, trend, badge }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; alert?: boolean; onPress?: () => void; trend?: ReactNode; badge?: number }) {
  const inner = (
    <>
      <Ionicons name={onPress ? "chevron-forward" : icon} size={16} color="#D4D4D8" style={s.bigIcon} />
      {badge && badge > 0 ? (
        <View style={s.bigBadge}><Text style={s.bigBadgeText}>{badge > 99 ? "99+" : badge}</Text></View>
      ) : null}
      <Text style={[s.bigValue, alert && { color: "#E5484D" }]}>{value}</Text>
      <View style={s.bigLabelRow}>
        <Text style={s.bigLabel}>{label}</Text>
        {trend}
      </View>
    </>
  );
  const badgeLabel = badge && badge > 0 ? `, ${badge} new` : "";
  if (onPress) {
    return (
      <Pressable style={s.bigTile} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value} ${label}${badgeLabel}, open`}>{inner}</Pressable>
    );
  }
  return <View style={s.bigTile} accessible accessibilityLabel={`${value} ${label}${badgeLabel}`}>{inner}</View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  muted: { color: "#A1A1AA", textAlign: "center", lineHeight: 20 },
  body: { padding: 16, paddingBottom: 40, gap: 4 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  topTitle: { fontSize: 28, fontWeight: "800" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  bellDot: { position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: 5, backgroundColor: "#E5484D", borderWidth: 1.5, borderColor: "#fff" },
  studioRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 60, height: 60, borderRadius: 16, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoInitial: { color: "#fff", fontSize: 26, fontWeight: "800" },
  name: { fontSize: 20, fontWeight: "800", color: "#18181B" },
  sub: { color: "#71717A", marginTop: 2, fontWeight: "600" },
  headerBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  outlineBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 12, paddingVertical: 11 },
  outlineBtnText: { fontWeight: "700", fontSize: 14, color: "#18181B" },
  section: { fontSize: 18, fontWeight: "800", marginTop: 22, marginBottom: 10 },
  hero: { flexDirection: "row", alignItems: "center", backgroundColor: "#18181B", borderRadius: 22, paddingTop: 33, paddingBottom: 16, paddingHorizontal: 8, overflow: "hidden", marginBottom: 10 },
  heroBloom: { position: "absolute", top: -44, right: -24, width: 160, height: 160, borderRadius: 80, backgroundColor: "#E5484D", opacity: 0.22 },
  heroStat: { flex: 1, alignItems: "center" },
  heroValue: { color: "#fff", fontSize: 28, fontWeight: "900" },
  heroLabel: { color: "#A1A1AA", fontSize: 12, fontWeight: "600", marginTop: 5, letterSpacing: 0.2 },
  heroTrend: { height: 16, marginTop: 3, alignItems: "center", justifyContent: "center" },
  heroDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.12)" },
  periodSeg: { flexDirection: "row", backgroundColor: "#F4F4F5", borderRadius: 999, padding: 3, marginBottom: 12 },
  periodBtn: { flex: 1, paddingVertical: 7, borderRadius: 999, alignItems: "center" },
  periodBtnActive: { backgroundColor: "#18181B" },
  periodText: { fontSize: 13, fontWeight: "700", color: "#71717A" },
  periodTextActive: { color: "#fff" },
  periodNote: { color: "#A1A1AA", fontSize: 11.5, fontWeight: "600", marginBottom: 12, marginTop: -2 },
  allTimeNote: { color: "#A1A1AA", fontSize: 11.5, fontWeight: "700", marginTop: 2, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  insightsCta: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F4F5", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12 },
  insightsCtaText: { flex: 1, fontSize: 14, fontWeight: "800", color: "#18181B" },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 1 },
  trendText: { fontSize: 11, fontWeight: "800" },
  gridRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  bigTile: { flex: 1, borderRadius: 18, padding: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEEEF0" },
  bigIcon: { position: "absolute", top: 15, right: 15 },
  bigBadge: { position: "absolute", top: 11, right: 38, minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: "#E5484D", alignItems: "center", justifyContent: "center" },
  bigBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  bigValue: { fontSize: 28, fontWeight: "900", color: "#18181B", marginTop: 4 },
  bigLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  bigLabel: { color: "#A1A1AA", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 },
});
