import type { AppointmentId, ArtistId, IdeaId, JourneyEntryId, ProfileId } from "../ids";
import type { JourneyEntryType } from "../enums";

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
