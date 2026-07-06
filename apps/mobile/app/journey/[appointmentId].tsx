// Route: /journey/[appointmentId] — one booking's journey + milestone uploads.
import { useLocalSearchParams } from "expo-router";

import { JourneyDetailScreen } from "../../src/features/journey/JourneyDetailScreen";

export default function JourneyDetailRoute() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  return <JourneyDetailScreen appointmentId={appointmentId ?? ""} />;
}
