// Route: /artist/[handle] — artist profile (handle = artist id).
import { useLocalSearchParams } from "expo-router";
import { ArtistProfileScreen } from "../../src/features/artist/ArtistProfileScreen";

export default function ArtistRoute() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return <ArtistProfileScreen id={handle ?? ""} />;
}
