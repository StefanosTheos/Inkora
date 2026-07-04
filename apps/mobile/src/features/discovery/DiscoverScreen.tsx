import {
  useArtistSearch, useDebouncedValue, useMyLocation, useStudioSearch, useStyleDeck,
} from "@inkora/data-access";
import {
  activeFilterCount, activeStudioFilterCount, type ArtistSearchParams, type ArtistSort,
  type SearchArtist, type SearchScope, type SearchStudio, type StudioSearchParams,
} from "@inkora/domain";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { ArtistResultRow, Chip, StudioResultRow } from "./components";
import { FilterSheet } from "./FilterSheet";

const img = imageUrl;
const SORTS: { key: ArtistSort; label: string; needsLocation?: boolean }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "distance", label: "Nearest", needsLocation: true },
  { key: "rating", label: "Top rated" },
];
const SCOPES: { key: SearchScope; label: string }[] = [
  { key: "artists", label: "Artists" },
  { key: "studios", label: "Studios" },
];

type Filters = Pick<ArtistSearchParams, "styleSlugs" | "radiusKm" | "minRating" | "acceptingOnly" | "sort">;
const INITIAL: Filters = { styleSlugs: [], radiusKm: null, minRating: 0, acceptingOnly: false, sort: "relevance" };

export function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sort?: string; minRating?: string }>();
  const near = useMyLocation(supabase).data ?? null;
  const styleDeck = useStyleDeck(supabase);
  const [scope, setScope] = useState<SearchScope>("artists");
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Apply filters passed via navigation (e.g. the home "Find your artist" promo).
  const paramSort = params.sort;
  const paramMinRating = params.minRating;
  useEffect(() => {
    if (!paramSort && !paramMinRating) return;
    setFilters((f) => ({
      ...f,
      ...(paramSort ? { sort: paramSort as ArtistSort } : {}),
      ...(paramMinRating ? { minRating: Number(paramMinRating) } : {}),
    }));
  }, [paramSort, paramMinRating]);

  const isStudios = scope === "studios";
  const q = useDebouncedValue(text.trim(), 300);
  const artistParams: ArtistSearchParams = useMemo(() => ({ q, near, ...filters }), [q, near, filters]);
  const studioParams: StudioSearchParams = useMemo(
    () => ({ q, near, styleSlugs: filters.styleSlugs, radiusKm: filters.radiusKm, minRating: filters.minRating, sort: filters.sort }),
    [q, near, filters],
  );

  const artistSearch = useArtistSearch(supabase, artistParams, !isStudios);
  const studioSearch = useStudioSearch(supabase, studioParams, isStudios);
  const search = isStudios ? studioSearch : artistSearch;
  const results: (SearchArtist | SearchStudio)[] = search.data?.pages.flat() ?? [];
  const filterCount = isStudios ? activeStudioFilterCount(studioParams) : activeFilterCount(artistParams);

  const onChange = (patch: Partial<ArtistSearchParams>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Artists / Studios toggle */}
      <View style={s.segment}>
        {SCOPES.map((sc) => {
          const active = scope === sc.key;
          return (
            <Pressable
              key={sc.key}
              style={[s.segBtn, active && s.segBtnActive]}
              onPress={() => setScope(sc.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Search ${sc.label}`}
            >
              <Text style={[s.segText, active && s.segTextActive]}>{sc.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Search field */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          style={s.searchInput}
          placeholder={isStudios ? "Search studios" : "Search artists, styles"}
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {text.length > 0 && (
          <Pressable onPress={() => setText("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Text style={s.clearIcon}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Sort + Filters row — horizontally scrollable so the Filters button
          stays reachable even when its active-count badge widens it. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.controls}
        contentContainerStyle={s.controlsContent}
        keyboardShouldPersistTaps="handled"
      >
        {SORTS.map((so) => (
          <Chip
            key={so.key}
            label={so.label}
            active={filters.sort === so.key}
            disabled={so.needsLocation && !near}
            onPress={() => onChange({ sort: so.key })}
          />
        ))}
        <Pressable
          style={[s.filterBtn, filterCount > 0 && s.filterBtnActive]}
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={filterCount > 0 ? `Filters, ${filterCount} active` : "Filters"}
        >
          <Text style={[s.filterText, filterCount > 0 && { color: "#fff" }]}>
            Filters{filterCount > 0 ? ` (${filterCount})` : ""}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Results */}
      <FlashList
        data={results}
        estimatedItemSize={80}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          isStudios ? (
            <StudioResultRow
              studio={item as SearchStudio}
              uri={img((item as SearchStudio).logoPath, 72)}
              onPress={() => router.push(`/studio/${(item as SearchStudio).slug}`)}
            />
          ) : (
            <ArtistResultRow
              artist={item as SearchArtist}
              uri={img((item as SearchArtist).avatarPath, 72)}
              onPress={() => router.push(`/artist/${(item as SearchArtist).id}`)}
            />
          )
        }
        onEndReached={() => {
          if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          search.isLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} />
          ) : (
            <Text style={s.empty}>{isStudios ? "No studios match your search." : "No artists match your search."}</Text>
          )
        }
        ListFooterComponent={search.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
      />

      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        styles={styleDeck.data ?? []}
        params={artistParams}
        onChange={onChange}
        hasLocation={near != null}
        showAccepting={!isStudios}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  segment: { flexDirection: "row", backgroundColor: "#F4F4F5", borderRadius: 10, padding: 3, marginHorizontal: 12, marginTop: 8 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  segBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontWeight: "700", fontSize: 14, color: "#71717A" },
  segTextActive: { color: "#18181B" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, margin: 12, marginBottom: 8 },
  searchIcon: { fontSize: 18, color: "#71717A" },
  searchInput: { flex: 1, fontSize: 16 },
  clearIcon: { fontSize: 16, color: "#A1A1AA" },
  controls: { flexGrow: 0, marginBottom: 8 },
  controlsContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E4E4E7" },
  filterBtnActive: { backgroundColor: "#E5484D", borderColor: "#E5484D" },
  filterText: { fontWeight: "700", fontSize: 13, color: "#18181B" },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 32, paddingHorizontal: 24 },
});
