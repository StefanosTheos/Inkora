import type { AppointmentId, ArtistId, BookingJourney, JourneyMilestone, MilestoneKind } from "@inkora/domain";
import { useQuery } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

const KIND_ORDER: Record<string, number> = { post_session: 1, week: 2, month: 3 };

interface JourneyRow {
  id: string;
  artist_id: string | null;
  scheduled_start: string;
  status: string;
  artists: { profiles: { display_name: string } | null } | null;
  reviews: { id: string }[] | { id: string } | null;
  journey_milestones: { kind: string; due_at: string; photo_path: string | null; completed_at: string | null }[] | null;
}

export const journeyKeys = {
  bookings: ["booking-journeys"] as const,
};

/** Every booking of the current seeker, with its derived stage + milestones. */
export async function getBookingJourneys(client: InkoraClient): Promise<BookingJourney[]> {
  const { data: userRes } = await client.auth.getUser();
  const me = userRes.user?.id;
  if (!me) return [];

  const { data, error } = await client
    .from("appointments")
    .select("id, artist_id, scheduled_start, status, artists(profiles(display_name)), reviews(id), journey_milestones(kind, due_at, photo_path, completed_at)")
    .eq("client_id", me)
    .order("scheduled_start", { ascending: false })
    .returns<JourneyRow[]>();
  if (error) throw toAppError(error);

  const now = Date.now();
  return (data ?? []).map((r) => {
    const rev = r.reviews;
    const hasReview = Array.isArray(rev) ? rev.length > 0 : rev != null;

    const milestones: JourneyMilestone[] = (r.journey_milestones ?? [])
      .map((m) => {
        const completed = m.completed_at != null;
        return {
          kind: m.kind as MilestoneKind,
          dueAt: m.due_at,
          photoPath: m.photo_path,
          completed,
          due: !completed && new Date(m.due_at).getTime() <= now,
        };
      })
      .sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9));

    const allDone = milestones.length > 0 && milestones.every((m) => m.completed);
    // Idea + Consult are reached once a booking exists (index 1); Session on
    // completion (2); Healing once reviewed (3); Done once reviewed + all
    // healing photos posted (4).
    let stageIndex = 1;
    if (r.status === "completed") stageIndex = 2;
    if (hasReview) stageIndex = 3;
    if (hasReview && allDone) stageIndex = 4;

    return {
      appointmentId: r.id as AppointmentId,
      artistId: (r.artist_id as ArtistId | null) ?? null,
      artistName: r.artists?.profiles?.display_name ?? "Artist",
      scheduledStart: r.scheduled_start,
      status: r.status,
      hasReview,
      stageIndex,
      milestones,
      dueCount: milestones.filter((m) => m.due).length,
    };
  });
}

/** Upload a healing photo for a milestone; mirrors onto the review + awards points. */
export async function uploadJourneyPhoto(
  client: InkoraClient, appointmentId: string, kind: MilestoneKind, uploaderId: string,
  body: ArrayBuffer | Blob, contentType: string, ext: string,
): Promise<string> {
  const key = `${uploaderId}/${appointmentId}/${kind}-${Date.now()}.${ext}`; // folder must be the uid (storage RLS)
  const { error: upErr } = await client.storage.from("journey-photos").upload(key, body, { contentType, upsert: true });
  if (upErr) throw toAppError(upErr);
  const path = `journey-photos/${key}`; // bucket-prefixed so imageUrl() resolves it
  const { error } = await client.rpc("complete_journey_milestone", {
    p_appointment_id: appointmentId, p_kind: kind, p_photo_path: path,
  });
  if (error) throw toAppError(error);
  return path;
}

export function useBookingJourneys(client: InkoraClient) {
  return useQuery({ queryKey: journeyKeys.bookings, queryFn: () => getBookingJourneys(client) });
}
