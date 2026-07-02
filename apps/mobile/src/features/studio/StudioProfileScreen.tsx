import {
  publicStorageUrl, startStudioConversation, useStudioPortfolio, useStudioProfile, useStudioReviews,
} from "@inkora/data-access";
import type { PortfolioImage, ReviewItem, StudioRosterArtist } from "@inkora/domain";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useToast } from "../../components/Toast";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
type Tab = "artists" | "portfolio" | "reviews" | "about";
const TABS: { key: Tab; label: string }[] = [
  { key: "artists", label: "Artists" },
  { key: "portfolio", label: "Portfolio" },
  { key: "reviews", label: "Reviews" },
  { key: "about", label: "About" },
];

export function StudioProfileScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const studio = useStudioProfile(supabase, slug);
  const artistIds = useMemo(() => (studio.data?.roster ?? []).map((r) => r.id), [studio.data]);
  const portfolio = useStudioPortfolio(supabase, artistIds);
  const reviews = useStudioReviews(supabase, studio.data?.id ?? "");
  const [tab, setTab] = useState<Tab>("artists");

  if (studio.isLoading) return <View style={s.center}><ActivityIndicator /></View>;
  const st = studio.data;
  if (!st) return <View style={s.center}><Text style={s.muted}>Studio not found.</Text></View>;

  const roster = st.roster ?? [];
  const styles = st.styles ?? [];
  const avgRating = roster.length
    ? roster.reduce((sum, r) => sum + r.ratingAvg * (r.ratingCount || 1), 0) / roster.reduce((sum, r) => sum + (r.ratingCount || 1), 0)
    : 0;
  const openDirections = () =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${st.latitude},${st.longitude}`);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.logo}>
            {img(st.logoPath) ? <Image source={{ uri: img(st.logoPath) }} style={s.logoImg} contentFit="cover" /> : (
              <Text style={s.logoInitial}>{st.name.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={s.name}>{st.name}</Text>
          <Text style={s.meta}>
            {avgRating > 0 ? `★ ${avgRating.toFixed(1)} · ` : ""}{roster.length} artist{roster.length === 1 ? "" : "s"}
            {st.city ? ` · ${st.city}` : ""}
          </Text>
          <Text style={s.address}>{[st.addressLine, st.city, st.country].filter(Boolean).join(", ") || "—"}</Text>
        </View>

        {/* Specialties */}
        {styles.length > 0 && (
          <View style={s.tags}>
            {styles.map((sl) => <View key={sl} style={s.tag}><Text style={s.tagText}>{sl}</Text></View>)}
          </View>
        )}

        {/* Tab bar */}
        <View style={s.tabBar}>
          {TABS.map((t) => (
            <Pressable key={t.key} style={[s.tabItem, tab === t.key && s.tabItemActive]} onPress={() => setTab(t.key)}>
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>
                {t.key === "artists" ? `Artists (${roster.length})` : t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        <View style={s.content}>
          {tab === "artists" && (
            roster.length === 0 ? <Text style={s.muted}>No resident artists listed.</Text> :
            roster.map((r) => <ArtistCard key={r.id} artist={r} onPress={() => router.push(`/artist/${r.id}`)} />)
          )}
          {tab === "portfolio" && <PortfolioGrid images={portfolio.data ?? []} loading={portfolio.isLoading} />}
          {tab === "reviews" && <Reviews items={reviews.data ?? []} loading={reviews.isLoading} />}
          {tab === "about" && (
            <View>
              {st.bio ? <Text style={s.bio}>{st.bio}</Text> : null}
              <Text style={s.sectionTitle}>Opening hours</Text>
              {DAY_ORDER.map((d) => {
                const ranges = st.openingHours[d];
                return (
                  <View key={d} style={s.hourRow}>
                    <Text style={s.hourDay}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
                    <Text style={s.hourVal}>{ranges?.length ? ranges.map((r) => `${r[0]}–${r[1]}`).join(", ") : "Closed"}</Text>
                  </View>
                );
              })}
              <Pressable style={s.directionsRow} onPress={openDirections}>
                <Text style={s.directionsText}>📍 Get directions</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[s.cta, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={s.ctaSecondary}
          onPress={async () => {
            try {
              const cid = await startStudioConversation(supabase, st.id);
              router.push(`/chats/${cid}`);
            } catch (e) {
              toast.show((e as Error).message, "error");
            }
          }}
        >
          <Text style={s.ctaSecondaryText}>Message</Text>
        </Pressable>
        <Pressable
          style={s.ctaPrimary}
          onPress={() => router.push({ pathname: "/booking-request", params: { studioSlug: st.slug } })}
        >
          <Text style={s.ctaPrimaryText}>Request booking</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ArtistCard({ artist, onPress }: { artist: StudioRosterArtist; onPress: () => void }) {
  return (
    <Pressable style={s.artistCard} onPress={onPress}>
      <View style={s.avatar}>
        {img(artist.avatarPath) ? <Image source={{ uri: img(artist.avatarPath) }} style={s.avatarImg} contentFit="cover" /> : (
          <Text style={s.avatarInitial}>{artist.displayName.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.artistName}>{artist.displayName}</Text>
        <Text style={s.artistMeta} numberOfLines={1}>
          {artist.ratingCount > 0 ? `★ ${artist.ratingAvg.toFixed(1)} (${artist.ratingCount})` : "New"}
          {artist.headline ? ` · ${artist.headline}` : ""}
        </Text>
        {(artist.styles ?? []).length > 0 && (
          <View style={s.miniTags}>
            {(artist.styles ?? []).slice(0, 3).map((sl) => <View key={sl} style={s.miniTag}><Text style={s.miniTagText}>{sl}</Text></View>)}
          </View>
        )}
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

function PortfolioGrid({ images, loading }: { images: PortfolioImage[]; loading: boolean }) {
  if (loading) return <ActivityIndicator />;
  if (images.length === 0) return <Text style={s.muted}>No portfolio pieces yet.</Text>;
  return (
    <View style={s.grid}>
      {images.map((im) => (
        <View key={im.id} style={s.gridItem}>
          <Image source={{ uri: img(im.imagePath) }} style={s.gridImg} contentFit="cover" />
        </View>
      ))}
    </View>
  );
}

function Reviews({ items, loading }: { items: ReviewItem[]; loading: boolean }) {
  if (loading) return <ActivityIndicator />;
  if (items.length === 0) return <Text style={s.muted}>No reviews yet.</Text>;
  return (
    <View>
      {items.map((r) => (
        <View key={r.id} style={s.reviewCard}>
          <Text style={s.reviewHead}>{r.authorName} · ★ {r.overallRating}</Text>
          {r.title ? <Text style={s.reviewTitle}>{r.title}</Text> : null}
          {r.body ? <Text style={s.reviewBody}>{r.body}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#A1A1AA", fontSize: 13 },
  header: { alignItems: "center", paddingTop: 16, paddingHorizontal: 20 },
  logo: { width: 88, height: 88, borderRadius: 20, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImg: { width: "100%", height: "100%" },
  logoInitial: { color: "#fff", fontSize: 36, fontWeight: "800" },
  name: { fontSize: 24, fontWeight: "800", marginTop: 10 },
  meta: { color: "#18181B", marginTop: 6, fontWeight: "600" },
  address: { color: "#52525B", marginTop: 4, textAlign: "center" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 20, marginTop: 12, justifyContent: "center" },
  tag: { backgroundColor: "#F4F4F5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: "600", color: "#18181B" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E4E4E7", marginTop: 16, paddingHorizontal: 8 },
  tabItem: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabItemActive: { borderBottomColor: "#E5484D" },
  tabText: { fontWeight: "600", color: "#71717A", fontSize: 13 },
  tabTextActive: { color: "#18181B" },
  content: { padding: 20, minHeight: 200 },
  bio: { color: "#3F3F46", lineHeight: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  hourRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  hourDay: { fontWeight: "700", width: 60 },
  hourVal: { color: "#3F3F46" },
  directionsRow: { marginTop: 16, backgroundColor: "#F4F4F5", borderRadius: 12, padding: 14, alignItems: "center" },
  directionsText: { fontWeight: "700" },
  artistCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { color: "#fff", fontSize: 22, fontWeight: "800" },
  artistName: { fontWeight: "800", fontSize: 15 },
  artistMeta: { color: "#52525B", fontSize: 13, marginTop: 2 },
  miniTags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  miniTag: { backgroundColor: "#F4F4F5", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  miniTagText: { fontSize: 11, fontWeight: "600", color: "#52525B" },
  chevron: { fontSize: 26, color: "#D4D4D8", fontWeight: "300" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridItem: { width: "48%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#E4E4E7" },
  gridImg: { width: "100%", height: "100%" },
  reviewCard: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 12, padding: 12, marginBottom: 10 },
  reviewHead: { fontWeight: "700" },
  reviewTitle: { fontWeight: "600", marginTop: 4 },
  reviewBody: { color: "#3F3F46", marginTop: 2 },
  cta: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 10, padding: 12, paddingTop: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E4E4E7" },
  ctaSecondary: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center" },
  ctaSecondaryText: { fontWeight: "700" },
  ctaPrimary: { flex: 2, padding: 16, borderRadius: 14, backgroundColor: "#E5484D", alignItems: "center" },
  ctaPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
