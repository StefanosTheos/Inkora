// Route: /studio-applications — the studio owner's inbox of pending artist
// applications (accept / decline; auto-rejects after 5 days).
import { StudioApplicationsScreen } from "../src/features/studio/StudioApplicationsScreen";

export default function StudioApplicationsRoute() {
  return <StudioApplicationsScreen />;
}
