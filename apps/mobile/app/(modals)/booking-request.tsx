// Route: /booking-request?artistId=… | ?studioSlug=… — mobile booking stepper.
import { useLocalSearchParams } from "expo-router";
import { Text,View } from "react-native";

import { BookingRequestFlow } from "../../src/features/booking/BookingRequestFlow";

export default function BookingRequestModal() {
  const { artistId, studioSlug, title } = useLocalSearchParams<{ artistId?: string; studioSlug?: string; title?: string }>();
  if (!artistId && !studioSlug) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text>Missing artist or studio.</Text></View>;
  }
  return <BookingRequestFlow artistId={artistId} studioSlug={studioSlug} presetTitle={title} />;
}
