import type { JourneyEntryType } from "../enums";
import type { AppointmentId, ArtistId, IdeaId, JourneyEntryId, ProfileId } from "../ids";

/** Private, user-owned tattoo timeline (idea → consultation → healing → milestone). */
export interface JourneyEntry {
  id: JourneyEntryId;
  profileId: ProfileId;
  appointmentId: AppointmentId | null;
  artistId: ArtistId | null;
  ideaId: IdeaId | null;
  entryType: JourneyEntryType;
  title: string | null;
  notes: string | null;
  imagePaths: string[];
  occurredOn: string;
}

/** Ordered progress stages for the journey tracker (milestone is a side note). */
export const JOURNEY_STAGES: JourneyEntryType[] = ["idea", "consultation", "appointment", "healing", "completed"];

export const JOURNEY_STAGE_LABEL: Record<JourneyEntryType, string> = {
  idea: "Idea",
  consultation: "Consult",
  appointment: "Session",
  healing: "Healing",
  milestone: "Milestone",
  completed: "Done",
};

/** Furthest stage reached (index into JOURNEY_STAGES, -1 if none) + 0..1 progress. */
export function journeyProgress(entries: { entryType: JourneyEntryType }[]): { stageIndex: number; pct: number } {
  let max = -1;
  for (const e of entries) {
    const i = JOURNEY_STAGES.indexOf(e.entryType);
    if (i > max) max = i;
  }
  return { stageIndex: max, pct: max < 0 ? 0 : (max + 1) / JOURNEY_STAGES.length };
}

// ---- Per-booking journey (each appointment tracked end to end) -------------
export type MilestoneKind = "post_session" | "week" | "month";

export const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  post_session: "Post-session",
  week: "1 Week",
  month: "1 Month",
};

export interface JourneyMilestone {
  kind: MilestoneKind;
  dueAt: string;
  photoPath: string | null;
  completed: boolean;
  /** due (date reached) and not yet completed — needs the user's attention. */
  due: boolean;
}

export interface BookingJourney {
  appointmentId: AppointmentId;
  artistId: ArtistId | null;
  artistName: string;
  scheduledStart: string;
  status: string;
  hasReview: boolean;
  /** Furthest ticked checkpoint, index into JOURNEY_STAGES (0..4). */
  stageIndex: number;
  milestones: JourneyMilestone[];
  /** How many milestones are due and unaddressed (drives the badge). */
  dueCount: number;
}
