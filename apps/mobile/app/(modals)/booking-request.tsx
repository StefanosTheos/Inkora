// Route: /booking-request?artistId=…&title=… — mobile booking stepper.
import { useLocalSearchParams } from "expo-router";
import { View, Text } from "react-native";
import { BookingRequestFlow } from "../../src/features/booking/BookingRequestFlow";

export default function BookingRequestModal() {
  const { artistId, title } = useLocalSearchParams<{ artistId?: string; title?: string }>();
  if (!artistId) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text>Missing artist.</Text></View>;
  }
  return <BookingRequestFlow artistId={artistId} presetTitle={title} />;
}
