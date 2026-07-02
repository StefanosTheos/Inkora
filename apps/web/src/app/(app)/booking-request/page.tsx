// Route: /booking-request?artistId=… | ?studioSlug=… — booking form (web, secondary).
import { RequestForm } from "../../../features/booking/RequestForm";

export default function BookingRequestPage({ searchParams }: { searchParams: { artistId?: string; studioSlug?: string } }) {
  if (!searchParams.artistId && !searchParams.studioSlug) {
    return <main className="p-8 text-zinc-500">Missing artist or studio.</main>;
  }
  return <RequestForm artistId={searchParams.artistId} studioSlug={searchParams.studioSlug} />;
}
