import {
  useFeaturedArtists, useIdeaFeed, useMyLocation, useNearbyStudios,
  usePromotions, useRecommendedForMe, useStyleDeck, useTrendingArtists,
} from "@inkora/data-access";
import type { HomeArtist, IdeaCard } from "@inkora/domain";
import { MasonryFlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { NotificationBell } from "../notifications/NotificationBell";
import { CategoryPickerModal } from "./CategoryPickerModal";
import { ArtistCard, CategoryCard, IdeaTile, PromoCard, SearchBar, SectionHeader, StudioCard } from "./components";
import { StyleFilterSheet } from "./StyleFilterSheet";

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

  // Explore = a browse feed filtered by style chips. Typed keyword search lives
  // in Discover (the top search bar routes there) to avoid a duplicate input.
  const [exploreStyles, setExploreStyles] = useState<string[]>([]);
  const [exploreSort, setExploreSort] = useState<"recent" | "popular">("recent");
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  const feedFilters = useMemo(() => ({ styleSlugs: exploreStyles, sort: exploreSort }), [exploreStyles, exploreSort]);
  const feed = useIdeaFeed(supabase, feedFilters);
  const filtersActive = exploreStyles.length > 0;
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

  // Promo cards: "Find your artist" → Discover (nearest + 4.5★); "First tattoo?"
  // → scroll to Explore; anything else → its own route.
  const onPromo = useCallback((ctaRoute: string | null) => {
    if (ctaRoute === "/discover") {
      router.push({ pathname: "/discover", params: { sort: "distance", minRating: "4.5" } });
    } else if (ctaRoute === "/") {
      scrollToExplore();
    } else if (ctaRoute) {
      router.push(ctaRoute);
    }
  }, [router, scrollToExplore]);

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
              onPress={() => onPromo(item.ctaRoute)}
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
      {/* One controls row: sort toggle on the left, Filters (styles) on the right.
          Typed search lives in Discover. */}
      <View style={s.exploreControls}>
        <View style={s.sortSeg}>
          {(["recent", "popular"] as const).map((so) => (
            <Pressable
              key={so}
              style={[s.sortSegBtn, exploreSort === so && s.sortSegBtnActive]}
              onPress={() => setExploreSort(so)}
              accessibilityRole="button"
              accessibilityState={{ selected: exploreSort === so }}
            >
              <Text style={[s.sortSegText, exploreSort === so && s.sortSegTextActive]}>{so === "recent" ? "Recent" : "Popular"}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[s.filterBtn, exploreStyles.length > 0 && s.filterBtnActive]}
          onPress={() => setStyleSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={exploreStyles.length > 0 ? `Filters, ${exploreStyles.length} active` : "Filters"}
        >
          <Text style={[s.filterText, exploreStyles.length > 0 && s.filterTextActive]}>
            Filters{exploreStyles.length > 0 ? ` (${exploreStyles.length})` : ""}
          </Text>
        </Pressable>
      </View>
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
      <StyleFilterSheet
        visible={styleSheetOpen}
        onClose={() => setStyleSheetOpen(false)}
        styles={categories.data ?? []}
        selected={exploreStyles}
        onToggle={toggleExploreStyle}
        onClear={() => setExploreStyles([])}
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
  exploreControls: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10 },
  sortSeg: { flexDirection: "row", backgroundColor: "#F4F4F5", borderRadius: 999, padding: 3 },
  sortSegBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  sortSegBtnActive: { backgroundColor: "#18181B" },
  sortSegText: { fontSize: 13, fontWeight: "700", color: "#71717A" },
  sortSegTextActive: { color: "#fff" },
  filterBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: "#E4E4E7" },
  filterBtnActive: { backgroundColor: "#E5484D", borderColor: "#E5484D" },
  filterText: { fontWeight: "700", fontSize: 13, color: "#18181B" },
  filterTextActive: { color: "#fff" },
});
