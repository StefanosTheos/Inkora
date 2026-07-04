import {
  useFeaturedArtists, useIdeaFeed, useMyLocation, useNearbyStudios,
  usePromotions, useRecommendedForMe, useStyleDeck, useTrendingArtists,
} from "@inkora/data-access";
import type { HomeArtist, IdeaCard } from "@inkora/domain";
import { MasonryFlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { NotificationBell } from "../notifications/NotificationBell";
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
  const feed = useIdeaFeed(supabase);

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
          <SectionHeader title="Categories" onSeeAll={() => router.push("/discover")} />
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories.data ?? []}
            keyExtractor={(c) => c.id}
            contentContainerStyle={s.rowPad}
            renderItem={({ item }) => (
              <CategoryCard style={item} uri={img(item.imagePath, 140)} onPress={() => router.push("/discover")} />
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

      <SectionHeader title="Explore" />
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <MasonryFlashList
        data={ideas}
        numColumns={2}
        estimatedItemSize={220}
        keyExtractor={(item: IdeaCard) => item.id}
        renderItem={({ item }) => (
          <IdeaTile idea={item} uri={img(item.imagePath, 180)} onPress={() => router.push(`/artist/${item.sourceArtistId ?? ""}`)} />
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
            <Text style={s.empty}>No inspiration yet — check back soon.</Text>
          )
        }
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 24 }}
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
});
