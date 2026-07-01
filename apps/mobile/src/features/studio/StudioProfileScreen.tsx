import { publicStorageUrl, useStudioProfile } from "@inkora/data-access";
import type { StudioRosterArtist } from "@inkora/domain";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
type Tab = "about" | "artists";

export function StudioProfileScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const studio = useStudioProfile(supabase, slug);
  const [tab, setTab] = useState<Tab>("about");

  if (studio.isLoading) return <View style={s.center}><ActivityIndicator /></View>;
  const st = studio.data;
  if (!st) return <View style={s.center}><Text style={s.muted}>Studio not found.</Text></View>;

  const openDirections = () =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${st.latitude},${st.longitude}`);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={s.header}>
          <View style={s.logo}>
            {img(st.logoPath) ? <Image source={{ uri: img(st.logoPath) }} style={s.logoImg} contentFit="cover" /> : (
              <Text style={s.logoInitial}>{st.name.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={s.name}>{st.name}</Text>
          <Text style={s.meta}>{[st.addressLine, st.city, st.country].filter(Boolean).join(", ") || "—"}</Text>
        </View>

        <View style={s.tabBar}>
          {(["about", "artists"] as Tab[]).map((t) => (
            <Pressable key={t} style={[s.tabItem, tab === t && s.tabItemActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === "about" ? "About" : `Artists (${st.roster.length})`}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.content}>
          {tab === "about" ? (
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
            </View>
          ) : (
            <View>
              {st.roster.length === 0 ? <Text style={s.muted}>No resident artists listed.</Text> : st.roster.map((r) => (
                <ArtistRow key={r.id} artist={r} onPress={() => router.push(`/artist/${r.id}`)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[s.cta, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={s.ctaSecondary} onPress={() => router.push("/chats")}>
          <Text style={s.ctaSecondaryText}>Message</Text>
        </Pressable>
        <Pressable style={s.ctaPrimary} onPress={openDirections}>
          <Text style={s.ctaPrimaryText}>Directions</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ArtistRow({ artist, onPress }: { artist: StudioRosterArtist; onPress: () => void }) {
  return (
    <Pressable style={s.artistRow} onPress={onPress}>
      <View style={s.avatar}>
        {img(artist.avatarPath) ? <Image source={{ uri: img(artist.avatarPath) }} style={s.avatarImg} contentFit="cover" /> : (
          <Text style={s.avatarInitial}>{artist.displayName.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.artistName}>{artist.displayName}</Text>
        <Text style={s.muted} numberOfLines={1}>
          {artist.ratingAvg > 0 ? `★ ${artist.ratingAvg.toFixed(1)}` : "New"}{artist.headline ? ` · ${artist.headline}` : ""}
        </Text>
      </View>
    </Pressable>
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
  meta: { color: "#52525B", marginTop: 4, textAlign: "center" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E4E4E7", marginTop: 16, paddingHorizontal: 12 },
  tabItem: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabItemActive: { borderBottomColor: "#E5484D" },
  tabText: { fontWeight: "600", color: "#71717A" },
  tabTextActive: { color: "#18181B" },
  content: { padding: 20, minHeight: 160 },
  bio: { color: "#3F3F46", lineHeight: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  hourRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  hourDay: { fontWeight: "700", width: 60 },
  hourVal: { color: "#3F3F46" },
  artistRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  avatar: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { color: "#fff", fontSize: 20, fontWeight: "800" },
  artistName: { fontWeight: "700", fontSize: 15 },
  cta: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 10, padding: 12, paddingTop: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E4E4E7" },
  ctaSecondary: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center" },
  ctaSecondaryText: { fontWeight: "700" },
  ctaPrimary: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: "#E5484D", alignItems: "center" },
  ctaPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
