// Route: /booking-request?artistId=… | ?studioSlug=… — mobile booking stepper.
// Optional refPath preloads a saved design as a reference photo.
import { useLocalSearchParams } from "expo-router";
import { Text,View } from "react-native";

import { BookingRequestFlow } from "../../src/features/booking/BookingRequestFlow";

export default function BookingRequestModal() {
  const { artistId, studioSlug, title, refPath } = useLocalSearchParams<{ artistId?: string; studioSlug?: string; title?: string; refPath?: string }>();
  if (!artistId && !studioSlug) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text>Missing artist or studio.</Text></View>;
  }
  return <BookingRequestFlow artistId={artistId} studioSlug={studioSlug} presetTitle={title} presetRefPath={refPath} />;
}
