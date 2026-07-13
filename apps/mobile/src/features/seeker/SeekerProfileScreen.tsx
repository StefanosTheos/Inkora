import { Ionicons } from "@expo/vector-icons";
import { startDirectConversation, useAuth, useClientReviews, usePublicSeekerProfile, useSeekerReviews } from "@inkora/data-access";
import { CLIENT_REVIEW_CATEGORIES, type ClientReviewItem, type SeekerReview } from "@inkora/domain";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ImageZoomModal } from "../../components/ImageZoomModal";
import { ReviewPhotoStrip } from "../../components/ReviewPhotoStrip";
import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { Avatar, fmtDate } from "../booking/components/ui";

// The healing milestones a review's journey photos map onto, in order.
const JOURNEY_MILESTONES = [
  { key: "post_session", label: "Post-session" },
  { key: "week", label: "1 Week" },
  { key: "month", label: "1 Month" },
];

export function SeekerProfileScreen({ id, featuredReviewId }: { id: string; featuredReviewId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { ctx } = useAuth();
  const profile = usePublicSeekerProfile(supabase, id);
  const reviews = useSeekerReviews(supabase, id);
  // Artists (and the client themselves) can see how artists have rated this
  // client. The RPC enforces the same rule, so this just avoids a dead fetch.
  const canSeeClientReviews = ctx.roles.includes("artist") || ctx.userId === id;
  const clientReviews = useClientReviews(supabase, id, canSeeClientReviews);
  const [zoomUri, setZoomUri] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  // Featuring a different review resets pagination and jumps to the top so the
  // newly-featured review (and its journey) is what the viewer lands on.
  useEffect(() => {
    setPage(0);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [featuredReviewId]);
  // Artists can start a chat with the seeker from here.
  const canMessage = ctx.roles.includes("artist") && !!ctx.userId && ctx.userId !== id;
  async function messageSeeker() {
    try {
      const cid = await startDirectConversation(supabase, id);
      router.push(`/chats/${cid}`);
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }

  if (profile.isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <TopBar onBack={() => router.back()} />
        <View style={s.center}><ActivityIndicator /></View>
      </SafeAreaView>
    );
  }
  const p = profile.data;
  if (!p) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <TopBar onBack={() => router.back()} />
        <View style={s.center}><Text style={s.muted}>This profile isn&apos;t available.</Text></View>
      </SafeAreaView>
    );
  }

  // Feature the tapped review's journey at the top; show the rest below.
  const allReviews = reviews.data ?? [];
  const featured = featuredReviewId ? allReviews.find((r) => r.id === featuredReviewId) : undefined;
  const journeyPhotos = featured?.photoPaths ?? [];
  const otherReviews = featured ? allReviews.filter((r) => r.id !== featured.id) : allReviews;
  const firstName = p.displayName.split(" ")[0] ?? p.displayName;
  // Paginate the reviews in batches of 3.
  const PAGE_SIZE = 3;
  const totalPages = Math.max(1, Math.ceil(otherReviews.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageReviews = otherReviews.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <TopBar onBack={() => router.back()} />
      <ScrollView ref={scrollRef} contentContainerStyle={s.body}>
        {/* Header */}
        <View style={s.header}>
          <Avatar path={p.avatarPath} name={p.displayName} size={80} />
          <Text style={s.name} accessibilityRole="header">{p.displayName}</Text>
          <Text style={s.sub}>
            {[p.username ? `@${p.username}` : null, p.city].filter(Boolean).join(" · ") || "Inkora member"}
          </Text>
          <Text style={s.since}>Member since {fmtDate(p.memberSince)}</Text>
        </View>

        {/* Stats */}
        <View style={s.stats}>
          <Stat label="Bookings" value={String(p.bookingsCount)} />
          <Stat label="Reviews" value={String(p.reviewsCount)} />
        </View>

        {canMessage ? (
          <Pressable style={s.messageBtn} onPress={messageSeeker} accessibilityRole="button" accessibilityLabel={`Message ${p.displayName}`}>
            <Ionicons name="chatbubble-outline" size={18} color="#fff" />
            <Text style={s.messageBtnText}>Message</Text>
          </Pressable>
        ) : null}

        {/* How artists have rated this client (artists + the client themselves) */}
        {canSeeClientReviews ? (
          <ClientReviewsSection reviews={clientReviews.data ?? []} loading={clientReviews.isLoading} isOwn={ctx.userId === id} />
        ) : null}

        {/* The opened review's text (its healing photos render in the journey
            section below, so no photo strip here to avoid duplication). */}
        {featured ? (
          <>
            <Text style={s.sectionTitle} accessibilityRole="header">Review</Text>
            <View style={[s.reviewCard, s.featuredCard]}>
              <Text style={s.reviewHead}>{featured.subjectName} · ★ {featured.overallRating}</Text>
              {featured.title ? <Text style={s.reviewTitle}>{featured.title}</Text> : null}
              {featured.body ? <Text style={s.reviewBody}>{featured.body}</Text> : null}
              <Text style={s.reviewDate}>{fmtDate(featured.createdAt)}</Text>
            </View>
          </>
        ) : null}

        {/* Tattoo journey — the featured review's healing photos (post-session / 1 week / 1 month) */}
        <Text style={s.sectionTitle} accessibilityRole="header">Tattoo journey</Text>
        <Text style={s.sectionHint}>
          {featured ? `Healing progress from ${firstName}'s ${featured.subjectName} tattoo.` : `Healing progress shared by ${firstName}.`}
        </Text>
        <View style={s.journeyRow}>
          {JOURNEY_MILESTONES.map((m, i) => {
            const photo = journeyPhotos[i];
            return (
              <View key={m.key} style={s.journeyCard}>
                {photo ? (
                  <Pressable
                    style={s.journeyPhotoWrap}
                    onPress={() => setZoomUri(imageUrl(photo, 1200) ?? null)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`${m.label} photo, tap to zoom`}
                  >
                    <Image source={{ uri: imageUrl(photo, 240) }} style={s.journeyPhoto} contentFit="cover" />
                  </Pressable>
                ) : (
                  <View style={s.journeyPlaceholder}>
                    <Ionicons name="image-outline" size={22} color="#D4D4D8" />
                  </View>
                )}
                <Text style={s.journeyLabel}>{m.label}</Text>
                {!photo ? <Text style={s.journeyEmpty}>Not shared yet</Text> : null}
              </View>
            );
          })}
        </View>

        {/* Other reviews written by this seeker */}
        <Text style={s.sectionTitle} accessibilityRole="header">{featured ? "Other reviews" : "Reviews"}</Text>
        {reviews.isLoading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : otherReviews.length === 0 ? (
          <Text style={s.muted}>No other reviews yet.</Text>
        ) : (
          <>
            {pageReviews.map((r: SeekerReview) => (
              <Pressable
                key={r.id}
                style={s.reviewCard}
                onPress={() => router.setParams({ reviewId: r.id })}
                accessibilityRole="button"
                accessibilityLabel={`Review of ${r.subjectName}, ${r.overallRating} stars. Tap to open`}
              >
                <Text style={s.reviewHead}>{r.subjectName} · ★ {r.overallRating}</Text>
                {r.title ? <Text style={s.reviewTitle}>{r.title}</Text> : null}
                {r.body ? <Text style={s.reviewBody}>{r.body}</Text> : null}
                <ReviewPhotoStrip paths={r.photoPaths} />
                <Text style={s.reviewDate}>{fmtDate(r.createdAt)}</Text>
              </Pressable>
            ))}
            {totalPages > 1 ? (
              <View style={s.pager}>
                <Pressable disabled={safePage === 0} onPress={() => setPage(safePage - 1)} hitSlop={6} style={[s.pagerBtn, safePage === 0 && s.pagerBtnOff]} accessibilityRole="button" accessibilityLabel="Previous page">
                  <Ionicons name="chevron-back" size={18} color={safePage === 0 ? "#D4D4D8" : "#18181B"} />
                </Pressable>
                {Array.from({ length: totalPages }, (_, i) => (
                  <Pressable key={i} onPress={() => setPage(i)} style={[s.pageNum, i === safePage && s.pageNumActive]} accessibilityRole="button" accessibilityLabel={`Page ${i + 1}`}>
                    <Text style={[s.pageNumText, i === safePage && s.pageNumTextActive]}>{i + 1}</Text>
                  </Pressable>
                ))}
                <Pressable disabled={safePage >= totalPages - 1} onPress={() => setPage(safePage + 1)} hitSlop={6} style={[s.pagerBtn, safePage >= totalPages - 1 && s.pagerBtnOff]} accessibilityRole="button" accessibilityLabel="Next page">
                  <Ionicons name="chevron-forward" size={18} color={safePage >= totalPages - 1 ? "#D4D4D8" : "#18181B"} />
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <ImageZoomModal visible={!!zoomUri} uri={zoomUri ?? ""} onClose={() => setZoomUri(null)} label="Tattoo progress" />
    </SafeAreaView>
  );
}

// The artist-facing client reputation: overall score, per-category averages,
// and each artist's note (hidden until the double-blind window unlocks it).
function ClientReviewsSection({ reviews, loading, isOwn }: { reviews: ClientReviewItem[]; loading: boolean; isOwn: boolean }) {
  const avg = (key: keyof ClientReviewItem) =>
    reviews.length ? reviews.reduce((sum, r) => sum + (r[key] as number), 0) / reviews.length : 0;
  // True grand mean of every category score (no intermediate per-review
  // rounding), so the headline matches the five category bars exactly.
  const overall = reviews.length
    ? CLIENT_REVIEW_CATEGORIES.reduce((sum, c) => sum + avg(c.key), 0) / CLIENT_REVIEW_CATEGORIES.length
    : 0;

  // Paginate the review cards, 3 per page (same pager as the other reviews).
  const PAGE_SIZE = 3;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(reviews.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageReviews = reviews.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <Text style={s.sectionTitle} accessibilityRole="header">{isOwn ? "How artists rate you" : "How artists rate this client"}</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : reviews.length === 0 ? (
        <Text style={[s.muted, { marginTop: 8 }]}>{isOwn ? "No artist has reviewed you yet." : "No client reviews yet."}</Text>
      ) : (
        <>
          <View style={s.crOverall}>
            <Text style={s.crBig}>★ {overall.toFixed(1)}</Text>
            <Text style={s.crCount}>{reviews.length} review{reviews.length > 1 ? "s" : ""}</Text>
          </View>
          {reviews.length < 3 ? (
            <Text style={s.crNew}>New client — based on only {reviews.length} review{reviews.length > 1 ? "s" : ""}.</Text>
          ) : null}
          <View style={s.crBars}>
            {CLIENT_REVIEW_CATEGORIES.map((cat) => {
              const v = avg(cat.key);
              return (
                <View key={cat.key} style={s.crBarRow}>
                  <Text style={s.crBarLabel}>{cat.label}</Text>
                  <View style={s.crBarTrack}><View style={[s.crBarFill, { width: `${(v / 5) * 100}%` }]} /></View>
                  <Text style={s.crBarVal}>{v.toFixed(1)}</Text>
                </View>
              );
            })}
          </View>
          {pageReviews.map((r) => (
            <View key={r.id} style={s.reviewCard}>
              <Text style={s.reviewHead}>{r.authorName} · ★ {r.overall}</Text>
              {r.comment ? (
                <Text style={s.reviewBody}>{r.comment}</Text>
              ) : r.textLocked ? (
                <Text style={s.crLocked}>🔒 {isOwn ? "Note hidden until you review this artist." : "Note hidden until the client reviews this artist."}</Text>
              ) : null}
              <Text style={s.reviewDate}>{fmtDate(r.createdAt)}</Text>
            </View>
          ))}
          {totalPages > 1 ? (
            <View style={s.pager}>
              <Pressable disabled={safePage === 0} onPress={() => setPage(safePage - 1)} hitSlop={6} style={[s.pagerBtn, safePage === 0 && s.pagerBtnOff]} accessibilityRole="button" accessibilityLabel="Previous page">
                <Ionicons name="chevron-back" size={18} color={safePage === 0 ? "#D4D4D8" : "#18181B"} />
              </Pressable>
              {Array.from({ length: totalPages }, (_, i) => (
                <Pressable key={i} onPress={() => setPage(i)} style={[s.pageNum, i === safePage && s.pageNumActive]} accessibilityRole="button" accessibilityLabel={`Page ${i + 1}`}>
                  <Text style={[s.pageNumText, i === safePage && s.pageNumTextActive]}>{i + 1}</Text>
                </Pressable>
              ))}
              <Pressable disabled={safePage >= totalPages - 1} onPress={() => setPage(safePage + 1)} hitSlop={6} style={[s.pagerBtn, safePage >= totalPages - 1 && s.pagerBtnOff]} accessibilityRole="button" accessibilityLabel="Next page">
                <Ionicons name="chevron-forward" size={18} color={safePage >= totalPages - 1 ? "#D4D4D8" : "#18181B"} />
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.topbar}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons name="chevron-back" size={26} color="#18181B" onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topbar: { paddingHorizontal: 12, paddingVertical: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#A1A1AA" },
  body: { padding: 16, paddingBottom: 40 },
  header: { alignItems: "center", gap: 4, marginBottom: 8 },
  name: { fontSize: 22, fontWeight: "800", marginTop: 8 },
  sub: { color: "#52525B", fontWeight: "600" },
  since: { color: "#A1A1AA", fontSize: 13 },
  stats: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 8 },
  statBox: { flex: 1, backgroundColor: "#F4F4F5", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  messageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#18181B", borderRadius: 14, paddingVertical: 13, marginTop: 4 },
  messageBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  statValue: { fontSize: 20, fontWeight: "900", color: "#18181B" },
  statLabel: { color: "#71717A", fontSize: 12, fontWeight: "600", marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 20 },
  sectionHint: { color: "#A1A1AA", fontSize: 13, marginTop: 2, marginBottom: 10 },
  journeyRow: { flexDirection: "row", gap: 8 },
  journeyCard: { flex: 1, alignItems: "center" },
  journeyPlaceholder: { width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: "#F4F4F5", borderWidth: 1, borderColor: "#EEE", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  journeyPhotoWrap: { width: "100%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#E4E4E7" },
  journeyPhoto: { width: "100%", height: "100%" },
  journeyLabel: { fontWeight: "700", fontSize: 12, marginTop: 6, color: "#18181B", textAlign: "center" },
  journeyEmpty: { color: "#A1A1AA", fontSize: 11, marginTop: 1 },
  crOverall: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10 },
  crBig: { fontSize: 26, fontWeight: "900", color: "#18181B" },
  crCount: { color: "#71717A", fontSize: 13, fontWeight: "600" },
  crNew: { color: "#B45309", fontSize: 12, fontWeight: "700", marginTop: 4 },
  crBars: { gap: 6, marginTop: 12 },
  crBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  crBarLabel: { width: 104, fontSize: 12, fontWeight: "700", color: "#3F3F46" },
  crBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#F4F4F5", overflow: "hidden" },
  crBarFill: { height: "100%", borderRadius: 4, backgroundColor: "#E5484D" },
  crBarVal: { width: 26, textAlign: "right", fontSize: 12, fontWeight: "700", color: "#18181B" },
  crLocked: { color: "#A1A1AA", fontSize: 13, fontStyle: "italic", marginTop: 4 },
  reviewCard: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 12, padding: 12, marginTop: 10 },
  featuredCard: { borderColor: "#FBCFE8", backgroundColor: "#FEF2F7" },
  reviewHead: { fontWeight: "700" },
  reviewTitle: { fontWeight: "600", marginTop: 4 },
  reviewBody: { color: "#3F3F46", marginTop: 2 },
  reviewDate: { color: "#A1A1AA", fontSize: 12, marginTop: 6 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 6, marginTop: 16 },
  pagerBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  pagerBtnOff: { opacity: 0.4 },
  pageNum: { minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F4F5" },
  pageNumActive: { backgroundColor: "#18181B" },
  pageNumText: { fontWeight: "700", color: "#52525B", fontSize: 14 },
  pageNumTextActive: { color: "#fff" },
});
