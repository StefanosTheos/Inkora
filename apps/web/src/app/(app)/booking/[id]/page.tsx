// Route: /booking/[id] — request or appointment detail (web, secondary).
import { BookingDetail } from "../../../../features/booking/BookingDetail";

export default function BookingDetailPage({ params }: { params: { id: string } }) {
  return <BookingDetail id={params.id} />;
}
