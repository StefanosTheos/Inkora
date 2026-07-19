import { Ionicons } from "@expo/vector-icons";
import { useAuth, useMyStudio, useStudioCompletedBookings } from "@inkora/data-access";
import type { StudioBookingDetail } from "@inkora/domain";
import { currencySymbol } from "@inkora/domain";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/EmptyState";
import { Pager, PagerScrollProvider } from "../../components/Pager";
import { RowSkeleton } from "../../components/Skeleton";
import { supabase } from "../../lib/supabase";
import { Avatar, money } from "../booking/components/ui";

const RED = "#E5484D";
const PAGE_SIZE = 5;

type Grain = "day" | "week" | "month";
const GRAINS: { key: Grain; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const mon = (i: number): string => MONTHS[i] ?? "";
const mon3 = (i: number): string => (MONTHS[i] ?? "").slice(0, 3);
const wd = (i: number): string => WDAYS[i] ?? "";

const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d: Date) => addDays(atMidnight(d), -(((d.getDay() + 6) % 7)));

/** The [start, end) window (local) for a grain around an anchor day. */
function windowFor(grain: Grain, anchor: Date): { start: Date; end: Date } {
  if (grain === "day") { const s = atMidnight(anchor); return { start: s, end: addDays(s, 1) }; }
  if (grain === "week") { const s = mondayOf(anchor); return { start: s, end: addDays(s, 7) }; }
  const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return { start: s, end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) };
}

/** Move the anchor one grain-unit in either direction. */
function shift(grain: Grain, anchor: Date, dir: 1 | -1): Date {
  if (grain === "day") return addDays(anchor, dir);
  if (grain === "week") return addDays(anchor, dir * 7);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Human label for the current window (e.g. "Today", "14–20 Jul", "July 2026"). */
function windowLabel(grain: Grain, start: Date, end: Date): string {
  const today = atMidnight(new Date());
  if (grain === "day") {
    if (sameDay(start, today)) return "Today";
    if (sameDay(start, addDays(today, -1))) return "Yesterday";
    return `${wd(start.getDay())} ${start.getDate()} ${mon3(start.getMonth())} ${start.getFullYear()}`;
  }
  if (grain === "week") {
    const last = addDays(end, -1);
    const sameMonth = start.getMonth() === last.getMonth();
    const left = `${start.getDate()}${sameMonth ? "" : ` ${mon3(start.getMonth())}`}`;
    return `${left}–${last.getDate()} ${mon3(last.getMonth())} ${last.getFullYear()}`;
  }
  return `${mon(start.getMonth())} ${start.getFullYear()}`;
}

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
const dayLabel = (iso: string): string => {
  const d = new Date(iso);
  return `${wd(d.getDay())} ${d.getDate()} ${mon3(d.getMonth())}`;
};

interface PriceBucket { key: string; label: string; min: number; max: number | null }

const toggleKey = (set: Set<string>, key: string): Set<string> => {
  const next = new Set(set);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
};

export function StudioInsightsScreen() {
  const router = useRouter();
  const { ctx } = useAuth();
  const params = useLocalSearchParams<{ g?: string }>();
  const initialGrain: Grain = params.g === "day" || params.g === "week" || params.g === "month" ? params.g : "week";

  const studioQ = useMyStudio(supabase, ctx.userId ?? "");
  const st = studioQ.data;
  const sym = currencySymbol(st?.currencyCode);

  const [grain, setGrain] = useState<Grain>(initialGrain);
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [page, setPage] = useState(0);

  // Filters
  const [sheetOpen, setSheetOpen] = useState(false);
  const [priceSel, setPriceSel] = useState<Set<string>>(new Set());
  const [placeSel, setPlaceSel] = useState<Set<string>>(new Set());
  const [artistSel, setArtistSel] = useState<Set<string>>(new Set());

  const scrollRef = useRef<ScrollView>(null);
  const listAnchor = useRef<View>(null);

  const { start, end } = useMemo(() => windowFor(grain, anchor), [grain, anchor]);
  const startISO = start.toISOString();
  const endISO = end.toISOString();
  const atPresent = end.getTime() > Date.now();

  const bookingsQ = useStudioCompletedBookings(supabase, st?.id ?? "", startISO, endISO);
  const rows = useMemo(() => bookingsQ.data ?? [], [bookingsQ.data]);

  const priceBuckets: PriceBucket[] = useMemo(() => [
    { key: "u150", label: `Under ${sym}150`, min: 0, max: 150 },
    { key: "150-300", label: `${sym}150–300`, min: 150, max: 300 },
    { key: "300-500", label: `${sym}300–500`, min: 300, max: 500 },
    { key: "500+", label: `${sym}500+`, min: 500, max: null },
  ], [sym]);

  // Filter options are drawn from the whole window (so every choice is offered),
  // even as the list itself narrows.
  const placeOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.placement).filter((p): p is string => !!p))).sort(),
    [rows],
  );
  const artistOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.artistId, r.artistName));
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (priceSel.size) {
      const p = r.priceAmount;
      const hit = p != null && priceBuckets.some((b) => priceSel.has(b.key) && p >= b.min && (b.max == null || p < b.max));
      if (!hit) return false;
    }
    if (placeSel.size && !(r.placement && placeSel.has(r.placement))) return false;
    if (artistSel.size && !artistSel.has(r.artistId)) return false;
    return true;
  }), [rows, priceSel, placeSel, artistSel, priceBuckets]);

  const activeCount = priceSel.size + placeSel.size + artistSel.size;
  const clearAll = () => { setPriceSel(new Set()); setPlaceSel(new Set()); setArtistSel(new Set()); };

  const totals = useMemo(() => {
    const revenue = filtered.reduce((sum, r) => sum + (r.priceAmount ?? 0), 0);
    const minutes = filtered.reduce((sum, r) => sum + r.durationMinutes, 0);
    const priced = filtered.filter((r) => r.priceAmount != null).length;
    const artists = new Set(filtered.map((r) => r.artistId)).size;
    const clients = new Set(filtered.map((r) => r.clientId)).size;
    return { revenue, count: filtered.length, minutes, avgPrice: priced ? revenue / priced : 0, artists, clients };
  }, [filtered]);

  // Reset to the first page whenever the window or filters change.
  useEffect(() => { setPage(0); }, [startISO, endISO, priceSel, placeSel, artistSel]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const changeGrain = (g: Grain) => { setGrain(g); setAnchor(new Date()); };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle} accessibilityRole="header">Insights</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Grain selector */}
      <View style={s.seg}>
        {GRAINS.map((g) => (
          <Pressable
            key={g.key}
            style={[s.segBtn, grain === g.key && s.segBtnActive]}
            onPress={() => changeGrain(g.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: grain === g.key }}
            accessibilityLabel={`Group by ${g.label.toLowerCase()}`}
          >
            <Text style={[s.segText, grain === g.key && s.segTextActive]}>{g.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Period navigator */}
      <View style={s.nav}>
        <Pressable onPress={() => setAnchor((a) => shift(grain, a, -1))} hitSlop={8} style={s.navArrow} accessibilityRole="button" accessibilityLabel="Previous period">
          <Ionicons name="chevron-back" size={20} color="#18181B" />
        </Pressable>
        <Text style={s.navLabel}>{windowLabel(grain, start, end)}</Text>
        <Pressable
          onPress={() => { if (!atPresent) setAnchor((a) => shift(grain, a, 1)); }}
          disabled={atPresent}
          hitSlop={8}
          style={[s.navArrow, atPresent && s.navArrowOff]}
          accessibilityRole="button"
          accessibilityLabel="Next period"
        >
          <Ionicons name="chevron-forward" size={20} color={atPresent ? "#D4D4D8" : "#18181B"} />
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.body}>
        <PagerScrollProvider scrollRef={scrollRef}>
          {/* Summary tiles — Revenue carries the accent as the headline metric. */}
          <View style={s.tiles}>
            <Tile label="Revenue" value={`${sym}${Math.round(totals.revenue).toLocaleString()}`} accent />
            <Tile label="Completed" value={String(totals.count)} />
            <Tile label="Avg price" value={totals.count ? money(Math.round(totals.avgPrice), st?.currencyCode) : "—"} />
            <Tile label="Total time" value={totals.minutes ? fmtHours(totals.minutes) : "—"} />
          </View>
          {totals.count > 0 ? (
            <Text style={s.subline}>{totals.artists} artist{totals.artists === 1 ? "" : "s"} · {totals.clients} client{totals.clients === 1 ? "" : "s"}</Text>
          ) : null}

          {/* Bookings list */}
          <View ref={listAnchor} collapsable={false} />
          <View style={s.sectionRow}>
            <View style={s.sectionLeft}>
              <View style={s.sectionAccent} />
              <Text style={s.sectionTitle} accessibilityRole="header">Completed bookings</Text>
            </View>
            <Pressable
              style={[s.filterBtn, activeCount > 0 && s.filterBtnActive]}
              onPress={() => setSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"}
            >
              <Ionicons name="options-outline" size={16} color={activeCount > 0 ? "#fff" : RED} />
              <Text style={[s.filterBtnText, activeCount > 0 && s.filterBtnTextActive]}>Filters</Text>
              {activeCount > 0 ? <View style={s.filterCount}><Text style={s.filterCountText}>{activeCount}</Text></View> : null}
            </Pressable>
          </View>

          {bookingsQ.isLoading ? (
            <View style={{ gap: 10 }}><RowSkeleton /><RowSkeleton /><RowSkeleton /></View>
          ) : filtered.length === 0 ? (
            activeCount > 0 ? (
              <EmptyState icon="filter-outline" title="No bookings match your filters" message="Loosen or clear the filters to see more." actionLabel="Clear filters" onAction={clearAll} />
            ) : (
              <EmptyState icon="receipt-outline" title="No completed bookings" message={`Nothing completed for this ${grain}. Use the arrows to look at another ${grain}.`} />
            )
          ) : (
            <>
              {pageRows.map((r) => <BookingRow key={r.appointmentId} row={r} sym={sym} currency={st?.currencyCode} />)}
              <Pager page={safePage} totalPages={totalPages} onChange={setPage} anchorRef={listAnchor} />
            </>
          )}
        </PagerScrollProvider>
      </ScrollView>

      <FiltersSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        resultCount={filtered.length}
        activeCount={activeCount}
        onClear={clearAll}
        priceBuckets={priceBuckets}
        priceSel={priceSel}
        onTogglePrice={(k) => setPriceSel((p) => toggleKey(p, k))}
        placeOptions={placeOptions}
        placeSel={placeSel}
        onTogglePlace={(k) => setPlaceSel((p) => toggleKey(p, k))}
        artistOptions={artistOptions}
        artistSel={artistSel}
        onToggleArtist={(k) => setArtistSel((p) => toggleKey(p, k))}
      />
    </SafeAreaView>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[s.tile, accent && s.tileAccent]}>
      <Text style={[s.tileValue, accent && s.tileValueAccent]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[s.tileLabel, accent && s.tileLabelAccent]}>{label}</Text>
    </View>
  );
}

function BookingRow({ row, sym, currency }: { row: StudioBookingDetail; sym: string; currency?: string }) {
  const meta = [
    fmtHours(row.durationMinutes),
    row.placement,
    row.approxSize,
    row.isColor == null ? null : row.isColor ? "Color" : "Black & grey",
  ].filter(Boolean) as string[];
  return (
    <View style={s.card}>
      <View style={s.cardAccent} />
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <Text style={s.cardWhen}>{dayLabel(row.scheduledStart)} · {timeLabel(row.scheduledStart)}–{timeLabel(row.scheduledEnd)}</Text>
          <Text style={s.cardPrice}>{row.priceAmount != null ? money(row.priceAmount, currency) : `${sym}—`}</Text>
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

        {meta.length ? (
          <View style={s.chips}>
            {meta.map((m, i) => <View key={i} style={s.chip}><Text style={s.chipText}>{m}</Text></View>)}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[s.fchip, selected && s.fchipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[s.fchipText, selected && s.fchipTextActive]}>{label}</Text>
    </Pressable>
  );
}

interface FiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  resultCount: number;
  activeCount: number;
  onClear: () => void;
  priceBuckets: PriceBucket[];
  priceSel: Set<string>;
  onTogglePrice: (k: string) => void;
  placeOptions: string[];
  placeSel: Set<string>;
  onTogglePlace: (k: string) => void;
  artistOptions: { id: string; name: string }[];
  artistSel: Set<string>;
  onToggleArtist: (k: string) => void;
}

function FiltersSheet(p: FiltersSheetProps) {
  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <Pressable style={s.sheetBackdrop} onPress={p.onClose}>
        <Pressable style={s.sheet} onPress={() => { /* swallow taps inside the sheet */ }}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>Filters</Text>
            {p.activeCount > 0 ? (
              <Pressable onPress={p.onClear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear all filters">
                <Text style={s.clearText}>Clear all</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView style={s.sheetScroll} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={s.filterLabel}>Price range</Text>
            <View style={s.chipWrap}>
              {p.priceBuckets.map((b) => (
                <FilterChip key={b.key} label={b.label} selected={p.priceSel.has(b.key)} onPress={() => p.onTogglePrice(b.key)} />
              ))}
            </View>

            <Text style={s.filterLabel}>Body part</Text>
            {p.placeOptions.length ? (
              <View style={s.chipWrap}>
                {p.placeOptions.map((pl) => (
                  <FilterChip key={pl} label={pl} selected={p.placeSel.has(pl)} onPress={() => p.onTogglePlace(pl)} />
                ))}
              </View>
            ) : <Text style={s.filterEmpty}>No body parts recorded in this period.</Text>}

            <Text style={s.filterLabel}>Artist</Text>
            {p.artistOptions.length ? (
              <View style={s.chipWrap}>
                {p.artistOptions.map((a) => (
                  <FilterChip key={a.id} label={a.name} selected={p.artistSel.has(a.id)} onPress={() => p.onToggleArtist(a.id)} />
                ))}
              </View>
            ) : <Text style={s.filterEmpty}>No bookings in this period.</Text>}
          </ScrollView>

          <Pressable style={s.applyBtn} onPress={p.onClose} accessibilityRole="button" accessibilityLabel={`Show ${p.resultCount} bookings`}>
            <Text style={s.applyText}>Show {p.resultCount} booking{p.resultCount === 1 ? "" : "s"}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  seg: { flexDirection: "row", backgroundColor: "#F4F4F5", borderRadius: 12, padding: 4, marginHorizontal: 16, marginTop: 12, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  segBtnActive: { backgroundColor: "#18181B" },
  segText: { fontWeight: "700", color: "#52525B", fontSize: 14 },
  segTextActive: { color: "#fff" },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 12 },
  navArrow: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  navArrowOff: { opacity: 0.5 },
  navLabel: { fontSize: 16, fontWeight: "800", color: "#18181B" },
  body: { padding: 16, paddingBottom: 40 },

  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexGrow: 1, flexBasis: "47%", backgroundColor: "#FAFAFA", borderWidth: 1, borderColor: "#F0F0F2", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14 },
  tileAccent: { backgroundColor: "#FEF3F3", borderColor: "#F7D3D4" },
  tileValue: { fontSize: 20, fontWeight: "800", color: "#18181B" },
  tileValueAccent: { color: RED },
  tileLabel: { fontSize: 12, fontWeight: "600", color: "#A1A1AA", marginTop: 3 },
  tileLabelAccent: { color: "#C2565A" },
  subline: { color: "#71717A", fontSize: 13, fontWeight: "600", marginTop: 10 },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 12 },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  sectionAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: RED },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#18181B" },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: RED, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  filterBtnActive: { backgroundColor: RED, borderColor: RED },
  filterBtnText: { color: RED, fontWeight: "800", fontSize: 13 },
  filterBtnTextActive: { color: "#fff" },
  filterCount: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  filterCountText: { color: RED, fontWeight: "800", fontSize: 11 },

  card: { flexDirection: "row", borderWidth: 1, borderColor: "#F0F0F2", borderRadius: 16, marginBottom: 10, overflow: "hidden" },
  cardAccent: { width: 4, backgroundColor: "#FBDDDE" },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardWhen: { fontSize: 13, fontWeight: "700", color: "#52525B", flex: 1 },
  cardPrice: { fontSize: 16, fontWeight: "800", color: RED },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#18181B", marginTop: 4 },
  people: { flexDirection: "row", gap: 12, marginTop: 12 },
  person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  personRole: { fontSize: 11, fontWeight: "700", color: "#A1A1AA", textTransform: "uppercase", letterSpacing: 0.3 },
  personName: { fontSize: 14, fontWeight: "700", color: "#18181B" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  chip: { backgroundColor: "#F4F4F5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: "600", color: "#52525B" },

  // Filters sheet
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, maxHeight: "80%" },
  sheetHandle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#E4E4E7", marginBottom: 12 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sheetTitle: { fontSize: 19, fontWeight: "800", color: "#18181B" },
  clearText: { color: RED, fontWeight: "800", fontSize: 14 },
  sheetScroll: { flexGrow: 0 },
  filterLabel: { fontSize: 12, fontWeight: "800", color: "#71717A", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, marginBottom: 10 },
  filterEmpty: { color: "#A1A1AA", fontSize: 13 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fchip: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  fchipActive: { backgroundColor: RED, borderColor: RED },
  fchipText: { fontSize: 13, fontWeight: "700", color: "#52525B" },
  fchipTextActive: { color: "#fff" },
  applyBtn: { backgroundColor: "#18181B", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 16 },
  applyText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
