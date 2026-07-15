import { Ionicons } from "@expo/vector-icons";
import {
  becomeArtist, computePreferences, createStudio, geocodeCity, publicStorageUrl, sendWelcomeEmail,
  setNotificationPrefs, topWeightedStyles, updateProfileLocation, useAuth, useFinishOnboarding,
  useOnboardingController, useRecommendedArtists, useStyleDeck,
} from "@inkora/data-access";
import type { RecommendedArtist, StyleCard, StylePreference } from "@inkora/domain";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { ActivityIndicator, type DimensionValue, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useToast } from "../../components/Toast";
import { env } from "../../lib/env";
import { EMAIL_NOTIFICATIONS_ENABLED } from "../../lib/features";
import { registerPushToken } from "../../lib/notifications";
import { supabase } from "../../lib/supabase";

const CARD_COLORS = ["#1F1B2E", "#3B2F4A", "#2E2A3F", "#42313B", "#283042", "#3A2E2E"];

export function OnboardingFlow() {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"choose" | "seeker" | "permissions">("choose");
  // A role path finished writing its data (and stamped onboarded_at) — hold the
  // user on the consent step before refreshing the session routes them to Home.
  const onComplete = () => setMode("permissions");
  if (mode === "permissions") return <CommsConsent onDone={() => void refresh()} />;
  if (mode === "choose") return <RoleChoice onSeeker={() => setMode("seeker")} onComplete={onComplete} />;
  return <SeekerOnboarding onComplete={onComplete} />;
}

// ------------------------------------------------------- comms consent step
// Shown once, right before entering the app. Both channels are opt-in: we only
// enable email/push if the user says yes here (they can change it later in
// Settings). Saying yes to email also fires the one welcome email.
function CommsConsent({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  // Email consent is skipped while email notifications are disabled — start on push.
  const [step, setStep] = useState<"email" | "push">(EMAIL_NOTIFICATIONS_ENABLED ? "email" : "push");
  const [busy, setBusy] = useState(false);

  async function chooseEmail(allow: boolean) {
    setBusy(true);
    try {
      await setNotificationPrefs(supabase, { email: allow });
      if (allow) void sendWelcomeEmail(supabase); // fire-and-forget; server no-ops if unconfigured
    } catch { /* non-blocking — consent shouldn't gate entering the app */ }
    setBusy(false);
    setStep("push");
  }

  async function choosePush(allow: boolean) {
    setBusy(true);
    try {
      if (allow) {
        const granted = await registerPushToken(); // triggers the device permission prompt
        await setNotificationPrefs(supabase, { push: granted });
        if (!granted) toast.show("No problem — you can turn on push later in Settings");
      } else {
        await setNotificationPrefs(supabase, { push: false });
      }
    } catch { /* non-blocking */ }
    setBusy(false);
    onDone(); // refresh session → root gate routes into the app
  }

  const email = step === "email";
  return (
    <View style={s.consentWrap}>
      <View style={s.consentCard}>
        <View style={s.consentIcon}>
          <Ionicons name={email ? "mail-outline" : "notifications-outline"} size={30} color="#E5484D" />
        </View>
        <Text style={s.consentTitle}>{email ? "Stay in the loop" : "Turn on notifications"}</Text>
        <Text style={s.consentBody}>
          {email
            ? "Can we email you about big news, new features and the occasional offer? We keep it rare — everyday activity like bookings and messages stays in the app."
            : "Get notified about bookings, offers and messages the moment they happen. You'll be asked for your device's permission next."}
        </Text>
        <Pressable style={s.consentPrimary} disabled={busy} onPress={() => void (email ? chooseEmail(true) : choosePush(true))} accessibilityRole="button" accessibilityLabel={email ? "Allow emails" : "Allow notifications"}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.consentPrimaryText}>{email ? "Allow emails" : "Allow notifications"}</Text>}
        </Pressable>
        <Pressable style={s.consentGhost} disabled={busy} onPress={() => void (email ? chooseEmail(false) : choosePush(false))} accessibilityRole="button" accessibilityLabel="Not now">
          <Text style={s.consentGhostText}>Not now</Text>
        </Pressable>
        {EMAIL_NOTIFICATIONS_ENABLED ? (
          <View style={s.consentDots}>
            <View style={[s.consentDot, email && s.consentDotActive]} />
            <View style={[s.consentDot, !email && s.consentDotActive]} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- role choice
function RoleChoice({ onSeeker, onComplete }: { onSeeker: () => void; onComplete: () => void }) {
  const finish = useFinishOnboarding(supabase);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [headline, setHeadline] = useState("");
  const [studioName, setStudioName] = useState("");
  const [studioCity, setStudioCity] = useState("");
  const [studioCountry, setStudioCountry] = useState("");
  // Accordion: only one role card's fields are open at a time so all three
  // choices fit on screen without scrolling until the user expands one.
  const [expanded, setExpanded] = useState<"artist" | "studio" | null>(null);

  async function onArtist() {
    setBusy(true);
    const res = await becomeArtist(supabase, headline.trim() || undefined);
    if (!res.ok) { setBusy(false); toast.show(res.error.message, "error"); return; }
    // Mark onboarded (no style prefs needed for artists), then re-mint the session.
    const fin = await finish.mutateAsync({});
    if (!fin.ok) { setBusy(false); toast.show(fin.error.message, "error"); return; }
    setBusy(false);
    onComplete(); // → comms consent step, then Home
  }

  async function onStudio() {
    const name = studioName.trim();
    const city = studioCity.trim();
    if (!name) { toast.show("Enter your studio's name", "error"); return; }
    if (!city) { toast.show("Enter your studio's city", "error"); return; }
    setBusy(true);
    // Studios must be geolocated (required by create-studio) so they surface in
    // discovery. Country disambiguates common city names (e.g. "Athens").
    const query = studioCountry.trim() ? `${city}, ${studioCountry.trim()}` : city;
    const coords = await geocodeCity(query);
    if (!coords) { setBusy(false); toast.show("Couldn't locate that city — try adding the country.", "error"); return; }
    const res = await createStudio(supabase, { name, city, latitude: coords.lat, longitude: coords.lng });
    if (!res.ok) { setBusy(false); toast.show(res.error.message, "error"); return; }
    // Mark onboarded (studio owners skip the style questionnaire), then re-mint.
    const fin = await finish.mutateAsync({});
    if (!fin.ok) { setBusy(false); toast.show(fin.error.message, "error"); return; }
    setBusy(false);
    onComplete(); // → comms consent step, then the studio dashboard
  }

  const toggle = (which: "artist" | "studio") => setExpanded((cur) => (cur === which ? null : which));

  return (
    <ScrollView contentContainerStyle={s.roleWrap}>
      <Text style={[s.title, { marginBottom: 20 }]}>How will you use Inkora?</Text>

      <Pressable style={s.roleCard} onPress={onSeeker} disabled={busy} accessibilityRole="button" accessibilityLabel="Find a tattoo">
        <Text style={s.roleTitle}>🔍  Find a tattoo</Text>
        <Text style={s.roleDesc}>Discover artists and studios, save ideas, and book consultations.</Text>
      </Pressable>

      <View style={s.roleCard}>
        <Pressable style={s.roleHead} onPress={() => toggle("artist")} disabled={busy} accessibilityRole="button" accessibilityState={{ expanded: expanded === "artist" }} accessibilityLabel="I'm a tattoo artist">
          <View style={s.roleHeadText}>
            <Text style={s.roleTitle}>🎨  I&apos;m a tattoo artist</Text>
            <Text style={s.roleDesc}>Get an artist profile to showcase your work and take booking requests.</Text>
          </View>
          <Ionicons name={expanded === "artist" ? "chevron-up" : "chevron-down"} size={20} color="#A1A1AA" />
        </Pressable>
        {expanded === "artist" ? (
          <>
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
          </>
        ) : null}
      </View>

      <View style={s.roleCard}>
        <Pressable style={s.roleHead} onPress={() => toggle("studio")} disabled={busy} accessibilityRole="button" accessibilityState={{ expanded: expanded === "studio" }} accessibilityLabel="I own a tattoo studio">
          <View style={s.roleHeadText}>
            <Text style={s.roleTitle}>🏠  I own a tattoo studio</Text>
            <Text style={s.roleDesc}>Manage your studio page, onboard artists, and track bookings and reviews.</Text>
          </View>
          <Ionicons name={expanded === "studio" ? "chevron-up" : "chevron-down"} size={20} color="#A1A1AA" />
        </Pressable>
        {expanded === "studio" ? (
          <>
            <Text style={s.roleFieldLabel}>Studio name</Text>
            <TextInput
              style={s.headlineInput}
              placeholder="e.g. Iron Lotus Tattoo"
              value={studioName}
              onChangeText={setStudioName}
              accessibilityLabel="Studio name"
            />
            <Text style={s.roleFieldLabel}>City</Text>
            <TextInput
              style={s.headlineInput}
              placeholder="e.g. Berlin"
              value={studioCity}
              onChangeText={setStudioCity}
              autoCapitalize="words"
              accessibilityLabel="Studio city"
            />
            <Text style={s.roleFieldLabel}>Country (improves the map location)</Text>
            <TextInput
              style={s.headlineInput}
              placeholder="e.g. Germany"
              value={studioCountry}
              onChangeText={setStudioCountry}
              autoCapitalize="words"
              accessibilityLabel="Studio country"
            />
            <Pressable style={s.roleBtn} onPress={onStudio} disabled={busy} accessibilityRole="button" accessibilityLabel="Continue as studio owner">
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.roleBtnText}>Continue as studio owner</Text>}
            </Pressable>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------- seeker flow
function SeekerOnboarding({ onComplete }: { onComplete: () => void }) {
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
    <Results weights={c.weights} styles={styles} onRestart={c.reset} onComplete={onComplete} />
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
  weights, styles, onRestart, onComplete,
}: {
  weights: Record<string, number>;
  styles: StyleCard[];
  onRestart: () => void;
  onComplete: () => void;
}) {
  const toast = useToast();
  const finish = useFinishOnboarding(supabase);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const prefs = useMemo(() => computePreferences(weights, styles), [weights, styles]);
  const topPrefs = useMemo(() => topWeightedStyles(prefs), [prefs]);
  const nameBySlug = useMemo(() => new Map(styles.map((st) => [st.slug, st.name])), [styles]);
  const recs = useRecommendedArtists(supabase, topPrefs, null, true, 5);

  async function onFinish() {
    setBusy(true);
    if (city.trim()) await updateProfileLocation(supabase, city, country); // geocodes "city, country" → lat/lng
    const res = await finish.mutateAsync(weights);
    if (!res.ok) {
      setBusy(false);
      toast.show(res.error.message, "error");
      return;
    }
    setBusy(false);
    onComplete(); // → comms consent step, then Home
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
      <TasteProfile prefs={prefs} styles={styles} />

      <Text style={[s.title, { marginTop: 24 }]}>Artists for you</Text>
      {recs.isLoading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : (recs.data ?? []).length === 0 ? (
        <Text style={s.muted}>No matches near you yet — explore the feed to discover more.</Text>
      ) : (
        (recs.data ?? []).map((a) => <ArtistRow key={a.id} artist={a} reason={matchReason(a, nameBySlug)} />)
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

/** Visual "taste board": a personal summary + image tiles of the top styles,
 *  loved ones badged. Replaces the arbitrary per-style percentages with the
 *  qualitative Loved/Liked signal the swipe deck actually captured. */
function TasteProfile({ prefs, styles }: { prefs: StylePreference[]; styles: StyleCard[] }) {
  const imgByStyleId = useMemo(() => new Map(styles.map((st) => [st.id, st.imagePath])), [styles]);
  const top = prefs.slice(0, 6); // already sorted by weight → loved (3) before liked (1)
  const lead = top.slice(0, 2).map((p) => p.name);
  const extra = top.length - lead.length;
  const summary = lead.length
    ? `You're drawn to ${lead.join(" & ")}${extra > 0 ? ` and ${extra} more` : ""}.`
    : "";

  return (
    <View>
      <Text style={s.title}>Your tattoo taste</Text>
      {summary ? <Text style={s.tasteSummary}>{summary}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tasteScroll} contentContainerStyle={s.tasteRow}>
        {top.map((p, i) => {
          const path = imgByStyleId.get(p.styleId) ?? null;
          const uri = path ? publicStorageUrl(env.SUPABASE_URL, path) : undefined;
          const loved = p.weight >= 3;
          return (
            <View key={p.styleId} style={[s.tasteTile, { backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }]}>
              {uri ? <Image source={{ uri }} style={s.tasteImg} contentFit="cover" transition={150} /> : null}
              {loved ? <View style={s.tasteBadge}><Text style={s.tasteBadgeText}>★ Loved</Text></View> : null}
              <View style={s.tasteOverlay}><Text style={s.tasteName} numberOfLines={1}>{p.name}</Text></View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** A short, human "why this artist" line from the recommender's match signals. */
function matchReason(a: RecommendedArtist, nameBySlug: Map<string, string>): string {
  // Rating is shown separately on the row, so keep the reason to style + distance.
  const names = a.matchedStyles.map((sl) => nameBySlug.get(sl) ?? sl).slice(0, 2);
  const parts: string[] = [];
  if (names.length) parts.push(`Matches your ${names.join(" & ")}`);
  if (a.distanceKm != null) parts.push(`${a.distanceKm < 1 ? "<1" : Math.round(a.distanceKm)} km away`);
  return parts.join("  ·  ");
}

function ArtistRow({ artist, reason }: { artist: RecommendedArtist; reason?: string }) {
  return (
    <View style={s.artistRow}>
      <View style={s.avatar}>
        <Text style={s.avatarInitial}>{artist.displayName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.artistName}>{artist.displayName}</Text>
        <Text style={reason ? s.why : s.muted} numberOfLines={2}>{reason || artist.headline || artist.styles.join(", ")}</Text>
      </View>
      <Text style={s.rating}>★ {artist.ratingAvg.toFixed(1)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  consentWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  consentCard: { width: "100%", maxWidth: 420, alignItems: "center", borderWidth: 1, borderColor: "#EEEEF0", borderRadius: 24, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  consentIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#FCE7E8", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  consentTitle: { fontSize: 22, fontWeight: "800", color: "#18181B", textAlign: "center" },
  consentBody: { color: "#52525B", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10, marginBottom: 22 },
  consentPrimary: { backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center", alignSelf: "stretch" },
  consentPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  consentGhost: { paddingVertical: 14, alignItems: "center", alignSelf: "stretch", marginTop: 4 },
  consentGhostText: { color: "#71717A", fontWeight: "700", fontSize: 15 },
  consentDots: { flexDirection: "row", gap: 7, marginTop: 12 },
  consentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#E4E4E7" },
  consentDotActive: { backgroundColor: "#18181B" },
  roleWrap: { padding: 20, paddingTop: 48, flexGrow: 1 },
  roleCard: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 16, padding: 18, marginBottom: 14, gap: 6 },
  roleHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  roleHeadText: { flex: 1, gap: 6 },
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
  tasteSummary: { color: "#52525B", fontSize: 15, lineHeight: 21, marginTop: -4, marginBottom: 14 },
  tasteScroll: { flexGrow: 0, minHeight: 132 },
  tasteRow: { flexDirection: "row", gap: 10, paddingRight: 4 },
  tasteTile: { width: 100, height: 128, borderRadius: 16, overflow: "hidden", justifyContent: "flex-end" },
  tasteImg: { ...StyleSheet.absoluteFillObject },
  tasteOverlay: { padding: 8, backgroundColor: "rgba(0,0,0,0.4)" },
  tasteName: { color: "#fff", fontWeight: "800", fontSize: 13 },
  tasteBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  tasteBadgeText: { color: "#E5484D", fontWeight: "800", fontSize: 10 },
  artistRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontWeight: "700", fontSize: 18 },
  artistName: { fontWeight: "700", fontSize: 15 },
  why: { color: "#E5484D", fontSize: 12.5, fontWeight: "600", marginTop: 2 },
  rating: { fontWeight: "700", color: "#18181B" },
  cityInput: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 10, padding: 14, fontSize: 16, marginTop: 4 },
  finishBtn: { backgroundColor: "#E5484D", padding: 16, borderRadius: 14, alignItems: "center", marginTop: 20 },
  finishText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
