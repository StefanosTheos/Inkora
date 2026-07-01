// Route: /studios/[slug] — studio profile (secondary web adaptation).
import { StudioProfileView } from "../../../../features/studio/StudioProfileView";

export default function StudioPage({ params }: { params: { slug: string } }) {
  return <StudioProfileView slug={params.slug} />;
}
