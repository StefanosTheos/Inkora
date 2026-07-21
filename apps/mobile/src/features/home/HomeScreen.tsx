import { Ionicons } from "@expo/vector-icons";
import {
  type FlashListItem, useFeaturedArtists, useFlashFeed, useIdeaFeed, useMyLocation, useMyStyleSlugs,
  useNearbyStudios, usePromotions, useRecommendedForMe, useStyleDeck, useTrendingArtists,
} from "@inkora/data-access";
import type { HomeArtist, IdeaCard } from "@inkora/domain";
import { MasonryFlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/EmptyState";
import { SetLocationSheet } from "../../components/SetLocationSheet";
import { RailSkeleton, TileGridSkeleton } from "../../components/Skeleton";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { NotificationBell } from "../notifications/NotificationBell";
import { CategoryPickerModal } from "./CategoryPickerModal";
import { ArtistCard, CategoryCard, FlashTile, IdeaTile, PromoCard, SearchBar, SectionHeader, StudioCard } from "./components";
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
  // Drives the Recommended rail vs. the "take the style quiz" CTA. Empty =
  // no preferences yet, so Recommended would just mirror Featured.
  const myStyles = useMyStyleSlugs(supabase);
  const hasStylePrefs = (myStyles.data ?? []).length > 0;

  // Explore = a browse feed filtered by style chips. Typed keyword search lives
  // in Discover (the top search bar routes there) to avoid a duplicate input.
  const [exploreStyles, setExploreStyles] = useState<string[]>([]);
  const [exploreSort, setExploreSort] = useState<"recent" | "popular">("recent");
  const [exploreFlashes, setExploreFlashes] = useState(false);
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  const [locSheetOpen, setLocSheetOpen] = useState(false);
  const feedFilters = useMemo(() => ({ styleSlugs: exploreStyles, sort: exploreSort }), [exploreStyles, exploreSort]);
  const feed = useIdeaFeed(supabase, feedFilters, !exploreFlashes);
  const flashesQ = useFlashFeed(supabase, exploreFlashes);
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
  const flashes = flashesQ.data?.pages.flatMap((p) => p.items) ?? [];
  const exploreItems: (IdeaCard | FlashListItem)[] = exploreFlashes ? flashes : ideas;

  const onRefresh = useCallback(() => {
    // Refresh whichever Explore feed is actually showing — the idea feed is
    // disabled while Flashes is on, so refetching it would be a no-op — plus the
    // home rails.
    if (exploreFlashes) void flashesQ.refetch();
    else void feed.refetch();
    void featured.refetch();
    void recommended.refetch();
    void trending.refetch();
    void promotions.refetch();
    void myStyles.refetch();
  }, [exploreFlashes, flashesQ, feed, featured, recommended, trending, promotions, myStyles]);

  // "See all" carries the rail's intent into Discover instead of dumping the
  // user on the default search (relevance, all styles).
  const goDiscover = useCallback(
    (params?: Record<string, string>) => router.push({ pathname: "/discover", params }),
    [router],
  );

  const artistSection = (
    title: string,
    q: { data?: HomeArtist[]; isLoading: boolean },
    seeAllParams?: Record<string, string>,
  ) => {
    if (!q.isLoading && (q.data ?? []).length === 0) return null;
    return (
      <View>
        <SectionHeader title={title} onSeeAll={() => goDiscover(seeAllParams)} />
        {q.isLoading ? (
          <RailSkeleton />
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

      {artistSection("Featured artists", featured, { sort: "rating", acceptingOnly: "1" })}
      {hasStylePrefs
        ? artistSection("Recommended for you", recommended, { styleSlugs: (myStyles.data ?? []).join(","), sort: "relevance" })
        : !myStyles.isLoading && (
          <Pressable style={s.quizCta} onPress={() => router.push("/style-quiz")} accessibilityRole="button" accessibilityLabel="Take the style quiz">
            <View style={s.quizIcon}><Ionicons name="sparkles" size={22} color="#E5484D" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.quizTitle}>Get tailored recommendations</Text>
              <Text style={s.quizSub}>Take the 60-second style quiz and we&apos;ll match you with artists.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C4C4C8" />
          </Pressable>
        )}
      {artistSection("Trending", trending, { sort: "rating" })}

      {!nearby.isLoading && (nearby.data ?? []).length > 0 && (
        <View>
          <SectionHeader title="Nearby studios" onSeeAll={() => goDiscover({ scope: "studios", sort: "distance" })} />
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

      {/* No saved location → the nearby rail can't render. Offer to set a city
          inline instead of silently hiding it. */}
      {!location.isLoading && location.data == null && (
        <Pressable style={s.quizCta} onPress={() => setLocSheetOpen(true)} accessibilityRole="button" accessibilityLabel="Set your city">
          <View style={s.quizIcon}><Ionicons name="location-outline" size={22} color="#E5484D" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.quizTitle}>See studios & artists near you</Text>
            <Text style={s.quizSub}>Set your city to sort by distance and find nearby studios.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C4C4C8" />
        </Pressable>
      )}

      <View onLayout={(e) => setExploreY(e.nativeEvent.layout.y)}>
      <SectionHeader title="Explore" />
      {/* One controls row: sort toggle on the left, Filters (styles) on the right.
          Typed search lives in Discover. */}
      <View style={s.exploreControls}>
        {/* Sort applies to ideas only — disabled while browsing flashes. */}
        <View style={[s.sortSeg, exploreFlashes && s.disabled]} pointerEvents={exploreFlashes ? "none" : "auto"}>
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
        <View style={s.exploreRight}>
          <Pressable
            style={[s.flashToggle, exploreFlashes && s.flashToggleActive]}
            onPress={() => setExploreFlashes((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: exploreFlashes }}
            accessibilityLabel="Show flash designs"
          >
            <Ionicons name={exploreFlashes ? "sparkles" : "sparkles-outline"} size={14} color={exploreFlashes ? "#fff" : "#E5484D"} />
            <Text style={[s.flashToggleText, exploreFlashes && s.flashToggleTextActive]}>Flashes</Text>
          </Pressable>
          <Pressable
            style={[s.filterBtn, exploreStyles.length > 0 && s.filterBtnActive, exploreFlashes && s.disabled]}
            onPress={() => setStyleSheetOpen(true)}
            disabled={exploreFlashes}
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
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <MasonryFlashList
        ref={listRef}
        data={exploreItems}
        numColumns={2}
        estimatedItemSize={220}
        keyExtractor={(item) => (item as { id: string }).id}
        renderItem={({ item }) => {
          if (exploreFlashes) {
            const f = item as FlashListItem;
            return <FlashTile flash={f} uri={img(f.imagePath, 180)} onPress={() => router.push(`/portfolio/${f.id}`)} />;
          }
          const idea = item as IdeaCard;
          return <IdeaTile idea={idea} uri={img(idea.imagePath, 180)} onPress={() => router.push(`/idea/${idea.id}`)} />;
        }}
        ListHeaderComponent={Header}
        onEndReached={() => {
          if (exploreFlashes) {
            if (flashesQ.hasNextPage && !flashesQ.isFetchingNextPage) void flashesQ.fetchNextPage();
          } else if (feed.hasNextPage && !feed.isFetchingNextPage) {
            void feed.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={exploreFlashes ? flashesQ.isRefetching : feed.isRefetching} onRefresh={onRefresh} />}
        ListEmptyComponent={
          exploreFlashes ? (
            flashesQ.isLoading ? <TileGridSkeleton /> : <EmptyState icon="sparkles-outline" title="No flashes yet" message="Flash designs from artists will show up here." compact />
          ) : feed.isLoading ? (
            <TileGridSkeleton />
          ) : filtersActive ? (
            <EmptyState icon="options-outline" title="No ideas match these filters" message="Try removing a style to see more." actionLabel="Clear filters" onAction={() => setExploreStyles([])} compact />
          ) : (
            <EmptyState icon="images-outline" title="No inspiration yet" message="Check back soon — new designs land here." compact />
          )
        }
        ListFooterComponent={(exploreFlashes ? flashesQ.isFetchingNextPage : feed.isFetchingNextPage) ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
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
      <SetLocationSheet
        visible={locSheetOpen}
        onClose={() => setLocSheetOpen(false)}
        onSaved={() => { void location.refetch(); void nearby.refetch(); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6 },
  brand: { fontSize: 24, fontWeight: "900", color: "#E5484D", letterSpacing: -0.5 },
  rowPad: { paddingRight: 12 },
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
  exploreRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  flashToggle: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: "#E5484D" },
  flashToggleActive: { backgroundColor: "#E5484D" },
  flashToggleText: { fontWeight: "800", fontSize: 13, color: "#E5484D" },
  flashToggleTextActive: { color: "#fff" },
  disabled: { opacity: 0.4 },
  quizCta: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#F1D6D7", backgroundColor: "#FFF5F5" },
  quizIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FDECEC", alignItems: "center", justifyContent: "center" },
  quizTitle: { fontSize: 15, fontWeight: "800", color: "#18181B" },
  quizSub: { fontSize: 12.5, color: "#71717A", marginTop: 2 },
});
