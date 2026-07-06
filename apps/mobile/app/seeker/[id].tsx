// Route: /seeker/[id] — public profile shown when tapping a reviewer.
// Optional ?reviewId features that review's tattoo journey at the top.
import { useLocalSearchParams } from "expo-router";

import { SeekerProfileScreen } from "../../src/features/seeker/SeekerProfileScreen";

export default function SeekerProfileRoute() {
  const { id, reviewId } = useLocalSearchParams<{ id: string; reviewId?: string }>();
  return <SeekerProfileScreen id={id ?? ""} featuredReviewId={reviewId} />;
}
