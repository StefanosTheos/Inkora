import { Ionicons } from "@expo/vector-icons";
import {
  startDirectConversation, studioSetMembership, useAuth, useMyStudio, useNotifications,
  useStudioArtistStats, useStudioOverview, useStudioOverviewPeriod, useStudioReviews,
} from "@inkora/data-access";
import type { ReviewItem, StatsPeriod, StudioArtistStat, StudioRosterArtist } from "@inkora/domain";
import { STATS_PERIOD_LABEL } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";
import { Pager } from "../../components/Pager";
import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { Avatar, fmtDate } from "../booking/components/ui";

/** Artists shown per page on the roster before paging kicks in. */
const ROSTER_PAGE_SIZE = 5;

/** Roster sort options — each maps an artist (+ its stats) to a sortable
 *  number; the roster is ordered high-to-low. */
type SortKey = "revenue" | "rating" | "bookings" | "saves" | "visits";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "rating", label: "Rating" },
  { key: "bookings", label: "Bookings" },
  { key: "saves", label: "Saves" },
  { key: "visits", label: "Visits" },
];
function sortValue(key: SortKey, a: StudioRosterArtist, stat?: StudioArtistStat): number {
  switch (key) {
    case "revenue": return stat?.revenue ?? 0;
    case "rating": return a.ratingAvg;
    case "bookings": return stat?.completed ?? 0;
    case "saves": return (stat?.savedBy ?? 0) + (stat?.workSaves ?? 0);
    case "visits": return stat?.profileVisits ?? 0;
  }
}

/** Compact currency for headline numbers: €0, €120, €2.4k, €18k. */
const compactMoney = (n: number): string => {
  if (n >= 10000) return `€${Math.round(n / 1000)}k`;
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${Math.round(n)}`;
};

/** The studio-owner home: studio identity, headline stats, and the onboarded
 *  roster with per-artist performance. Business-focused — no discovery/AI. */
export function StudioDashboardScreen() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { ctx, signOut } = useAuth();
  const meId = ctx.userId ?? "";
  const [menuArtist, setMenuArtist] = useState<{ id: string; name: string } | null>(null);
  const [rosterPage, setRosterPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [period, setPeriod] = useState<StatsPeriod>("30d");
  const studioQ = useMyStudio(supabase, meId);
  const st = studioQ.data;
  const overviewQ = useStudioOverview(supabase, st?.id ?? "");
  const periodQ = useStudioOverviewPeriod(supabase, st?.id ?? "", period);
  const statsQ = useStudioArtistStats(supabase, st?.id ?? "");
  const reviewsQ = useStudioReviews(supabase, st?.id ?? "");
  const { notifications } = useNotifications(supabase);
  const unread = notifications.filter((n) => !n.readAt).length;
  const ov = overviewQ.data;
  const pv = periodQ.data;
  const statsById = new Map((statsQ.data ?? []).map((x) => [x.artistId, x]));
  const roster = [...(st?.roster ?? [])].sort(
    (a, b) => sortValue(sortKey, b, statsById.get(b.id)) - sortValue(sortKey, a, statsById.get(a.id)),
  );
  const rosterPages = Math.max(1, Math.ceil(roster.length / ROSTER_PAGE_SIZE));
  const safeRosterPage = Math.min(rosterPage, rosterPages - 1);
  const pagedRoster = roster.slice(safeRosterPage * ROSTER_PAGE_SIZE, safeRosterPage * ROSTER_PAGE_SIZE + ROSTER_PAGE_SIZE);

  async function messageArtist(artistId: string) {
    try {
      const cid = await startDirectConversation(supabase, artistId);
      router.push(`/chats/${cid}`);
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }
  async function setMembership(artistId: string, status: "active" | "suspended" | "removed") {
    setMenuArtist(null);
    try {
      await studioSetMembership(supabase, st?.id ?? "", artistId, status);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-studio", meId] }),
        qc.invalidateQueries({ queryKey: ["studio-artist-stats", st?.id] }),
        qc.invalidateQueries({ queryKey: ["studio-overview", st?.id] }),
      ]);
      toast.show(status === "removed" ? "Artist removed from studio" : status === "active" ? "Artist reactivated" : "Artist suspended");
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }
  const confirmRemove = (artistId: string, name: string) => {
    void confirm({ title: `Remove ${name}?`, message: "They'll be taken off your roster.", confirmLabel: "Remove", destructive: true })
      .then((ok) => { if (ok) void setMembership(artistId, "removed"); });
  };
  const confirmSignOut = () => {
    void confirm({ title: "Sign out?", message: "You'll need to sign in again to manage your studio.", confirmLabel: "Sign out", destructive: true })
      .then((ok) => { if (ok) void signOut(); });
  };

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

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.topbar}>
          <Text style={s.topTitle} accessibilityRole="header">Studio</Text>
          <View style={s.topActions}>
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
          {(["30d", "mtd", "ytd"] as const).map((p) => (
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
        <View style={s.hero}>
          <View style={s.heroBloom} />
          <HeroStat text={String(ov?.activeArtists ?? 0)} label="Artists" />
          <View style={s.heroDivider} />
          <HeroStat
            text={compactMoney(pv?.revenue ?? 0)}
            label="Revenue"
            trend={<TrendBadge cur={pv?.revenue ?? 0} prev={pv?.prevRevenue ?? 0} />}
          />
          <View style={s.heroDivider} />
          <HeroStat text={ov && ov.ratingCount > 0 ? `★${ov.ratingAvg.toFixed(1)}` : "—"} label="Rating" />
        </View>
        <Text style={s.periodNote}>Revenue, completed, cancelled &amp; visits shown for {STATS_PERIOD_LABEL[period].toLowerCase()}</Text>
        <View style={s.gridRow}>
          <BigTile label="Completed" value={pv?.completed ?? 0} icon="checkmark-done-outline" trend={<TrendBadge cur={pv?.completed ?? 0} prev={pv?.prevCompleted ?? 0} />} />
          <BigTile label="Scheduled" value={ov?.scheduledBookings ?? 0} icon="calendar-outline" />
        </View>
        <View style={s.gridRow}>
          <BigTile label="Cancelled" value={pv?.cancelled ?? 0} icon="close-circle-outline" trend={<TrendBadge cur={pv?.cancelled ?? 0} prev={pv?.prevCancelled ?? 0} higherIsBetter={false} />} />
          <BigTile label="No-shows" value={pv?.noShow ?? 0} icon="person-remove-outline" alert={!!pv?.noShow} trend={<TrendBadge cur={pv?.noShow ?? 0} prev={pv?.prevNoShow ?? 0} higherIsBetter={false} />} />
        </View>
        <View style={s.gridRow}>
          <BigTile label="Profile visits" value={pv?.profileVisits ?? 0} icon="eye-outline" trend={<TrendBadge cur={pv?.profileVisits ?? 0} prev={pv?.prevProfileVisits ?? 0} />} />
          <BigTile label="Saved by" value={ov?.studioSaves ?? 0} icon="heart-outline" />
        </View>
        <View style={s.gridRow}>
          <BigTile label="Applications" value={ov?.pendingApplications ?? 0} icon="mail-unread-outline" alert={!!ov?.pendingApplications} onPress={() => router.push("/studio-applications")} />
        </View>

        {/* Roster */}
        <View style={s.sectionRow}>
          <Text style={s.sectionInline} accessibilityRole="header">Artists</Text>
          <Pressable style={s.inviteLink} onPress={() => router.push("/studio-invite")} accessibilityRole="button" accessibilityLabel="Invite an artist">
            <Ionicons name="person-add-outline" size={15} color="#E5484D" />
            <Text style={s.inviteLinkText}>Invite</Text>
          </Pressable>
        </View>
        {roster.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortRow} style={s.sortScroll}>
            <Ionicons name="swap-vertical-outline" size={15} color="#A1A1AA" style={{ alignSelf: "center", marginRight: 2 }} />
            {SORT_OPTIONS.map((o) => {
              const active = o.key === sortKey;
              return (
                <Pressable
                  key={o.key}
                  style={[s.sortChip, active && s.sortChipActive]}
                  onPress={() => { setSortKey(o.key); setRosterPage(0); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Sort by ${o.label}`}
                >
                  <Text style={[s.sortChipText, active && s.sortChipTextActive]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {statsQ.isLoading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : roster.length === 0 ? (
          <Text style={s.muted}>No artists onboarded yet. Invite one to get started.</Text>
        ) : (
          <>
            {pagedRoster.map((a) => (
              <ArtistStatCard key={a.id} artist={a} stat={statsById.get(a.id)} onOpen={() => router.push(`/artist/${a.id}`)} onMessage={() => void messageArtist(a.id)} onMenu={() => setMenuArtist({ id: a.id, name: a.displayName })} />
            ))}
            <Pager page={safeRosterPage} totalPages={rosterPages} onChange={setRosterPage} />
          </>
        )}

        {/* Suspended members — off the roster, still tied to the studio. */}
        {st.suspended.length > 0 ? (
          <>
            <Text style={s.section} accessibilityRole="header">Suspended</Text>
            {st.suspended.map((a) => (
              <View key={a.id} style={s.card}>
                <View style={s.cardHead}>
                  <Pressable style={s.cardPerson} onPress={() => router.push(`/artist/${a.id}`)} accessibilityRole="button" accessibilityLabel={`View ${a.displayName}'s profile`}>
                    <Avatar path={a.avatarPath} name={a.displayName} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardName} numberOfLines={1}>{a.displayName}</Text>
                      <Text style={s.cardSub} numberOfLines={1}>{a.headline ?? "Tattoo artist"}</Text>
                    </View>
                  </Pressable>
                  <View style={s.suspendedChip}><Text style={s.suspendedChipText}>Suspended</Text></View>
                </View>
                <View style={s.suspendActions}>
                  <Pressable style={[s.suspendBtn, s.reactivateBtn]} onPress={() => void setMembership(a.id, "active")} accessibilityRole="button" accessibilityLabel={`Reactivate ${a.displayName}`}>
                    <Text style={s.reactivateText}>Reactivate</Text>
                  </Pressable>
                  <Pressable style={[s.suspendBtn, s.removeOutlineBtn]} onPress={() => confirmRemove(a.id, a.displayName)} accessibilityRole="button" accessibilityLabel={`Remove ${a.displayName}`}>
                    <Text style={s.removeOutlineText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* Recent reviews of the studio */}
        {(reviewsQ.data ?? []).length > 0 ? (
          <>
            <Text style={s.section} accessibilityRole="header">Recent reviews</Text>
            {(reviewsQ.data ?? []).slice(0, 3).map((rv: ReviewItem) => (
              <Pressable
                key={rv.id}
                style={s.reviewCard}
                onPress={() => { if (rv.authorId) router.push(`/seeker/${rv.authorId}`); }}
                accessibilityRole="button"
                accessibilityLabel={`Review by ${rv.authorName}, ${rv.overallRating} stars`}
              >
                <Text style={s.reviewHead}>{rv.authorName} · ★ {rv.overallRating}</Text>
                {rv.title ? <Text style={s.reviewTitle}>{rv.title}</Text> : null}
                {rv.body ? <Text style={s.reviewBody} numberOfLines={2}>{rv.body}</Text> : null}
                <Text style={s.reviewDate}>{fmtDate(rv.createdAt)}</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {/* Settings */}
        <View style={s.settingsCard}>
          <Pressable style={s.settingRow} onPress={() => router.push("/profile/account")} accessibilityRole="button" accessibilityLabel="Account settings">
            <Ionicons name="settings-outline" size={20} color="#52525B" />
            <Text style={s.settingLabel}>Account settings</Text>
            <Ionicons name="chevron-forward" size={16} color="#D4D4D8" />
          </Pressable>
          <Pressable style={s.settingRow} onPress={confirmSignOut} accessibilityRole="button" accessibilityLabel="Sign out">
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={[s.settingLabel, { color: "#DC2626" }]}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Per-artist management sheet */}
      <Modal visible={!!menuArtist} transparent animationType="fade" onRequestClose={() => setMenuArtist(null)}>
        <Pressable style={s.sheetBackdrop} onPress={() => setMenuArtist(null)}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{menuArtist?.name}</Text>
            <Pressable style={s.sheetBtn} onPress={() => { if (menuArtist) void setMembership(menuArtist.id, "suspended"); }} accessibilityRole="button" accessibilityLabel="Suspend artist">
              <Ionicons name="pause-circle-outline" size={20} color="#18181B" />
              <Text style={s.sheetBtnText}>Suspend artist</Text>
            </Pressable>
            <Pressable style={s.sheetBtn} onPress={() => { const a = menuArtist; setMenuArtist(null); if (a) void confirm({ title: `Remove ${a.name}?`, message: "They'll be taken off your roster.", confirmLabel: "Remove", destructive: true }).then((ok) => { if (ok) void setMembership(a.id, "removed"); }); }} accessibilityRole="button" accessibilityLabel="Remove from studio">
              <Ionicons name="person-remove-outline" size={20} color="#DC2626" />
              <Text style={[s.sheetBtnText, { color: "#DC2626" }]}>Remove from studio</Text>
            </Pressable>
            <Pressable style={[s.sheetBtn, s.sheetCancel]} onPress={() => setMenuArtist(null)} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={[s.sheetBtnText, { fontWeight: "800" }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function HeroStat({ text, label, trend }: { text: string; label: string; trend?: ReactNode }) {
  return (
    <View style={s.heroStat} accessible accessibilityLabel={`${text} ${label}`}>
      <Text style={s.heroValue}>{text}</Text>
      <Text style={s.heroLabel}>{label}</Text>
      {trend ? <View style={{ marginTop: 3 }}>{trend}</View> : null}
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

function BigTile({ label, value, icon, alert, onPress, trend }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; alert?: boolean; onPress?: () => void; trend?: ReactNode }) {
  const inner = (
    <>
      <Ionicons name={onPress ? "chevron-forward" : icon} size={16} color="#D4D4D8" style={s.bigIcon} />
      <Text style={[s.bigValue, alert && { color: "#E5484D" }]}>{value}</Text>
      <View style={s.bigLabelRow}>
        <Text style={s.bigLabel}>{label}</Text>
        {trend}
      </View>
    </>
  );
  if (onPress) {
    return (
      <Pressable style={s.bigTile} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value} ${label}, open`}>{inner}</Pressable>
    );
  }
  return <View style={s.bigTile} accessible accessibilityLabel={`${value} ${label}`}>{inner}</View>;
}

function ArtistStatCard({ artist, stat, onOpen, onMessage, onMenu }: { artist: StudioRosterArtist; stat?: StudioArtistStat; onOpen: () => void; onMessage: () => void; onMenu: () => void }) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Pressable style={s.cardPerson} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`View ${artist.displayName}'s profile`}>
          <Avatar path={artist.avatarPath} name={artist.displayName} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={s.cardName} numberOfLines={1}>{artist.displayName}</Text>
            <Text style={s.cardSub} numberOfLines={1}>{artist.headline ?? "Tattoo artist"}</Text>
          </View>
          <View style={s.rating}>
            <Ionicons name="star" size={13} color="#E5484D" />
            <Text style={s.ratingText}>{artist.ratingAvg > 0 ? artist.ratingAvg.toFixed(1) : "—"}</Text>
          </View>
        </Pressable>
        <Pressable onPress={onMessage} hitSlop={8} style={s.msgBtn} accessibilityRole="button" accessibilityLabel={`Message ${artist.displayName}`}>
          <Ionicons name="chatbubble-outline" size={18} color="#18181B" />
        </Pressable>
        <Pressable onPress={onMenu} hitSlop={8} style={s.msgBtn} accessibilityRole="button" accessibilityLabel={`Manage ${artist.displayName}`}>
          <Ionicons name="ellipsis-horizontal" size={18} color="#18181B" />
        </Pressable>
      </View>
      <View style={s.metrics}>
        <Metric label="Revenue" value={compactMoney(stat?.revenue ?? 0)} />
        <Metric label="Done" value={stat?.completed ?? 0} />
        <Metric label="Upcoming" value={stat?.scheduled ?? 0} />
        <Metric label="Cancel" value={cancelRateLabel(stat)} alert={cancelRateValue(stat) >= 20} />
        <Metric label="No-show" value={stat?.noShow ?? 0} alert={(stat?.noShow ?? 0) > 0} />
        <Metric label="Reviews" value={stat?.ratingCount ?? 0} />
        <Metric label="Saves" value={(stat?.savedBy ?? 0) + (stat?.workSaves ?? 0)} />
        <Metric label="Visits" value={stat?.profileVisits ?? 0} />
      </View>
    </View>
  );
}

/** Cancellation rate = cancelled / (completed + cancelled). "—" with no history. */
function cancelRateValue(stat?: StudioArtistStat): number {
  const total = (stat?.completed ?? 0) + (stat?.cancelled ?? 0);
  return total > 0 ? Math.round(((stat?.cancelled ?? 0) / total) * 100) : 0;
}
function cancelRateLabel(stat?: StudioArtistStat): string {
  const total = (stat?.completed ?? 0) + (stat?.cancelled ?? 0);
  return total > 0 ? `${cancelRateValue(stat)}%` : "—";
}

function Metric({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <View style={s.metric} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[s.metricValue, alert && { color: "#DC2626" }]} numberOfLines={1}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
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
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
  sectionInline: { fontSize: 18, fontWeight: "800" },
  inviteLink: { flexDirection: "row", alignItems: "center", gap: 5 },
  inviteLinkText: { color: "#E5484D", fontWeight: "800", fontSize: 14 },
  sortScroll: { flexGrow: 0, marginBottom: 12 },
  sortRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sortChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F4F4F5" },
  sortChipActive: { backgroundColor: "#18181B" },
  sortChipText: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  sortChipTextActive: { color: "#fff" },
  cardPerson: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, paddingBottom: 28, gap: 4 },
  sheetTitle: { fontWeight: "800", fontSize: 15, color: "#18181B", textAlign: "center", paddingVertical: 10 },
  sheetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 14, backgroundColor: "#F4F4F5" },
  sheetBtnText: { fontWeight: "700", fontSize: 15, color: "#18181B" },
  sheetCancel: { backgroundColor: "#fff", marginTop: 4 },
  hero: { flexDirection: "row", alignItems: "center", backgroundColor: "#18181B", borderRadius: 22, paddingVertical: 22, paddingHorizontal: 8, overflow: "hidden", marginBottom: 10 },
  heroBloom: { position: "absolute", top: -44, right: -24, width: 160, height: 160, borderRadius: 80, backgroundColor: "#E5484D", opacity: 0.22 },
  heroStat: { flex: 1, alignItems: "center" },
  heroValue: { color: "#fff", fontSize: 28, fontWeight: "900" },
  heroLabel: { color: "#A1A1AA", fontSize: 12, fontWeight: "600", marginTop: 5, letterSpacing: 0.2 },
  heroDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.12)" },
  periodSeg: { flexDirection: "row", backgroundColor: "#F4F4F5", borderRadius: 999, padding: 3, marginBottom: 12 },
  periodBtn: { flex: 1, paddingVertical: 7, borderRadius: 999, alignItems: "center" },
  periodBtnActive: { backgroundColor: "#18181B" },
  periodText: { fontSize: 13, fontWeight: "700", color: "#71717A" },
  periodTextActive: { color: "#fff" },
  periodNote: { color: "#A1A1AA", fontSize: 11.5, fontWeight: "600", marginBottom: 12, marginTop: -2 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 1 },
  trendText: { fontSize: 11, fontWeight: "800" },
  gridRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  bigTile: { flex: 1, borderRadius: 18, padding: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEEEF0" },
  bigIcon: { position: "absolute", top: 15, right: 15 },
  bigValue: { fontSize: 28, fontWeight: "900", color: "#18181B", marginTop: 4 },
  bigLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  bigLabel: { color: "#A1A1AA", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 },
  card: { borderWidth: 1, borderColor: "#F0F0F2", borderRadius: 16, padding: 12, marginBottom: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardName: { fontWeight: "800", fontSize: 15, color: "#18181B" },
  cardSub: { color: "#71717A", fontSize: 13, marginTop: 2 },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontWeight: "800", color: "#18181B", fontSize: 13 },
  msgBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F4F4F5", alignItems: "center", justifyContent: "center" },
  metrics: { flexDirection: "row", flexWrap: "wrap", rowGap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F4F4F5" },
  metric: { alignItems: "center", width: "25%" },
  metricValue: { fontWeight: "800", fontSize: 15, color: "#18181B" },
  metricLabel: { color: "#A1A1AA", fontSize: 10, fontWeight: "600", marginTop: 2 },
  suspendedChip: { backgroundColor: "#FFF7ED", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  suspendedChipText: { color: "#C2410C", fontWeight: "800", fontSize: 12 },
  suspendActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  suspendBtn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  reactivateBtn: { backgroundColor: "#18181B" },
  reactivateText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  removeOutlineBtn: { borderWidth: 1, borderColor: "#E4E4E7" },
  removeOutlineText: { color: "#DC2626", fontWeight: "800", fontSize: 14 },
  reviewCard: { borderWidth: 1, borderColor: "#F0F0F2", borderRadius: 14, padding: 12, marginBottom: 10 },
  reviewHead: { fontWeight: "800", fontSize: 14, color: "#18181B" },
  reviewTitle: { fontWeight: "600", marginTop: 4, color: "#18181B" },
  reviewBody: { color: "#3F3F46", marginTop: 2, lineHeight: 19 },
  reviewDate: { color: "#A1A1AA", fontSize: 12, marginTop: 6 },
  settingsCard: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, overflow: "hidden", marginTop: 24 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  settingLabel: { flex: 1, fontWeight: "600", fontSize: 15, color: "#18181B" },
});
