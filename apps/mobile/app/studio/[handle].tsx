// Route: /studio/[handle] — studio profile (handle = studio slug).
import { useLocalSearchParams } from "expo-router";
import { StudioProfileScreen } from "../../src/features/studio/StudioProfileScreen";

export default function StudioRoute() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return <StudioProfileScreen slug={handle ?? ""} />;
}
