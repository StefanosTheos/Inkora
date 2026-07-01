// Route: /booking/[id] — unified detail for a request OR an appointment.
import { useLocalSearchParams } from "expo-router";
import { BookingDetailScreen } from "../../src/features/booking/BookingDetailScreen";

export default function BookingDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingDetailScreen id={id ?? ""} />;
}
