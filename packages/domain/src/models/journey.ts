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
