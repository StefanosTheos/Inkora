// Route: /seeker/[id] — public profile shown when tapping a reviewer.
// Optional ?reviewId features that review's tattoo journey at the top.
// Optional ?appointmentId features a specific session (used from the artist's
// completed-appointment detail), showing that session's journey even if the
// review/photos are still pending.
import { useLocalSearchParams } from "expo-router";

import { SeekerProfileScreen } from "../../src/features/seeker/SeekerProfileScreen";

export default function SeekerProfileRoute() {
  const { id, reviewId, appointmentId } = useLocalSearchParams<{ id: string; reviewId?: string; appointmentId?: string }>();
  return <SeekerProfileScreen id={id ?? ""} featuredReviewId={reviewId} appointmentId={appointmentId} />;
}
