import {
  useDebouncedValue, useFeaturedArtists, useIdeaFeed, useMyLocation, useNearbyStudios,
  usePromotions, useRecommendedForMe, useStyleDeck, useTrendingArtists,
} from "@inkora/data-access";
import type { HomeArtist, IdeaCard } from "@inkora/domain";
import { MasonryFlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { Chip } from "../discovery/components";
import { NotificationBell } from "../notifications/NotificationBell";
import { CategoryPickerModal } from "./CategoryPickerModal";
import { ArtistCard, CategoryCard, IdeaTile, PromoCard, SearchBar, SectionHeader, StudioCard } from "./components";

const img = imageUrl;

export function HomeScreen() {
  const router = useRouter();
  const promotions = usePromotions(supabase);
  const categories = useStyleDeck(supabase);
  const featured = useFeaturedArtists(supabase);
  const recommended = useRecommendedForMe(supabase);
  const trending = useTrendingArtists(supabase);
  const location = useMyLocation(supabase);
  const nearby = useNearbyStudios(supabase, location.data);

  // Explore filters (keyword + styles) applied to the inspiration feed.
  const [exploreQ, setExploreQ] = useState("");
  const [exploreStyles, setExploreStyles] = useState<string[]>([]);
  const debouncedQ = useDebouncedValue(exploreQ.trim(), 300);
  const feedFilters = useMemo(() => ({ q: debouncedQ, styleSlugs: exploreStyles }), [debouncedQ, exploreStyles]);
  const feed = useIdeaFeed(supabase, feedFilters);
  const filtersActive = debouncedQ.length > 0 || exploreStyles.length > 0;
  const toggleExploreStyle = (slug: string) =>
    setExploreStyles((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));

  // Scroll-to-Explore: capture the section's offset via onLayout, then jump there.
  const listRef = useRef<React.ElementRef<typeof MasonryFlashList>>(null);
  const [exploreY, setExploreY] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollToExplore = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: Math.max(exploreY - 8, 0), animated: true });
  }, [exploreY]);
  const applyCategories = useCallback((slugs: string[]) => {
    setExploreStyles(slugs);
    setPickerOpen(false);
    // Let the modal begin closing + keepPreviousData hold the list height before scrolling.
    setTimeout(scrollToExplore, 120);
  }, [scrollToExplore]);

  const ideas = feed.data?.pages.flatMap((p) => p.items) ?? [];

  const onRefresh = useCallback(() => {
    void feed.refetch();
    void featured.refetch();
    void recommended.refetch();
    void trending.refetch();
    void promotions.refetch();
  }, [feed, featured, recommended, trending, promotions]);

  const artistSection = (title: string, q: { data?: HomeArtist[]; isLoading: boolean }) => {
    if (!q.isLoading && (q.data ?? []).length === 0) return null;
    return (
      <View>
        <SectionHeader title={title} onSeeAll={() => router.push("/discover")} />
        {q.isLoading ? (
          <ActivityIndicator style={s.rowLoader} />
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={q.data ?? []}
            keyExtractor={(a) => a.id}
            contentContainerStyle={s.rowPad}
            renderItem={({ item }) => (
              <ArtistCard artist={item} uri={img(item.avatarPath, 72)} onPress={() => router.push(`/artist/${item.id}`)} />
            )}
          />
        )}
      </View>
    );
  };

  const Header = (
    <View>
      <View style={s.topbar}>
        <Text style={s.brand}>Inkora</Text>
        <NotificationBell />
      </View>
      <SearchBar onPress={() => router.push("/discover")} />

      {(promotions.data ?? []).length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={promotions.data ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={s.rowPad}
          renderItem={({ item, index }) => (
            <PromoCard
              promo={item}
              index={index}
              uri={img(item.imagePath, 320)}
              onPress={() => item.ctaRoute && router.push(item.ctaRoute)}
            />
          )}
        />
      )}

      {(categories.data ?? []).length > 0 && (
        <View>
          <SectionHeader title="Categories" onSeeAll={() => setPickerOpen(true)} />
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories.data ?? []}
            keyExtractor={(c) => c.id}
            contentContainerStyle={s.rowPad}
            renderItem={({ item }) => (
              <CategoryCard style={item} uri={img(item.imagePath, 140)} onPress={() => applyCategories([item.slug])} />
            )}
          />
        </View>
      )}

      {artistSection("Featured artists", featured)}
      {artistSection("Recommended for you", recommended)}
      {artistSection("Trending", trending)}

      {!nearby.isLoading && (nearby.data ?? []).length > 0 && (
        <View>
          <SectionHeader title="Nearby studios" onSeeAll={() => router.push("/discover")} />
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={nearby.data ?? []}
            keyExtractor={(st) => st.id}
            contentContainerStyle={s.rowPad}
            renderItem={({ item }) => (
              <StudioCard studio={item} uri={img(item.logoPath, 160)} onPress={() => router.push(`/studio/${item.slug}`)} />
            )}
          />
        </View>
      )}

      <View onLayout={(e) => setExploreY(e.nativeEvent.layout.y)}>
      <SectionHeader title="Explore" />
      <View style={s.exploreSearch}>
        <Text style={s.exploreSearchIcon}>⌕</Text>
        <TextInput
          style={s.exploreSearchInput}
          placeholder="Search ideas (e.g. rose, mandala)"
          value={exploreQ}
          onChangeText={setExploreQ}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search tattoo ideas"
        />
        {exploreQ.length > 0 && (
          <Pressable onPress={() => setExploreQ("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear idea search">
            <Text style={s.exploreClear}>✕</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.exploreChips}
        keyboardShouldPersistTaps="handled"
      >
        {(categories.data ?? []).map((st) => (
          <Chip key={st.id} label={st.name} active={exploreStyles.includes(st.slug)} onPress={() => toggleExploreStyle(st.slug)} />
        ))}
      </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <MasonryFlashList
        ref={listRef}
        data={ideas}
        numColumns={2}
        estimatedItemSize={220}
        keyExtractor={(item: IdeaCard) => item.id}
        renderItem={({ item }) => (
          <IdeaTile idea={item} uri={img(item.imagePath, 180)} onPress={() => router.push(`/idea/${item.id}`)} />
        )}
        ListHeaderComponent={Header}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={onRefresh} />}
        ListEmptyComponent={
          feed.isLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : (
            <Text style={s.empty}>
              {filtersActive ? "No ideas match these filters. Try clearing them." : "No inspiration yet — check back soon."}
            </Text>
          )
        }
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 24 }}
      />

      <CategoryPickerModal
        visible={pickerOpen}
        categories={categories.data ?? []}
        initialSelected={exploreStyles}
        onClose={() => setPickerOpen(false)}
        onApply={applyCategories}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6 },
  brand: { fontSize: 24, fontWeight: "900", color: "#E5484D", letterSpacing: -0.5 },
  rowPad: { paddingRight: 12 },
  rowLoader: { alignSelf: "flex-start", marginLeft: 24, marginVertical: 12 },
  empty: { textAlign: "center", color: "#A1A1AA", marginTop: 24, paddingHorizontal: 24 },
  exploreSearch: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 12, marginBottom: 8 },
  exploreSearchIcon: { fontSize: 18, color: "#71717A" },
  exploreSearchInput: { flex: 1, fontSize: 15 },
  exploreClear: { fontSize: 16, color: "#A1A1AA" },
  exploreChips: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8 },
});
