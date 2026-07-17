import {
  useArtistSearch, useDebouncedValue, useIdeaFeed, useMyLocation, useStudioSearch, useStyleDeck,
} from "@inkora/data-access";
import {
  activeFilterCount, activeStudioFilterCount, type ArtistSearchParams, type ArtistSort,
  type IdeaCard, type SearchArtist, type SearchScope, type SearchStudio, type StudioSearchParams,
} from "@inkora/domain";
import { FlashList, MasonryFlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SetLocationSheet } from "../../components/SetLocationSheet";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { IdeaTile } from "../home/components";
import { StyleFilterSheet } from "../home/StyleFilterSheet";
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
  { key: "ideas", label: "Designs" },
];

type Filters = Pick<ArtistSearchParams, "styleSlugs" | "radiusKm" | "minRating" | "acceptingOnly" | "sort">;
const INITIAL: Filters = { styleSlugs: [], radiusKm: null, minRating: 0, acceptingOnly: false, sort: "relevance" };

export function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sort?: string; minRating?: string; scope?: string; styleSlugs?: string; acceptingOnly?: string }>();
  const near = useMyLocation(supabase).data ?? null;
  const styleDeck = useStyleDeck(supabase);
  const [scope, setScope] = useState<SearchScope>("artists");
  const [text, setText] = useState("");
  // Distance defaults to "Any" (radiusKm: null); the seeker can narrow it via
  // the filter chips.
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [locSheetOpen, setLocSheetOpen] = useState(false);

  // Apply filters/scope passed via navigation — the home promos and each rail's
  // "See all" carry their intent through (sort, styles, accepting, scope).
  const paramSort = params.sort;
  const paramMinRating = params.minRating;
  const paramStyleSlugs = params.styleSlugs;
  const paramAccepting = params.acceptingOnly;
  const paramScope = params.scope;
  useEffect(() => {
    if (paramScope === "artists" || paramScope === "studios" || paramScope === "ideas") setScope(paramScope);
  }, [paramScope]);
  useEffect(() => {
    if (!paramSort && !paramMinRating && !paramStyleSlugs && !paramAccepting) return;
    setFilters((f) => ({
      ...f,
      ...(paramSort ? { sort: paramSort as ArtistSort } : {}),
      ...(paramMinRating ? { minRating: Number(paramMinRating) } : {}),
      ...(paramStyleSlugs ? { styleSlugs: paramStyleSlugs.split(",").filter(Boolean) } : {}),
      ...(paramAccepting ? { acceptingOnly: paramAccepting === "1" } : {}),
    }));
  }, [paramSort, paramMinRating, paramStyleSlugs, paramAccepting]);

  const isStudios = scope === "studios";
  const isIdeas = scope === "ideas";
  const q = useDebouncedValue(text.trim(), 300);
  const artistParams: ArtistSearchParams = useMemo(() => ({ q, near, ...filters }), [q, near, filters]);
  const studioParams: StudioSearchParams = useMemo(
    () => ({ q, near, styleSlugs: filters.styleSlugs, radiusKm: filters.radiusKm, minRating: filters.minRating, sort: filters.sort }),
    [q, near, filters],
  );

  const [ideaSort, setIdeaSort] = useState<"recent" | "popular">("recent");
  const [ideaStyles, setIdeaStyles] = useState<string[]>([]);
  const [ideaSheetOpen, setIdeaSheetOpen] = useState(false);
  const toggleIdeaStyle = (slug: string) =>
    setIdeaStyles((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));
  const artistSearch = useArtistSearch(supabase, artistParams, !isStudios && !isIdeas);
  const studioSearch = useStudioSearch(supabase, studioParams, isStudios);
  const ideaFeed = useIdeaFeed(supabase, { q, sort: ideaSort, styleSlugs: ideaStyles }, isIdeas);
  const ideas: IdeaCard[] = ideaFeed.data?.pages.flatMap((p) => p.items) ?? [];
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
          placeholder={isIdeas ? "Search designs" : isStudios ? "Search studios" : "Search artists, styles"}
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
          stays reachable even when its active-count badge widens it. Ideas have
          no rating/distance/accepting filters, so the row is hidden for them. */}
      {!isIdeas && (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.controls}
        contentContainerStyle={s.controlsContent}
        keyboardShouldPersistTaps="handled"
      >
        {SORTS.map((so) => {
          const needsLoc = so.needsLocation && !near;
          return (
            <Chip
              key={so.key}
              // Location-gated sort stays tappable — tapping opens the "set your
              // city" sheet instead of dead-ending as a greyed-out chip.
              label={needsLoc ? `${so.label} 📍` : so.label}
              active={filters.sort === so.key}
              onPress={() => (needsLoc ? setLocSheetOpen(true) : onChange({ sort: so.key }))}
            />
          );
        })}
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
      )}

      {/* Designs: sort toggle on the left, style filter on the right. */}
      {isIdeas && (
        <View style={s.ideaControls}>
          <View style={s.sortSeg}>
            {(["recent", "popular"] as const).map((so) => (
              <Pressable
                key={so}
                style={[s.sortSegBtn, ideaSort === so && s.sortSegBtnActive]}
                onPress={() => setIdeaSort(so)}
                accessibilityRole="button"
                accessibilityState={{ selected: ideaSort === so }}
              >
                <Text style={[s.sortSegText, ideaSort === so && s.sortSegTextActive]}>{so === "recent" ? "Recent" : "Popular"}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[s.filterBtn, ideaStyles.length > 0 && s.filterBtnActive]}
            onPress={() => setIdeaSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={ideaStyles.length > 0 ? `Filters, ${ideaStyles.length} active` : "Filters"}
          >
            <Text style={[s.filterText, ideaStyles.length > 0 && { color: "#fff" }]}>
              Filters{ideaStyles.length > 0 ? ` (${ideaStyles.length})` : ""}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Results */}
      {isIdeas ? (
        <MasonryFlashList
          data={ideas}
          numColumns={2}
          estimatedItemSize={220}
          keyExtractor={(item) => (item as IdeaCard).id}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 4 }}
          renderItem={({ item }) => {
            const idea = item as IdeaCard;
            return <IdeaTile idea={idea} uri={img(idea.imagePath, 300)} onPress={() => router.push(`/idea/${idea.id}`)} />;
          }}
          onEndReached={() => {
            if (ideaFeed.hasNextPage && !ideaFeed.isFetchingNextPage) void ideaFeed.fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            ideaFeed.isLoading
              ? <ActivityIndicator style={{ marginTop: 32 }} />
              : <Text style={s.empty}>No designs match your search.</Text>
          }
          ListFooterComponent={ideaFeed.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        />
      ) : (
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
      )}

      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        styles={styleDeck.data ?? []}
        params={artistParams}
        onChange={onChange}
        hasLocation={near != null}
        onSetLocation={() => { setSheetOpen(false); setLocSheetOpen(true); }}
      />
      <SetLocationSheet
        visible={locSheetOpen}
        onClose={() => setLocSheetOpen(false)}
        onSaved={() => onChange({ sort: "distance" })}
      />
      <StyleFilterSheet
        visible={ideaSheetOpen}
        onClose={() => setIdeaSheetOpen(false)}
        styles={styleDeck.data ?? []}
        selected={ideaStyles}
        onToggle={toggleIdeaStyle}
        onClear={() => setIdeaStyles([])}
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
  ideaControls: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, marginBottom: 8 },
  sortSeg: { flexDirection: "row", backgroundColor: "#F4F4F5", borderRadius: 999, padding: 3 },
  sortSegBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  sortSegBtnActive: { backgroundColor: "#18181B" },
  sortSegText: { fontSize: 13, fontWeight: "700", color: "#71717A" },
  sortSegTextActive: { color: "#fff" },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E4E4E7" },
  filterBtnActive: { backgroundColor: "#E5484D", borderColor: "#E5484D" },
  filterText: { fontWeight: "700", fontSize: 13, color: "#18181B" },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 32, paddingHorizontal: 24 },
});
