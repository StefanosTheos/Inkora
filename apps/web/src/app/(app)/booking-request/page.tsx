// Route: /booking-request?artistId=… — booking request form (web, secondary).
import { RequestForm } from "../../../features/booking/RequestForm";

export default function BookingRequestPage({ searchParams }: { searchParams: { artistId?: string } }) {
  if (!searchParams.artistId) {
    return <main className="p-8 text-zinc-500">Missing artist.</main>;
  }
  return <RequestForm artistId={searchParams.artistId} />;
}
