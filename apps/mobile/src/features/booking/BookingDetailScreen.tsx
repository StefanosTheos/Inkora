import { Ionicons } from "@expo/vector-icons";
import {
  bookingKeys, cancelAppointment, cancelRequest, completeAppointment, createOffer, declineRequest,
  getChatSignedUrl, markEntityNotificationsRead, rescheduleAppointment, respondToOffer,
  startDirectConversation, submitReview,
  useAppointment, useAppointmentReview, useArtistAvailability, useArtistDaySlots, useAuth,
  useBookingRequest, withdrawOffer,
} from "@inkora/data-access";
import {
  APPOINTMENT_STATUS_LABEL, type AppointmentRequestView, type AppointmentView, type OfferView,
  slotMatchesTimeOfDay, TIME_OF_DAY_LABEL, type TimeOfDay,
} from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";
import { ImageZoomModal } from "../../components/ImageZoomModal";
import { useToast } from "../../components/Toast";
import { useMarkRequestSeen } from "../../lib/seen-requests";
import { supabase } from "../../lib/supabase";
import { MonthCalendar } from "./components/MonthCalendar";
import { Avatar, budgetRangeLabel, fmtDate, fmtDateTime, fmtTime, money, offerBudgetError, requestChip, StatusChip } from "./components/ui";

const DURATIONS = [
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
  { label: "Full day", minutes: 360 },
];

type Toast = ReturnType<typeof useToast>;
type Router = ReturnType<typeof useRouter>;

/** Artist opens (or reuses) a direct chat with the client. */
async function messageClient(router: Router, toast: Toast, clientId: string) {
  try {
    const cid = await startDirectConversation(supabase, clientId);
    router.push(`/chats/${cid}`);
  } catch (e) {
    toast.show((e as Error).message, "error");
  }
}

export function BookingDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const apptQ = useAppointment(supabase, id);
  const reqQ = useBookingRequest(supabase, id);

  let content: React.ReactNode;
  if (apptQ.data) content = <AppointmentDetail appt={apptQ.data} meId={meId} />;
  else if (reqQ.data) content = <RequestDetail req={reqQ.data} meId={meId} />;
  else if (apptQ.isLoading || reqQ.isLoading) content = <View style={s.center}><ActivityIndicator /></View>;
  else content = <View style={s.center}><Text style={s.muted}>This booking no longer exists.</Text></View>;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle}>Booking</Text>
        <View style={{ width: 26 }} />
      </View>
      {content}
    </SafeAreaView>
  );
}

// ============================================================ APPOINTMENT
function AppointmentDetail({ appt, meId }: { appt: AppointmentView; meId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const isArtist = appt.artistId === meId;
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const durationMin = Math.round((new Date(appt.scheduledEnd).getTime() - new Date(appt.scheduledStart).getTime()) / 60000);
  // The tattoo brief the client filled in during the request, carried over so
  // the artist sees placement/size/etc. on the confirmed booking too.
  const reqQ = useBookingRequest(supabase, appt.requestId ?? "");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: bookingKeys.appointments });
      await qc.invalidateQueries({ queryKey: bookingKeys.appointment(appt.id) });
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const active = appt.status === "scheduled" || appt.status === "rescheduled";

  // Free reschedule/cancel up to 4 days before the appointment.
  const FREE_WINDOW_DAYS = 4;
  const startMs = new Date(appt.scheduledStart).getTime();
  const freeUntilMs = startMs - FREE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const withinFeeWindow = Date.now() > freeUntilMs; // less than 4 days away
  const freeUntilISO = new Date(freeUntilMs).toISOString();

  function onReschedulePress() {
    // Seeker inside the fee window: warn that a new deposit applies, then open
    // the normal reschedule picker. (The deposit/payment step will be wired in
    // between the confirm and the picker later.)
    if (!isArtist && withinFeeWindow) {
      void confirm({
        title: "Free reschedule window has passed",
        message: "This appointment is less than 4 days away, so rescheduling now requires a new deposit.",
        confirmLabel: "Reschedule anyway",
        cancelLabel: "Keep appointment",
      }).then((ok) => { if (ok) setRescheduling(true); });
      return;
    }
    setRescheduling(true);
  }

  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.partyRow}>
        <Pressable
          style={s.partyPerson}
          onPress={() => router.push(`/artist/${appt.artistId}`)}
          disabled={isArtist}
          accessibilityRole={isArtist ? undefined : "button"}
          accessibilityLabel={isArtist ? appt.counterparty.name : `View ${appt.counterparty.name}'s profile`}
        >
          <Avatar path={appt.counterparty.avatarPath} name={appt.counterparty.name} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={s.partyName}>{appt.counterparty.name}</Text>
            <Text style={s.muted}>{isArtist ? "Client" : "Artist"}</Text>
          </View>
        </Pressable>
        {isArtist ? (
          <Pressable style={s.msgBtn} onPress={() => messageClient(router, toast, appt.clientId)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Message client">
            <Ionicons name="chatbubble-outline" size={20} color="#18181B" />
          </Pressable>
        ) : null}
        <StatusChip status={appt.status} label={APPOINTMENT_STATUS_LABEL[appt.status]} />
      </View>

      <View style={s.infoCard}>
        {appt.studioName ? <InfoRow icon="home-outline" label={`Booked via ${appt.studioName}`} /> : null}
        <InfoRow icon="calendar-outline" label={fmtDate(appt.scheduledStart)} />
        <InfoRow icon="time-outline" label={`${fmtTime(appt.scheduledStart)} – ${fmtTime(appt.scheduledEnd)}`} />
        {appt.priceAmount != null ? <InfoRow icon="pricetag-outline" label={money(appt.priceAmount)} /> : null}
        {appt.locationNote ? <InfoRow icon="location-outline" label={appt.locationNote} /> : null}
      </View>

      {reqQ.data ? <TattooBrief req={reqQ.data} /> : null}

      {appt.cancellationReason ? <Text style={s.muted}>Reason: {appt.cancellationReason}</Text> : null}

      {appt.status === "completed" && !isArtist ? <ReviewSection appt={appt} /> : null}

      {rescheduling && active ? (
        <SlotPicker
          artistId={appt.artistId}
          durationMinutes={durationMin}
          onCancel={() => setRescheduling(false)}
          onPick={(start, end) => run(async () => {
            await rescheduleAppointment(supabase, appt.id, start, end);
            setRescheduling(false);
          })}
        />
      ) : active ? (
        <View style={s.actions}>
          <SecondaryBtn label="Reschedule" onPress={onReschedulePress} disabled={busy} />
          {isArtist && <SecondaryBtn label="Mark completed" onPress={() => run(() => completeAppointment(supabase, appt.id))} disabled={busy} />}
          <DangerBtn
            label="Cancel appointment"
            disabled={busy}
            onPress={() => {
              void confirm({
                title: "Cancel appointment?",
                message: `${isArtist ? "The client" : "The artist"} will be notified.`,
                confirmLabel: "Cancel it",
                cancelLabel: "Keep",
                destructive: true,
              }).then((ok) => { if (ok) void run(() => cancelAppointment(supabase, appt.id)); });
            }}
          />
        </View>
      ) : null}

      {active && !isArtist ? (
        <View style={[s.notice, withinFeeWindow && s.noticeWarn]}>
          <Ionicons
            name={withinFeeWindow ? "alert-circle-outline" : "information-circle-outline"}
            size={18}
            color={withinFeeWindow ? "#B91C1C" : "#B45309"}
          />
          <Text style={[s.noticeText, withinFeeWindow && s.noticeTextWarn]}>
            {withinFeeWindow
              ? "The free reschedule/cancel window has passed. Rescheduling now requires a new deposit."
              : `You can reschedule or cancel free of charge until ${fmtDate(freeUntilISO)} (4 days before your appointment).`}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

// The tattoo brief from the original request (title, description, placement,
// size, colour, budget, reference photos). Shown on the confirmed appointment
// so the artist keeps the client's spec at hand.
function TattooBrief({ req }: { req: AppointmentRequestView }) {
  return (
    <View style={s.infoCard}>
      <View style={s.briefHead}>
        <Ionicons name="brush-outline" size={15} color="#71717A" />
        <Text style={s.briefLabel}>Tattoo details</Text>
      </View>
      <Text style={s.briefTitle}>{req.title}</Text>
      {req.description ? <Text style={s.reqBody}>{req.description}</Text> : null}
      {req.placement ? <InfoRow icon="body-outline" label={req.placement} /> : null}
      {req.approxSize ? <InfoRow icon="resize-outline" label={req.approxSize} /> : null}
      {req.isColor != null ? <InfoRow icon="color-palette-outline" label={req.isColor ? "Color" : "Black & grey"} /> : null}
      {req.budgetMin || req.budgetMax ? <InfoRow icon="wallet-outline" label={`Budget ${money(req.budgetMin, "EUR")}–${money(req.budgetMax, "EUR")}`} /> : null}
      {req.referencePaths.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.refs}>
          {req.referencePaths.map((p) => <SignedThumb key={p} path={p} />)}
        </ScrollView>
      )}
    </View>
  );
}

// Review — only rendered for a completed appointment the current user booked.
function ReviewSection({ appt }: { appt: AppointmentView }) {
  const qc = useQueryClient();
  const toast = useToast();
  const reviewQ = useAppointmentReview(supabase, appt.id);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await submitReview(supabase, {
        appointmentId: appt.id, artistId: appt.artistId, rating,
        title: title.trim() || undefined, body: body.trim() || undefined,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: bookingKeys.review(appt.id) }),
        qc.invalidateQueries({ queryKey: ["artist-reviews", appt.artistId] }),
        qc.invalidateQueries({ queryKey: ["artist", appt.artistId] }),
        qc.invalidateQueries({ queryKey: ["booking-journeys"] }),
      ]);
      toast.show("Thanks for your review!");
      setOpen(false);
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (reviewQ.isLoading) return null;

  const existing = reviewQ.data;
  if (existing) {
    return (
      <View style={s.reviewDone} accessible accessibilityLabel={`You reviewed this session, ${existing.overallRating} out of 5 stars`}>
        <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
        <Text style={s.reviewDoneText}>You reviewed this — {"★".repeat(existing.overallRating)}{"☆".repeat(5 - existing.overallRating)}</Text>
      </View>
    );
  }

  if (!open) {
    return (
      <View style={s.actions}>
        <PrimaryBtn label="Leave a review" onPress={() => setOpen(true)} />
      </View>
    );
  }

  return (
    <View style={s.reviewForm}>
      <Text style={s.reviewFormTitle}>Rate your session with {appt.counterparty.name}</Text>
      <View style={s.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}>
            <Ionicons name={n <= rating ? "star" : "star-outline"} size={34} color="#E5484D" />
          </Pressable>
        ))}
      </View>
      <TextInput style={s.reviewInput} placeholder="Title (optional)" value={title} onChangeText={setTitle} accessibilityLabel="Review title" />
      <TextInput style={[s.reviewInput, s.reviewMultiline]} placeholder="Share the details (optional)" value={body} onChangeText={setBody} multiline accessibilityLabel="Review details" />
      <PrimaryBtn label={busy ? "Submitting…" : "Submit review"} onPress={() => void submit()} disabled={busy} />
      <SecondaryBtn label="Cancel" onPress={() => setOpen(false)} disabled={busy} />
    </View>
  );
}

// ============================================================ REQUEST
function RequestDetail({ req, meId }: { req: AppointmentRequestView; meId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const scrollRef = useRef<ScrollView>(null);
  const isArtist = req.artistId === meId;
  const [busy, setBusy] = useState(false);
  const [reoffering, setReoffering] = useState(false);

  async function invalidate() {
    await qc.invalidateQueries({ queryKey: bookingKeys.request(req.id) });
    await qc.invalidateQueries({ queryKey: bookingKeys.clientRequests });
    await qc.invalidateQueries({ queryKey: bookingKeys.artistRequests });
    await qc.invalidateQueries({ queryKey: bookingKeys.appointments });
    await qc.invalidateQueries({ queryKey: ["notifications"] }); // refresh the "Booking requests" badge
  }

  // After sending an offer: confirm and scroll back to the top of the request.
  async function handleOfferSent() {
    await invalidate();
    toast.show("Offer sent");
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  // Client viewing a request with offer(s): clear the "new offer" badge.
  const offerIds = req.offers.map((o) => o.id).join(",");
  useEffect(() => {
    if (isArtist || !offerIds) return;
    void (async () => {
      await Promise.all(offerIds.split(",").map((oid) => markEntityNotificationsRead(supabase, "offer", oid)));
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    })();
  }, [isArtist, offerIds, qc]);

  // Client opening their own request marks it seen, dropping the open-request
  // badge (Requests tab + Upcoming "See all") by one.
  const markSeen = useMarkRequestSeen();
  useEffect(() => {
    if (!isArtist) markSeen(req.id);
  }, [isArtist, req.id, markSeen]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); await invalidate(); }
    catch (e) { toast.show((e as Error).message, "error"); }
    finally { setBusy(false); }
  }

  const router = useRouter();
  const latestOffer = req.offers[0];
  const pendingOffer = req.offers.find((o) => o.status === "pending");
  // Compose directly only before any offer has gone out (pending/reviewing).
  const freshOffer = isArtist && (req.status === "pending" || req.status === "reviewing");
  // An offer is out and awaiting the client — to change it, the artist withdraws
  // it first (behind a "Send a new offer" button + confirmation).
  const hasPendingOffer = isArtist && !!pendingOffer && req.status !== "converted";
  // After the client declined or the artist withdrew, they can propose a fresh one.
  const canReoffer = isArtist && !freshOffer && !pendingOffer
    && (latestOffer?.status === "declined" || latestOffer?.status === "withdrawn") && req.status !== "converted";

  // Replace a pending offer: confirm, withdraw it, then reveal the composer.
  function sendNewOffer() {
    void confirm({
      title: "Send a new offer?",
      message: "Withdraw the current offer to send a new one. The client won't be able to accept the current offer.",
      confirmLabel: "Withdraw",
      cancelLabel: "Cancel",
      destructive: true,
    }).then((ok) => {
      if (!ok) return;
      void run(async () => {
        if (pendingOffer) await withdrawOffer(supabase, pendingOffer.id);
        setReoffering(true);
      });
    });
  }
  // Header chip reconciles request + latest-offer status (cancelled/booked win
  // over the offer, so a cancelled request doesn't still read "Offer declined").
  const headerChip = requestChip(req);
  // The client can only cancel an in-flight request — not one that's already
  // resolved (converted/cancelled/declined) or whose offer they've declined.
  const clientCanCancel = !isArtist
    && req.status !== "converted" && req.status !== "cancelled" && req.status !== "declined"
    && latestOffer?.status !== "declined";

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={s.body}>
      <View style={s.partyRow}>
        <Avatar path={req.counterparty.avatarPath} name={req.counterparty.name} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={s.partyName}>{req.counterparty.name}</Text>
          <Text style={s.muted}>{isArtist ? "Client" : "Artist"}</Text>
        </View>
        {isArtist ? (
          <Pressable style={s.msgBtn} onPress={() => messageClient(router, toast, req.clientId)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Message client">
            <Ionicons name="chatbubble-outline" size={20} color="#18181B" />
          </Pressable>
        ) : null}
        <StatusChip status={headerChip.status} label={headerChip.label} />
      </View>

      <Text style={s.reqTitle}>{req.title}</Text>
      {req.description ? <Text style={s.reqBody}>{req.description}</Text> : null}

      <View style={s.tagRow}>
        {req.studioName ? <Tag text={`🏠 ${req.studioName}`} /> : null}
        {req.placement ? <Tag text={req.placement} /> : null}
        {req.approxSize ? <Tag text={req.approxSize} /> : null}
        {req.isColor != null ? <Tag text={req.isColor ? "Color" : "Black & grey"} /> : null}
        {req.preferredDate ? <Tag text={`Prefers ${fmtDate(req.preferredDate)}`} /> : null}
        {req.preferredTimeOfDay ? <Tag text={TIME_OF_DAY_LABEL[req.preferredTimeOfDay]} /> : null}
        {req.budgetMin || req.budgetMax ? <Tag text={`Budget ${money(req.budgetMin, "EUR")}–${money(req.budgetMax, "EUR")}`} /> : null}
      </View>

      {req.referencePaths.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.refs}>
          {req.referencePaths.map((p) => <SignedThumb key={p} path={p} />)}
        </ScrollView>
      )}

      {/* Offers */}
      {req.offers.length > 0 && <Text style={s.sectionTitle}>Offers</Text>}
      {req.offers.map((o) => (
        <OfferCard
          key={o.id}
          offer={o}
          isArtist={isArtist}
          busy={busy}
          onAccept={() => run(async () => {
            const apptId = await respondToOffer(supabase, o.id, true);
            if (apptId) router.replace(`/booking/${apptId}`);
          })}
          onDecline={() => run(async () => { await respondToOffer(supabase, o.id, false); })}
        />
      ))}

      {/* Artist: an offer is out — replace it by withdrawing first (keeps the
          composer hidden until they commit to sending a new one). */}
      {hasPendingOffer && !reoffering && (
        <PrimaryBtn label="Send a new offer" disabled={busy} onPress={sendNewOffer} />
      )}

      {/* Artist: make a new offer after a decline/withdrawal */}
      {canReoffer && !reoffering && (
        <PrimaryBtn label="Make a new offer" disabled={busy} onPress={() => setReoffering(true)} />
      )}

      {/* Artist: the offer composer (calendar + details) */}
      {(freshOffer || reoffering) && (
        <ArtistOfferComposer req={req} onSent={async () => { setReoffering(false); await handleOfferSent(); }} />
      )}

      {/* Artist decline */}
      {isArtist && (req.status === "pending" || req.status === "reviewing") && (
        <DangerBtn label="Decline request" disabled={busy} onPress={() => run(() => declineRequest(supabase, req.id))} />
      )}

      {/* Client cancel */}
      {clientCanCancel && (
        <DangerBtn label="Cancel request" disabled={busy} onPress={() => run(() => cancelRequest(supabase, req.id))} />
      )}
    </ScrollView>
  );
}

function OfferCard({ offer, isArtist, busy, onAccept, onDecline }: {
  offer: OfferView; isArtist: boolean; busy: boolean;
  onAccept: () => void; onDecline: () => void;
}) {
  const pending = offer.status === "pending";
  return (
    <View style={s.offerCard}>
      <View style={s.offerHead}>
        <Text style={s.offerPrice}>{money(offer.priceAmount, offer.currencyCode)}</Text>
        {!pending && <StatusChip status={offer.status} label={offer.status[0]!.toUpperCase() + offer.status.slice(1)} />}
      </View>
      {offer.proposedStart ? <Text style={s.offerLine}>🗓 {fmtDateTime(offer.proposedStart)}</Text> : null}
      {offer.message ? <Text style={s.offerMsg}>{offer.message}</Text> : null}
      {pending && !isArtist && (
        <View style={s.actions}>
          <PrimaryBtn label="Accept" onPress={onAccept} disabled={busy} />
          <SecondaryBtn label="Decline" onPress={onDecline} disabled={busy} />
        </View>
      )}
    </View>
  );
}

function ArtistOfferComposer({ req, onSent }: { req: AppointmentRequestView; onSent: () => Promise<void> }) {
  const toast = useToast();
  const [duration, setDuration] = useState(120);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<{ start: string; end: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!picked || !price) { toast.show("Pick a slot and enter a price to send your offer", "error"); return; }
    const budgetErr = offerBudgetError(Number(price), req.budgetMin, req.budgetMax);
    if (budgetErr) { toast.show(budgetErr, "error"); return; }
    setBusy(true);
    try {
      await createOffer(supabase, {
        requestId: req.id,
        proposedStart: picked.start,
        proposedEnd: picked.end,
        priceAmount: Number(price),
        message: message.trim() || null,
      });
      await onSent();
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.composer}>
      <Text style={s.sectionTitle}>Send an offer</Text>
      <Text style={s.label}>Session length</Text>
      <View style={s.chipWrap}>
        {DURATIONS.map((d) => (
          <Pressable key={d.minutes} style={[s.durChip, duration === d.minutes && s.durChipActive]} onPress={() => { setDuration(d.minutes); setPicked(null); }}>
            <Text style={[s.durChipText, duration === d.minutes && s.durChipTextActive]}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Propose a time</Text>
      {req.preferredDate || req.preferredTimeOfDay ? (
        <View style={s.preferBox}>
          <Ionicons name="calendar" size={16} color="#B45309" />
          <Text style={s.preferText}>
            Client prefers {[req.preferredDate ? fmtDate(req.preferredDate) : null, req.preferredTimeOfDay ? TIME_OF_DAY_LABEL[req.preferredTimeOfDay] : null].filter(Boolean).join(" · ")}
          </Text>
        </View>
      ) : null}
      <SlotPicker artistId={req.artistId} durationMinutes={duration} onPick={(start, end) => setPicked({ start, end })} selectedStart={picked?.start} preferredTimeOfDay={req.preferredTimeOfDay} />

      <Text style={s.label}>Price estimate (€)</Text>
      {req.budgetMin != null || req.budgetMax != null ? (
        <Text style={s.budgetHint}>Client&apos;s budget: {budgetRangeLabel(req.budgetMin, req.budgetMax)} — keep your offer within this range.</Text>
      ) : null}
      <TextInput style={s.input} keyboardType="number-pad" value={price} onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ""))} placeholder="0" />
      <Text style={s.priceNote}>An indicative quote — payment is arranged directly with the client, not through Inkora.</Text>
      <Text style={s.label}>Message</Text>
      <TextInput style={[s.input, s.multiline]} value={message} onChangeText={setMessage} placeholder="Anything the client should know" multiline />

      <PrimaryBtn label={busy ? "Sending…" : "Send offer"} onPress={send} disabled={busy} />
    </View>
  );
}

// ---------------------------------------------------------------- slot picker
function SlotPicker({ artistId, durationMinutes, onPick, onCancel, selectedStart, preferredTimeOfDay }: {
  artistId: string; durationMinutes: number;
  onPick: (start: string, end: string) => void; onCancel?: () => void; selectedStart?: string;
  preferredTimeOfDay?: TimeOfDay | null;
}) {
  const availabilityQ = useArtistAvailability(supabase, artistId);
  const enabledWeekdays = useMemo(() => Array.from(new Set((availabilityQ.data ?? []).map((a) => a.dayOfWeek))), [availabilityQ.data]);
  const [date, setDate] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const slotsQ = useArtistDaySlots(supabase, artistId, date ?? "", durationMinutes);

  const allSlots = slotsQ.data ?? [];
  const filtering = !!preferredTimeOfDay && !showAll;
  const slots = filtering ? allSlots.filter((iso) => slotMatchesTimeOfDay(iso, preferredTimeOfDay)) : allSlots;

  return (
    <View style={s.slotPicker}>
      <MonthCalendar selected={date} onSelect={setDate} enabledWeekdays={enabledWeekdays.length ? enabledWeekdays : undefined} />
      {preferredTimeOfDay && date ? (
        <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={6} accessibilityRole="button">
          <Text style={s.slotFilterNote}>
            {showAll ? `Showing all times · Show ${TIME_OF_DAY_LABEL[preferredTimeOfDay]} only` : `Client prefers ${TIME_OF_DAY_LABEL[preferredTimeOfDay]} · Show all times`}
          </Text>
        </Pressable>
      ) : null}
      {date && (
        slotsQ.isLoading ? <ActivityIndicator style={{ marginTop: 8 }} /> :
        slots.length === 0 ? (
          <Text style={s.muted}>
            {filtering && allSlots.length > 0 ? `No ${TIME_OF_DAY_LABEL[preferredTimeOfDay!].toLowerCase()} slots that day — tap above to show all.` : "No open slots that day."}
          </Text>
        ) :
        <View style={s.chipWrap}>
          {slots.map((iso) => {
            const end = new Date(new Date(iso).getTime() + durationMinutes * 60000).toISOString();
            const active = selectedStart === iso;
            return (
              <Pressable key={iso} style={[s.slotChip, active && s.slotChipActive]} onPress={() => onPick(iso, end)}>
                <Text style={[s.slotChipText, active && s.slotChipTextActive]}>{fmtTime(iso)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {onCancel && <SecondaryBtn label="Cancel" onPress={onCancel} />}
    </View>
  );
}

// ---------------------------------------------------------------- small bits
function InfoRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={18} color="#71717A" />
      <Text style={s.infoText}>{label}</Text>
    </View>
  );
}
function Tag({ text }: { text: string }) {
  return <View style={s.tag}><Text style={s.tagText}>{text}</Text></View>;
}
function SignedThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string>();
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    let ok = true;
    void getChatSignedUrl(supabase, path).then((u) => ok && setUrl(u ?? undefined));
    return () => { ok = false; };
  }, [path]);
  if (!url) return <View style={[s.thumb, { backgroundColor: "#E4E4E7" }]} />;
  return (
    <>
      <Pressable onPress={() => setZoom(true)} accessibilityRole="imagebutton" accessibilityLabel="View reference photo">
        <Image source={{ uri: url }} style={s.thumb} contentFit="cover" />
      </Pressable>
      <ImageZoomModal visible={zoom} uri={url} onClose={() => setZoom(false)} label="Reference photo" />
    </>
  );
}
function PrimaryBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[s.primary, disabled && s.disabled]} disabled={disabled} onPress={onPress}><Text style={s.primaryText}>{label}</Text></Pressable>;
}
function SecondaryBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[s.secondary, disabled && s.disabled]} disabled={disabled} onPress={onPress}><Text style={s.secondaryText}>{label}</Text></Pressable>;
}
function DangerBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[s.danger, disabled && s.disabled]} disabled={disabled} onPress={onPress}><Text style={s.dangerText}>{label}</Text></Pressable>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  muted: { color: "#A1A1AA" },
  flex1: { flex: 1 },
  partyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  partyPerson: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  msgBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  partyName: { fontSize: 18, fontWeight: "800" },
  infoCard: { backgroundColor: "#F9FAFB", borderRadius: 16, padding: 14, gap: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 15, fontWeight: "600", color: "#18181B" },
  briefHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  briefLabel: { fontSize: 12, fontWeight: "800", color: "#71717A", letterSpacing: 0.6, textTransform: "uppercase" },
  briefTitle: { fontSize: 17, fontWeight: "800", color: "#18181B" },
  reqTitle: { fontSize: 20, fontWeight: "800" },
  reqBody: { fontSize: 15, color: "#3F3F46", lineHeight: 21 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { backgroundColor: "#F4F4F5", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontWeight: "600", color: "#52525B", fontSize: 13 },
  refs: { gap: 8, paddingVertical: 4 },
  thumb: { width: 96, height: 96, borderRadius: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginTop: 6 },
  offerCard: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 16, padding: 14, gap: 6 },
  offerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  offerPrice: { fontSize: 20, fontWeight: "800", color: "#18181B" },
  offerLine: { fontSize: 14, color: "#3F3F46" },
  offerMsg: { fontSize: 14, color: "#3F3F46", fontStyle: "italic", marginTop: 4 },
  composer: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 16, padding: 14, gap: 8 },
  label: { fontWeight: "700", fontSize: 13, color: "#52525B", marginTop: 8 },
  priceNote: { color: "#A1A1AA", fontSize: 12, marginTop: 4 },
  budgetHint: { color: "#B45309", fontSize: 12, marginTop: 4, fontWeight: "600" },
  slotFilterNote: { color: "#B45309", fontSize: 12, fontWeight: "700", marginTop: 8 },
  preferBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6, marginBottom: 2 },
  preferText: { flex: 1, color: "#92400E", fontWeight: "700", fontSize: 14 },
  input: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginTop: 4 },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  durChip: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  durChipActive: { backgroundColor: "#18181B", borderColor: "#18181B" },
  durChipText: { fontWeight: "700", color: "#18181B", fontSize: 13 },
  durChipTextActive: { color: "#fff" },
  slotPicker: { borderTopWidth: 1, borderTopColor: "#F4F4F5", paddingTop: 8, gap: 6 },
  slotChip: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  slotChipActive: { backgroundColor: "#E5484D", borderColor: "#E5484D" },
  slotChipText: { fontWeight: "700", color: "#18181B" },
  slotChipTextActive: { color: "#fff" },
  notice: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 12, backgroundColor: "#FEF3C7" },
  noticeWarn: { backgroundColor: "#FEE2E2" },
  noticeText: { flex: 1, color: "#92400E", fontSize: 13, lineHeight: 18 },
  noticeTextWarn: { color: "#B91C1C" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  reviewDone: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12, marginTop: 4 },
  reviewDoneText: { color: "#166534", fontWeight: "700" },
  reviewForm: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, padding: 14, gap: 10, marginTop: 4 },
  reviewFormTitle: { fontSize: 15, fontWeight: "800" },
  starsRow: { flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 4 },
  reviewInput: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  reviewMultiline: { minHeight: 80, textAlignVertical: "top" },
  primary: { flex: 1, minWidth: 120, backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondary: { flex: 1, minWidth: 120, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  secondaryText: { color: "#18181B", fontWeight: "700", fontSize: 15 },
  danger: { flex: 1, minWidth: 120, borderWidth: 1, borderColor: "#FECACA", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  dangerText: { color: "#DC2626", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.4 },
});
