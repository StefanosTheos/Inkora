import type {
  AppointmentId, AppointmentRequestId, AppointmentRequestView, AppointmentView, ArtistId,
  BookingRequestInput, ClientReviewInput, ConversationId, CounterpartyRef, OfferInput, OfferView,
  ProfileId, StudioId, TimeOfDay,
} from "@inkora/domain";
import { useQuery } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";
import { sendMessage, startDirectConversation } from "../messaging";
import { markEntityNotificationsRead } from "../notifications";

const BOOKING_BUCKET = "chat-attachments"; // reference photos reuse the private attachments bucket

// ------------------------------------------------------------------ date range helpers
function addDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
}
/** Parse the lower bound out of a Postgres daterange literal like "[2026-07-10,2026-07-11)". */
function firstDate(ranges: string[] | null): string | null {
  const m = (ranges?.[0] ?? "").match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

// ------------------------------------------------------------------ row shapes
interface OfferRow {
  id: string; request_id: string; artist_id: string;
  proposed_start: string | null; proposed_end: string | null;
  price_amount: number; deposit_amount: number | null; currency_code: string;
  message: string | null; status: string; expires_at: string | null; created_at: string;
}
interface ReqRow {
  id: string; client_id: string; artist_id: string; studio_id: string | null;
  title: string; description: string | null; placement: string | null; approx_size: string | null;
  is_color: boolean | null; budget_min: number | null; budget_max: number | null;
  preferred_dates: string[] | null; preferred_time_of_day: string | null; reference_paths: string[] | null;
  status: string; created_at: string;
  client: { id: string; display_name: string; avatar_path: string | null } | null;
  artist: { id: string; profiles: { display_name: string; avatar_path: string | null } | null } | null;
  studio: { name: string } | null;
  offers: OfferRow[] | null;
}
interface ApptRow {
  id: string; request_id: string | null; client_id: string; artist_id: string; studio_id: string | null;
  scheduled_start: string; scheduled_end: string; status: string;
  price_amount: number | null; deposit_amount: number | null; deposit_paid: boolean;
  location_note: string | null; notes: string | null; cancellation_reason: string | null;
  reschedule_status: string | null; reschedule_start: string | null; reschedule_end: string | null; reschedule_by: string | null;
  client: { id: string; display_name: string; avatar_path: string | null } | null;
  artist: { id: string; profiles: { display_name: string; avatar_path: string | null } | null } | null;
  studio: { name: string } | null;
}

const REQ_SELECT =
  "id, client_id, artist_id, studio_id, title, description, placement, approx_size, is_color, budget_min, budget_max, preferred_dates, preferred_time_of_day, reference_paths, status, created_at, " +
  "client:profiles!appointment_requests_client_id_fkey(id, display_name, avatar_path), " +
  "artist:artists!appointment_requests_artist_id_fkey(id, profiles!inner(display_name, avatar_path)), " +
  "studio:studios(name), " +
  "offers(id, request_id, artist_id, proposed_start, proposed_end, price_amount, deposit_amount, currency_code, message, status, expires_at, created_at)";

const APPT_SELECT =
  "id, request_id, client_id, artist_id, studio_id, scheduled_start, scheduled_end, status, price_amount, deposit_amount, deposit_paid, location_note, notes, cancellation_reason, " +
  "reschedule_status, reschedule_start, reschedule_end, reschedule_by, " +
  "client:profiles!appointments_client_id_fkey(id, display_name, avatar_path), " +
  "artist:artists!appointments_artist_id_fkey(id, profiles!inner(display_name, avatar_path)), " +
  "studio:studios(name)";

// ------------------------------------------------------------------ mapping
function mapOffer(o: OfferRow): OfferView {
  return {
    id: o.id as OfferView["id"],
    requestId: o.request_id as AppointmentRequestId,
    artistId: o.artist_id as ArtistId,
    proposedStart: o.proposed_start,
    proposedEnd: o.proposed_end,
    priceAmount: Number(o.price_amount),
    depositAmount: o.deposit_amount == null ? null : Number(o.deposit_amount),
    currencyCode: o.currency_code,
    message: o.message,
    status: o.status as OfferView["status"],
    expiresAt: o.expires_at,
    createdAt: o.created_at,
  };
}
function counterparty(row: ReqRow | ApptRow, meId: string): CounterpartyRef {
  const iAmClient = row.client_id === meId;
  if (iAmClient) {
    return {
      id: row.artist_id as ProfileId,
      name: row.artist?.profiles?.display_name ?? "Artist",
      avatarPath: row.artist?.profiles?.avatar_path ?? null,
    };
  }
  return {
    id: row.client_id as ProfileId,
    name: row.client?.display_name ?? "Client",
    avatarPath: row.client?.avatar_path ?? null,
  };
}
function mapReq(row: ReqRow, meId: string): AppointmentRequestView {
  return {
    id: row.id as AppointmentRequestId,
    clientId: row.client_id as ProfileId,
    artistId: row.artist_id as ArtistId,
    studioId: (row.studio_id as StudioId | null) ?? null,
    studioName: row.studio?.name ?? null,
    counterparty: counterparty(row, meId),
    title: row.title,
    description: row.description,
    placement: row.placement,
    approxSize: row.approx_size,
    isColor: row.is_color,
    budgetMin: row.budget_min == null ? null : Number(row.budget_min),
    budgetMax: row.budget_max == null ? null : Number(row.budget_max),
    preferredDate: firstDate(row.preferred_dates),
    preferredTimeOfDay: (row.preferred_time_of_day as TimeOfDay | null) ?? null,
    referencePaths: row.reference_paths ?? [],
    status: row.status as AppointmentRequestView["status"],
    createdAt: row.created_at,
    offers: (row.offers ?? []).map(mapOffer).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
function mapAppt(row: ApptRow, meId: string): AppointmentView {
  return {
    id: row.id as AppointmentId,
    requestId: (row.request_id as AppointmentRequestId | null) ?? null,
    clientId: row.client_id as ProfileId,
    artistId: row.artist_id as ArtistId,
    studioId: (row.studio_id as StudioId | null) ?? null,
    studioName: row.studio?.name ?? null,
    counterparty: counterparty(row, meId),
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    status: row.status as AppointmentView["status"],
    priceAmount: row.price_amount == null ? null : Number(row.price_amount),
    depositAmount: row.deposit_amount == null ? null : Number(row.deposit_amount),
    depositPaid: row.deposit_paid,
    locationNote: row.location_note,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    rescheduleStatus: (row.reschedule_status as AppointmentView["rescheduleStatus"] | null) ?? "none",
    rescheduleStart: row.reschedule_start,
    rescheduleEnd: row.reschedule_end,
    rescheduleBy: (row.reschedule_by as ProfileId | null) ?? null,
  };
}

async function meId(client: InkoraClient): Promise<string> {
  const { data } = await client.auth.getUser();
  const id = data.user?.id;
  if (!id) throw toAppError({ message: "unauthenticated" });
  return id;
}

// ------------------------------------------------------------------ requests
export async function createBookingRequest(
  client: InkoraClient, input: BookingRequestInput,
): Promise<{ id: AppointmentRequestId; conversationId: ConversationId }> {
  const me = await meId(client);
  // Every request opens (or reuses) a direct chat with the artist and drops a
  // snapshot card there, so the request lives in the conversation too.
  const conversationId = await startDirectConversation(client, input.artistId);
  const preferred = input.preferredDate ? [`[${input.preferredDate},${addDay(input.preferredDate)})`] : [];
  const { data, error } = await client
    .from("appointment_requests")
    .insert({
      client_id: me,
      artist_id: input.artistId,
      studio_id: input.studioId ?? null,
      conversation_id: conversationId,
      idea_id: input.ideaId ?? null,
      title: input.title,
      description: input.description ?? null,
      placement: input.placement ?? null,
      approx_size: input.approxSize ?? null,
      is_color: input.isColor ?? null,
      budget_min: input.budgetMin ?? null,
      budget_max: input.budgetMax ?? null,
      preferred_dates: preferred,
      preferred_time_of_day: input.preferredTimeOfDay ?? null,
      reference_paths: input.referencePaths ?? [],
    })
    .select("id")
    .single();
  if (error) throw toAppError(error);
  const requestId = data.id as AppointmentRequestId;

  await sendMessage(client, conversationId, me, {
    type: "booking_card",
    body: `📩 Booking request: ${input.title}`,
    metadata: {
      kind: "booking_request",
      requestId,
      artistId: input.artistId,
      title: input.title,
      placement: input.placement ?? null,
      size: input.approxSize ?? null,
      isColor: input.isColor ?? null,
      preferredDate: input.preferredDate ?? null,
      preferredTimeOfDay: input.preferredTimeOfDay ?? null,
      budgetMin: input.budgetMin ?? null,
      budgetMax: input.budgetMax ?? null,
    },
  });

  return { id: requestId, conversationId };
}

export async function listMyRequests(client: InkoraClient, role: "client" | "artist"): Promise<AppointmentRequestView[]> {
  const me = await meId(client);
  const col = role === "client" ? "client_id" : "artist_id";
  const { data, error } = await client
    .from("appointment_requests")
    .select(REQ_SELECT)
    .eq(col, me)
    .order("created_at", { ascending: false })
    .returns<ReqRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => mapReq(r, me));
}

export async function getBookingRequest(client: InkoraClient, id: string): Promise<AppointmentRequestView | null> {
  const me = await meId(client);
  const { data, error } = await client.from("appointment_requests").select(REQ_SELECT).eq("id", id).maybeSingle<ReqRow>();
  if (error) throw toAppError(error);
  return data ? mapReq(data, me) : null;
}

/** Artist marks a request declined (party update policy allows this). */
export async function declineRequest(client: InkoraClient, id: string): Promise<void> {
  const { error } = await client.from("appointment_requests").update({ status: "declined" }).eq("id", id);
  if (error) throw toAppError(error);
  // Answering the request clears its "new" badge.
  await markEntityNotificationsRead(client, "appointment_request", id);
}

export async function cancelRequest(client: InkoraClient, id: string): Promise<void> {
  const { error } = await client.from("appointment_requests").update({ status: "cancelled" }).eq("id", id);
  if (error) throw toAppError(error);
}

// ------------------------------------------------------------------ offers
export async function createOffer(client: InkoraClient, input: OfferInput): Promise<void> {
  const me = await meId(client);
  const { data: offerRow, error } = await client.from("offers").insert({
    request_id: input.requestId,
    artist_id: me,
    proposed_start: input.proposedStart,
    proposed_end: input.proposedEnd,
    price_amount: input.priceAmount,
    deposit_amount: input.depositAmount ?? null,
    currency_code: input.currencyCode ?? "EUR",
    message: input.message ?? null,
    expires_at: input.expiresAt ?? null,
  }).select("id").single();
  if (error) throw toAppError(error);
  // move the request into "offered" so the client sees it's answered
  await client.from("appointment_requests").update({ status: "offered" }).eq("id", input.requestId);
  // Sending an offer answers the request — clear its "new" badge.
  await markEntityNotificationsRead(client, "appointment_request", input.requestId);

  // Post an offer snapshot into the request's chat so the client sees it there.
  const { data: reqRow } = await client
    .from("appointment_requests").select("conversation_id").eq("id", input.requestId)
    .maybeSingle<{ conversation_id: string | null }>();
  if (reqRow?.conversation_id) {
    await sendMessage(client, reqRow.conversation_id, me, {
      type: "booking_card",
      body: "🏷️ Offer sent",
      metadata: {
        kind: "offer",
        offerId: offerRow.id,
        requestId: input.requestId,
        artistId: me,
        proposedStart: input.proposedStart,
        priceAmount: input.priceAmount,
        currencyCode: input.currencyCode ?? "EUR",
        message: input.message ?? null,
      },
    });
  }
}

export async function getOfferStatus(client: InkoraClient, offerId: string): Promise<string | null> {
  const { data, error } = await client.from("offers").select("status").eq("id", offerId).maybeSingle<{ status: string }>();
  if (error) throw toAppError(error);
  return data?.status ?? null;
}
export function useOfferStatus(client: InkoraClient, offerId: string) {
  return useQuery({ queryKey: ["offer-status", offerId], queryFn: () => getOfferStatus(client, offerId), enabled: !!offerId });
}

export async function withdrawOffer(client: InkoraClient, offerId: string): Promise<void> {
  const { error } = await client.from("offers").update({ status: "withdrawn" }).eq("id", offerId);
  if (error) throw toAppError(error);
}

/** Client accepts/declines. Returns the new appointment id on accept. */
export async function respondToOffer(client: InkoraClient, offerId: string, accept: boolean): Promise<string | null> {
  const { data, error } = await client.rpc("respond_offer", { p_offer_id: offerId, p_accept: accept });
  if (error) throw toAppError(error);
  const appointmentId = (data as string | null) ?? null;

  // On accept, drop a "booking confirmed" snapshot into the chat (best effort).
  if (accept && appointmentId) {
    try {
      const me = await meId(client);
      const { data: off } = await client.from("offers").select("request_id").eq("id", offerId).maybeSingle<{ request_id: string }>();
      const reqId = off?.request_id;
      const { data: req } = reqId
        ? await client.from("appointment_requests").select("conversation_id").eq("id", reqId).maybeSingle<{ conversation_id: string | null }>()
        : { data: null };
      const { data: appt } = await client.from("appointments").select("scheduled_start, price_amount").eq("id", appointmentId).maybeSingle<{ scheduled_start: string; price_amount: number | null }>();
      if (req?.conversation_id) {
        await sendMessage(client, req.conversation_id, me, {
          type: "booking_card",
          body: "✅ Booking confirmed",
          metadata: {
            kind: "appointment",
            appointmentId,
            proposedStart: appt?.scheduled_start ?? null,
            priceAmount: appt?.price_amount ?? null,
            currencyCode: "EUR",
          },
        });
      }
    } catch { /* the confirmation card is best-effort; never fail the accept */ }
  }
  return appointmentId;
}

// ------------------------------------------------------------------ appointments
export async function listMyAppointments(client: InkoraClient): Promise<AppointmentView[]> {
  const me = await meId(client);
  const { data, error } = await client
    .from("appointments")
    .select(APPT_SELECT)
    .order("scheduled_start", { ascending: true })
    .limit(200)
    .returns<ApptRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => mapAppt(r, me));
}

/** Dashboard view: only future scheduled/rescheduled appointments, filtered + capped server-side. */
export async function listUpcomingAppointments(client: InkoraClient, limit = 3): Promise<AppointmentView[]> {
  const me = await meId(client);
  const { data, error } = await client
    .from("appointments")
    .select(APPT_SELECT)
    .in("status", ["scheduled", "rescheduled"])
    .gte("scheduled_start", new Date().toISOString())
    .order("scheduled_start", { ascending: true })
    .limit(limit)
    .returns<ApptRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => mapAppt(r, me));
}

/** Total appointment count for the current user (RLS-scoped) — head-only, no rows transferred. */
export async function countMyAppointments(client: InkoraClient): Promise<number> {
  const { count, error } = await client.from("appointments").select("id", { count: "exact", head: true });
  if (error) throw toAppError(error);
  return count ?? 0;
}

export async function getAppointment(client: InkoraClient, id: string): Promise<AppointmentView | null> {
  const me = await meId(client);
  const { data, error } = await client.from("appointments").select(APPT_SELECT).eq("id", id).maybeSingle<ApptRow>();
  if (error) throw toAppError(error);
  return data ? mapAppt(data, me) : null;
}

// ------------------------------------------------------------------ reviews (post-booking)
export interface AppointmentReview {
  id: string;
  overallRating: number;
}
export interface ReviewInput {
  appointmentId: string;
  artistId: string;
  rating: number;
  title?: string;
  body?: string;
}

/** The current user's review for an appointment, if they've left one. */
export async function getAppointmentReview(client: InkoraClient, appointmentId: string): Promise<AppointmentReview | null> {
  const { data, error } = await client
    .from("reviews")
    .select("id, overall_rating")
    .eq("appointment_id", appointmentId)
    .maybeSingle<{ id: string; overall_rating: number }>();
  if (error) throw toAppError(error);
  return data ? { id: data.id, overallRating: data.overall_rating } : null;
}

/** Leave a review. Only possible for a real appointment (reviews.appointment_id
 *  is NOT NULL + UNIQUE), so the "one review per completed booking" rule is
 *  enforced by the schema; the UI only surfaces this on completed appointments. */
export async function submitReview(client: InkoraClient, input: ReviewInput): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw toAppError(new Error("You need to sign in to leave a review."));
  const { error } = await client.from("reviews").insert({
    appointment_id: input.appointmentId,
    author_id: uid,
    artist_id: input.artistId,
    overall_rating: input.rating,
    title: input.title ?? null,
    body: input.body ?? null,
  });
  if (error) throw toAppError(error);
}

// ------------------------------------------------------------------ client reviews (artist -> client)
export interface AppointmentClientReview {
  id: string;
  overall: number;
}

/** The current artist's review of the client for an appointment, if left. */
export async function getAppointmentClientReview(client: InkoraClient, appointmentId: string): Promise<AppointmentClientReview | null> {
  const { data, error } = await client
    .from("client_reviews")
    .select("id, overall")
    .eq("appointment_id", appointmentId)
    .maybeSingle<{ id: string; overall: number }>();
  if (error) throw toAppError(error);
  return data ? { id: data.id, overall: data.overall } : null;
}

/** Artist reviews a client after a completed session. One row per appointment
 *  (client_reviews.appointment_id is NOT NULL + UNIQUE); the UI only surfaces
 *  this on completed appointments for the artist. `overall` is derived in the DB. */
export async function submitClientReview(client: InkoraClient, input: ClientReviewInput): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw toAppError(new Error("You need to sign in to leave a review."));
  const { error } = await client.from("client_reviews").insert({
    appointment_id: input.appointmentId,
    author_id: uid,
    client_id: input.clientId,
    punctuality: input.punctuality,
    communication: input.communication,
    preparedness: input.preparedness,
    sat_well: input.satWell,
    respect: input.respect,
    comment: input.comment ?? null,
  });
  if (error) throw toAppError(error);
}

export async function cancelAppointment(client: InkoraClient, id: string, reason?: string): Promise<void> {
  const { error } = await client
    .from("appointments")
    .update({
      status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason ?? null,
      // clear any pending reschedule so a cancelled booking can't show as "pending reply"
      reschedule_status: "none", reschedule_start: null, reschedule_end: null, reschedule_by: null,
    })
    .eq("id", id);
  if (error) throw toAppError(error);
}

// Propose (or counter) a new time. The other party must approve before the
// scheduled time actually moves (see propose_reschedule / accept_reschedule).
// Notifies the other party (RPC) and drops a tappable card into the chat.
export async function proposeReschedule(client: InkoraClient, id: string, start: string, end: string): Promise<void> {
  const { error } = await client.rpc("propose_reschedule", { p_appointment_id: id, p_start: start, p_end: end });
  if (error) throw toAppError(error);

  try {
    const me = await meId(client);
    const { data: appt } = await client
      .from("appointments").select("request_id").eq("id", id)
      .maybeSingle<{ request_id: string | null }>();
    const reqId = appt?.request_id;
    const { data: req } = reqId
      ? await client.from("appointment_requests").select("conversation_id").eq("id", reqId).maybeSingle<{ conversation_id: string | null }>()
      : { data: null };
    if (req?.conversation_id) {
      await sendMessage(client, req.conversation_id, me, {
        type: "booking_card",
        body: "🔁 Reschedule requested",
        metadata: { kind: "reschedule", appointmentId: id, proposedStart: start, proposedEnd: end },
      });
    }
  } catch { /* the reschedule card is best-effort; never fail the proposal */ }
}

/** Decline/withdraw the pending reschedule — clears it and KEEPS the original time. */
export async function declineReschedule(client: InkoraClient, id: string): Promise<void> {
  const { error } = await client.rpc("decline_reschedule", { p_appointment_id: id });
  if (error) throw toAppError(error);
}

/** Accept the pending reschedule proposal (moves the appointment to the new time). */
export async function acceptReschedule(client: InkoraClient, id: string): Promise<void> {
  const { error } = await client.rpc("accept_reschedule", { p_appointment_id: id });
  if (error) throw toAppError(error);

  // Confirm in the chat so both parties see the new time is locked in.
  try {
    const me = await meId(client);
    const { data: appt } = await client
      .from("appointments").select("request_id, scheduled_start").eq("id", id)
      .maybeSingle<{ request_id: string | null; scheduled_start: string }>();
    const reqId = appt?.request_id;
    const { data: req } = reqId
      ? await client.from("appointment_requests").select("conversation_id").eq("id", reqId).maybeSingle<{ conversation_id: string | null }>()
      : { data: null };
    if (req?.conversation_id) {
      await sendMessage(client, req.conversation_id, me, {
        type: "booking_card",
        body: "✅ Reschedule accepted",
        metadata: { kind: "reschedule_accepted", appointmentId: id, proposedStart: appt?.scheduled_start ?? null },
      });
    }
  } catch { /* the confirmation card is best-effort; never fail the acceptance */ }
}

export async function completeAppointment(client: InkoraClient, id: string): Promise<void> {
  const { error } = await client
    .from("appointments")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw toAppError(error);

  // Drop a "completed" snapshot into the chat so both parties see it (best effort).
  try {
    const me = await meId(client);
    const { data: appt } = await client
      .from("appointments").select("request_id, scheduled_start").eq("id", id)
      .maybeSingle<{ request_id: string | null; scheduled_start: string }>();
    const reqId = appt?.request_id;
    const { data: req } = reqId
      ? await client.from("appointment_requests").select("conversation_id").eq("id", reqId).maybeSingle<{ conversation_id: string | null }>()
      : { data: null };
    if (req?.conversation_id) {
      await sendMessage(client, req.conversation_id, me, {
        type: "booking_card",
        body: "🎉 Appointment completed",
        metadata: { kind: "completed", appointmentId: id, proposedStart: appt?.scheduled_start ?? null },
      });
    }
  } catch { /* the completed card is best-effort; never fail the completion */ }
}

// ------------------------------------------------------------------ open slots
export async function getArtistDaySlots(client: InkoraClient, artistId: string, date: string, slotMinutes = 60): Promise<string[]> {
  const { data, error } = await client.rpc("artist_day_slots", { p_artist: artistId, p_date: date, p_slot_minutes: slotMinutes });
  if (error) throw toAppError(error);
  return (data as string[] | null) ?? [];
}

// ------------------------------------------------------------------ reference uploads
// Path is keyed by the uploader (the seeker) so storage RLS can verify
// ownership: `requests/<uploaderId>/<file>`. The assigned artist gets read
// access via the booking_ref_read policy (matches reference_paths).
export async function uploadBookingReference(client: InkoraClient, uploaderId: string, body: ArrayBuffer | Blob, contentType: string, ext: string): Promise<string> {
  const path = `requests/${uploaderId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const { error } = await client.storage.from(BOOKING_BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw toAppError(error);
  return path;
}

// ------------------------------------------------------------------ hooks
export const bookingKeys = {
  clientRequests: ["requests", "client"] as const,
  artistRequests: ["requests", "artist"] as const,
  request: (id: string) => ["request", id] as const,
  appointments: ["appointments"] as const,
  upcoming: (limit: number) => ["appointments", "upcoming", limit] as const,
  appointmentCount: ["appointments", "count"] as const,
  appointment: (id: string) => ["appointment", id] as const,
  review: (appointmentId: string) => ["appointment-review", appointmentId] as const,
  clientReview: (appointmentId: string) => ["appointment-client-review", appointmentId] as const,
  // slotMinutes is part of the key: open start-times depend on the session
  // length (a slot must fit before the artist's day ends), so changing the
  // duration must refetch rather than reuse the previous length's slots.
  daySlots: (artistId: string, date: string, slotMinutes: number) => ["day-slots", artistId, date, slotMinutes] as const,
};

export function useMyRequests(client: InkoraClient, role: "client" | "artist") {
  return useQuery({ queryKey: role === "client" ? bookingKeys.clientRequests : bookingKeys.artistRequests, queryFn: () => listMyRequests(client, role) });
}
export function useBookingRequest(client: InkoraClient, id: string) {
  return useQuery({ queryKey: bookingKeys.request(id), queryFn: () => getBookingRequest(client, id), enabled: !!id });
}
export function useMyAppointments(client: InkoraClient) {
  return useQuery({ queryKey: bookingKeys.appointments, queryFn: () => listMyAppointments(client) });
}
export function useUpcomingAppointments(client: InkoraClient, limit = 3) {
  return useQuery({ queryKey: bookingKeys.upcoming(limit), queryFn: () => listUpcomingAppointments(client, limit) });
}
export function useMyAppointmentCount(client: InkoraClient) {
  return useQuery({ queryKey: bookingKeys.appointmentCount, queryFn: () => countMyAppointments(client) });
}
export function useAppointment(client: InkoraClient, id: string) {
  return useQuery({ queryKey: bookingKeys.appointment(id), queryFn: () => getAppointment(client, id), enabled: !!id });
}
export function useAppointmentReview(client: InkoraClient, appointmentId: string, enabled = true) {
  return useQuery({
    queryKey: bookingKeys.review(appointmentId),
    queryFn: () => getAppointmentReview(client, appointmentId),
    enabled: enabled && !!appointmentId,
  });
}
export function useAppointmentClientReview(client: InkoraClient, appointmentId: string, enabled = true) {
  return useQuery({
    queryKey: bookingKeys.clientReview(appointmentId),
    queryFn: () => getAppointmentClientReview(client, appointmentId),
    enabled: enabled && !!appointmentId,
  });
}
export function useArtistDaySlots(client: InkoraClient, artistId: string, date: string, slotMinutes = 60) {
  return useQuery({ queryKey: bookingKeys.daySlots(artistId, date, slotMinutes), queryFn: () => getArtistDaySlots(client, artistId, date, slotMinutes), enabled: !!artistId && !!date });
}
