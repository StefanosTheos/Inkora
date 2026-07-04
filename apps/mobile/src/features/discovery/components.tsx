import type { SearchArtist, SearchStudio } from "@inkora/domain";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function Chip({ label, active, disabled, onPress }: {
  label: string; active?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      style={[s.chip, active && s.chipActive, disabled && s.chipDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[s.chipText, active && s.chipTextActive, disabled && s.chipTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

export function ArtistResultRow({ artist, uri, onPress }: {
  artist: SearchArtist; uri?: string; onPress: () => void;
}) {
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={s.avatar}>
        {uri ? <Image source={{ uri }} style={s.avatarImg} contentFit="cover" /> : (
          <Text style={s.avatarInitial}>{artist.displayName.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.rowTop}>
          <Text style={s.name} numberOfLines={1}>{artist.displayName}</Text>
          {!artist.isAccepting && <Text style={s.closed}>booked</Text>}
        </View>
        <Text style={s.meta} numberOfLines={1}>
          {artist.ratingCount > 0 ? `★ ${artist.ratingAvg.toFixed(1)}` : "New"}
          {artist.styles.length ? ` · ${artist.styles.slice(0, 2).join(", ")}` : ""}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {[artist.city, artist.distanceKm != null ? `${artist.distanceKm} km` : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

export function StudioResultRow({ studio, uri, onPress }: {
  studio: SearchStudio; uri?: string; onPress: () => void;
}) {
  return (
    <Pressable style={s.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${studio.name}`}>
      <View style={s.logo}>
        {uri ? <Image source={{ uri }} style={s.avatarImg} contentFit="cover" /> : (
          <Text style={s.avatarInitial}>{studio.name.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1}>{studio.name}</Text>
        <Text style={s.meta} numberOfLines={1}>
          {studio.ratingCount > 0 ? `★ ${studio.ratingAvg.toFixed(1)}` : "New"}
          {` · ${studio.artistCount} artist${studio.artistCount === 1 ? "" : "s"}`}
          {studio.styles.length ? ` · ${studio.styles.slice(0, 2).join(", ")}` : ""}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {[studio.city, studio.distanceKm != null ? `${studio.distanceKm} km` : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F4F4F5", marginRight: 8 },
  chipActive: { backgroundColor: "#E5484D" },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontWeight: "600", color: "#18181B", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  chipTextDisabled: { color: "#A1A1AA" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  avatar: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logo: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { color: "#fff", fontSize: 22, fontWeight: "800" },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontWeight: "700", fontSize: 16, flexShrink: 1 },
  closed: { fontSize: 11, color: "#A1A1AA", borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  meta: { color: "#52525B", fontSize: 13, marginTop: 2 },
  sub: { color: "#A1A1AA", fontSize: 12, marginTop: 1 },
});
