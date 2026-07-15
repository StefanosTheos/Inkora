import { Ionicons } from "@expo/vector-icons";
import {
  type InviteArtist, searchArtistsForInvite, studioInviteArtist, useAuth, useMyStudio, useStyleDeck,
} from "@inkora/data-access";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "../../components/Toast";
import { supabase } from "../../lib/supabase";
import { Avatar } from "../booking/components/ui";

type SortKey = "rating" | "reviews" | "name";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "rating", label: "Top rated" },
  { key: "reviews", label: "Most reviews" },
  { key: "name", label: "Name" },
];
const RATINGS: { value: number; label: string }[] = [
  { value: 0, label: "Any" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

export function StudioInviteScreen() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const studioQ = useMyStudio(supabase, meId);
  const studioId = studioQ.data?.id ?? "";

  // Applied filters (drive the query).
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<SortKey>("rating");

  // Draft filters (edited in the dialog, committed on "Show results").
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dCity, setDCity] = useState("");
  const [dStyle, setDStyle] = useState<string | null>(null);
  const [dRating, setDRating] = useState(0);
  const [dSort, setDSort] = useState<SortKey>("rating");

  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const styleDeck = useStyleDeck(supabase);
  const styleList = styleDeck.data ?? [];
  const styleName = (slug: string | null) => (slug ? styleList.find((x) => x.slug === slug)?.name ?? slug : null);

  const name = query.trim();
  const cityQ = city.trim();
  const resultsQ = useQuery({
    queryKey: ["invite-search", name, cityQ, style, minRating],
    queryFn: () => searchArtistsForInvite(supabase, { query: name, city: cityQ, style: style ?? undefined, minRating }),
  });

  // Sorting is client-side so changing it never triggers a refetch.
  const results = useMemo(() => {
    const list = [...(resultsQ.data ?? [])];
    list.sort((a, b) =>
      sort === "name" ? a.displayName.localeCompare(b.displayName)
      : sort === "reviews" ? b.ratingCount - a.ratingCount
      : b.ratingAvg - a.ratingAvg,
    );
    return list;
  }, [resultsQ.data, sort]);

  const activeCount = (cityQ ? 1 : 0) + (style ? 1 : 0) + (minRating > 0 ? 1 : 0) + (sort !== "rating" ? 1 : 0);
  const summary = [cityQ || null, styleName(style), minRating > 0 ? `${minRating.toFixed(1)}+` : null, sort !== "rating" ? SORTS.find((x) => x.key === sort)?.label : null]
    .filter(Boolean).join("  ·  ");

  function openFilters() {
    setDCity(city); setDStyle(style); setDRating(minRating); setDSort(sort);
    setFiltersOpen(true);
  }
  function applyFilters() {
    setCity(dCity); setStyle(dStyle); setMinRating(dRating); setSort(dSort);
    setFiltersOpen(false);
  }
  function resetDraft() {
    setDCity(""); setDStyle(null); setDRating(0); setDSort("rating");
  }

  async function invite(artistId: string) {
    setBusy(artistId);
    try {
      await studioInviteArtist(supabase, studioId, artistId);
      setInvited((p) => new Set(p).add(artistId));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-studio", meId] }),
        qc.invalidateQueries({ queryKey: ["studio-overview", studioId] }),
      ]);
      toast.show("Invitation sent");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.title}>Find artists</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={s.controls}>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={18} color="#A1A1AA" />
          <TextInput style={s.searchInput} value={query} onChangeText={setQuery} placeholder="Search by name" placeholderTextColor="#A1A1AA" autoCapitalize="none" />
          {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={18} color="#C4C4C8" /></Pressable> : null}
        </View>
        <Pressable style={[s.filterBtn, activeCount > 0 && s.filterBtnActive]} onPress={openFilters} accessibilityRole="button" accessibilityLabel={activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"}>
          <Ionicons name="options-outline" size={18} color={activeCount > 0 ? "#fff" : "#18181B"} />
          {activeCount > 0 ? <View style={s.filterCount}><Text style={s.filterCountText}>{activeCount}</Text></View> : null}
        </Pressable>
      </View>
      {summary ? (
        <View style={s.summaryRow}>
          <Text style={s.summaryText} numberOfLines={1}>{summary}</Text>
          <Pressable onPress={() => { setCity(""); setStyle(null); setMinRating(0); setSort("rating"); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear filters">
            <Text style={s.clearText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {resultsQ.isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : results.length === 0 ? (
          <Text style={s.muted}>No artists match your filters.</Text>
        ) : (
          <>
            <Text style={s.count}>{results.length} artist{results.length === 1 ? "" : "s"}</Text>
            {results.map((a) => (
              <ArtistRow key={a.id} artist={a} invited={invited.has(a.id)} busy={busy === a.id} onOpen={() => router.push(`/artist/${a.id}`)} onInvite={() => void invite(a.id)} />
            ))}
          </>
        )}
      </ScrollView>

      {/* Filters dialog */}
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setFiltersOpen(false)}>
          <Pressable style={s.sheet} onPress={() => { /* absorb taps inside the sheet */ }}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Filters</Text>
              <Pressable onPress={resetDraft} hitSlop={8} accessibilityRole="button" accessibilityLabel="Reset filters"><Text style={s.resetText}>Reset</Text></Pressable>
            </View>

            <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>City</Text>
              <View style={s.cityWrap}>
                <Ionicons name="location-outline" size={18} color="#A1A1AA" />
                <TextInput style={s.searchInput} value={dCity} onChangeText={setDCity} placeholder="Any city" placeholderTextColor="#A1A1AA" autoCapitalize="words" />
                {dCity ? <Pressable onPress={() => setDCity("")} hitSlop={8}><Ionicons name="close-circle" size={18} color="#C4C4C8" /></Pressable> : null}
              </View>

              <Text style={s.fieldLabel}>Style</Text>
              <View style={s.wrap}>
                <Chip label="All" active={dStyle === null} onPress={() => setDStyle(null)} />
                {styleList.map((st) => (
                  <Chip key={st.slug} label={st.name} active={dStyle === st.slug} onPress={() => setDStyle(dStyle === st.slug ? null : st.slug)} />
                ))}
              </View>

              <Text style={s.fieldLabel}>Minimum rating</Text>
              <View style={s.wrap}>
                {RATINGS.map((r) => (
                  <Chip key={r.value} label={r.label} active={dRating === r.value} onPress={() => setDRating(r.value)} />
                ))}
              </View>

              <Text style={s.fieldLabel}>Sort by</Text>
              <View style={s.wrap}>
                {SORTS.map((o) => (
                  <Chip key={o.key} label={o.label} active={dSort === o.key} onPress={() => setDSort(o.key)} />
                ))}
              </View>
            </ScrollView>

            <Pressable style={s.applyBtn} onPress={applyFilters} accessibilityRole="button" accessibilityLabel="Show results">
              <Text style={s.applyText}>Show results</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.chip, active && s.chipActive]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ArtistRow({ artist, invited, busy, onOpen, onInvite }: { artist: InviteArtist; invited: boolean; busy: boolean; onOpen: () => void; onInvite: () => void }) {
  const meta = [artist.ratingCount > 0 ? `★ ${artist.ratingAvg.toFixed(1)} (${artist.ratingCount})` : null, artist.city, artist.headline]
    .filter(Boolean).join(" · ");
  return (
    <View style={s.row}>
      <Pressable style={s.person} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`View ${artist.displayName}`}>
        <Avatar path={artist.avatarPath} name={artist.displayName} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{artist.displayName}</Text>
          <Text style={s.sub} numberOfLines={1}>{meta || "Artist"}</Text>
        </View>
      </Pressable>
      <Pressable style={[s.inviteBtn, invited && s.inviteBtnDone]} disabled={invited || busy} onPress={onInvite} accessibilityRole="button" accessibilityLabel={`Invite ${artist.displayName}`}>
        <Text style={[s.inviteText, invited && s.inviteTextDone]}>{invited ? "Invited" : busy ? "…" : "Invite"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 22, fontWeight: "800" },
  controls: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 4 },
  searchWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F4F4F5" },
  searchInput: { flex: 1, fontSize: 15, color: "#18181B" },
  filterBtn: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  filterBtnActive: { backgroundColor: "#18181B", borderColor: "#18181B" },
  filterCount: { position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#E5484D", alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 1.5, borderColor: "#fff" },
  filterCountText: { color: "#fff", fontWeight: "800", fontSize: 10 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 10 },
  summaryText: { flex: 1, color: "#52525B", fontSize: 13, fontWeight: "600" },
  clearText: { color: "#E5484D", fontWeight: "800", fontSize: 13 },
  body: { padding: 16, paddingTop: 12, gap: 4 },
  count: { color: "#A1A1AA", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  muted: { color: "#A1A1AA", marginTop: 24, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontWeight: "800", fontSize: 15, color: "#18181B" },
  sub: { color: "#71717A", fontSize: 13, marginTop: 2 },
  inviteBtn: { backgroundColor: "#18181B", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  inviteBtnDone: { backgroundColor: "#F4F4F5" },
  inviteText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  inviteTextDone: { color: "#71717A" },
  // Filters dialog
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, maxHeight: "85%" },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#E4E4E7", marginBottom: 10 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#18181B" },
  resetText: { color: "#E5484D", fontWeight: "800", fontSize: 14 },
  sheetBody: { paddingBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "800", color: "#A1A1AA", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 18, marginBottom: 10 },
  cityWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F4F4F5" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: "#F4F4F5" },
  chipActive: { backgroundColor: "#18181B" },
  chipText: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  applyBtn: { backgroundColor: "#18181B", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 14 },
  applyText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
