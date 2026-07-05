import {
  becomeArtist, computePreferences, publicStorageUrl, topStyleSlugs, updateProfileLocation, useAuth,
  useFinishOnboarding, useOnboardingController, useRecommendedArtists, useStyleDeck,
} from "@inkora/data-access";
import type { RecommendedArtist, StyleCard, StylePreference } from "@inkora/domain";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { ActivityIndicator, type DimensionValue, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useToast } from "../../components/Toast";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

const CARD_COLORS = ["#1F1B2E", "#3B2F4A", "#2E2A3F", "#42313B", "#283042", "#3A2E2E"];

export function OnboardingFlow() {
  const [mode, setMode] = useState<"choose" | "seeker">("choose");
  if (mode === "choose") return <RoleChoice onSeeker={() => setMode("seeker")} />;
  return <SeekerOnboarding />;
}

// ---------------------------------------------------------------- role choice
function RoleChoice({ onSeeker }: { onSeeker: () => void }) {
  const { refresh } = useAuth();
  const finish = useFinishOnboarding(supabase);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [headline, setHeadline] = useState("");

  async function onArtist() {
    setBusy(true);
    const res = await becomeArtist(supabase, headline.trim() || undefined);
    if (!res.ok) { setBusy(false); toast.show(res.error.message, "error"); return; }
    // Mark onboarded (no style prefs needed for artists), then re-mint the session.
    const fin = await finish.mutateAsync({});
    if (!fin.ok) { setBusy(false); toast.show(fin.error.message, "error"); return; }
    await refresh(); // artist role + onboarded → root gate routes to Home
    setBusy(false);
  }

  return (
    <ScrollView contentContainerStyle={s.roleWrap}>
      <Text style={s.title}>How will you use Inkora?</Text>
      <Text style={[s.muted, { marginBottom: 20 }]}>You can change this anytime in settings.</Text>

      <Pressable style={s.roleCard} onPress={onSeeker} disabled={busy} accessibilityRole="button" accessibilityLabel="Find a tattoo">
        <Text style={s.roleTitle}>🔍  Find a tattoo</Text>
        <Text style={s.roleDesc}>Discover artists and studios, save ideas, and book consultations.</Text>
      </Pressable>

      <View style={s.roleCard}>
        <Text style={s.roleTitle}>🎨  I&apos;m a tattoo artist</Text>
        <Text style={s.roleDesc}>Get an artist profile to showcase your work and take booking requests.</Text>
        <Text style={s.roleFieldLabel}>Headline (optional)</Text>
        <TextInput
          style={s.headlineInput}
          placeholder="e.g. Fine-line & botanical"
          value={headline}
          onChangeText={setHeadline}
          accessibilityLabel="Artist headline"
        />
        <Pressable style={s.roleBtn} onPress={onArtist} disabled={busy} accessibilityRole="button" accessibilityLabel="Continue as artist">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.roleBtnText}>Continue as artist</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------- seeker flow
function SeekerOnboarding() {
  const deck = useStyleDeck(supabase);
  const styles = deck.data ?? [];
  const c = useOnboardingController(styles);

  if (deck.isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={s.muted}>Loading styles…</Text>
      </View>
    );
  }

  return c.done ? (
    <Results weights={c.weights} styles={styles} onRestart={c.reset} />
  ) : (
    <Deck
      card={c.current}
      index={c.index}
      total={c.total}
      progress={c.progress}
      onReact={c.react}
      onBack={c.back}
    />
  );
}

// ---------------------------------------------------------------- deck step
function Deck({
  card, index, total, progress, onReact, onBack,
}: {
  card: StyleCard | null;
  index: number;
  total: number;
  progress: number;
  onReact: (r: "skip" | "like" | "love") => void;
  onBack: () => void;
}) {
  if (!card) return null;
  const bg = CARD_COLORS[index % CARD_COLORS.length];
  const uri = card.imagePath ? publicStorageUrl(env.SUPABASE_URL, card.imagePath) : undefined;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={onBack} disabled={index === 0} hitSlop={12}>
          <Text style={[s.back, index === 0 && s.disabled]}>‹ Back</Text>
        </Pressable>
        <Text style={s.muted}>{index + 1} / {total}</Text>
      </View>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as DimensionValue }]} />
      </View>

      <Text style={s.question}>What catches your eye?</Text>

      <View style={[s.card, { backgroundColor: bg }]}>
        {uri ? <Image source={{ uri }} style={s.cardImage} contentFit="cover" transition={150} /> : null}
        <View style={s.cardLabel}>
          <Text style={s.cardName}>{card.name}</Text>
        </View>
      </View>

      <View style={s.actions}>
        <Pressable style={[s.reactBtn, s.skip]} onPress={() => onReact("skip")}>
          <Text style={s.reactText}>Skip</Text>
        </Pressable>
        <Pressable style={[s.reactBtn, s.like]} onPress={() => onReact("like")}>
          <Text style={s.reactText}>♥ Like</Text>
        </Pressable>
        <Pressable style={[s.reactBtn, s.love]} onPress={() => onReact("love")}>
          <Text style={[s.reactText, { color: "#fff" }]}>★ Love</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ------------------------------------------------------------- results step
function Results({
  weights, styles, onRestart,
}: {
  weights: Record<string, number>;
  styles: StyleCard[];
  onRestart: () => void;
}) {
  const { refresh } = useAuth();
  const toast = useToast();
  const finish = useFinishOnboarding(supabase);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const prefs = useMemo(() => computePreferences(weights, styles), [weights, styles]);
  const slugs = useMemo(() => topStyleSlugs(prefs, 3), [prefs]);
  const recs = useRecommendedArtists(supabase, slugs, true);

  async function onFinish() {
    setBusy(true);
    if (city.trim()) await updateProfileLocation(supabase, city, country); // geocodes "city, country" → lat/lng
    const res = await finish.mutateAsync(weights);
    if (!res.ok) {
      setBusy(false);
      toast.show(res.error.message, "error");
      return;
    }
    await refresh(); // flips isOnboarded → root gate routes to Home
    setBusy(false);
  }

  if (prefs.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.question}>No favorites yet</Text>
        <Text style={s.muted}>Give a few styles a Like or Love to get recommendations.</Text>
        <Pressable style={[s.reactBtn, s.love, { marginTop: 16 }]} onPress={onRestart}>
          <Text style={[s.reactText, { color: "#fff" }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.results}>
      <Text style={s.title}>Your tattoo taste</Text>
      {prefs.map((p) => <PreferenceBar key={p.styleId} pref={p} />)}

      <Text style={[s.title, { marginTop: 24 }]}>Artists for you</Text>
      {recs.isLoading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : (recs.data ?? []).length === 0 ? (
        <Text style={s.muted}>No matches near you yet — explore the feed to discover more.</Text>
      ) : (
        (recs.data ?? []).map((a) => <ArtistRow key={a.id} artist={a} />)
      )}

      <Text style={[s.title, { marginTop: 24 }]}>Where are you based?</Text>
      <TextInput style={s.cityInput} placeholder="City" value={city} onChangeText={setCity} autoCapitalize="words" />
      <TextInput
        style={[s.cityInput, { marginTop: 8 }]}
        placeholder="Country (improves nearby results)"
        value={country}
        onChangeText={setCountry}
        autoCapitalize="words"
      />

      <Pressable style={[s.finishBtn]} disabled={busy} onPress={onFinish}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.finishText}>Start exploring</Text>}
      </Pressable>
    </ScrollView>
  );
}

function PreferenceBar({ pref }: { pref: StylePreference }) {
  return (
    <View style={s.prefRow}>
      <Text style={s.prefName}>{pref.name}</Text>
      <View style={s.prefTrack}>
        <View style={[s.prefFill, { width: `${pref.percentage}%` as DimensionValue }]} />
      </View>
      <Text style={s.prefPct}>{pref.percentage}%</Text>
    </View>
  );
}

function ArtistRow({ artist }: { artist: RecommendedArtist }) {
  return (
    <View style={s.artistRow}>
      <View style={s.avatar}>
        <Text style={s.avatarInitial}>{artist.displayName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.artistName}>{artist.displayName}</Text>
        <Text style={s.muted} numberOfLines={1}>{artist.headline ?? artist.styles.join(", ")}</Text>
      </View>
      <Text style={s.rating}>★ {artist.ratingAvg.toFixed(1)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  roleWrap: { padding: 20, paddingTop: 48, flexGrow: 1 },
  roleCard: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 16, padding: 18, marginBottom: 14, gap: 6 },
  roleTitle: { fontSize: 18, fontWeight: "800", color: "#18181B" },
  roleDesc: { color: "#71717A", fontSize: 14, lineHeight: 20 },
  roleFieldLabel: { fontSize: 13, fontWeight: "600", color: "#52525B", marginTop: 10 },
  headlineInput: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 10, padding: 12, fontSize: 15, marginTop: 6 },
  roleBtn: { backgroundColor: "#E5484D", borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 10 },
  roleBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  container: { flex: 1, padding: 20, paddingTop: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  back: { color: "#E5484D", fontWeight: "600", fontSize: 16 },
  disabled: { opacity: 0.3 },
  muted: { color: "#A1A1AA", fontSize: 14 },
  progressTrack: { height: 4, backgroundColor: "#E4E4E7", borderRadius: 2, overflow: "hidden", marginBottom: 16 },
  progressFill: { height: 4, backgroundColor: "#E5484D" },
  question: { fontSize: 24, fontWeight: "800", marginBottom: 16 },
  card: { flex: 1, borderRadius: 20, overflow: "hidden", justifyContent: "flex-end" },
  cardImage: { ...StyleSheet.absoluteFillObject },
  cardLabel: { padding: 16, backgroundColor: "rgba(0,0,0,0.35)" },
  cardName: { color: "#fff", fontSize: 22, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  reactBtn: { flex: 1, padding: 16, borderRadius: 14, alignItems: "center" },
  skip: { backgroundColor: "#F4F4F5" },
  like: { backgroundColor: "#FCE7E8" },
  love: { backgroundColor: "#E5484D" },
  reactText: { fontWeight: "700", fontSize: 15, color: "#18181B" },
  results: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  prefRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  prefName: { width: 96, fontWeight: "600", fontSize: 13 },
  prefTrack: { flex: 1, height: 10, backgroundColor: "#F4F4F5", borderRadius: 5, overflow: "hidden" },
  prefFill: { height: 10, backgroundColor: "#E5484D", borderRadius: 5 },
  prefPct: { width: 40, textAlign: "right", fontWeight: "700", fontSize: 13 },
  artistRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontWeight: "700", fontSize: 18 },
  artistName: { fontWeight: "700", fontSize: 15 },
  rating: { fontWeight: "700", color: "#18181B" },
  cityInput: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 10, padding: 14, fontSize: 16, marginTop: 4 },
  finishBtn: { backgroundColor: "#E5484D", padding: 16, borderRadius: 14, alignItems: "center", marginTop: 20 },
  finishText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
