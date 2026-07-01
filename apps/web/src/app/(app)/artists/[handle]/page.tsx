// Route: /artists/[handle] — artist profile (secondary web adaptation).
import { ArtistProfileView } from "../../../../features/artist/ArtistProfileView";

export default function ArtistPage({ params }: { params: { handle: string } }) {
  return <ArtistProfileView id={params.handle} />;
}
