import { Ionicons } from "@expo/vector-icons";
import {
  recordProfileVisit, startDirectConversation, studioInviteArtist, useArtistAvailability, useArtistFlashes,
  useArtistPortfolio, useArtistProfile, useArtistReviews, useArtistSaved, useAuth, useMyStudio,
} from "@inkora/data-access";
import {
  type AvailabilitySlot, type Complexity, DAY_LABELS,
  estimatePrice, formatAmount, formatStyleSlug, type PortfolioImage, type ReviewItem,
} from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Pager } from "../../components/Pager";
import { ReviewPhotoStrip } from "../../components/ReviewPhotoStrip";
import { ReviewReply } from "../../components/ReviewReply";
import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { Avatar } from "../booking/components/ui";
import { Chip } from "../discovery/components";

const img = (p?: string | null, size?: number) => imageUrl(p, size);
const money = formatAmount;
const hhmm = (t: string) => t.slice(0, 5);
type Tab = "portfolio" | "reviews" | "flashes" | "availability";
const TABS: { key: Tab; label: string }[] = [
  { key: "portfolio", label: "Portfolio" },
  { key: "reviews", label: "Reviews" },
  { key: "flashes", label: "Flashes" },
  { key: "availability", label: "Availability" },
];
const COMPLEXITY: Complexity[] = ["simple", "medium", "complex"];

export function ArtistProfileScreen({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { ctx } = useAuth();
  const isSelf = !!ctx.userId && ctx.userId === id;
  // Log the visit (best-effort; server ignores the artist's own views + dedupes).
  useEffect(() => {
    if (id && !isSelf) void recordProfileVisit(supabase, "artist", id).catch(() => { /* best-effort */ });
  }, [id, isSelf]);
  const profile = useArtistProfile(supabase, id);
  const portfolio = useArtistPortfolio(supabase, id);
  const reviews = useArtistReviews(supabase, id);
  const flashes = useArtistFlashes(supabase, id);
  const availability = useArtistAvailability(supabase, id);
  const save = useArtistSaved(supabase, id);
  const tabParam = useLocalSearchParams<{ tab?: string }>().tab;
  const [tab, setTab] = useState<Tab>(tabParam === "reviews" ? "reviews" : "portfolio");
  const [complexity, setComplexity] = useState<Complexity>("medium");
  // A studio owner sees business actions (Message, Invite) — not client ones
  // (Save, Request booking).
  const qc = useQueryClient();
  const isStudioOwner = ctx.roles.includes("studio_admin");
  const myStudio = useMyStudio(supabase, isStudioOwner ? (ctx.userId ?? "") : "");
  const onRoster = (myStudio.data?.roster ?? []).some((r) => r.id === id);
  const [inviteBusy, setInviteBusy] = useState(false);

  const onToggleSave = () => {
    const next = !save.saved;
    save.toggle();
    toast.show(next ? "Saved to your artists" : "Removed from saved");
  };
  async function messageArtist() {
    try {
      const cid = await startDirectConversation(supabase, id);
      router.push(`/chats/${cid}`);
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }
  async function inviteToStudio() {
    const sid = myStudio.data?.id;
    if (!sid) return;
    setInviteBusy(true);
    try {
      await studioInviteArtist(supabase, sid, id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-studio", ctx.userId] }),
        qc.invalidateQueries({ queryKey: ["studio-overview", sid] }),
      ]);
      toast.show("Invitation sent");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setInviteBusy(false);
    }
  }

  if (profile.isLoading) {
    return <View style={s.center}><ActivityIndicator /></View>;
  }
  const a = profile.data;
  if (!a) {
    return <View style={s.center}><Text style={s.muted}>Artist not found.</Text></View>;
  }
  const est = estimatePrice(complexity, a.hourlyRate, a.minCharge, a.currencyCode);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#18181B" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.avatar}>
            {img(a.avatarPath, 96) ? <Image source={{ uri: img(a.avatarPath, 96) }} style={s.avatarImg} contentFit="cover" /> : (
              <Text style={s.avatarInitial}>{a.displayName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={s.nameRow}>
            <Text style={s.name}>{a.displayName}</Text>
            {a.verified && <Text style={s.verified}>✓</Text>}
          </View>
          {a.headline ? <Text style={s.headline}>{a.headline}</Text> : null}
          <Text style={s.meta}>
            {a.ratingCount > 0 ? `★ ${a.ratingAvg.toFixed(1)} (${a.ratingCount})` : "New artist"}
            {a.city ? ` · ${a.city}` : ""}
          </Text>
          {a.instagram ? (
            <Pressable onPress={() => Linking.openURL(`https://instagram.com/${a.instagram}`)}>
              <Text style={s.insta}>@{a.instagram}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Tags */}
        {a.styles.length > 0 && (
          <View style={s.tags}>
            {a.styles.map((sl) => <View key={sl} style={s.tag}><Text style={s.tagText}>{formatStyleSlug(sl)}</Text></View>)}
          </View>
        )}

        {a.bio ? <Text style={s.bio}>{a.bio}</Text> : null}

        {/* Studio affiliation */}
        {a.studios.map((st) => (
          <Pressable key={st.id} style={s.studioLink} onPress={() => router.push(`/studio/${st.slug}`)}>
            <Text style={s.studioText}>🏠 {st.name}</Text>
          </Pressable>
        ))}

        {/* Price estimator */}
        <View style={s.estCard}>
          <Text style={s.estTitle}>Estimate a price</Text>
          <View style={s.estChips}>
            {COMPLEXITY.map((c) => (
              <Chip key={c} label={c.charAt(0).toUpperCase() + c.slice(1)} active={complexity === c} onPress={() => setComplexity(c)} />
            ))}
          </View>
          <Text style={s.estRange}>{money(est.min, est.currencyCode)} – {money(est.max, est.currencyCode)}</Text>
          <Text style={s.muted}>Rough estimate based on the artist&apos;s rate. Final quote comes from the artist.</Text>
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {TABS.map((t) => (
            <Pressable key={t.key} style={[s.tabItem, tab === t.key && s.tabItemActive]} onPress={() => setTab(t.key)}>
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        <View style={s.tabContent}>
          {tab === "portfolio" && <PortfolioGrid images={portfolio.data ?? []} loading={portfolio.isLoading} />}
          {tab === "reviews" && <Reviews items={reviews.data ?? []} loading={reviews.isLoading} avg={a.ratingAvg} count={a.ratingCount} canReply={isSelf} onReplied={() => void reviews.refetch()} />}
          {tab === "flashes" && <FlashGrid images={flashes.data ?? []} loading={flashes.isLoading} />}
          {tab === "availability" && <Availability slots={availability.data ?? []} loading={availability.isLoading} />}
        </View>
      </ScrollView>

      {/* Sticky CTA — hidden on your own profile (can't save/message/book yourself) */}
      {isSelf ? (
        <View style={[s.cta, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={s.selfNote}>This is your public profile — edit it from your dashboard.</Text>
        </View>
      ) : isStudioOwner ? (
        // Studio owner: business actions only — Message + invite to the roster.
        <View style={[s.cta, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={s.ctaSecondary} onPress={() => void messageArtist()}>
            <Text style={s.ctaSecondaryText}>Message</Text>
          </Pressable>
          {onRoster ? (
            <View style={[s.ctaPrimary, s.ctaDisabled]} accessibilityRole="text" accessibilityLabel="Already on your roster">
              <Text style={s.ctaPrimaryText}>✓ On your roster</Text>
            </View>
          ) : (
            <Pressable style={[s.ctaPrimary, inviteBusy && s.ctaDisabled]} disabled={inviteBusy} onPress={() => void inviteToStudio()} accessibilityRole="button" accessibilityLabel={`Invite ${a.displayName} to your studio`}>
              {inviteBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaPrimaryText}>Invite to studio</Text>}
            </Pressable>
          )}
        </View>
      ) : (
        <View style={[s.cta, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={[s.ctaSave, save.saved && s.ctaSaveActive]}
            onPress={onToggleSave}
            disabled={save.isToggling}
            accessibilityRole="button"
            accessibilityState={{ selected: save.saved }}
            accessibilityLabel={save.saved ? "Saved. Tap to remove from your saved artists" : "Save artist"}
          >
            <Ionicons name={save.saved ? "heart" : "heart-outline"} size={24} color={save.saved ? "#E5484D" : "#18181B"} />
          </Pressable>
          <Pressable style={s.ctaSecondary} onPress={() => void messageArtist()}>
            <Text style={s.ctaSecondaryText}>Message</Text>
          </Pressable>
          <Pressable
            style={[s.ctaPrimary, !a.isAccepting && s.ctaDisabled]}
            disabled={!a.isAccepting}
            onPress={() => router.push({ pathname: "/booking-request", params: { artistId: a.id } })}
          >
            <Text style={s.ctaPrimaryText}>{a.isAccepting ? "Request booking" : "Not accepting"}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function PortfolioGrid({ images, loading }: { images: PortfolioImage[]; loading: boolean }) {
  const router = useRouter();
  if (loading) return <ActivityIndicator />;
  if (images.length === 0) return <Text style={s.muted}>No portfolio pieces yet.</Text>;
  return (
    <View style={s.grid}>
      {images.map((im) => (
        <Pressable
          key={im.id}
          style={s.gridItem}
          onPress={() => router.push(`/portfolio/${im.id}`)}
          accessibilityRole="imagebutton"
          accessibilityLabel={im.caption ? `View design: ${im.caption}` : "View portfolio piece"}
        >
          <Image source={{ uri: img(im.imagePath, 200) }} style={s.gridImg} contentFit="cover" />
        </Pressable>
      ))}
    </View>
  );
}

const REVIEWS_PAGE_SIZE = 3;

function Reviews({ items, loading, avg, count, canReply, onReplied }: { items: ReviewItem[]; loading: boolean; avg: number; count: number; canReply: boolean; onReplied: () => void }) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  if (loading) return <ActivityIndicator />;
  const totalPages = Math.max(1, Math.ceil(items.length / REVIEWS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageReviews = items.slice(safePage * REVIEWS_PAGE_SIZE, safePage * REVIEWS_PAGE_SIZE + REVIEWS_PAGE_SIZE);
  return (
    <View>
      <Text style={s.reviewSummary}>{count > 0 ? `★ ${avg.toFixed(1)} · ${count} review${count === 1 ? "" : "s"}` : "No reviews yet."}</Text>
      {pageReviews.map((r) => (
        <View key={r.id} style={s.reviewCard}>
          <Pressable
            onPress={() => r.authorId && router.push({ pathname: "/seeker/[id]", params: { id: r.authorId, reviewId: r.id } })}
            disabled={!r.authorId}
            accessibilityRole="button"
            accessibilityLabel={`View ${r.authorName}'s profile`}
          >
            <View style={s.reviewHeadRow}>
              <Avatar path={r.authorAvatarPath} name={r.authorName} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={s.reviewAuthor}>{r.authorName}</Text>
                <Text style={s.reviewStars}>{"★".repeat(r.overallRating)}{"☆".repeat(5 - r.overallRating)}</Text>
              </View>
              {r.authorId ? <Ionicons name="chevron-forward" size={16} color="#D4D4D8" /> : null}
            </View>
            {r.title ? <Text style={s.reviewTitle}>{r.title}</Text> : null}
            {r.body ? <Text style={s.reviewBody}>{r.body}</Text> : null}
            <ReviewPhotoStrip paths={r.photoPaths} />
          </Pressable>
          <ReviewReply reviewId={r.id} reply={r.reply} canReply={canReply} onReplied={onReplied} />
        </View>
      ))}
      <Pager page={safePage} totalPages={totalPages} onChange={setPage} />
    </View>
  );
}

function FlashGrid({ images, loading }: { images: PortfolioImage[]; loading: boolean }) {
  const router = useRouter();
  if (loading) return <ActivityIndicator />;
  if (images.length === 0) return <Text style={s.muted}>No flash designs yet.</Text>;
  return (
    <>
      <Text style={s.flashHint}>Ready-to-tattoo designs — book one directly, no consultation needed.</Text>
      <View style={s.grid}>
        {images.map((im) => (
          <Pressable
            key={im.id}
            style={s.gridItem}
            onPress={() => router.push(`/portfolio/${im.id}`)}
            accessibilityRole="imagebutton"
            accessibilityLabel={im.caption ? `View flash design: ${im.caption}` : "View flash design"}
          >
            <Image source={{ uri: img(im.imagePath, 200) }} style={s.gridImg} contentFit="cover" />
          </Pressable>
        ))}
      </View>
    </>
  );
}

function Availability({ slots, loading }: { slots: AvailabilitySlot[]; loading: boolean }) {
  if (loading) return <ActivityIndicator />;
  if (slots.length === 0) return <Text style={s.muted}>Availability not set.</Text>;
  return (
    <View>
      {slots.map((sl, i) => (
        <View key={i} style={s.availRow}>
          <Text style={s.availDay}>{DAY_LABELS[sl.dayOfWeek]}</Text>
          <Text style={s.availTime}>{hhmm(sl.startTime)} – {hhmm(sl.endTime)}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topbar: { paddingHorizontal: 12, paddingVertical: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#A1A1AA", fontSize: 13 },
  header: { alignItems: "center", paddingTop: 16, paddingHorizontal: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { color: "#fff", fontSize: 40, fontWeight: "800" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  name: { fontSize: 24, fontWeight: "800" },
  verified: { color: "#fff", backgroundColor: "#3B82F6", width: 20, height: 20, borderRadius: 10, textAlign: "center", overflow: "hidden", fontWeight: "800", fontSize: 12, lineHeight: 20 },
  headline: { color: "#52525B", marginTop: 2 },
  meta: { color: "#18181B", marginTop: 6, fontWeight: "600" },
  insta: { color: "#E5484D", marginTop: 4, fontWeight: "600" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 20, marginTop: 12, justifyContent: "center" },
  tag: { backgroundColor: "#F4F4F5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: "600", color: "#18181B" },
  bio: { paddingHorizontal: 20, marginTop: 12, color: "#3F3F46", lineHeight: 20 },
  studioLink: { marginHorizontal: 20, marginTop: 12, backgroundColor: "#F4F4F5", borderRadius: 12, padding: 12 },
  studioText: { fontWeight: "600" },
  estCard: { margin: 20, marginBottom: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#E4E4E7" },
  estTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10 },
  estChips: { flexDirection: "row", marginBottom: 10 },
  estRange: { fontSize: 24, fontWeight: "800", color: "#E5484D" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E4E4E7", marginTop: 8, paddingHorizontal: 12 },
  tabItem: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabItemActive: { borderBottomColor: "#E5484D" },
  tabText: { fontWeight: "600", color: "#71717A" },
  tabTextActive: { color: "#18181B" },
  tabContent: { padding: 20, minHeight: 160 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridItem: { width: "48%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#E4E4E7" },
  gridImg: { width: "100%", height: "100%" },
  reviewSummary: { fontWeight: "700", marginBottom: 12 },
  reviewCard: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 12, padding: 12, marginBottom: 10 },
  reviewHead: { fontWeight: "700" },
  reviewHeadRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAuthor: { fontWeight: "800", fontSize: 14, color: "#18181B" },
  reviewStars: { color: "#E5484D", fontSize: 13, marginTop: 1 },
  reviewTitle: { fontWeight: "600", marginTop: 8 },
  reviewBody: { color: "#3F3F46", marginTop: 2 },
  flashHint: { color: "#71717A", fontSize: 13, marginBottom: 12, lineHeight: 18 },
  availRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  availDay: { fontWeight: "700", width: 60 },
  availTime: { color: "#3F3F46" },
  cta: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 10, padding: 12, paddingTop: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E4E4E7" },
  selfNote: { flex: 1, textAlign: "center", color: "#71717A", fontWeight: "600", paddingVertical: 8 },
  ctaSave: { width: 54, borderRadius: 14, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  ctaSaveActive: { borderColor: "#E5484D", backgroundColor: "#FEF2F2" },
  ctaSecondary: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center" },
  ctaSecondaryText: { fontWeight: "700" },
  ctaPrimary: { flex: 2, padding: 16, borderRadius: 14, backgroundColor: "#E5484D", alignItems: "center" },
  ctaPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  ctaDisabled: { backgroundColor: "#D4D4D8" },
});
