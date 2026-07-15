import { Ionicons } from "@expo/vector-icons";
import {
  type InviteArtist, searchArtistsForInvite, studioInviteArtist, useAuth, useMyStudio, useStyleDeck,
} from "@inkora/data-access";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
  { value: 0, label: "Any rating" },
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
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<SortKey>("rating");
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const styleDeck = useStyleDeck(supabase);
  const styleList = styleDeck.data ?? [];

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

      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color="#A1A1AA" />
        <TextInput style={s.searchInput} value={query} onChangeText={setQuery} placeholder="Search by name" placeholderTextColor="#A1A1AA" autoCapitalize="none" />
        {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={18} color="#C4C4C8" /></Pressable> : null}
      </View>
      <View style={[s.searchWrap, { marginTop: 8 }]}>
        <Ionicons name="location-outline" size={18} color="#A1A1AA" />
        <TextInput style={s.searchInput} value={city} onChangeText={setCity} placeholder="Filter by city" placeholderTextColor="#A1A1AA" autoCapitalize="words" />
        {city ? <Pressable onPress={() => setCity("")} hitSlop={8}><Ionicons name="close-circle" size={18} color="#C4C4C8" /></Pressable> : null}
      </View>

      {/* Style filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
        <Chip label="All styles" active={style === null} onPress={() => setStyle(null)} />
        {styleList.map((st) => (
          <Chip key={st.slug} label={st.name} active={style === st.slug} onPress={() => setStyle(style === st.slug ? null : st.slug)} />
        ))}
      </ScrollView>

      {/* Rating + sort */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
        {RATINGS.map((r) => (
          <Chip key={r.value} label={r.label} active={minRating === r.value} onPress={() => setMinRating(r.value)} />
        ))}
        <View style={s.chipDivider} />
        {SORTS.map((o) => (
          <Chip key={o.key} label={o.label} active={sort === o.key} onPress={() => setSort(o.key)} />
        ))}
      </ScrollView>

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
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F4F4F5" },
  searchInput: { flex: 1, fontSize: 15, color: "#18181B" },
  // minHeight stops the horizontal scroll row's frame from collapsing and
  // clipping the chips (same fix as the bookings tabs).
  chipScroll: { flexGrow: 0, minHeight: 44, marginTop: 10 },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F4F4F5" },
  chipActive: { backgroundColor: "#18181B" },
  chipText: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  chipDivider: { width: 1, height: 22, backgroundColor: "#E4E4E7", marginHorizontal: 2 },
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
});
