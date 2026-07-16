import { Ionicons } from "@expo/vector-icons";
import type { HomeArtist, IdeaCard, NearbyStudio, Promotion, StyleCard } from "@inkora/domain";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GradientBg } from "../../components/Gradient";

// On-brand promo gradients (top accent → dark plum bottom, so text stays legible).
const PROMO_GRADIENTS = [
  { from: "#E5484D", to: "#241A33" }, // brand red → plum
  { from: "#6D28D9", to: "#1E1B2E" }, // violet → plum
  { from: "#F2704D", to: "#2A1E38" }, // coral → plum
];

// -------------------------------------------------------------- Search bar
export function SearchBar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={s.search} onPress={onPress}>
      <Text style={s.searchIcon}>⌕</Text>
      <Text style={s.searchText}>Search artists, styles, studios</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------- Section header
export function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={s.seeAll}>See all</Text>
        </Pressable>
      )}
    </View>
  );
}

// -------------------------------------------------------------- Promo card
export function PromoCard({ promo, index, uri, onPress }: {
  promo: Promotion; index: number; uri?: string; onPress: () => void;
}) {
  return (
    <Pressable style={s.promo} onPress={onPress}>
      {uri ? (
        <Image source={{ uri }} style={s.promoImg} contentFit="cover" />
      ) : (
        <>
          <GradientBg {...PROMO_GRADIENTS[index % PROMO_GRADIENTS.length]!} />
          <View style={s.promoBloom} />
        </>
      )}
      <View style={s.promoOverlay}>
        <Text style={s.promoTitle}>{promo.title}</Text>
        {promo.subtitle ? <Text style={s.promoSubtitle}>{promo.subtitle}</Text> : null}
        {promo.ctaLabel ? <Text style={s.promoCta}>{promo.ctaLabel} →</Text> : null}
      </View>
    </Pressable>
  );
}

// ------------------------------------------------------------ Category card
export function CategoryCard({ style, uri, onPress }: { style: StyleCard; uri?: string; onPress: () => void }) {
  return (
    <Pressable style={s.category} onPress={onPress}>
      <View style={s.categoryImgWrap}>
        {uri ? <Image source={{ uri }} style={s.categoryImg} contentFit="cover" /> : null}
      </View>
      <Text style={s.categoryName} numberOfLines={2}>{style.name}</Text>
    </Pressable>
  );
}

// -------------------------------------------------------------- Artist card
export function ArtistCard({ artist, uri, onPress }: { artist: HomeArtist; uri?: string; onPress: () => void }) {
  return (
    <Pressable style={s.artist} onPress={onPress}>
      <View style={s.avatar}>
        {uri ? <Image source={{ uri }} style={s.avatarImg} contentFit="cover" /> : (
          <Text style={s.avatarInitial}>{artist.displayName.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <Text style={s.artistName} numberOfLines={1}>{artist.displayName}</Text>
      <Text style={s.artistMeta} numberOfLines={1}>
        {artist.ratingCount > 0 ? `★ ${artist.ratingAvg.toFixed(1)}` : "New"}
        {/* Recommended cards carry the match "why": nearest studio + matched style. */}
        {artist.distanceKm != null ? ` · ${artist.distanceKm < 1 ? "<1" : Math.round(artist.distanceKm)}km` : ""}
        {(artist.matchedStyles?.[0] ?? artist.styles[0]) ? ` · ${artist.matchedStyles?.[0] ?? artist.styles[0]}` : ""}
      </Text>
    </Pressable>
  );
}

// -------------------------------------------------------------- Studio card
export function StudioCard({ studio, uri, onPress }: { studio: NearbyStudio; uri?: string; onPress: () => void }) {
  return (
    <Pressable style={s.studio} onPress={onPress}>
      <View style={s.studioLogo}>
        {uri ? <Image source={{ uri }} style={s.studioLogoImg} contentFit="cover" /> : (
          <Text style={s.avatarInitial}>{studio.name.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.artistName} numberOfLines={1}>{studio.name}</Text>
        <Text style={s.artistMeta} numberOfLines={1}>
          {studio.city ?? "—"}{studio.distanceKm != null ? ` · ${studio.distanceKm} km` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

// -------------------------------------------------------- Feed idea tile
/** Compact count for social-proof badges: 0–999, then 1.2k / 12k. */
function compactCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

export function IdeaTile({ idea, uri, onPress }: { idea: IdeaCard; uri?: string; onPress: () => void }) {
  const ratio = idea.width && idea.height ? idea.width / idea.height : 0.8;
  return (
    <Pressable style={s.tile} onPress={onPress}>
      <View>
        {uri ? (
          <Image source={{ uri }} style={[s.tileImg, { aspectRatio: ratio }]} contentFit="cover" transition={150} />
        ) : (
          <View style={[s.tileImg, s.tileFallback, { aspectRatio: ratio }]} />
        )}
        {idea.saveCount > 0 ? (
          <View style={s.tileSaves}>
            <Ionicons name="heart" size={11} color="#fff" />
            <Text style={s.tileSavesText}>{compactCount(idea.saveCount)}</Text>
          </View>
        ) : null}
      </View>
      {idea.title ? <Text style={s.tileTitle} numberOfLines={1}>{idea.title}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 12, marginBottom: 8 },
  searchIcon: { fontSize: 18, color: "#71717A" },
  searchText: { color: "#71717A", fontSize: 15 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, marginTop: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  seeAll: { color: "#E5484D", fontWeight: "600" },
  promo: { width: 300, height: 140, borderRadius: 16, overflow: "hidden", marginLeft: 12, justifyContent: "flex-end", backgroundColor: "#1F1B2E" },
  promoImg: { ...StyleSheet.absoluteFillObject },
  promoBloom: { position: "absolute", top: -70, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(255,255,255,0.10)" },
  promoOverlay: { padding: 14, backgroundColor: "rgba(0,0,0,0.25)" },
  promoTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  promoSubtitle: { color: "#fff", opacity: 0.9, marginTop: 2 },
  promoCta: { color: "#fff", fontWeight: "700", marginTop: 8 },
  category: { width: 84, marginLeft: 12, alignItems: "center" },
  categoryImgWrap: { width: 84, height: 84, borderRadius: 14, overflow: "hidden", backgroundColor: "#E4E4E7" },
  categoryImg: { width: "100%", height: "100%" },
  categoryName: { marginTop: 6, fontSize: 12, fontWeight: "600", textAlign: "center", alignSelf: "stretch" },
  artist: { width: 120, marginLeft: 12 },
  avatar: { width: 120, height: 120, borderRadius: 16, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { color: "#fff", fontSize: 34, fontWeight: "800" },
  artistName: { marginTop: 6, fontWeight: "700", fontSize: 14 },
  artistMeta: { color: "#A1A1AA", fontSize: 12, marginTop: 1 },
  studio: { width: 240, marginLeft: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F4F4F5", borderRadius: 14, padding: 10 },
  studioLogo: { width: 48, height: 48, borderRadius: 10, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  studioLogoImg: { width: "100%", height: "100%" },
  tile: { flex: 1, margin: 4 },
  tileImg: { width: "100%", borderRadius: 12, backgroundColor: "#E4E4E7" },
  tileFallback: { backgroundColor: "#E4E4E7" },
  tileSaves: { position: "absolute", left: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  tileSavesText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  tileTitle: { fontSize: 12, fontWeight: "600", marginTop: 4 },
});
