import { Ionicons } from "@expo/vector-icons";
import { startDirectConversation, useAuth, useClientReviews, usePublicSeekerProfile, useSeekerReviews } from "@inkora/data-access";
import { CLIENT_REVIEW_CATEGORIES, type ClientReviewItem, type SeekerReview } from "@inkora/domain";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { type RefObject, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ImageZoomModal } from "../../components/ImageZoomModal";
import { Pager, PagerScrollProvider } from "../../components/Pager";
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

type ProfileTab = "journey" | "reviews" | "ratings";

export function SeekerProfileScreen({ id, featuredReviewId, appointmentId }: { id: string; featuredReviewId?: string; appointmentId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { ctx } = useAuth();
  const profile = usePublicSeekerProfile(supabase, id);
  const reviews = useSeekerReviews(supabase, id);
  // Artists, studio owners (both business decision-makers) and the client
  // themselves can see how artists have rated this client. The RPC enforces the
  // same rule, so this just avoids a dead fetch.
  const canSeeClientReviews = ctx.roles.includes("artist") || ctx.roles.includes("studio_admin") || ctx.userId === id;
  const clientReviews = useClientReviews(supabase, id, canSeeClientReviews);
  const [zoomUri, setZoomUri] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<ProfileTab>("journey");
  const scrollRef = useRef<ScrollView>(null);
  const tabAnchor = useRef<View>(null);
  // Featuring a session (tapping a review, or arriving from an appointment)
  // jumps to the Journey tab + top, resets pagination, so the newly-featured
  // session is what the viewer lands on.
  useEffect(() => {
    setPage(0);
    setTab("journey");
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [featuredReviewId, appointmentId]);
  // Artists and studio owners can start a chat with the seeker from here.
  const canMessage = (ctx.roles.includes("artist") || ctx.roles.includes("studio_admin")) && !!ctx.userId && ctx.userId !== id;
  const isOwn = ctx.userId === id;
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

  // Entry points, two layouts:
  //  - Per-session (classic): reached by tapping a specific review, or from an
  //    artist's completed-appointment detail (?appointmentId). Shows that one
  //    session — a "Tattoo journey" strip of its photos (with the review card
  //    when a review exists). Rendered even when pending (no review/photos yet).
  //  - Latest session: opened cold via a button ("View my public profile", or
  //    an artist opening the profile not through a review). Auto-features the
  //    most-recent review with healing photos.
  // allReviews is newest-first.
  const allReviews = reviews.data ?? [];
  const perSession = !!featuredReviewId || !!appointmentId;
  const featured = featuredReviewId
    ? allReviews.find((r) => r.id === featuredReviewId)
    : appointmentId
      ? allReviews.find((r) => r.appointmentId === appointmentId)
      : allReviews.find((r) => r.photoPaths.length > 0);
  const journeyPhotos = featured?.photoPaths ?? [];
  const firstName = p.displayName.split(" ")[0] ?? p.displayName;
  // Paginate the seeker's written reviews in batches of 3 (Reviews tab).
  const PAGE_SIZE = 3;
  const totalPages = Math.max(1, Math.ceil(allReviews.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageReviews = allReviews.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <TopBar onBack={() => router.back()} />
      <ScrollView ref={scrollRef} contentContainerStyle={s.body}>
        <PagerScrollProvider scrollRef={scrollRef}>
        {/* Header */}
        <View style={s.header}>
          <Avatar path={p.avatarPath} name={p.displayName} size={80} />
          <Text style={s.name} accessibilityRole="header">{p.displayName}</Text>
          <Text style={s.sub}>
            {[p.username ? `@${p.username}` : null, p.city].filter(Boolean).join(" · ") || "Inkora member"}
          </Text>
          <Text style={s.since}>Member since {fmtDate(p.memberSince)}</Text>
          {p.bio ? <Text style={s.bio}>{p.bio}</Text> : null}
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

        {/* Tabs — split the (previously long) content into Journey / Reviews /
            Ratings so the page stays light and easy to navigate. */}
        <View style={s.tabs}>
          <TabBtn label="Journey" active={tab === "journey"} onPress={() => setTab("journey")} />
          <TabBtn label={`Reviews${allReviews.length ? ` (${allReviews.length})` : ""}`} active={tab === "reviews"} onPress={() => setTab("reviews")} />
          {canSeeClientReviews ? <TabBtn label={`Ratings${clientReviews.data?.length ? ` (${clientReviews.data.length})` : ""}`} active={tab === "ratings"} onPress={() => setTab("ratings")} /> : null}
        </View>
        <View ref={tabAnchor} collapsable={false} />

        {tab === "journey" ? (
          featured ? (
            // A featured session: photos first, then the review (both layouts
            // share this order). Title differs: a specific session ("Tattoo
            // journey") vs the cold-open summary ("… latest session").
            <>
              <Text style={s.sectionTitle} accessibilityRole="header">{perSession ? "Tattoo journey" : isOwn ? "Your latest session" : `${firstName}'s latest session`}</Text>
              <Text style={s.sectionHint}>
                {isOwn && !perSession ? `Healing progress from your ${featured.subjectName} tattoo.` : `Healing progress from ${firstName}'s ${featured.subjectName} tattoo.`}
              </Text>
              <JourneyPhotoRow photos={journeyPhotos} onZoom={setZoomUri} />
              <FeaturedReviewCard review={featured} />
            </>
          ) : perSession ? (
            // Completed session still pending a review/photos.
            <>
              <Text style={s.sectionTitle} accessibilityRole="header">Tattoo journey</Text>
              <Text style={s.sectionHint}>{isOwn ? "Your" : `${firstName}'s`} healing photos and review for this session will appear here once shared.</Text>
              <JourneyPhotoRow photos={journeyPhotos} onZoom={setZoomUri} />
            </>
          ) : (
            <View style={s.tabEmpty}>
              <Ionicons name="footsteps-outline" size={30} color="#D4D4D8" />
              <Text style={s.muted}>{isOwn ? "You haven’t shared a tattoo journey yet." : `${firstName} hasn’t shared a tattoo journey yet.`}</Text>
            </View>
          )
        ) : tab === "reviews" ? (
          reviews.isLoading ? (
            <ActivityIndicator style={{ marginTop: 16 }} />
          ) : allReviews.length === 0 ? (
            <View style={s.tabEmpty}>
              <Ionicons name="star-outline" size={30} color="#D4D4D8" />
              <Text style={s.muted}>{isOwn ? "You haven’t written any reviews yet." : `${firstName} hasn’t written any reviews yet.`}</Text>
            </View>
          ) : (
            <>
              {pageReviews.map((r: SeekerReview) => (
                <Pressable
                  key={r.id}
                  style={[s.reviewCard, featured?.id === r.id && s.featuredCard]}
                  onPress={() => router.setParams({ reviewId: r.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Review of ${r.subjectName}, ${r.overallRating} stars. Tap to open its tattoo journey`}
                >
                  <Text style={s.reviewHead}>{r.subjectName} · ★ {r.overallRating}</Text>
                  {r.title ? <Text style={s.reviewTitle}>{r.title}</Text> : null}
                  {r.body ? <Text style={s.reviewBody} numberOfLines={3}>{r.body}</Text> : null}
                  <ReviewPhotoStrip paths={r.photoPaths} />
                  <Text style={s.reviewDate}>{fmtDate(r.createdAt)}</Text>
                </Pressable>
              ))}
              <Pager page={safePage} totalPages={totalPages} onChange={setPage} anchorRef={tabAnchor} />
            </>
          )
        ) : (
          /* Ratings — how artists rate this client (only shown to artists / self). */
          <ClientReviewsSection reviews={clientReviews.data ?? []} loading={clientReviews.isLoading} isOwn={isOwn} anchorRef={tabAnchor} />
        )}
        </PagerScrollProvider>
      </ScrollView>
      <ImageZoomModal visible={!!zoomUri} uri={zoomUri ?? ""} onClose={() => setZoomUri(null)} label="Tattoo progress" />
    </SafeAreaView>
  );
}

// A session's healing photos (post-session / 1 week / 1 month), tappable to zoom.
function JourneyPhotoRow({ photos, onZoom }: { photos: string[]; onZoom: (uri: string | null) => void }) {
  return (
    <View style={s.journeyRow}>
      {JOURNEY_MILESTONES.map((m, i) => {
        const photo = photos[i];
        return (
          <View key={m.key} style={s.journeyCard}>
            {photo ? (
              <Pressable
                style={s.journeyPhotoWrap}
                onPress={() => onZoom(imageUrl(photo, 1200) ?? null)}
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
  );
}

function FeaturedReviewCard({ review }: { review: SeekerReview }) {
  return (
    <View style={[s.reviewCard, s.featuredCard]}>
      <Text style={s.reviewHead}>{review.subjectName} · ★ {review.overallRating}</Text>
      {review.title ? <Text style={s.reviewTitle}>{review.title}</Text> : null}
      {review.body ? <Text style={s.reviewBody}>{review.body}</Text> : null}
      <Text style={s.reviewDate}>{fmtDate(review.createdAt)}</Text>
    </View>
  );
}

// The artist-facing client reputation: overall score, per-category averages,
// and each artist's note (hidden until the double-blind window unlocks it).
function ClientReviewsSection({ reviews, loading, isOwn, anchorRef }: { reviews: ClientReviewItem[]; loading: boolean; isOwn: boolean; anchorRef?: RefObject<View | null> }) {
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
          <Pager page={safePage} totalPages={totalPages} onChange={setPage} anchorRef={anchorRef} />
        </>
      )}
    </>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.tab, active && s.tabActive]} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label}>
      <Text style={[s.tabText, active && s.tabTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
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
  bio: { color: "#3F3F46", fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8, paddingHorizontal: 8 },
  stats: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 8 },
  statBox: { flex: 1, backgroundColor: "#F4F4F5", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  messageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#18181B", borderRadius: 14, paddingVertical: 13, marginTop: 4 },
  messageBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 20, marginBottom: 6 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 999, backgroundColor: "#F4F4F5", alignItems: "center" },
  tabActive: { backgroundColor: "#18181B" },
  tabText: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  tabTextActive: { color: "#fff" },
  tabEmpty: { alignItems: "center", gap: 10, paddingVertical: 36 },
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
  featuredCard: { borderColor: "#D4D4D8", backgroundColor: "#F4F4F5" },
  reviewHead: { fontWeight: "700" },
  reviewTitle: { fontWeight: "600", marginTop: 4 },
  reviewBody: { color: "#3F3F46", marginTop: 2 },
  reviewDate: { color: "#A1A1AA", fontSize: 12, marginTop: 6 },
});
