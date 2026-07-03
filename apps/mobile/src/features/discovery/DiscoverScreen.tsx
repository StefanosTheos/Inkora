import {
  publicStorageUrl, useArtistSearch, useDebouncedValue, useMyLocation, useStyleDeck,
} from "@inkora/data-access";
import { activeFilterCount, type ArtistSearchParams, type ArtistSort } from "@inkora/domain";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import { ArtistResultRow, Chip } from "./components";
import { FilterSheet } from "./FilterSheet";

const img = (path?: string | null) => (path ? publicStorageUrl(env.SUPABASE_URL, path) : undefined);
const SORTS: { key: ArtistSort; label: string; needsLocation?: boolean }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "distance", label: "Nearest", needsLocation: true },
  { key: "rating", label: "Top rated" },
];

type Filters = Pick<ArtistSearchParams, "styleSlugs" | "radiusKm" | "minRating" | "acceptingOnly" | "sort">;
const INITIAL: Filters = { styleSlugs: [], radiusKm: null, minRating: 0, acceptingOnly: false, sort: "relevance" };

export function DiscoverScreen() {
  const router = useRouter();
  const near = useMyLocation(supabase).data ?? null;
  const styleDeck = useStyleDeck(supabase);
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [sheetOpen, setSheetOpen] = useState(false);

  const q = useDebouncedValue(text.trim(), 300);
  const params: ArtistSearchParams = useMemo(() => ({ q, near, ...filters }), [q, near, filters]);
  const search = useArtistSearch(supabase, params);
  const results = search.data?.pages.flat() ?? [];
  const filterCount = activeFilterCount(params);

  const onChange = (patch: Partial<ArtistSearchParams>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Search field */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search artists, styles"
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {text.length > 0 && (
          <Pressable onPress={() => setText("")} hitSlop={8}>
            <Text style={s.clearIcon}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Sort + Filters row */}
      <View style={s.controls}>
        {SORTS.map((so) => (
          <Chip
            key={so.key}
            label={so.label}
            active={filters.sort === so.key}
            disabled={so.needsLocation && !near}
            onPress={() => onChange({ sort: so.key })}
          />
        ))}
        <View style={{ flex: 1 }} />
        <Pressable style={[s.filterBtn, filterCount > 0 && s.filterBtnActive]} onPress={() => setSheetOpen(true)}>
          <Text style={[s.filterText, filterCount > 0 && { color: "#fff" }]}>
            Filters{filterCount > 0 ? ` (${filterCount})` : ""}
          </Text>
        </Pressable>
      </View>

      {/* Results */}
      <FlashList
        data={results}
        estimatedItemSize={80}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <ArtistResultRow artist={item} uri={img(item.avatarPath)} onPress={() => router.push(`/artist/${item.id}`)} />
        )}
        onEndReached={() => {
          if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          search.isLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} />
          ) : (
            <Text style={s.empty}>No artists match your search.</Text>
          )
        }
        ListFooterComponent={search.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
      />

      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        styles={styleDeck.data ?? []}
        params={params}
        onChange={onChange}
        hasLocation={near != null}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, margin: 12, marginBottom: 8 },
  searchIcon: { fontSize: 18, color: "#71717A" },
  searchInput: { flex: 1, fontSize: 16 },
  clearIcon: { fontSize: 16, color: "#A1A1AA" },
  controls: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E4E4E7" },
  filterBtnActive: { backgroundColor: "#E5484D", borderColor: "#E5484D" },
  filterText: { fontWeight: "700", fontSize: 13, color: "#18181B" },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 32, paddingHorizontal: 24 },
});
