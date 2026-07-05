// Route: /seeker/[id] — public profile shown when tapping a reviewer.
import { useLocalSearchParams } from "expo-router";

import { SeekerProfileScreen } from "../../src/features/seeker/SeekerProfileScreen";

export default function SeekerProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SeekerProfileScreen id={id ?? ""} />;
}
